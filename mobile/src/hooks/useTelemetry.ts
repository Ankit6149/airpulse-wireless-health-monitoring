// mobile/src/hooks/useTelemetry.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { AirPulseCore, VitalsResult, PositionResult } from '../native/AirPulseCore';

export interface AlertRecord {
  id: string;
  timestamp: string;
  node_id: string;
  anomaly_type: string;
  details: string;
  resolved: boolean;
}

export function useTelemetry(initialServerIp: string = 'localhost') {
  const [serverIp, setServerIp] = useState(initialServerIp);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [vitals, setVitals] = useState<VitalsResult>({
    respiration_rate: 0,
    heart_rate: 0,
    confidence: 0,
    anomaly_detected: false,
  });

  const [position, setPosition] = useState<PositionResult>({
    x: 0,
    y: 0,
    velocity_x: 0,
    velocity_y: 0,
    current_zone: 'ZONE_A',
  });

  const [alerts, setAlerts] = useState<AlertRecord[]>([]);

  // Telemetry rolling histories for canvas waveforms
  const [amplitudeHistory, setAmplitudeHistory] = useState<number[]>(new Array(100).fill(0));
  const [respirationHistory, setRespirationHistory] = useState<number[]>(new Array(100).fill(0));

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsConnecting(true);
    setIsConnected(false);

    // Support standard port 8000 for FastAPI Server
    const wsUrl = `ws://${serverIp}:8000/ws/vitals`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'telemetry') {
            const rawSignal: number[] = data.signal || [];
            
            // 1. Process Vitals
            const vitalsResult = await AirPulseCore.calculateVitals(rawSignal);
            setVitals(vitalsResult);

            // 2. Add raw signal values to amplitude history
            if (rawSignal.length > 0) {
              setAmplitudeHistory(prev => {
                const updated = [...prev, ...rawSignal];
                return updated.slice(updated.length - 100);
              });
            }

            // 3. Process Respiration filter trail for charts
            // Simulate drawing exhalation/inhalation trail
            const filterRespirationTrail = rawSignal.map(val => val * 0.45); // Approximate scale
            setRespirationHistory(prev => {
              const updated = [...prev, ...filterRespirationTrail];
              return updated.slice(updated.length - 100);
            });
          }

          if (data.type === 'position') {
            // Smooth positioning coordinates
            const smoothed = await AirPulseCore.updatePosition(data.x, data.y);
            setPosition(smoothed);
          }

          if (data.type === 'alerts') {
            setAlerts(data.records || []);
          }
        } catch {
          // Parse fail catch
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        // Attempt automatic reconnection every 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };
    } catch {
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [serverIp]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    serverIp,
    setServerIp,
    vitals,
    position,
    alerts,
    amplitudeHistory,
    respirationHistory,
    reconnect: connect,
  };
}
