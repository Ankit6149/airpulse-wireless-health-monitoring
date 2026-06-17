// mobile/App.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Activity,
  Heart,
  Wind,
  Navigation,
  Bell,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react-native';

import { useTelemetry } from './src/hooks/useTelemetry';
import { GlassPanel } from './src/components/GlassPanel';
import { VitalsChart } from './src/components/VitalsChart';

export default function App() {
  const [ipInput, setIpInput] = useState('localhost');
  const {
    isConnected,
    isConnecting,
    setServerIp,
    vitals,
    position,
    alerts,
    amplitudeHistory,
    respirationHistory,
    reconnect,
  } = useTelemetry('localhost');

  const handleConnect = () => {
    setServerIp(ipInput);
    reconnect();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* 1. Header Bar */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>AirPulse Mobile</Text>
              <Text style={styles.subtitle}>Caregiver Telemetry Console</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                isConnected ? styles.statusConnected : styles.statusDisconnected,
              ]}
            >
              {isConnected ? (
                <Wifi size={14} color="#10b981" />
              ) : (
                <WifiOff size={14} color="#ef4444" />
              )}
              <Text
                style={[
                  styles.statusText,
                  { color: isConnected ? '#10b981' : '#ef4444' },
                ]}
              >
                {isConnected ? 'ONLINE' : isConnecting ? 'CONNECTING' : 'OFFLINE'}
              </Text>
            </View>
          </View>

          {/* 2. Connection Settings Widget */}
          <GlassPanel style={styles.connectionPanel}>
            <Text style={styles.sectionTitle}>Server Configuration</Text>
            <View style={styles.ipRow}>
              <TextInput
                style={styles.ipInput}
                value={ipInput}
                onChangeText={setIpInput}
                placeholder="Enter Server IP Address"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                keyboardType="default"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.connectButton}
                onPress={handleConnect}
                disabled={isConnecting}
              >
                <RefreshCw size={16} color="#06b6d4" />
                <Text style={styles.connectButtonText}>
                  {isConnecting ? '...' : 'Connect'}
                </Text>
              </TouchableOpacity>
            </View>
          </GlassPanel>

          {/* 3. Live Vitals Grid */}
          <View style={styles.vitalsGrid}>
            {/* Respiration Card */}
            <GlassPanel style={styles.vitalCard}>
              <View style={styles.cardHeader}>
                <Wind size={20} color="#06b6d4" />
                <Text style={styles.vitalLabel}>Respiration</Text>
              </View>
              <Text style={styles.vitalValue}>
                {vitals.respiration_rate > 0 ? `${vitals.respiration_rate}` : '--'}
                <Text style={styles.vitalUnit}> Br/Min</Text>
              </Text>
              <View
                style={[
                  styles.alertIndicator,
                  vitals.anomaly_detected && vitals.respiration_rate < 8
                    ? styles.alertActive
                    : styles.alertNormal,
                ]}
              >
                <Text style={styles.alertIndicatorText}>
                  {vitals.respiration_rate < 8 && vitals.respiration_rate > 0
                    ? 'APNEA RISK'
                    : 'NORMAL'}
                </Text>
              </View>
            </GlassPanel>

            {/* Heart Rate Card */}
            <GlassPanel style={styles.vitalCard}>
              <View style={styles.cardHeader}>
                <Heart size={20} color="#ec4899" />
                <Text style={styles.vitalLabel}>Heart Rate</Text>
              </View>
              <Text style={styles.vitalValue}>
                {vitals.heart_rate > 0 ? `${vitals.heart_rate}` : '--'}
                <Text style={styles.vitalUnit}> BPM</Text>
              </Text>
              <View
                style={[
                  styles.alertIndicator,
                  vitals.anomaly_detected &&
                  (vitals.heart_rate < 50 || vitals.heart_rate > 120)
                    ? styles.alertActive
                    : styles.alertNormal,
                ]}
              >
                <Text style={styles.alertIndicatorText}>
                  {vitals.heart_rate > 0 &&
                  (vitals.heart_rate < 50 || vitals.heart_rate > 120)
                    ? 'CARDIAC STR'
                    : 'NORMAL'}
                </Text>
              </View>
            </GlassPanel>
          </View>

          {/* 4. Telemetry Graph */}
          <GlassPanel>
            <Text style={styles.sectionTitle}>Real-time CSI Waveforms</Text>
            <VitalsChart
              amplitudeHistory={amplitudeHistory}
              respirationHistory={respirationHistory}
            />
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#6366f1' }]} />
                <Text style={styles.legendText}>Raw CSI Amplitude</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#06b6d4' }]} />
                <Text style={styles.legendText}>Filtered Breathing</Text>
              </View>
            </View>
          </GlassPanel>

          {/* 5. Spatial Coordinate tracking & Location Zone */}
          <GlassPanel>
            <View style={styles.cardHeader}>
              <Navigation size={18} color="#10b981" />
              <Text style={styles.sectionTitle}>Zone Location Tracker</Text>
            </View>
            <View style={styles.zoneTrackerContent}>
              <View>
                <Text style={styles.zoneTitle}>
                  Current Zone: {position.current_zone}
                </Text>
                <Text style={styles.coordinatesText}>
                  Coords: X={position.x.toFixed(2)}m | Y={position.y.toFixed(2)}m
                </Text>
              </View>
              <View style={styles.zoneConfidencePill}>
                <Activity size={12} color="#10b981" />
                <Text style={styles.confidenceText}>Lock: 85%</Text>
              </View>
            </View>
          </GlassPanel>

          {/* 6. SQLite Alerts Logs Table */}
          <GlassPanel style={styles.alertsPanel}>
            <View style={styles.cardHeader}>
              <Bell size={18} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Recent Health Alerts</Text>
            </View>
            {alerts.length === 0 ? (
              <Text style={styles.noAlertsText}>No recent anomalies detected.</Text>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <View key={alert.id} style={styles.alertRow}>
                  <View>
                    <Text style={styles.alertRowTitle}>
                      {alert.anomaly_type.toUpperCase()} ({alert.node_id})
                    </Text>
                    <Text style={styles.alertDetails}>{alert.details}</Text>
                  </View>
                  <Text style={styles.alertTimestamp}>
                    {new Date(alert.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </Text>
                </View>
              ))
            )}
          </GlassPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#060913',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: Platform.OS === 'android' ? 24 : 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusConnected: {
    borderColor: 'rgba(16, 185, 129, 0.2)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  statusDisconnected: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  connectionPanel: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  ipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ipInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
  },
  connectButtonText: {
    color: '#06b6d4',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  vitalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vitalCard: {
    flex: 0.48,
    alignItems: 'center',
    paddingVertical: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  vitalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 8,
  },
  vitalValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginVertical: 4,
  },
  vitalUnit: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: 'normal',
  },
  alertIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 6,
  },
  alertNormal: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  alertActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  alertIndicatorText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  zoneTrackerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  zoneTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  coordinatesText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 4,
  },
  zoneConfidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#10b981',
    marginLeft: 4,
  },
  alertsPanel: {
    paddingBottom: 8,
  },
  noAlertsText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.35)',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 10,
  },
  alertRowTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  alertDetails: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2,
  },
  alertTimestamp: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
  },
});
