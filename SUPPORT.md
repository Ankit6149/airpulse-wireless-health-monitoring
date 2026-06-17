# Support Guide

Welcome to the AirPulse community! If you are having trouble setting up your ESP32-S3 boards, compiling the Rust core, running the FastAPI server, or connecting the mobile app, here is how you can find help.

---

## 🔍 Step 1: Check the Documentation

Before seeking support, please review our detailed guides:
* **Repository Overview**: Read the root [README.md](file:///c:/Users/ANKIT%20BHARDWAJ/Desktop/omnisense-csi/README.md) for network specifications.
* **Rust DSP Core Guide**: Refer to [core/airpulse-core-rust/README.md](file:///c:/Users/ANKIT%20BHARDWAJ/Desktop/omnisense-csi/core/airpulse-core-rust/README.md).
* **Mobile Client Guide**: Refer to [mobile/README.md](file:///c:/Users/ANKIT%20BHARDWAJ/Desktop/omnisense-csi/mobile/README.md).

---

## 💬 Step 2: Open-Source Support Channels

1. **GitHub Issues**: If you find a bug in the code, please search existing issues before opening a new one. Provide system logs, terminal output, and steps to reproduce.
2. **GitHub Discussions**: Use discussions for open questions, feature requests, or sharing your creative physical setup (we love seeing photos of your ESP32 plug configurations!).

---

## 🛠️ Step 3: Troubleshooting Common Maker Errors

* **Windows File Locking (os error 32)**: See the Rust core README for instructions on whitelisting the project folder in Windows Defender.
* **WebSocket Connection Drops**: Ensure your mobile device and backend server are on the **same Wi-Fi network**. Set the Server IP in the mobile app header to your host PC's private IP.
