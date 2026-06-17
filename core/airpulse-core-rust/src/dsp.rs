// core/airpulse-core-rust/src/dsp.rs

#[derive(Clone, Debug)]
pub struct Biquad {
    pub b: [f64; 3],
    pub a: [f64; 3],
    pub w: [f64; 2],
}

impl Biquad {
    pub fn new(b: [f64; 3], a: [f64; 3]) -> Self {
        Self { b, a, w: [0.0; 2] }
    }

    /// Direct Form II step implementation
    pub fn filter(&mut self, x: f64) -> f64 {
        let w0 = x - self.a[1] * self.w[0] - self.a[2] * self.w[1];
        let y = self.b[0] * w0 + self.b[1] * self.w[0] + self.b[2] * self.w[1];
        self.w[1] = self.w[0];
        self.w[0] = w0;
        y
    }
}

#[derive(Clone, Debug)]
pub struct SosFilter {
    biquads: Vec<Biquad>,
}

impl SosFilter {
    pub fn new(sections: Vec<([f64; 3], [f64; 3])>) -> Self {
        let biquads = sections.into_iter().map(|(b, a)| Biquad::new(b, a)).collect();
        Self { biquads }
    }

    pub fn filter(&mut self, x: f64) -> f64 {
        let mut out = x;
        for biquad in &mut self.biquads {
            out = biquad.filter(out);
        }
        out
    }

    pub fn filter_vector(&mut self, data: &[f64]) -> Vec<f64> {
        data.iter().map(|&x| self.filter(x)).collect()
    }
}

/// Remove Carrier Frequency Offset (CFO) and Sampling Frequency Offset (SFO) linear phase trends.
pub fn sanitize_phases(phases: &[f64]) -> Vec<f64> {
    let n = phases.len();
    if n < 2 {
        return phases.to_vec();
    }
    let mut detrended = vec![0.0; n];
    let alpha = (phases[n - 1] - phases[0]) / (n - 1) as f64;
    for k in 0..n {
        detrended[k] = phases[k] - (alpha * k as f64);
    }
    let sum: f64 = detrended.iter().sum();
    let beta = sum / n as f64;
    for k in 0..n {
        detrended[k] -= beta;
    }
    detrended
}

/// Estimate BPM of a bandpass filtered signal using zero crossings.
pub fn zero_crossing_bpm(signal: &[f64], fs: f64, low_f: f64, high_f: f64) -> f64 {
    let n = signal.len();
    if n < 2 {
        return 0.0;
    }
    let sum: f64 = signal.iter().sum();
    let mean = sum / n as f64;
    let mut sig = vec![0.0; n];
    for i in 0..n {
        sig[i] = signal[i] - mean;
    }

    let mut zero_crossings = Vec::new();
    for i in 0..n - 1 {
        let sign_curr = if sig[i] >= 0.0 { 1.0 } else { -1.0 };
        let sign_next = if sig[i + 1] >= 0.0 { 1.0 } else { -1.0 };
        if sign_curr != sign_next {
            zero_crossings.push(i as f64);
        }
    }

    if zero_crossings.len() < 2 {
        return 0.0;
    }

    let t_start = zero_crossings[0] / fs;
    let t_end = zero_crossings[zero_crossings.len() - 1] / fs;
    let duration = t_end - t_start;
    if duration <= 0.0 {
        return 0.0;
    }

    let n_crossings = zero_crossings.len() as f64;
    let freq = (n_crossings - 1.0) / (2.0 * duration);
    let bpm = freq * 60.0;

    let min_bpm = low_f * 60.0;
    let max_bpm = high_f * 60.0;
    if bpm < min_bpm {
        min_bpm
    } else if bpm > max_bpm {
        max_bpm
    } else {
        bpm
    }
}
