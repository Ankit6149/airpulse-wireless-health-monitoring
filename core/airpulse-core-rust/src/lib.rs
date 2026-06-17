// core/airpulse-core-rust/src/lib.rs

pub mod dsp;
pub mod tracking;

uniffi::include_scaffolding!("airpulse_core");

use std::sync::Mutex;
use std::sync::OnceLock;

// Define structs matching dictionary definitions in IDL
#[derive(Clone, Debug, Default)]
pub struct VitalsResult {
    pub respiration_rate: f64,
    pub heart_rate: f64,
    pub confidence: f64,
    pub anomaly_detected: bool,
}

#[derive(Clone, Debug, Default)]
pub struct PositionResult {
    pub x: f64,
    pub y: f64,
    pub velocity_x: f64,
    pub velocity_y: f64,
    pub current_zone: String,
}

// Thread-safe standard OnceLock caching structures
fn get_respiration_filter() -> &'static Mutex<dsp::SosFilter> {
    static RES_FILTER: OnceLock<Mutex<dsp::SosFilter>> = OnceLock::new();
    RES_FILTER.get_or_init(|| {
        // Precomputed SOS coefficients for respiration bandpass (0.1Hz - 0.5Hz, fs=10Hz, order=5)
        let sections = vec![
            ([0.0003, 0.0006, 0.0003], [1.0, -1.8227, 0.8372]),
            ([1.0, 2.0, 1.0], [1.0, -1.7458, 0.7716]),
        ];
        Mutex::new(dsp::SosFilter::new(sections))
    })
}

fn get_heart_filter() -> &'static Mutex<dsp::SosFilter> {
    static HR_FILTER: OnceLock<Mutex<dsp::SosFilter>> = OnceLock::new();
    HR_FILTER.get_or_init(|| {
        // Precomputed SOS coefficients for heart rate bandpass (0.8Hz - 2.0Hz, fs=10Hz, order=3)
        let sections = vec![
            ([0.0055, 0.0111, 0.0055], [1.0, -1.3533, 0.6125]),
            ([1.0, 1.0, 0.0], [1.0, -0.6389, 0.0]),
        ];
        Mutex::new(dsp::SosFilter::new(sections))
    })
}

fn get_tracker_2d() -> &'static Mutex<tracking::KalmanFilter2D> {
    static TRACKER: OnceLock<Mutex<tracking::KalmanFilter2D>> = OnceLock::new();
    TRACKER.get_or_init(|| {
        Mutex::new(tracking::KalmanFilter2D::new(0.0, 0.0, 0.05, 0.5))
    })
}

/// Dummy implementation for CSI ingestion/detrending prep
pub fn process_csi_frame(json_payload: String) -> String {
    json_payload
}

/// Calculate respiration rate and heart rate from raw detrended signal vectors
pub fn calculate_vitals(raw_signal: Vec<f64>) -> VitalsResult {
    let sanitized = dsp::sanitize_phases(&raw_signal);
    
    // Respiration rate
    let mut resp_filter = get_respiration_filter().lock().unwrap();
    let resp_signal = resp_filter.filter_vector(&sanitized);
    let resp_rate = dsp::zero_crossing_bpm(&resp_signal, 10.0, 0.1, 0.5);

    // Heart rate
    let mut heart_filter = get_heart_filter().lock().unwrap();
    let heart_signal = heart_filter.filter_vector(&sanitized);
    let heart_rate = dsp::zero_crossing_bpm(&heart_signal, 10.0, 0.8, 2.0);

    let anomaly_detected = resp_rate < 8.0 || heart_rate < 50.0 || heart_rate > 120.0;

    VitalsResult {
        respiration_rate: resp_rate,
        heart_rate,
        confidence: 0.85,
        anomaly_detected,
    }
}

/// Smoothes (x, y) spatial coordinates via 2D Kalman filter
pub fn update_position(x: f64, y: f64) -> PositionResult {
    let mut tracker = get_tracker_2d().lock().unwrap();
    // Default 10 Hz sampling intervals (0.1s)
    tracker.update(x, y, 0.1);

    let zone = if tracker.x < 3.0 && tracker.y < 2.5 {
        "ZONE_A"
    } else if tracker.x >= 3.0 && tracker.y < 2.5 {
        "ZONE_B"
    } else if tracker.x < 3.0 && tracker.y >= 2.5 {
        "ZONE_C"
    } else {
        "ZONE_D"
    };

    PositionResult {
        x: tracker.x,
        y: tracker.y,
        velocity_x: tracker.vx,
        velocity_y: tracker.vy,
        current_zone: zone.to_string(),
    }
}
