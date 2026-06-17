# AirPulse Core

AirPulse Core is an open-source, passive vital signs monitoring framework. It streams Channel State Information (CSI) from standard commercial WiFi devices (such as ESP32-S3 microcontrollers) and extracts single-person respiration and heart rates using non-contact RF analysis.

---

## 1. Directory Structure

* **`ingester/`**: Go source code for the raw packet parser and TCP stream forwarder.
* **`bin/`**: Pre-compiled ingester binaries for Windows/Linux/macOS.
* **`server/`**: Python-based FastAPI backend server.
  - `main.py`: Hosts the TCP connection server, parses JSON frames, and broadcasts data via WebSockets.
  - `plugins/wifi_pulse/vitals.py`: DSP engine that sanitizes phase carrier frequencies and extracts vital BPMs.
* **`simulate_csi.py`**: A simulator to test the system without physical hardware.

---

## 2. Quick Start

### Step 1: Start the Python Backend
Ensure Python 3.10+ is installed with the required DSP dependencies:
```bash
pip install fastapi uvicorn numpy scipy pydantic
```
Start the server:
```bash
python server/main.py
```
The server will start on port `8000` and wait for TCP packets.

### Step 2: Start the Go Ingester
The ingester receives UDP packets from raw ESP32 nodes and pipes them over TCP to the Python server. Run the pre-compiled binary:
```bash
# Windows
bin\ingester.exe -bind 0.0.0.0:8090 -dest 127.0.0.1:8091
```

### Step 3: Run the CSI Simulator
To test the setup without physical hardware, run the simulator script. This simulates active UDP packets from physical nodes:
```bash
python simulate_csi.py
```

Open a client dashboard or connect a WebSocket client to `ws://localhost:8000/ws/telemetry` to receive normalized respiration and heart rate logs!

---

## 3. License
AirPulse Core is licensed under the [MIT License](LICENSE).
