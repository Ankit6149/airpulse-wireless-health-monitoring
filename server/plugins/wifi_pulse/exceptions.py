class VitalsException(Exception):
    """Base exception for all wifi_pulse physiological plugin errors."""
    pass

class SignalExtractionError(VitalsException):
    """Raised when raw signal buffer processing fails due to insufficient data or dimensions."""
    pass

class FilterExecutionError(VitalsException):
    """Raised when butterworth or other filters fail to compute."""
    pass

class FallDetectionError(VitalsException):
    """Raised when the STFT or fall state tracker runs into invalid states."""
    pass
