import sqlite3
import os
import time
import asyncio

DB_PATH = os.path.join(os.path.dirname(__file__), "airpulse_core.db")

def _init_db_sync():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Vitals History Table Only
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vitals_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp REAL,
        node_id TEXT,
        respiration_rate REAL,
        heart_rate REAL,
        status TEXT
    )
    """)
    
    conn.commit()
    conn.close()

async def init_db():
    await asyncio.to_thread(_init_db_sync)
    print(f"[Database] SQLite Core DB initialized at {DB_PATH}")

def _log_vitals_sync(node_id, respiration_rate, heart_rate, status):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO vitals_history (timestamp, node_id, respiration_rate, heart_rate, status) VALUES (?, ?, ?, ?, ?)",
        (time.time(), node_id, respiration_rate, heart_rate, status)
    )
    conn.commit()
    conn.close()

async def log_vitals(node_id: str, respiration_rate: float, heart_rate: float, status: str):
    await asyncio.to_thread(_log_vitals_sync, node_id, respiration_rate, heart_rate, status)

def _fetch_vitals_sync(limit):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT timestamp, node_id, respiration_rate, heart_rate, status FROM vitals_history ORDER BY id DESC LIMIT ?",
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()
    
    return [
        {
            "timestamp": row[0],
            "node_id": row[1],
            "respiration_rate": row[2],
            "heart_rate": row[3],
            "status": row[4]
        }
        for row in rows
    ]

async def fetch_vitals(limit: int = 100):
    return await asyncio.to_thread(_fetch_vitals_sync, limit)
