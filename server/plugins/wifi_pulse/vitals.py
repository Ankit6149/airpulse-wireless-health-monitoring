import numpy as np
from scipy.signal import butter, sosfiltfilt
from collections import deque
import time
import logging

from plugins.base import BasePlugin
from plugins.wifi_pulse.config import VitalsConfig
from plugins.wifi_pulse.exceptions import SignalExtractionError, FilterExecutionError

logger = logging.getLogger("airpulse.wifi_pulse")

# ═══════════════════════════════════════════════════════════════
#  STABILIZATION UTILITIES
# ═══════════════════════════════════════════════════════════════

def sanitize_phases(phases: np.ndarray) -> np.ndarray:
    """
    Remove Carrier Frequency Offset (CFO) and Sampling Frequency Offset (SFO) linear phase trends.
    """
    n = len(phases)
    if n < 2:
        return phases
    k = np.arange(n)
    alpha = (phases[-1] - phases[0]) / (n - 1)
    detrended = phases - (alpha * k)
    beta = np.mean(detrended)
    return detrended - beta


def zero_crossing_bpm(signal: np.ndarray, fs: float, low_f: float, high_f: float) -> float:
    """
    Estimate BPM of a bandpass filtered signal using zero crossings.
    """
    sig = signal - np.mean(signal)
    
    # Sign transitions
    zero_crossings = np.where(np.diff(np.sign(sig)) != 0)[0]
    if len(zero_crossings) < 2:
        return 0.0
        
    t_start = zero_crossings[0] / fs
    t_end = zero_crossings[-1] / fs
    duration = t_end - t_start
    if duration <= 0:
        return 0.0
        
    n_crossings = len(zero_crossings)
    freq = (n_crossings - 1) / (2.0 * duration)
    bpm = freq * 60.0
    return float(np.clip(bpm, low_f * 60.0, high_f * 60.0))


def spectral_centroid(freqs: np.ndarray, magnitudes: np.ndarray, peak_idx: int, radius: int = 3) -> float:
    """
    Compute weighted centroid around the peak for sub-bin frequency resolution.
    """
    lo = max(0, peak_idx - radius)
    hi = min(len(freqs), peak_idx + radius + 1)
    region_freqs = freqs[lo:hi]
    region_mags = magnitudes[lo:hi]
    total_power = np.sum(region_mags)
    if total_power < 1e-12:
        return freqs[peak_idx]
    return float(np.sum(region_freqs * region_mags) / total_power)


def median_of_deque(d: deque) -> float:
    """Return median of a deque of floats."""
    if not d:
        return 0.0
    return float(np.median(list(d)))


class KalmanFilter1D:
    """
    1D Kalman Filter for vital signs smoothing.
    """
    def __init__(self, initial_value: float, process_variance: float = 0.05, measurement_variance: float = 1.0):
        self.x = initial_value
        self.P = 1.0
        self.Q = process_variance
        self.R_base = measurement_variance

    def update(self, measurement: float, confidence: float) -> float:
        self.P = self.P + self.Q
        conf = max(1e-4, confidence)
        R = self.R_base / (conf ** 2)
        K = self.P / (self.P + R)
        self.x = self.x + K * (measurement - self.x)
        self.P = (1.0 - K) * self.P
        return self.x


class AdaptiveLMSFilter:
    """
    Normalized Least Mean Squares (NLMS) Adaptive Filter for motion artifact cancellation.
    """
    def __init__(self, filter_order: int = 4, mu: float = 0.05):
        self.order = filter_order
        self.mu = mu
        self.w = np.zeros(filter_order)
        self.x_buf = deque(maxlen=filter_order)

    def process(self, reference_sample: float, target_sample: float) -> float:
        self.x_buf.appendleft(reference_sample)
        if len(self.x_buf) < self.order:
            return target_sample

        x_vec = np.array(list(self.x_buf))
        y = np.dot(self.w, x_vec)
        e = target_sample - y
        norm_x = np.dot(x_vec, x_vec) + 1e-6
        self.w = self.w + (2.0 * self.mu * e * x_vec) / norm_x
        return e


# ═══════════════════════════════════════════════════════════════
#  VITALS PROCESSOR MODULE (SINGLE-PERSON CORE)
# ═══════════════════════════════════════════════════════════════

class VitalsProcessorModule(BasePlugin):
    """
    Single-Person Vitals Processor with EMA smoothing, median filtering,
    spectral centroid interpolation, and confidence scoring.
    """

    EMA_ALPHA = 0.15
    MEDIAN_WINDOW = 5
    N_FFT = 4096
    CENTROID_RADIUS = 3

    def __init__(self, config: VitalsConfig | None = None, **kwargs):
        self.config = config or VitalsConfig(**kwargs)

        self.history_amplitudes = []
        self.history_phases = []
        self.history_sanitized_phases = []
        self.history_timestamps = []

        # Temporal smoothing state
        self._ema_resp = 0.0
        self._ema_heart = 0.0
        self._resp_history = deque(maxlen=self.MEDIAN_WINDOW)
        self._heart_history = deque(maxlen=self.MEDIAN_WINDOW)

        # Kalman Trackers (1D) for vitals
        self.kf_resp = None
        self.kf_heart = None

        # NLMS Adaptive Filter for motion artifact cancellation
        self.lms_filter = AdaptiveLMSFilter(filter_order=4, mu=0.05)

        # Precompute static FFT frequency arrays and masks
        self._fft_freqs = np.fft.rfftfreq(self.N_FFT, d=1.0 / self.config.sampling_rate)
        self._resp_mask = (self._fft_freqs >= self.config.respiration_low_freq) & (self._fft_freqs <= self.config.respiration_high_freq)
        self._heart_mask = (self._fft_freqs >= self.config.heart_rate_low_freq) & (self._fft_freqs <= self.config.heart_rate_high_freq)
        self._hanning_cache = {}

        # Precompute bandpass filter coefficients
        self._sos_resp = butter(
            5,
            [self.config.respiration_low_freq, self.config.respiration_high_freq],
            btype="bandpass",
            fs=self.config.sampling_rate,
            output="sos",
        )
        self._sos_heart = butter(
            3,
            [self.config.heart_rate_low_freq, self.config.heart_rate_high_freq],
            btype="bandpass",
            fs=self.config.sampling_rate,
            output="sos",
        )

        logger.info(f"Initialized VitalsProcessorModule for node {self.config.node_id}")

    def add_frame(self, amplitude: np.ndarray, phase: np.ndarray, timestamp_us: int) -> None:
        """Appends new amplitude and phase arrays to the rolling buffer."""
        if not isinstance(amplitude, np.ndarray):
            amplitude = np.array(amplitude)
        if not isinstance(phase, np.ndarray):
            phase = np.array(phase)

        # Check for subcarrier count change to prevent shape mismatch crashes
        if len(self.history_amplitudes) > 0:
            prev_n_sc = self.history_amplitudes[-1].shape[0]
            curr_n_sc = amplitude.shape[0]
            if prev_n_sc != curr_n_sc:
                self.history_amplitudes.clear()
                self.history_phases.clear()
                self.history_sanitized_phases.clear()
                self.history_timestamps.clear()
                
                self.kf_resp = None
                self.kf_heart = None
                self._resp_history.clear()
                self._heart_history.clear()
                self._ema_resp = 0.0
                self._ema_heart = 0.0

        self.history_amplitudes.append(amplitude)
        self.history_phases.append(phase)
        self.history_sanitized_phases.append(sanitize_phases(phase))
        self.history_timestamps.append(timestamp_us)

        if len(self.history_amplitudes) > self.config.window_limit:
            self.history_amplitudes.pop(0)
            self.history_phases.pop(0)
            self.history_sanitized_phases.pop(0)
            self.history_timestamps.pop(0)

    def process(self) -> dict:
        """
        Executes the single-person vital signs extraction pipeline.
        """
        n_frames = len(self.history_amplitudes)
        if n_frames < 150:
            return {
                "timestamp_ms": int(time.time() * 1000),
                "respiration_bpm": 0.0,
                "heart_rate_bpm": 0.0,
                "motion_score": 0.0,
                "confidence": 0.0,
                "raw_signal": [],
                "filtered_signal": [],
            }

        amplitudes = np.array(self.history_amplitudes)
        sanitized_phs = np.array(self.history_sanitized_phases)

        # Select primary signal paths
        variances = np.var(amplitudes, axis=0)
        best_subcarrier_idx = np.argmax(variances)
        primary_signal = amplitudes[:, best_subcarrier_idx]

        phase_variances = np.var(sanitized_phs, axis=0)
        best_phase_idx = np.argmax(phase_variances)
        primary_phase_signal = sanitized_phs[:, best_phase_idx]

        motion_score = float(np.std(primary_signal))
        recent_motion_score = float(np.std(primary_signal[-40:])) if len(primary_signal) >= 40 else motion_score

        # Apply NLMS filter to primary amplitude signal for heart rate tracking
        min_subcarrier_idx = np.argmin(variances)
        reference_signal = amplitudes[:, min_subcarrier_idx]

        denoised_primary_signal = np.zeros_like(primary_signal)
        for i_sample in range(len(primary_signal)):
            denoised_primary_signal[i_sample] = self.lms_filter.process(
                reference_sample=reference_signal[i_sample],
                target_sample=primary_signal[i_sample]
            )

        # Extract primary breathing and heart rate
        raw_resp, resp_conf = self._extract_respiration_raw(primary_phase_signal)
        raw_heart, heart_conf = self._extract_heart_rate_raw(denoised_primary_signal)

        self._resp_history.append(raw_resp)
        self._heart_history.append(raw_heart)
        median_resp = median_of_deque(self._resp_history)
        median_heart = median_of_deque(self._heart_history)

        if self.kf_resp is None:
            self.kf_resp = KalmanFilter1D(initial_value=median_resp, process_variance=0.03, measurement_variance=1.5)
        if self.kf_heart is None:
            self.kf_heart = KalmanFilter1D(initial_value=median_heart, process_variance=0.05, measurement_variance=2.0)

        # Normalize confidence metrics
        resp_conf_norm = min(1.0, resp_conf / 0.03)
        heart_conf_norm = min(1.0, heart_conf / 0.015)
        confidence = 0.7 * resp_conf_norm + 0.3 * heart_conf_norm

        smoothed_resp = self.kf_resp.update(median_resp, resp_conf_norm)
        smoothed_heart = self.kf_heart.update(median_heart, heart_conf_norm)

        # EMA smoothing with decay mechanism
        if self._ema_resp == 0.0:
            self._ema_resp = smoothed_resp
        else:
            if raw_resp > 0.0:
                self._ema_resp = self.EMA_ALPHA * smoothed_resp + (1.0 - self.EMA_ALPHA) * self._ema_resp
            else:
                self._ema_resp = 0.9 * self._ema_resp
                if self._ema_resp < 0.5:
                    self._ema_resp = 0.0

        if self._ema_heart == 0.0:
            self._ema_heart = smoothed_heart
        else:
            if raw_heart > 0.0:
                self._ema_heart = self.EMA_ALPHA * smoothed_heart + (1.0 - self.EMA_ALPHA) * self._ema_heart
            else:
                self._ema_heart = 0.9 * self._ema_heart
                if self._ema_heart < 0.5:
                    self._ema_heart = 0.0

        filtered_resp = sosfiltfilt(self._sos_resp, primary_phase_signal)

        return {
            "timestamp_ms": int(time.time() * 1000),
            "respiration_bpm": round(self._ema_resp, 1),
            "heart_rate_bpm": round(self._ema_heart, 1),
            "motion_score": round(motion_score, 4),
            "recent_motion": round(recent_motion_score, 4),
            "confidence": round(confidence, 3),
            "raw_signal": [float(x) for x in primary_phase_signal[-100:]],
            "filtered_signal": [float(x) for x in filtered_resp[-100:]],
        }

    def _extract_respiration_raw(self, signal: np.ndarray) -> tuple[float, float]:
        try:
            filtered = sosfiltfilt(self._sos_resp, signal)
            std_val = np.std(filtered)
            if std_val < 0.05:
                return 0.0, 0.0
                
            centered = filtered - np.mean(filtered)
            L = len(centered)
            if L not in self._hanning_cache:
                self._hanning_cache[L] = np.hanning(L)
            windowed = centered * self._hanning_cache[L]

            freqs = self._fft_freqs
            fft_vals = np.abs(np.fft.rfft(windowed, n=self.N_FFT))
            mask = self._resp_mask
            
            if not np.any(mask):
                return 12.0, 0.0

            masked_mags = fft_vals[mask]
            peak_local_idx = np.argmax(masked_mags)
            peak_global_idx = np.where(mask)[0][peak_local_idx]

            fft_freq = spectral_centroid(freqs, fft_vals, peak_global_idx, self.CENTROID_RADIUS)
            fft_bpm = fft_freq * 60.0
            zc_bpm = zero_crossing_bpm(filtered, self.config.sampling_rate, self.config.respiration_low_freq, self.config.respiration_high_freq)

            peak_power = masked_mags[peak_local_idx]
            total_power = np.sum(masked_mags) + 1e-12
            confidence = float(peak_power / total_power)

            if zc_bpm > 0:
                bpm = 0.5 * fft_bpm + 0.5 * zc_bpm
            else:
                bpm = fft_bpm

            return float(np.clip(bpm, 6.0, 30.0)), confidence

        except Exception as e:
            logger.error(f"Error during respiration extraction: {e}")
            raise FilterExecutionError(f"Respiration bandpass filter/FFT failed: {e}")

    def _extract_heart_rate_raw(self, signal: np.ndarray) -> tuple[float, float]:
        try:
            filtered = sosfiltfilt(self._sos_heart, signal)
            std_val = np.std(filtered)
            if std_val < 0.05:
                return 0.0, 0.0
                
            centered = filtered - np.mean(filtered)
            L = len(centered)
            if L not in self._hanning_cache:
                self._hanning_cache[L] = np.hanning(L)
            windowed = centered * self._hanning_cache[L]

            freqs = self._fft_freqs
            fft_vals = np.abs(np.fft.rfft(windowed, n=self.N_FFT))
            mask = self._heart_mask
            
            if not np.any(mask):
                return 72.0, 0.0

            masked_mags = fft_vals[mask]
            peak_local_idx = np.argmax(masked_mags)
            peak_global_idx = np.where(mask)[0][peak_local_idx]

            fft_freq = spectral_centroid(freqs, fft_vals, peak_global_idx, self.CENTROID_RADIUS)
            fft_bpm = fft_freq * 60.0
            zc_bpm = zero_crossing_bpm(filtered, self.config.sampling_rate, self.config.heart_rate_low_freq, self.config.heart_rate_high_freq)

            peak_power = masked_mags[peak_local_idx]
            total_power = np.sum(masked_mags) + 1e-12
            confidence = float(peak_power / total_power)

            if zc_bpm > 0:
                bpm = 0.5 * fft_bpm + 0.5 * zc_bpm
            else:
                bpm = fft_bpm

            return float(np.clip(bpm, 45.0, 140.0)), confidence

        except Exception as e:
            logger.error(f"Error during BCG heart rate extraction: {e}")
            raise FilterExecutionError(f"BCG heart rate bandpass/FFT failed: {e}")
