import socket
import struct
import time
import math
import numpy as np
import threading

def simulate_node(node_name, port, sampling_rate=20.0, num_subcarriers=64):
    print(f"[Simulator] Spawning {node_name} streaming on UDP port {port}...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    seq_id = 0
    start_time = time.time()
    interval = 1.0 / sampling_rate
    
    try:
        while True:
            t = time.time() - start_time
            timestamp_us = int(time.time() * 1000000)
            
            # Default baseline subcarrier parameters
            base_amp = 1500.0 + 300.0 * np.sin(np.arange(num_subcarriers) * 0.15)
            base_phase = np.arange(num_subcarriers) * 0.08
            
            I = np.zeros(num_subcarriers)
            Q = np.zeros(num_subcarriers)
            rssi = -40 + int(2.0 * math.sin(t * 0.1))
            
            if node_name == "Node_A":
                # Zone 1 - Normal Subject Vitals
                # Respiration: 16 BPM (0.267 Hz), Heart Rate: 72 BPM (1.2 Hz)
                resp_mod = 12.0 * math.sin(2 * math.pi * 0.267 * t)
                heart_mod = 1.5 * math.sin(2 * math.pi * 1.2 * t)
                for k in range(num_subcarriers):
                    amp = base_amp[k] + resp_mod * np.cos(k * 0.1) + heart_mod * np.sin(k * 0.2)
                    ph = base_phase[k] + (resp_mod * 0.005) * np.sin(k * 0.05)
                    I[k] = amp * math.cos(ph)
                    Q[k] = amp * math.sin(ph)
                    
            elif node_name == "Node_B":
                # Zone 1 - Overlapping Normal Subject (Independent sensor path check)
                # Respiration: 15 BPM (0.25 Hz), Heart Rate: 70 BPM (1.167 Hz)
                resp_mod = 11.0 * math.sin(2 * math.pi * 0.25 * t + 0.5)
                heart_mod = 1.4 * math.sin(2 * math.pi * 1.167 * t + 0.3)
                for k in range(num_subcarriers):
                    amp = base_amp[k] + resp_mod * np.cos(k * 0.09) + heart_mod * np.sin(k * 0.18)
                    ph = base_phase[k] + (resp_mod * 0.004) * np.sin(k * 0.06)
                    I[k] = amp * math.cos(ph)
                    Q[k] = amp * math.sin(ph)
                    
            elif node_name == "Node_C":
                # Zone 2 - Dynamic Anomaly Cycle for alert validation
                # 60-second periodic workflow:
                # - 0s to 35s: Normal vitals (Resp: 18 BPM, HR: 75 BPM)
                # - 35s to 38s: Sudden Fall Event (high velocity Doppler shift and noise)
                # - 38s to 55s: Complete Immobility + Respiratory Arrest (Apnea / 0 BPM)
                # - 55s to 60s: Recovery / Resuscitation phase
                cycle_time = t % 60.0
                if cycle_time < 35.0:
                    resp_mod = 10.0 * math.sin(2 * math.pi * 0.3 * t)
                    heart_mod = 1.6 * math.sin(2 * math.pi * 1.25 * t)
                    for k in range(num_subcarriers):
                        amp = base_amp[k] + resp_mod * np.cos(k * 0.11) + heart_mod * np.sin(k * 0.22)
                        ph = base_phase[k] + (resp_mod * 0.005) * np.sin(k * 0.04)
                        I[k] = amp * math.cos(ph)
                        Q[k] = amp * math.sin(ph)
                elif cycle_time < 38.0:
                    # Fall Burst: simulates a body fast collapse signature (large frequency burst)
                    fall_freq = 8.5
                    fall_mod = 900.0 * math.sin(2 * math.pi * fall_freq * t)
                    noise = np.random.normal(0, 80.0, num_subcarriers)
                    for k in range(num_subcarriers):
                        amp = base_amp[k] + fall_mod * np.sin(k * 0.07) + noise[k]
                        ph = base_phase[k] + (fall_mod * 0.05) * np.cos(k * 0.03)
                        I[k] = amp * math.cos(ph)
                        Q[k] = amp * math.sin(ph)
                elif cycle_time < 55.0:
                    # Immobility + Apnea state: 0 BPM breathing activity, minimal thermal drift
                    noise = np.random.normal(0, 0.05, num_subcarriers)
                    for k in range(num_subcarriers):
                        amp = base_amp[k] + noise[k]
                        ph = base_phase[k] + (noise[k] * 0.0001)
                        I[k] = amp * math.cos(ph)
                        Q[k] = amp * math.sin(ph)
                else:
                    # Recovery: gradual vital parameter ramp-up
                    recovery_scale = (cycle_time - 55.0) / 5.0
                    resp_mod = 14.0 * math.sin(2 * math.pi * 0.35 * t) * recovery_scale
                    heart_mod = 2.0 * math.sin(2 * math.pi * 1.4 * t) * recovery_scale
                    for k in range(num_subcarriers):
                        amp = base_amp[k] + resp_mod * np.cos(k * 0.1) + heart_mod * np.sin(k * 0.2)
                        ph = base_phase[k] + (resp_mod * 0.005) * np.sin(k * 0.05)
                        I[k] = amp * math.cos(ph)
                        Q[k] = amp * math.sin(ph)
                        
            # Build binary CSI packet matching ESP32 UDP layout
            header = struct.pack(">IQbH", seq_id, timestamp_us, rssi, num_subcarriers)
            payload = bytearray(header)
            for k in range(num_subcarriers):
                i_val = int(max(-32768, min(32767, I[k])))
                q_val = int(max(-32768, min(32767, Q[k])))
                payload.extend(struct.pack(">hh", i_val, q_val))
                
            sock.sendto(payload, ("127.0.0.1", port))
            seq_id += 1
            
            elapsed = time.time() - start_time
            expected_next = seq_id * interval
            sleep_time = expected_next - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)
                
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"[Simulator] {node_name} encountered error: {e}")
    finally:
        sock.close()
        print(f"[Simulator] Stopped stream for {node_name}.")

if __name__ == "__main__":
    print("=== AirPulse Multi-Node CSI Data Simulator ===")
    print("Starting concurrent simulator threads. Press Ctrl+C to terminate.")
    
    threads = []
    
    # Spawn 3 concurrent simulated physical streams
    node_configs = [
        ("Node_A", 8090), # Zone 1 (normal)
        ("Node_B", 8092), # Zone 1 (overlapping coverage)
        ("Node_C", 8093)  # Zone 2 (dynamic fall & apnea anomaly cycles)
    ]
    
    for name, port in node_configs:
        t = threading.Thread(target=simulate_node, args=(name, port), daemon=True)
        t.start()
        threads.append(t)
        
    try:
        # Keep main thread alive
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\n[Simulator] Shutdown signal received.")
