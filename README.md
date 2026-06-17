# 📡 AirPulse: Open-Source Contactless Vital Signs & Passive Safety Monitor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8.svg?style=flat&logo=go)](https://golang.org)
[![Python Version](https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=flat&logo=python)](https://www.python.org)
[![Platform Support](https://img.shields.io/badge/Platform-Docker%20%7C%20Windows%20%7C%20Linux-brightgreen.svg)](#)
[![WiFi CSI](https://img.shields.io/badge/Hardware-ESP32--S3-orange.svg?style=flat)](https://www.espressif.com/)

> **A privacy-first, contactless vital signs and fall monitoring system using standard WiFi signals.**
> Helping caregivers look after their loved ones with dignity, particularly in high-risk, private zones (like bathrooms or showers) without cameras or uncomfortable wearable sensors.

---

## ⚡ 1. Platform Capabilities & Caregiver Value

AirPulse translates Channel State Information (CSI) multipath wireless reflections into granular physiological and spatial intelligence:

| Capability | Advanced Algorithmic Method | Range / Sensitivity | Typical Latency | Caregiver & Privacy Value |
| :--- | :--- | :--- | :--- | :--- |
| **Breathing Rate** | Bandpass filtering (0.1–0.5 Hz) + **FastICA** wave separation | 6–30 BPM range, sub-millimeter chest resolution | < 2.5 seconds | **No Chest Straps**: Zero-contact respiration logs during sleep. |
| **Heart Rate** | **Adaptive NLMS filter** + 0.8–2.5 Hz BCG recoil tracking | 45–140 BPM tracking range | < 4.0 seconds | **No Smartwatches**: Passive pulse and cardiac monitoring. |
| **Fall Detection** | STFT Doppler velocity surge + post-impact immobility consensus | 2-second dual-node voting window | < 1.0 second | **Bathroom Safety**: Captures falls through curtains and shower doors. |
| **Multi-Person Tracking** | 2D Kalman filter + Hungarian Coordinate mapping | Tracks up to 4 people simultaneously | < 1.0 second (tracking) | **Dignified Monitoring**: Knows room coordinates without cameras. |
| **Gait Identification** | 128D Normalized Stride Vector + Cosine similarity profiles | Passthrough doorways (< 2 strides) | < 1.5 seconds | **Care Customization**: Tailors algorithms based on who is walking. |
| **Anti-Tailgating** | Stride matrix rank decomposition on walk pathways | Rank $\ge 2$ triggers corridor warning | < 1.0 second | **Access Security**: Identifies multi-person entry in hallways. |

---

## 📡 2. Privacy-First System Architecture

The platform coordinates high-speed hardware data pipelines and translates them into secure caregiver panels:

```
ESP32 Node A ──(UDP:8090)──┐
ESP32 Node B ──(UDP:8094)──┼─► [ Go Ingester Daemon ] ──(TCP:8091/94/95)──► [ FastAPI Server ] ──(WS:8000)──► [ Next.js Nurse Dashboard ]
ESP32 Node C ──(UDP:8095)──┘         (Phase Detrending)                  (FastICA / Kalman / Alerts)
```

The system comprises three primary architectural layers:
1. **Edge Ingestion Daemon (`ingester/`)**: A high-performance Go receiver that binds to UDP interfaces to ingest high-frequency CSI packets (150–200 Hz). Uses pre-allocated byte arrays and Go `sync.Pool` structures to achieve zero garbage collection overhead. CFO/SFO clock drifts are removed linearly at the edge.
2. **FastAPI Backend Server (`server/`)**: Coordinates raw TCP data sockets, initializes the SQLite database engine (`airpulse.db`), executes the mathematical processing plugins (FastICA, Kalman coordinates, Stride biometrics), and manages the Twilio voice/SMS alert dispatch gateways.
3. **Next.js Caregiver Frontend (`frontend/`)**: A premium dashboard showing occupant coordinate overlays on custom rooms, live wave oscilloscopes, database logs, and real-time Toast alarms.

---

## 🤝 3. Community Open-Core Philosophy

We believe in making contactless safety and privacy accessible. The repository is structured to empower developers and researchers:
* **Passive Safety Focus**: Encouraging camera-free monitoring solutions for bathrooms and bedrooms.
* **Open-Core Drivers**: Providing baseline single-person vital sign processing and CSI phase extraction for everyone.
* **Extensible Plugins**: Developers can customize tracking models in [rf_space/](file:///c:/Users/ANKIT%20BHARDWAJ/Desktop/omnisense-csi/server/plugins/rf_space) and stride biometrics in [gait_secure/](file:///c:/Users/ANKIT%20BHARDWAJ/Desktop/omnisense-csi/server/plugins/gait_secure).

---

## 🚀 4. Quick Start: Mock Execution

You can run and test the entire multi-node coordination pipeline, WebSocket broadcasts, and frontend console on your local laptop without physical ESP32 development boards:

### Step 1: Clone and Build with Docker Compose
```bash
# Clone the repository
git clone https://github.com/Ankit6149/airpulse-wifi-sensing.git
cd airpulse-wifi-sensing

# Start the services (FastAPI, Go Ingester, and Next.js frontend)
docker compose up --build -d
```

### Step 2: Stream Simulated CSI Packets
In a new terminal window, start the multi-node offline simulator to pump mock physiological waves:
```bash
python simulate_csi.py
```
* **Web Caregiver Dashboard**: [http://localhost:3000](http://localhost:3000)
* **Interactive REST API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠️ 5. Local Developer Environment Setup

If you prefer to run the components natively on your system outside Docker:

### A. Go Ingester Setup
Ensure Go 1.21+ is installed.
```bash
cd ingester
go build -o ../bin/ingester.exe .
cd ..

# Run (Listens on UDP 8090 and forwards detrended NDJSON to Python TCP 8091)
./bin/ingester.exe -bind 0.0.0.0:8090 -dest 127.0.0.1:8091
```

### B. Python FastAPI Backend Setup
Requires Python 3.10+.
```bash
cd server
python -m venv .venv

# Activate Virtual Environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
python main.py
```
*(The FastAPI server will start on port `8000` and open TCP ingress ports `8091`, `8094`, and `8095` to receive multi-node ingester data).*

### C. Next.js Frontend Setup
Requires Node.js 18+.
```bash
cd frontend
npm install
npm run dev
```
*(Next.js dev server will bind to port `3000` and connect back to the backend WebSocket stream).*

### D. React Native Mobile App Setup
Requires Node.js 18+ and Expo.
```bash
cd mobile
npm install
npm run start
```
*(Start Expo Go on your mobile device to scan the QR code and test the dark-themed caregiver console in real-time).*

---


## 🧪 6. Automated Verification Tests

To verify that the mathematical DSP logic, SQLite database queries, and alerting thresholds compile and process correctly:
```bash
# Activate virtual environment, then execute:
python server/tests.py
```

---

## 🔌 7. REST & WebSocket API Specification

### REST API Endpoints (Port 8000)

#### `POST /api/configure-room`
Updates the coordinate grid size of a sensor node.
```json
{
  "node_id": "Node_A",
  "room_width": 6.0,
  "room_height": 5.0
}
```

#### `POST /api/register-zone`
Calibrates and registers a zone covariance fingerprint for presence checks.
```json
{
  "node_id": "Node_A",
  "zone_id": "ZONE_BED"
}
```

#### `POST /api/enroll-user`
Enrolls a user's walking stride pattern into the biometrics registry.
```json
{
  "node_id": "Node_A",
  "user_token": "ANKIT"
}
```

#### `GET /api/db/vitals?limit=50`
Retrieves historical respiration and heart rate logs from `airpulse.db`.

---

### WebSocket Broadcast Protocol (`/ws/telemetry`)
Emits structural JSON updates at 10 Hz containing coordinates, separated vitals, and biometric statuses:

```json
{
  "type": "TELEMETRY",
  "node_id": "Node_A",
  "timestamp": 1686738923500,
  "data": {
    "vitals": {
      "respiration_bpm": 16.5,
      "heart_rate_bpm": 74.0,
      "motion_score": 0.045,
      "confidence": 0.94,
      "multi_person_vitals": [
        {
          "person_id": 1,
          "respiration_bpm": 16.5,
          "heart_rate_bpm": 74.0
        }
      ]
    },
    "occupancy": {
      "occupant_count": 1,
      "active_zone_id": "ZONE_BED",
      "trackers": {
        "1": { "x": 2.4, "y": 1.8 }
      }
    },
    "biometrics": {
      "user_token": "ANKIT",
      "similarity_score": 0.965,
      "access_authorized": true,
      "tailgate_detected": false
    }
  }
}
```

---

## 📈 8. Advanced Signal Calibration

### CFO/SFO Clock Detrending
The clock mismatch between the transmitter and receiver causes a linear phase drift over OFDM subcarrier indexes. We detrend the phase using:
$$\phi'_{i} = \phi_{i} - \frac{\phi_{N} - \phi_{1}}{N} \cdot i$$
This isolates physical chest wall phase shifts.

### Conjugate Multi-Antenna Conjugation
On B2B nodes with multi-antenna receivers (e.g. 2x2 or 3x3), the SFO phase noise affects all antennas equally. By calculating the conjugate multiplication of antenna matrices:
$$S_{\text{conj}} = H_{\text{ant1}} \cdot H_{\text{ant2}}^{*}$$
The receiver clock offsets cancel out mathematically, resulting in a detrended phase signal without linear regression.

---

## 📄 9. License & Community Contributions

AirPulse is licensed under the [MIT License](https://opensource.org/licenses/MIT). We welcome contributions from developers, signal processing experts, and caregivers to make wireless health monitoring more accurate, reliable, and accessible for homes and care facilities worldwide.
