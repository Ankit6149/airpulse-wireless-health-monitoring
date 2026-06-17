// mobile/src/native/AirPulseCore.ts
import { NativeModules } from 'react-native';

export interface VitalsResult {
  respiration_rate: number;
  heart_rate: number;
  confidence: number;
  anomaly_detected: boolean;
}

export interface PositionResult {
  x: number;
  y: number;
  velocity_x: number;
  velocity_y: number;
  current_zone: string;
}

// Biquad Filter implementation
class Biquad {
  private b: [number, number, number];
  private a: [number, number, number];
  private w: [number, number];

  constructor(b: [number, number, number], a: [number, number, number]) {
    this.b = b;
    this.a = a;
    this.w = [0.0, 0.0];
  }

  filter(x: number): number {
    const w0 = x - this.a[1] * this.w[0] - this.a[2] * this.w[1];
    const y = this.b[0] * w0 + this.b[1] * this.w[0] + this.b[2] * this.w[1];
    this.w[1] = this.w[0];
    this.w[0] = w0;
    return y;
  }
}

// Cascaded Second Order Sections (SOS) Filter
class SosFilter {
  private biquads: Biquad[];

  constructor(sections: Array<{ b: [number, number, number]; a: [number, number, number] }>) {
    this.biquads = sections.map(sec => new Biquad(sec.b, sec.a));
  }

  filter(x: number): number {
    let out = x;
    for (const biquad of this.biquads) {
      out = biquad.filter(out);
    }
    return out;
  }

  filterVector(data: number[]): number[] {
    return data.map(x => this.filter(x));
  }
}

// 2D Kalman Filter for positioning
class KalmanFilter2D {
  x: number = 0;
  y: number = 0;
  vx: number = 0;
  vy: number = 0;
  p: number[][] = [
    [1.0, 0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0, 0.0],
    [0.0, 0.0, 5.0, 0.0],
    [0.0, 0.0, 0.0, 5.0],
  ];
  q: number;
  r: number;

  constructor(q: number = 0.05, r: number = 0.5) {
    this.q = q;
    this.r = r;
  }

  update(zx: number, zy: number, dt: number) {
    // 1. Predict state
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 2. Predict covariance
    const pNext = this.p.map(row => [...row]);
    pNext[0][0] = this.p[0][0] + dt * (this.p[2][0] + this.p[0][2] + dt * this.p[2][2]) + this.q;
    pNext[0][1] = this.p[0][1] + dt * (this.p[2][1] + this.p[0][3] + dt * this.p[2][3]);
    pNext[0][2] = this.p[0][2] + dt * this.p[2][2];
    pNext[0][3] = this.p[0][3] + dt * this.p[2][3];

    pNext[1][0] = this.p[1][0] + dt * (this.p[3][0] + this.p[1][2] + dt * this.p[3][2]);
    pNext[1][1] = this.p[1][1] + dt * (this.p[3][1] + this.p[1][3] + dt * this.p[3][3]) + this.q;
    pNext[1][2] = this.p[1][2] + dt * this.p[3][2];
    pNext[1][3] = this.p[1][3] + dt * this.p[3][3];

    pNext[2][0] = this.p[2][0] + dt * this.p[2][2];
    pNext[2][1] = this.p[2][1] + dt * this.p[2][3];
    pNext[2][2] = this.p[2][2] + this.q * 0.1;

    pNext[3][0] = this.p[3][0] + dt * this.p[3][2];
    pNext[3][1] = this.p[3][1] + dt * this.p[3][3];
    pNext[3][3] = this.p[3][3] + this.q * 0.1;

    this.p = pNext;

    // 3. Measurement Update
    const s00 = this.p[0][0] + this.r;
    const s01 = this.p[0][1];
    const s10 = this.p[1][0];
    const s11 = this.p[1][1] + this.r;

    const det = s00 * s11 - s01 * s10;
    if (Math.abs(det) > 1e-9) {
      const invS00 = s11 / det;
      const invS01 = -s01 / det;
      const invS10 = -s10 / det;
      const invS11 = s00 / det;

      const k = Array.from({ length: 4 }, () => [0, 0]);
      for (let r = 0; r < 4; r++) {
        k[r][0] = this.p[r][0] * invS00 + this.p[r][1] * invS10;
        k[r][1] = this.p[r][0] * invS01 + this.p[r][1] * invS11;
      }

      const dyX = zx - this.x;
      const dyY = zy - this.y;

      this.x += k[0][0] * dyX + k[0][1] * dyY;
      this.y += k[1][0] * dyX + k[1][1] * dyY;
      this.vx += k[2][0] * dyX + k[2][1] * dyY;
      this.vy += k[3][0] * dyX + k[3][1] * dyY;

      const pUpdated = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const kh0 = k[r][0] * this.p[0][c];
          const kh1 = k[r][1] * this.p[1][c];
          pUpdated[r][c] = this.p[r][c] - (kh0 + kh1);
        }
      }
      this.p = pUpdated;
    }
  }
}

// Local cache for TypeScript Fallback filters
let localRespirationFilter: SosFilter | null = null;
let localHeartFilter: SosFilter | null = null;
let localTracker: KalmanFilter2D | null = null;

function getRespirationFilter(): SosFilter {
  if (!localRespirationFilter) {
    // 0.1Hz - 0.5Hz bandpass coefficients, fs=10Hz
    localRespirationFilter = new SosFilter([
      { b: [0.0003, 0.0006, 0.0003], a: [1.0, -1.8227, 0.8372] },
      { b: [1.0, 2.0, 1.0], a: [1.0, -1.7458, 0.7716] },
    ]);
  }
  return localRespirationFilter;
}

function getHeartFilter(): SosFilter {
  if (!localHeartFilter) {
    // 0.8Hz - 2.0Hz bandpass coefficients, fs=10Hz
    localHeartFilter = new SosFilter([
      { b: [0.0055, 0.0111, 0.0055], a: [1.0, -1.3533, 0.6125] },
      { b: [1.0, 1.0, 0.0], a: [1.0, -0.6389, 0.0] },
    ]);
  }
  return localHeartFilter;
}

function getTracker(): KalmanFilter2D {
  if (!localTracker) {
    localTracker = new KalmanFilter2D(0.05, 0.5);
  }
  return localTracker;
}

// SFO & CFO Linear Phase Sanitization
function sanitizePhases(phases: number[]): number[] {
  const n = phases.length;
  if (n < 2) return [...phases];
  const detrended = new Array(n).fill(0);
  const alpha = (phases[n - 1] - phases[0]) / (n - 1);
  for (let k = 0; k < n; k++) {
    detrended[k] = phases[k] - alpha * k;
  }
  const sum = detrended.reduce((a, b) => a + b, 0);
  const beta = sum / n;
  for (let k = 0; k < n; k++) {
    detrended[k] -= beta;
  }
  return detrended;
}

// Zero-crossing BPM Estimation
function zeroCrossingBpm(signal: number[], fs: number, lowF: number, highF: number): number {
  const n = signal.length;
  if (n < 2) return 0.0;
  const sum = signal.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const sig = signal.map(x => x - mean);

  const crossings: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const signCurr = sig[i] >= 0.0 ? 1.0 : -1.0;
    const signNext = sig[i + 1] >= 0.0 ? 1.0 : -1.0;
    if (signCurr !== signNext) {
      crossings.push(i);
    }
  }

  if (crossings.length < 2) return 0.0;

  const tStart = crossings[0] / fs;
  const tEnd = crossings[crossings.length - 1] / fs;
  const duration = tEnd - tStart;
  if (duration <= 0.0) return 0.0;

  const freq = (crossings.length - 1) / (2.0 * duration);
  const bpm = freq * 60.0;
  const minBpm = lowF * 60.0;
  const maxBpm = highF * 60.0;

  if (bpm < minBpm) return minBpm;
  if (bpm > maxBpm) return maxBpm;
  return bpm;
}

// Check if native Rust module is available
const isNativeAvailable = !!(NativeModules && NativeModules.AirPulseCore);

export const AirPulseCore = {
  processCsiFrame: async (jsonPayload: string): Promise<string> => {
    if (isNativeAvailable) {
      try {
        return await NativeModules.AirPulseCore.process_csi_frame(jsonPayload);
      } catch {
        // Fallback to TS on runtime FFI error
      }
    }
    return jsonPayload;
  },

  calculateVitals: async (rawSignal: number[]): Promise<VitalsResult> => {
    if (isNativeAvailable) {
      try {
        return await NativeModules.AirPulseCore.calculate_vitals(rawSignal);
      } catch {
        // Fallback to TS on runtime FFI error
      }
    }

    // Pure TS Fallback DSP
    const sanitized = sanitizePhases(rawSignal);
    
    // Respiration
    const respSignal = getRespirationFilter().filterVector(sanitized);
    const respRate = zeroCrossingBpm(respSignal, 10.0, 0.1, 0.5);

    // Heart rate
    const heartSignal = getHeartFilter().filterVector(sanitized);
    const heartRate = zeroCrossingBpm(heartSignal, 10.0, 0.8, 2.0);

    const anomalyDetected = respRate < 8.0 || heartRate < 50.0 || heartRate > 120.0;

    return {
      respiration_rate: parseFloat(respRate.toFixed(2)),
      heart_rate: parseFloat(heartRate.toFixed(2)),
      confidence: 0.85,
      anomaly_detected: anomalyDetected,
    };
  },

  updatePosition: async (x: number, y: number): Promise<PositionResult> => {
    if (isNativeAvailable) {
      try {
        return await NativeModules.AirPulseCore.update_position(x, y);
      } catch {
        // Fallback to TS on runtime FFI error
      }
    }

    // Pure TS Fallback tracking
    const tracker = getTracker();
    tracker.update(x, y, 0.1);

    let zone = "ZONE_D";
    if (tracker.x < 3.0 && tracker.y < 2.5) {
      zone = "ZONE_A";
    } else if (tracker.x >= 3.0 && tracker.y < 2.5) {
      zone = "ZONE_B";
    } else if (tracker.x < 3.0 && tracker.y >= 2.5) {
      zone = "ZONE_C";
    }

    return {
      x: parseFloat(tracker.x.toFixed(3)),
      y: parseFloat(tracker.y.toFixed(3)),
      velocity_x: parseFloat(tracker.vx.toFixed(3)),
      velocity_y: parseFloat(tracker.vy.toFixed(3)),
      current_zone: zone,
    };
  }
};
