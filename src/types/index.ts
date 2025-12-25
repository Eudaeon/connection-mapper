export interface LogEntry {
  user: string;
  ip: string;
  timestamp: Date;

  // Fields for Sign-in Log
  application?: string;
  mfaRequirement?: string;
  mfaMethod?: string;

  // Fields for Audit Log
  userAgent?: string;

  // Shared fields (parsed from both log types)
  os?: string;
  browser?: string;
  compliant?: string;
  managed?: string;
  status?: string;
  reason?: string;
}

export interface GeolocationData {
  lat: number;
  lon: number;
  query: string; // The IP address
}

export interface Connection extends LogEntry {
  lat: number;
  lon: number;
}

export interface UserMapData {
  user: string;
  color: string;
  allConnections: Connection[];
  latestConnection?: Connection;
}
