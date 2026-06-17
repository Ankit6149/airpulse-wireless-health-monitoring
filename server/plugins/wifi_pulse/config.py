from pydantic import BaseModel, Field

class VitalsConfig(BaseModel):
    """
    Validated configuration parameters for the Vitals Processor Module (wifi_pulse).
    """
    window_limit: int = Field(default=300, ge=50, description="Size of the rolling signal frame buffer.")
    sampling_rate: float = Field(default=20.0, gt=0.0, description="CSI packet sampling rate in Hz.")
    node_id: str = Field(default="NODE-ESP32S3-SYSCORE", description="Hardware identifier of the monitoring node.")
    
    # Filter specifications
    respiration_low_freq: float = Field(default=0.1, gt=0.0)
    respiration_high_freq: float = Field(default=0.5, gt=0.0)
    
    heart_rate_low_freq: float = Field(default=0.8, gt=0.0)
    heart_rate_high_freq: float = Field(default=2.0, gt=0.0)
    
    # Fall detection parameters
    doppler_burst_threshold: float = Field(default=8.0, gt=0.0, description="STFT frequency threshold to flag a fall burst.")
    immobility_seconds: float = Field(default=8.0, gt=0.0, description="Cooldown window to measure post-fall immobility.")
    immobility_variance_threshold: float = Field(default=0.2, gt=0.0, description="Maximum standard deviation to classify immobility.")
