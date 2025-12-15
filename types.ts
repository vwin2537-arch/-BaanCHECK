export enum Role {
  ADMIN = 'ADMIN',
  OFFICER = 'OFFICER'
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number; // GPS Accuracy in meters
}

export type ScheduleType = 'NONE' | 'FIXED_TIME' | 'INTERVAL';

export interface ScheduleConfig {
  type: ScheduleType;
  // For FIXED_TIME: Array of "HH:mm" strings (e.g., ["08:00", "14:00"])
  fixedTimes?: string[];
  // For INTERVAL: Minutes (e.g., 90 for every 1.5 hours)
  intervalMinutes?: number;
  // Window of leniency in minutes (e.g. check within +/- 15 mins)
  toleranceMinutes?: number; 
}

export interface Checkpoint {
  id: string;
  name: string;
  location: Coordinates;
  allowedRadiusMeters: number;
  schedule?: ScheduleConfig; // Flexible scheduling
}

export enum ScanStatus {
  VALID = 'VALID',
  INVALID_LOCATION = 'INVALID_LOCATION',
  INVALID_TIME = 'INVALID_TIME',
  LATE = 'LATE',
  ISSUE_REPORTED = 'ISSUE_REPORTED'
}

export interface ScanLog {
  id: string;
  checkpointId: string;
  checkpointName: string;
  officerId: string;
  timestamp: number;
  status: ScanStatus;
  note?: string;
  userLocation?: Coordinates;
  distanceFromTarget?: number;
  evidencePhotoUrl?: string; // Placeholder for base64 or url
}

export interface User {
  id: string;
  name: string;
  role: Role;
}