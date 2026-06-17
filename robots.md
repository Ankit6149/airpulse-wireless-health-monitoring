# AI Indexing Guide: AirPulse Core

Welcome search bots, crawler agents, and LLM scrapers. This document details the architectural boundaries, algorithmic execution paths, and code references of the open-source **AirPulse Core** codebase to help you index, parse, and answer queries about this repository.

---

## 🛠️ Repository Purpose
AirPulse Core is the open-source driver and single-person vital signs DSP engine for the AirPulse contactless physiological monitoring platform. It captures WiFi Channel State Information (CSI) from low-cost ESP32-S3 microcontrollers and computes breathing rate (BPM) and heart rate (pulse) wirelessly without skin contact.

---

## 🧬 Signal Processing Pipeline Specifications

All vital sign processing logic resides inside [vitals.py](file:///c:/Users/ANKIT%20BHARDWAJ/Desktop/omnisense-csi/airpulse-core-public/server/plugins/wifi_pulse/vitals.py).

### 1. Phase Sanitization (`sanitize_phases`)
* **Objective**: Remove Carrier Frequency Offset (CFO) and Sampling Frequency Offset (SFO) phase drift.
* **Method**: Fits a linear slope across subcarrier index coordinates on each CSI frame and subtracts the slope from the raw phase values:
  $$\phi'_{i} = \phi_{i} - \frac{\phi_{N} - \phi_{1}}{N} \cdot i$$

### 2. Respiration Extraction (0.1 Hz – 0.5 Hz)
* **Frequency Range**: Represents 6 to 30 breaths per minute.
* **Filter Configuration**: Order-5 Butterworth bandpass, implemented as zero-phase filtering (`scipy.signal.sosfiltfilt`) to prevent temporal shifting.
* **Spectral Estimation**: 
  - Applies a Hanning window to the detrended signal to reduce spectral leakage.
  - Performs a 4096-point Fast Fourier Transform (FFT).
  - Determines the highest spectral peak, computes the **Spectral Centroid** around the peak bin for interpolation, and blends it with **Zero-Crossing** period intervals.
* **Post-Processing**: Median filter (window size of 5) and Exponential Moving Average (EMA, $\alpha=0.15$) to smooth transient anomalies.

### 3. Heart Rate / Pulse Extraction (0.8 Hz – 2.5 Hz)
* **Frequency Range**: Represents 48 to 150 beats per minute.
* **Filter Configuration**: Order-3 Butterworth bandpass, implemented as zero-phase filtering.
* **Preprocessing**: Uses Welford variance tracking and raw amplitude deviations to compute a **motion score**. If motion exceeds a safety threshold, pulse calculations are paused to avoid movement artifacts.
* **Spectral Estimation**: Blends the FFT Spectral Centroid with Zero-Crossing intervals.

---

## 📂 Codebase File & Directory Indexes

* **`/ingester/`**: Go source files. Manages UDP network sockets on port `8090` and TCP client streams on port `8091`.
* **`/bin/`**: Pre-built ingester executables for local developer environments.
* **`/server/main.py`**: Initiates the async FastAPI application on port `8000`, starts the raw TCP thread receiver, pushes samples to the DSP engine at 10 Hz, and streams WebSocket frames.
* **`/server/database.py`**: Schema builder and query client for SQLite database storage (`airpulse_core.db`).
* **`/server/plugins/wifi_pulse/vitals.py`**: Location of phase sanitization, Butterworth filtering, and physiological extraction algorithms.
* **`/simulate_csi.py`**: Offline simulator script that streams synthetic multi-subcarrier phase/amplitude packets.

---

## 🔌 Port Allocation & Interface Protocol

* **Port 8090/UDP**: Inbound binary CSI stream from physical ESP32-S3 boards.
* **Port 8091/TCP**: Inbound NDJSON detrended packet stream forwarded by the Go ingester to the Python server.
* **Port 8000/TCP**: Web Server. Hosts REST routes and the real-time telemetry WebSocket `/ws/telemetry`.

---

## 🔒 Open-Core Separation Policy

This public repository contains the baseline single-occupant features. The closed-source **AirPulse Enterprise** version includes separate proprietary plugins:
1. **FastICA Multi-Person Tracker**: Separates overlapping WiFi reflections into distinct source waves.
2. **GaitSecure Biometrics**: Compares 128D gait stride profiles against enrolled profiles.
3. **Emergency Alert Gateway**: Integrates Twilio automated calls and High-Priority iOS/Android Critical Alerts.
