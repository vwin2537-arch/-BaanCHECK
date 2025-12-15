import { Coordinates, ScanLog, Checkpoint } from './types';

// Haversine formula to calculate distance between two points in meters
export const calculateDistance = (
  coords1: Coordinates,
  coords2: Coordinates
): number => {
  const R = 6371e3; // Earth radius in meters
  const lat1 = (coords1.latitude * Math.PI) / 180;
  const lat2 = (coords2.latitude * Math.PI) / 180;
  const deltaLat = ((coords2.latitude - coords1.latitude) * Math.PI) / 180;
  const deltaLon = ((coords2.longitude - coords1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

// Get Current Position with High Accuracy & Metadata
export const getCurrentPosition = (): Promise<Coordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy // Return accuracy in meters
          });
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  });
};

// --- UTM CONVERSION UTILITIES ---
// Simplified logic to convert Lat/Long to UTM String for display
export const latLonToUtm = (lat: number, lon: number): string => {
  if (!(-80 <= lat && lat <= 84)) return "Outside UTM Limits";

  const falseEasting = 500000.0;
  const falseNorthing = lat >= 0.0 ? 0.0 : 10000000.0;
  
  const zoneNumber = Math.floor((lon + 180.0) / 6) + 1;
  const centralMeridian = ((zoneNumber - 1) * 6 - 180 + 3) * (Math.PI / 180.0);

  const k0 = 0.9996;
  const a = 6378137.0; // WGS84 Major axis
  const f = 1 / 298.257223563; // WGS84 Flattening
  const b = a * (1 - f); // Minor axis
  const eSq = (a * a - b * b) / (a * a); // First eccentricity squared
  const ePrimeSq = (a * a - b * b) / (b * b); // Second eccentricity squared

  const latRad = lat * (Math.PI / 180.0);
  const lonRad = lon * (Math.PI / 180.0);

  const N = a / Math.sqrt(1 - eSq * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = ePrimeSq * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lonRad - centralMeridian);

  const M = a * ((1 - eSq / 4 - 3 * eSq * eSq / 64 - 5 * eSq * eSq * eSq / 256) * latRad
              - (3 * eSq / 8 + 3 * eSq * eSq / 32 + 45 * eSq * eSq * eSq / 1024) * Math.sin(2 * latRad)
              + (15 * eSq * eSq / 256 + 45 * eSq * eSq * eSq / 1024) * Math.sin(4 * latRad)
              - (35 * eSq * eSq * eSq / 3072) * Math.sin(6 * latRad));

  const easting = falseEasting + k0 * N * (A + (1 - T + C) * A * A * A / 6
                + (5 - 18 * T + T * T + 72 * C - 58 * ePrimeSq) * A * A * A * A * A / 120);

  const northing = falseNorthing + k0 * (M + N * Math.tan(latRad) * (A * A / 2
                 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
                 + (61 - 58 * T + T * T + 600 * C - 330 * ePrimeSq) * A * A * A * A * A * A / 720));

  return `Zone ${zoneNumber} | E: ${Math.floor(easting)} N: ${Math.floor(northing)}`;
};

// --- EXPORT UTILITIES ---

export const downloadFile = (content: string, fileName: string, contentType: string) => {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
};

export const convertLogsToCSV = (logs: ScanLog[]): string => {
  const header = "Date,Time,Checkpoint Name,Officer ID,Status,Note,Distance Deviation (m),Location Lat,Location Lng,Accuracy (m)\n";
  const rows = logs.map(log => {
    const date = formatDate(log.timestamp);
    const time = formatTime(log.timestamp);
    const note = log.note ? `"${log.note.replace(/"/g, '""')}"` : "";
    const status = log.status;
    const distance = log.distanceFromTarget ? Math.round(log.distanceFromTarget) : "";
    const lat = log.userLocation?.latitude || "";
    const lng = log.userLocation?.longitude || "";
    const acc = log.userLocation?.accuracy ? Math.round(log.userLocation.accuracy) : "";
    
    return `${date},${time},"${log.checkpointName}",${log.officerId},${status},${note},${distance},${lat},${lng},${acc}`;
  }).join("\n");

  return header + rows;
};