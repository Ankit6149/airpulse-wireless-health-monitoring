from abc import ABC, abstractmethod
import numpy as np

class BasePlugin(ABC):
    """
    Abstract base class representing the standard interface for all AirPulse plugins.
    Ensures consistent lifecycle methods for ingestion and signal processing.
    """
    
    @abstractmethod
    def add_frame(self, *args, **kwargs) -> None:
        """
        Ingest a new raw data frame (e.g. amplitude, phase, or timestamp).
        """
        pass

    @abstractmethod
    def process(self, *args, **kwargs) -> dict:
        """
        Execute the DSP algorithm on the buffered frames and return a standardized result dictionary.
        """
        pass
