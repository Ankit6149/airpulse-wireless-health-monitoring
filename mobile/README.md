# 📱 AirPulse Caregiver Companion Mobile App

A high-performance mobile dashboard for caregivers built with React Native (Expo) and TypeScript. It displays real-time vitals, scrolling waveforms, indoor tracking coordinates, and historical health anomaly alerts.

---

## ⚡ Key Architectural Features

### 1. Dual-Mode Telemetry Engine
To support rapid local developer testing without requiring complex native toolchain installations, the app implements a **dual-mode engine**:
* **Native Mode**: Leverages `uniffi-bindgen` FFI bindings to call high-performance digital filters directly in compiled Rust.
* **TypeScript Fallback**: Runs equivalent Direct Form II Biquad filters, linear phase sanitization (SFO/CFO detrending), and zero-crossing BPM solvers locally in JS/TS.

### 2. Premium Glassmorphic Styling
The interface mirrors the sleek, dark void layout of the Next.js caregiver web console:
* Card overlays with thin, semi-transparent borders.
* Real-time scrolling waveforms drawn using `react-native-svg` (Indigo for raw CSI, Cyan for respiration) with exhalation fading gradients and dotted grid lines.

---

## 🚀 Quick Start (Expo)

### Step 1: Install Dependencies
Navigate to the mobile directory and install Node modules:
```bash
cd mobile
npm install
```

### Step 2: Start the Development Server
Run the Expo packager:
```bash
npm run start
```
* Use the **Expo Go** app on your physical iOS or Android device to scan the QR code and launch the app instantly.
* Alternatively, run in simulators using `npm run android` or `npm run ios` (requires macOS).

---

## 📡 Connecting to the Live Server

By default, the mobile app looks for the FastAPI telemetry server at `ws://localhost:8000/ws/vitals`. 

If testing on a physical phone:
1. Ensure your phone and the host computer running the backend server are on the **same local Wi-Fi network**.
2. Identify your computer's local IP address (e.g., `192.168.1.15`).
3. Enter the IP address in the **Server Configuration** card at the top of the mobile app and tap **Connect**.

---

## 🛠️ Compiling Native Rust FFI Bindings

When you are ready to compile the native Rust binaries (`.a` static library for iOS and `.so` JNI library for Android):

### 1. Requirements
* Xcode and Command Line Tools (for iOS static builds).
* Android Studio, NDK (Native Development Kit), and CMake (for Android JNI builds).
* Rust compile targets:
  ```bash
  rustup target add aarch64-apple-ios aarch64-linux-android armv7-linux-android i686-linux-android x86_64-linux-android
  ```

### 2. Generate Bindings & Compile
Run the native FFI build toolchain in the Rust core directory:
```bash
cd ../core/airpulse-core-rust/
cargo build --release
```
Copy the compiled dynamic JNI libraries into `mobile/android/app/src/main/jniLibs` and the static archive into Xcode as a framework.
