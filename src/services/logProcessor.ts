import { parseCSV } from './csvParser';
import type { GeolocationData, Connection, UserMapData } from '../types';

async function geocodeIPs(ips: string[], onProgress: (message: string) => void): Promise<Map<string, GeolocationData>> {
  const geoMap = new Map<string, GeolocationData>();
  const ipChunks: string[][] = [];
  
  for (let i = 0; i < ips.length; i += 100) {
    ipChunks.push(ips.slice(i, i + 100));
  }

  let processedCount = 0;
  for (const chunk of ipChunks) {
    onProgress(`Geocoding ${processedCount + 1}-${processedCount + chunk.length} of ${ips.length} IPs...`);
    try {
      const payload = chunk.map(ip => ({ query: ip, fields: "query,lon,lat" }));
      const response = await fetch('https://ip-geolocation-api.eudaeon.workers.dev/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const geoData: GeolocationData[] = await response.json();
      for (const geo of geoData) {
        if (geo.lat && geo.lon) {
          geoMap.set(geo.query, geo);
        }
      }
    } catch (e: any) {
      console.error(`Failed to geocode chunk: ${e.message}`);
    }
    processedCount += chunk.length;
  }
  
  onProgress(`Geocoding complete. Found locations for ${geoMap.size} IPs.`);
  return geoMap;
}

function assignColors(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 360) / count;
    colors.push(`hsl(${hue}, 90%, 70%)`);
  }
  return colors;
}

export async function processLogFile(file: File, onProgress: (message: string) => void): Promise<UserMapData[]> {
  onProgress('Reading file...');
  const csvContent = await file.text();

  onProgress('Parsing CSV...');
  const logs = parseCSV(csvContent);
  if (logs.length === 0) {
    throw new Error('No valid log entries found in the file.');
  }

  const uniqueIPs = [...new Set(logs.map(log => log.ip))];
  const geoData = await geocodeIPs(uniqueIPs, onProgress);

  onProgress('Processing connections...');
  const connections: Connection[] = [];
  for (const log of logs) {
    const geo = geoData.get(log.ip);
    if (geo) {
      connections.push({
        ...log,
        timestamp: new Date(log.timestamp),
        lat: geo.lat,
        lon: geo.lon,
      });
    }
  }

  if (connections.length === 0) {
    throw new Error('Could not geocode any IP addresses from the file.');
  }

  const users = [...new Set(connections.map(c => c.user))].filter((user): user is string => user !== undefined);
  const userColors = assignColors(users.length);
  const userMap = new Map<string, UserMapData>();

  for (let i = 0; i < users.length; i++) {
    const user = users[i] as string;
    const userConnections = connections
      .filter(c => c.user === user)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (userConnections.length > 0) {
      userMap.set(user, {
        user: user,
        color: userColors[i] ?? '#000000',
        allConnections: userConnections,
        latestConnection: userConnections[userConnections.length - 1],
      });
    }
  }

  onProgress('Finalizing data...');
  return [...userMap.values()];
}
