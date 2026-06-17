# Contributing to AirPulse

We are thrilled that you want to help make wireless health tracking and caregiver safety tools better, more accurate, and accessible for everyone! Please take a moment to review these guidelines to make the contribution process smooth and collaborative.

---

## 💡 How You Can Help

1. **Improve the DSP Math**: Optimize our Butterworth filters or introduce faster, more stable heartbeat extraction algorithms.
2. **Add Device Drivers**: Help map CSI formats from other microcontrollers (like standard routers, Raspberry Pi, or other ESP32 builds).
3. **Refine the Mobile App**: Help improve the real-time SVG charting performance, offline processing, or dark-mode layout designs.
4. **Documentation & Guides**: Clarify setup procedures, write tutorials for makers, or translate the project READMEs.

---

## 🚀 Our Pull Request Process

1. **Open an Issue**: Before starting work on major features, open an issue to discuss your approach with the maintainers.
2. **Fork and Branch**: Fork the repository and create your feature branch:
   ```bash
   git checkout -b feat/your-awesome-feature
   ```
3. **Format & Test**:
   * For Python backend code, verify formatting and run tests: `python server/tests.py`.
   * For TypeScript mobile code, verify type-safety: `npx tsc --noEmit` in the `mobile` folder.
   * For Go ingester code, ensure `go fmt` has been run.
4. **Commit Clearly**: Write clear, descriptive commit messages (e.g., `feat: implement median filter fallback in AirPulseCore`).
5. **Submit PR**: Open a Pull Request back to our `main` branch. Provide a clean summary of what your code solves.

---

## 🎨 Code Style Standards

* **Go**: Follow standard `go fmt` styling conventions.
* **Python**: Follow PEP 8 guidelines. Use standard docstrings for complex math functions.
* **TypeScript / TSX**: Ensure clean variable declarations, type safety, and avoid conditional rule-of-hooks violations in React.
