export interface LogEntry {
  user: string;
  ip: string;
  timestamp: Date;
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
