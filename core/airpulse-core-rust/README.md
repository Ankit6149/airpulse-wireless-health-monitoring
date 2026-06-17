# 🦀 AirPulse Core (Rust Telemetry & DSP Library)

A high-performance, zero-overhead mathematical library for real-time Channel State Information (CSI) vital sign extraction and spatial coordinate tracking. It exports native bindings for mobile platforms using Mozilla's UniFFI.

---

## 📦 Crate Features

### 1. Digital Signal Processing (`dsp.rs`)
* **Butterworth Bandpass Cascade**: Implements Direct Form II Second Order Section (SOS) Biquad filter cascades.
* **Phase Sanitization**: Removes Carrier Frequency Offset (CFO) and Sampling Frequency Offset (SFO) timing drift slopes linearly across subcarriers.
* **Zero-Crossing Frequency Solver**: Evaluates physiological frequency peaks (respiration and heart rate) with high resilience to baseline shifts.

### 2. Spatial Tracking (`tracking.rs`)
* **1D Kalman Smoothers**: Filters high-frequency noise from raw respiration vectors.
* **2D Kalman Coordinate Tracker**: Predicts state velocities and smooths coordinates `(x, y)` to filter location shifts and identify room location zones.

### 3. Native Bindings (`lib.rs` & UDL)
* Uses `uniffi-bindgen` to parse `src/airpulse_core.udl` and generate Swift headers (`airpulse_coreFFI.h`) and Kotlin JNI bridging files.

---

## 🛠️ Local Compilation & Windows Lock Workaround

During Windows local compilation, search indexers or real-time antivirus protection can lock intermediate `.rcgu.o` object files causing:
```
error: could not compile `thiserror-impl` due to 1 previous error (os error 32)
```

### Exclude Workspace from Windows Defender:
1. Open **Windows Security** -> **Virus & threat protection**.
2. Click **Manage settings** under *Virus & threat protection settings*.
3. Click **Add or remove exclusions** under *Exclusions*.
4. Select **Add an exclusion** -> **Folder** -> Select `omnisense-csi`.

### Build Commands:
To build the library check targets:
```bash
# Clean lock files
cargo clean

# Validate compilation
cargo check
```
To compile release static/dynamic libraries:
```bash
cargo build --release
```
The output targets will be generated inside `target/release/`:
* `.a` static archives for Apple architectures.
* `.so` dynamic libraries for JNI Android load rules.
* `.dll` dynamic library for Windows.
