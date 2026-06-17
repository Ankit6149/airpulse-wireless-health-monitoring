import asyncio
import socket
import struct
import threading
import time
import json
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List

from plugins.wifi_pulse.vitals import VitalsProcessorModule
from plugins.wifi_pulse.config import VitalsConfig
from database import init_db, log_vitals, fetch_vitals

# Shared Vitals Processor Instance
vitals_processor = VitalsProcessorModule(config=VitalsConfig(node_id="NODE-CORE"))
last_db_log_time = 0.0

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database
    await init_db()
    
    # Start the single TCP Ingestion server on port 8091
    asyncio.create_task(start_tcp_ingestion_server(8091))
    print("[Server Startup] TCP ingestion server active on port 8091.")
    yield

app = FastAPI(title="AirPulse Core Backend", lifespan=lifespan)

# Enable CORS for standard local development visualizers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
active_connections: List[WebSocket] = []
active_connections_lock = threading.Lock()

async def broadcast_message(message: dict):
    with active_connections_lock:
        disconnected = []
        for connection in active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            if conn in active_connections:
                active_connections.remove(conn)

async def start_tcp_ingestion_server(port: int):
    server = await asyncio.start_server(handle_tcp_client, "0.0.0.0", port)
    async with server:
        await server.serve_forever()

async def handle_tcp_client(reader, writer):
    global last_db_log_time
    addr = writer.get_extra_info('peername')
    print(f"[TCP Listener] Ingester connected from {addr}")
    
    buffer = ""
    last_process_time = 0.0
    
    try:
        while True:
            data = await reader.read(8192)
            if not data:
                break
            
            buffer += data.decode('utf-8')
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line:
                    continue
                
                try:
                    frame = json.loads(line)
                    node_id = frame.get("node_id", "NODE-CORE")
                    timestamp_us = frame["timestamp_us"]
                    amplitude = np.array(frame["amplitude"])
                    phase = np.array(frame["phase"])
                    
                    # Ingest frame
                    vitals_processor.add_frame(amplitude, phase, timestamp_us)
                    
                    # Process at 10 Hz
                    now = time.time()
                    if (now - last_process_time) >= 0.1:
                        last_process_time = now
                        vitals_res = vitals_processor.process()
                        
                        payload = {
                            "type": "TELEMETRY",
                            "node_id": node_id,
                            "timestamp": int(now * 1000),
                            "data": {
                                "vitals": vitals_res
                            }
                        }
                        
                        # Broadcast live readings to visualizers
                        await broadcast_message(payload)
                        
                        # Log to database every 5.0 seconds
                        if (now - last_db_log_time) >= 5.0:
                            last_db_log_time = now
                            resp_val = vitals_res.get("respiration_bpm", 0.0)
                            hr_val = vitals_res.get("heart_rate_bpm", 0.0)
                            status_val = "NORMAL" if resp_val > 0 else "UNKNOWN"
                            await log_vitals(node_id, resp_val, hr_val, status_val)
                            
                except Exception as e:
                    print(f"[TCP Listener] Frame processing error: {e}")
                    
        print(f"[TCP Listener] Ingester from {addr} disconnected.")
    except Exception as e:
        print(f"[TCP Listener] Connection error: {e}")
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass

@app.get("/api/db/vitals")
async def get_db_vitals(limit: int = 100):
    return await fetch_vitals(limit)

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await websocket.accept()
    with active_connections_lock:
        active_connections.append(websocket)
    print(f"[WebSocket] Client connected from {websocket.client}")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        with active_connections_lock:
            if websocket in active_connections:
                active_connections.remove(websocket)
        print(f"[WebSocket] Client disconnected from {websocket.client}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
