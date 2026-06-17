// core/airpulse-core-rust/src/tracking.rs

pub struct KalmanFilter1D {
    pub x: f64, // State estimate
    pub p: f64, // Uncertainty covariance
    pub q: f64, // Process noise covariance
    pub r: f64, // Measurement noise covariance
}

impl KalmanFilter1D {
    pub fn new(initial_value: f64, q: f64, r: f64) -> Self {
        Self {
            x: initial_value,
            p: 1.0,
            q,
            r,
        }
    }

    pub fn update(&mut self, measurement: f64) -> f64 {
        // Predict
        self.p += self.q;

        // Update
        let k = self.p / (self.p + self.r);
        self.x += k * (measurement - self.x);
        self.p *= 1.0 - k;

        self.x
    }
}

pub struct KalmanFilter2D {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub p: [[f64; 4]; 4],
    pub q: f64,
    pub r: f64,
}

impl KalmanFilter2D {
    pub fn new(initial_x: f64, initial_y: f64, q: f64, r: f64) -> Self {
        let mut p = [[0.0; 4]; 4];
        p[0][0] = 1.0;
        p[1][1] = 1.0;
        p[2][2] = 5.0;
        p[3][3] = 5.0;

        Self {
            x: initial_x,
            y: initial_y,
            vx: 0.0,
            vy: 0.0,
            p,
            q,
            r,
        }
    }

    /// Predict state and covariance for time interval dt, then update with coordinates (z_x, z_y)
    pub fn update(&mut self, z_x: f64, z_y: f64, dt: f64) {
        // 1. Predict state: x = F*x
        self.x += self.vx * dt;
        self.y += self.vy * dt;

        // 2. Predict covariance: P = F*P*F^T + Q
        // F = [1, 0, dt, 0]
        //     [0, 1, 0, dt]
        //     [0, 0, 1, 0]
        //     [0, 0, 0, 1]
        let mut p_next = self.p;

        // Row 0
        p_next[0][0] = self.p[0][0] + dt * (self.p[2][0] + self.p[0][2] + dt * self.p[2][2]) + self.q;
        p_next[0][1] = self.p[0][1] + dt * (self.p[2][1] + self.p[0][3] + dt * self.p[2][3]);
        p_next[0][2] = self.p[0][2] + dt * self.p[2][2];
        p_next[0][3] = self.p[0][3] + dt * self.p[2][3];

        // Row 1
        p_next[1][0] = self.p[1][0] + dt * (self.p[3][0] + self.p[1][2] + dt * self.p[3][2]);
        p_next[1][1] = self.p[1][1] + dt * (self.p[3][1] + self.p[1][3] + dt * self.p[3][3]) + self.q;
        p_next[1][2] = self.p[1][2] + dt * self.p[3][2];
        p_next[1][3] = self.p[1][3] + dt * self.p[3][3];

        // Row 2
        p_next[2][0] = self.p[2][0] + dt * self.p[2][2];
        p_next[2][1] = self.p[2][1] + dt * self.p[2][3];
        p_next[2][2] = self.p[2][2] + self.q * 0.1;

        // Row 3
        p_next[3][0] = self.p[3][0] + dt * self.p[3][2];
        p_next[3][1] = self.p[3][1] + dt * self.p[3][3];
        p_next[3][3] = self.p[3][3] + self.q * 0.1;

        self.p = p_next;

        // 3. Measurement Update
        // Measurement matrix H maps state to [x, y]:
        // H = [1, 0, 0, 0]
        //     [0, 1, 0, 0]
        // Innovation covariance S = H*P*H^T + R
        // S = [P_00 + R, P_01]
        //     [P_10, P_11 + R]
        let s00 = self.p[0][0] + self.r;
        let s01 = self.p[0][1];
        let s10 = self.p[1][0];
        let s11 = self.p[1][1] + self.r;

        // Matrix determinant for inversion
        let det = s00 * s11 - s01 * s10;
        if det.abs() > 1e-9 {
            let inv_s00 = s11 / det;
            let inv_s01 = -s01 / det;
            let inv_s10 = -s10 / det;
            let inv_s11 = s00 / det;

            // Kalman Gain K = P * H^T * S^-1
            // H^T = [1, 0]
            //       [0, 1]
            //       [0, 0]
            //       [0, 0]
            let mut k = [[0.0; 2]; 4];
            for r in 0..4 {
                k[r][0] = self.p[r][0] * inv_s00 + self.p[r][1] * inv_s10;
                k[r][1] = self.p[r][0] * inv_s01 + self.p[r][1] * inv_s11;
            }

            // Innovation y = z - H*x
            let dy_x = z_x - self.x;
            let dy_y = z_y - self.y;

            // Updated State estimate x = x + K*y
            self.x += k[0][0] * dy_x + k[0][1] * dy_y;
            self.y += k[1][0] * dy_x + k[1][1] * dy_y;
            self.vx += k[2][0] * dy_x + k[2][1] * dy_y;
            self.vy += k[3][0] * dy_x + k[3][1] * dy_y;

            // Updated Covariance P = (I - K*H)*P
            let mut p_updated = [[0.0; 4]; 4];
            for r in 0..4 {
                for c in 0..4 {
                    let kh0 = k[r][0] * self.p[0][c];
                    let kh1 = k[r][1] * self.p[1][c];
                    p_updated[r][c] = self.p[r][c] - (kh0 + kh1);
                }
            }
            self.p = p_updated;
        }
    }
}
