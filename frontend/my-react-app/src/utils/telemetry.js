import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

export function reportWebVitals(onMetric) {
  if (onMetric && typeof onMetric === 'function') {
    onCLS(onMetric);
    onFID(onMetric);
    onLCP(onMetric);
    onFCP(onMetric);
    onTTFB(onMetric);
  }
}

export function getNetworkProfile() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return { effectiveType: 'unknown', downlink: 'unknown', saveData: false };

  return {
    effectiveType: connection.effectiveType, // e.g., '4g', '3g'
    downlink: connection.downlink,           // Mbps estimate
    rtt: connection.rtt,                     // Round-trip time
    saveData: connection.saveData
  };
}