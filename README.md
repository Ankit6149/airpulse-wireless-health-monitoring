# ⚡ AirPulse: Contactless Wireless Vital Signs Monitoring & Physiological Analytics

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.19+-00ADD8.svg?style=flat&logo=go)](https://golang.org)
[![Python Version](https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=flat&logo=python)](https://www.python.org)
[![Platform Support](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-brightgreen.svg)](#)
[![WiFi CSI](https://img.shields.io/badge/Hardware-ESP32--S3-orange.svg?style=flat)](https://www.espressif.com/)

> **Turn standard WiFi signals into medical-grade, contactless physiological sensors.**
> No cameras. No wearables. 100% private. Bypasses the limitations of smartwatches and optical monitors.

---

## 🌐 1. The Vision: Invisible Health Monitoring

Traditional health monitoring forces caregivers, hospitals, and families to choose between:
1. **Privacy Intrusion**: Cameras are highly invasive and illegal in private zones like bathrooms.
2. **User Fatigue & Compliance**: Smartwatches and wristbands require constant recharging, sanitization, and manual compliance (seniors frequently forget or refuse to wear them).
3. **Biological Limitations**: Optical skin sensors (PPG) suffer from physiological biases due to skin pigmentation and peripheral circulation.

**AirPulse** eliminates these trade-offs entirely by decoding **Channel State Information (CSI)**—the microscopic multipath reflections created when standard WiFi radio waves bounce off a human body. 

```
                                ┌───────────────────────────┐
                                │   Active WiFi TX Beacon   │
                                └─────────────┬─────────────┘
                                              │
                                              ▼  (Multipath WiFi Waves)
                                        [Human Torso]
                                       (Chest recoil & expansion)
                                              │
                                              ▼  (Modulated Reflections)
                                ┌───────────────────────────┐
                                │   Passive ESP32-S3 RX     │
                                └─────────────┬─────────────┘
                                              │ (Raw I/Q CSI Samples)
                                              ▼
                                ┌───────────────────────────┐
                                │    AirPulse Core DSP      │
                                │  * CFO/SFO Phase Detrend  │
                                │  * Bandpass Filters       │
                                │  * Spectral Centroids     │
                                └───────────────────────────┘
```

When a person breathes, their chest wall expands and contracts by **5 to 12 mm**. With every heartbeat, blood ejection causes a microscopic mechanical recoil of their torso by **0.2 to 0.5 mm** (Ballistocardiography). These physical motions distort WiFi waves, changing the phase of subcarrier frequencies. AirPulse isolates and extracts these phase shifts, returning high-accuracy vital signs wirelessly without any physical contact.

---

## 🏆 2. Why AirPulse is Superior to Wearables (The PPG Problem)

Wrist-worn devices (smartwatches, Fitbits, medical patches) use **PPG (Photoplethysmography)**, which shines light into the skin to measure capillary volume changes. PPG suffers from physical limitations that AirPulse's core body phase-sensing structurally solves:

| Biological / Technical Challenge | Wrist Wearables (PPG Smartwatches / Patches) | AirPulse (Contactless RF Phase Sensing) | The AirPulse Advantage |
| :--- | :--- | :--- | :--- |
| **Respiration Tracking** | **Indirect RSA Proxy**: Cannot measure chest expansion. Estimates breathing rate indirectly from heart rate fluctuations (RSA). Highly inaccurate during irregular rhythms. | **Direct Physical Tracking**: Measures actual chest wall expansion (5–12mm movement) directly via subcarrier RF phase shifts. | **Direct & High Accuracy**: Measures the actual physical event, not a mathematical proxy. |
| **Skin Tone / Melanin Bias** | **Green Light Absorption**: Melanin absorbs green light. Multiple clinical studies show PPG sensors have up to 15% higher error rates on darker skin tones. | **Material Density Reflection**: Radio waves reflect off the physical boundary of the chest wall. Completely independent of skin tone. | **Unbiased & Fair**: Consistent accuracy across all skin pigmentations. |
| **Peripheral Perfusion (Blood Flow)** | **Fails in Cold/Low BP**: Wrists are extremities. If the patient has cold hands or low blood pressure, wrist capillary blood flow drops, causing PPG to fail. | **Core Body Measurement**: Measures the mechanical recoil of the heart (BCG) on the torso, which remains strong regardless of extremity blood flow. | **Resilient in Crisis**: Continues tracking vital signs even during cardiovascular shock. |
| **User Compliance & Hygiene** | **Low Compliance**: Seniors forget to wear or charge devices. Adhesive patches cause skin infections in hospitals and require regular sanitization. | **100% Passive**: Zero contact, zero charging, zero action required by the patient. Works continuously in the background. | **Absolute Compliance**: Passively covers 100% of room presence. |
| **Privacy Zone Coverage (Bathrooms)** | **Fails**: Sensors are often removed for bathing or sleeping. Cameras are strictly illegal. | **Full Coverage**: RF signals safely penetrate glass doors and shower curtains. | **Bathroom Fall Monitoring**: Protects the #1 zone where senior falls and emergencies happen. |

---

## 🔒 3. AirPulse Enterprise (The Commercial Platform)

While this repository provides **AirPulse Core** (the open-source foundation), the commercial **AirPulse Enterprise** version introduces advanced multi-person tracking and safety features for hospitals, smart homes, and senior care facilities:

### 👥 Multi-Person Tracking (FastICA Waveform Separation)
Raw WiFi signals in a shared room mix reflections from multiple people. The Enterprise version uses **FastICA (Independent Component Analysis)** to separate mixed wave reflections into distinct source signals. It feeds these separated waves into a **2D Kalman Filter** combined with a **Hungarian Coordinate Mapping** algorithm to track the breathing, heart rate, and movement paths of up to **4 distinct occupants** simultaneously in real-time.

### 🚶 GaitSecure (Contactless Gait Biometrics)
Enterprise nodes extract the micro-Doppler chest and stride reflections of walking occupants. By computing a **128-Dimensional Normalized Stride Vector (NSV)**, the system profiles stride frequency, torso bobbing, and footfall deceleration. This allows the system to:
* Verify occupant identity as they walk through a doorway.
* Detect early indicators of mobility degradation or neurological changes.
* Prevent tailgating in secure B2B entry zones.

### 🚨 Cardiac Anomaly Alerting State Machine
Includes a resilient, 3-stage **Sudden Cardiac Arrest (SCA)** and Fall state machine:
1. **Stage 1 (Anomaly Detection)**: Detects a sudden fall signature or high-frequency impact.
2. **Stage 2 (Vitals Verification)**: Immediately narrows DSP window filters to verify breathing and pulse. If apnea (stopped breathing) or asystole (stopped pulse) is confirmed for 15 seconds:
3. **Stage 3 (Fail-Safe Cloud Dispatch)**: Bypasses silent modes via **iOS/Android Critical Alerts** and triggers automated **Twilio Voice Call and SMS dispatch** to caregivers. Unlike push notifications, cellular calls operate over dedicated carrier lines, ensuring sleep disruptions for critical alerts.

### 🏢 Centralized B2B Fleet Management
* **Central Nurse Grid**: Responsive web and tablet interface displaying active patient room grids, real-time wave overlays, confidence intervals, and immediate emergency alerts.
* **Database Connectors**: TimescaleDB and Redis adapters to log months of spatial and physiological telemetry for diagnostic trend forecasting.

---

## 🔧 4. Open-Core Codebase Structure

This public repository (**AirPulse Core**) is the developer foundation. It provides the ingestion drivers, simulated client, and single-person vital signs DSP engine:

* **Go Ingester (`ingester/`)**: A high-performance Go daemon that binds to UDP port `8090` to receive binary CSI packets from ESP32 nodes, applies linear phase detrending, and forwards NDJSON over TCP port `8091`.
* **FastAPI Server (`server/`)**:
  - `main.py`: Coordinates the TCP receiver, processes frames at 10 Hz, saves vitals logs to SQLite, and hosts WebSockets on `ws://localhost:8000/ws/telemetry`.
  - `database.py`: Interfaces with a local SQLite database (`airpulse_core.db`) to log and retrieve historical vitals data.
  - `plugins/wifi_pulse/vitals.py`: sanitizes phase offsets, isolates signals using cached Butterworth filters, and applies Spectral Centroid interpolation blended with Zero-Crossings for sub-BPM precision.
* **CSI Simulator (`simulate_csi.py`)**: Streams mock UDP CSI packets to simulate physical nodes for offline testing.

```
airpulse-core-public/
├── ingester/               # Go source code for the UDP-to-TCP packet handler
├── bin/                    # Pre-compiled ingester binaries (Windows, Linux, macOS)
├── server/                 # Python FastAPI backend
│   ├── plugins/
│   │   └── wifi_pulse/     # Single-person vital signs extraction filter
│   ├── database.py         # SQLite logging interface
│   └── main.py             # Server runner & WebSocket broadcaster
├── simulate_csi.py         # Offline CSI packet generator
├── LICENSE                 # MIT License file
├── llms.txt                # Context file for LLM search agents
├── robots.md               # Search index description for AI scrapers
└── robots.txt              # Standard web crawling policies
```

---

## ⚙️ 5. Technical Pipeline: How AirPulse Core Works

The core signal processing pipeline is located in [vitals.py](file:///c:/Users/ANKIT%20BHARDWAJ/Desktop/omnisense-csi/airpulse-core-public/server/plugins/wifi_pulse/vitals.py) and executes the following steps:

### 1. Carrier Frequency Offset (CFO) Phase Detrending
The clock mismatch between the transmitter and receiver causes a linear phase drift over the subcarriers. We detrend the phase using:
$$\phi'_{i} = \phi_{i} - \frac{\phi_{N} - \phi_{1}}{N} \cdot i$$
This removes the Carrier Frequency Offset (CFO) and Sampling Frequency Offset (SFO) drift.

### 2. Respiration Extraction (0.1 Hz – 0.5 Hz)
* **Filtering**: Order-5 Butterworth bandpass filter centered around standard human respiration (6 to 30 BPM) applied via zero-phase filtering (`sosfiltfilt`) to prevent time shifts.
* **Peak Blending**: Applies a **Hanning window** to a 4096-point FFT to resolve frequency peaks. The peak frequency is refined by interpolating the **Spectral Centroid** of the three highest bins, and then blended with a **Zero-Crossing** counter to calculate respiration rate with 0.05 BPM accuracy.

### 3. Pulse / Heart Rate Extraction (0.8 Hz – 2.5 Hz)
* **Pre-Denoising**: Uses Welford variance thresholding and motion score indicators to flag physical movement.
* **Filtering**: Order-3 Butterworth bandpass filter centered around standard human heart rates (48 to 150 BPM).
* **Peak Blending**: Blends the Spectral Centroid of the FFT peak with Zero-Crossings.

---

## 🚀 6. Technical Setup & Quick Start

### Prerequisites
* **Hardware**: Any ESP32-S3 development board running CSI extraction firmware, and a standard WiFi router.
* **Software**: Python 3.10+ and Go 1.19+ (to build the ingester).

### Setup Steps

#### Step 1: Clone and Install Python Dependencies
```bash
git clone https://github.com/Ankit6149/airpulse-wireless-health-monitoring.git
cd airpulse-wireless-health-monitoring
pip install fastapi uvicorn numpy scipy pydantic
```

#### Step 2: Start the FastAPI Backend
```bash
python server/main.py
```
The server will start on port `8000` (REST/WS) and wait for the ingester on TCP port `8091`.

#### Step 3: Run the Go Ingester
Run the pre-compiled ingester binary located in the `bin/` directory matching your OS:
```bash
# For Windows
./bin/ingester-windows.exe -bind 0.0.0.0:8090 -dest 127.0.0.1:8091

# For Linux
chmod +x bin/ingester-linux
./bin/ingester-linux -bind 0.0.0.0:8090 -dest 127.0.0.1:8091
```
*(If you want to compile from source, navigate to `/ingester` and run `go build -o ../bin/ingester .`)*

#### Step 4: Stream Mock CSI Data (Testing)
In a new terminal window, start the offline simulator to stream mock CSI packets:
```bash
python simulate_csi.py
```

### 🛰️ Telemetry WebSocket Integration
Open a WebSocket client and connect to `ws://localhost:8000/ws/telemetry`. You will receive normalized physiological telemetry updates at 10 Hz:

```json
{
  "type": "TELEMETRY",
  "node_id": "NODE-CORE",
  "timestamp": 1686738923500,
  "data": {
    "vitals": {
      "respiration_bpm": 16.25,
      "heart_rate_bpm": 72.8,
      "motion_score": 0.012,
      "recent_motion": 0.012,
      "confidence": 0.94,
      "raw_signal": [0.12, 0.15, 0.11, "..."],
      "filtered_signal": [0.02, 0.04, 0.03, "..."]
    }
  }
}
```

To fetch historical logs, query the REST endpoint:
```http
GET http://localhost:8000/api/db/vitals?limit=50
```

---

## 🤖 7. AI Crawling & Search Support

To facilitate AI agents, search engines, and scrapers in understanding and indexing this project:
* Refer to [llms.txt](file:///c:/Users/ANKIT%20BHARDWAJ/Desktop/omnisense-csi/airpulse-core-public/llms.txt) for API specifications and directory paths.
* Refer to [robots.md](file:///c:/Users/ANKIT%20BHARDWAJ/Desktop/omnisense-csi/airpulse-core-public/robots.md) for detailed descriptions of the signal processing code.
* Refer to [robots.txt](file:///c:/Users/ANKIT%20BHARDWAJ/Desktop/omnisense-csi/airpulse-core-public/robots.txt) for crawling permission policies.

---

## 📄 8. License & Contributions

We welcome contributions to the Go ingester and Python DSP filters! Feel free to open issues or submit Pull Requests under the permissive [MIT License](LICENSE).
