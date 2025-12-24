import { parseCSV } from './csvParser';
import type { GeolocationData, Connection, UserMapData } from '../types/index';

type ProgressReporter = (message: string, progressValue?: number, progressText?: string) => void;

const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 3;
const CONCURRENCY_LIMIT = 4;

async function geocodeIPs(
  ips: string[],
  onProgress: ProgressReporter,
  startProgress: number = 0,
  endProgress: number = 100
): Promise<Map<string, GeolocationData>> {
  const geoMap = new Map<string, GeolocationData>();
  if (ips.length === 0) {
    onProgress(`Geocoding complete.`, endProgress, `0`);
    return geoMap;
  }

  const ipChunks: string[][] = [];
  for (let i = 0; i < ips.length; i += 100) ipChunks.push(ips.slice(i, i + 100));
  
  const totalChunks = ipChunks.length;
  let completedChunks = 0;
  const progressRange = endProgress - startProgress;

  const processChunk = async (chunk: string[]) => {
    let attempts = 0;
    while (attempts < MAX_RETRIES) {
      try {
        const payload = chunk.map(ip => ({ query: ip, fields: 'query,lon,lat' }));
        const response = await fetch('https://ip-geolocation-api.eudaeon.workers.dev/', { 
          method: 'POST', 
          body: JSON.stringify(payload) 
        });
        if (!response.ok) throw new Error(`${response.status}`);

        const geoData: GeolocationData[] = await response.json();
        for (const geo of geoData) {
          if (geo.lat !== undefined && geo.lon !== undefined) {
            geoMap.set(geo.query, geo);
          }
        }
        
        completedChunks++;
        onProgress(
          `Geocoding IPs...`, 
          Math.min(Math.round(startProgress + (completedChunks / totalChunks) * progressRange), endProgress - 1), 
          `${geoMap.size}`
        );
        return;
      } catch (e) {
        attempts++;
        if (attempts < MAX_RETRIES) await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempts));
      }
    }
  };

  const pool: Promise<void>[] = [];
  for (const chunk of ipChunks) {
    const p = processChunk(chunk).finally(() => {
      const idx = pool.indexOf(p);
      if (idx > -1) pool.splice(idx, 1);
    });
    pool.push(p);
    if (pool.length >= CONCURRENCY_LIMIT) await Promise.race(pool);
  }
  await Promise.all(pool);

  onProgress(`Geocoding complete.`, endProgress - 1, `${geoMap.size}`);
  return geoMap;
}

function assignColors(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `hsl(${(i * 360) / count}, 90%, 70%)`);
}

export async function processLogFile(file: File, onProgress: ProgressReporter): Promise<UserMapData[]> {
  onProgress('Reading file...', 5, '');
  const logs = parseCSV(await file.text());
  if (logs.length === 0) throw new Error('No valid log entries found in the file.');

  const geoData = await geocodeIPs([...new Set(logs.map(log => log.ip))], onProgress, 10, 90);
  onProgress('Processing connections...', 95);

  const userGroups = new Map<string, Connection[]>();
  for (const log of logs) {
    const geo = geoData.get(log.ip);
    if (geo) {
      const conn: Connection = { ...log, lat: geo.lat, lon: geo.lon };
      if (!userGroups.has(conn.user)) userGroups.set(conn.user, []);
      userGroups.get(conn.user)!.push(conn);
    }
  }

  if (userGroups.size === 0) throw new Error('Could not geocode any IP addresses from the file.');

  const sortedUsers = [...userGroups.keys()].sort((a, b) => a.localeCompare(b));
  const colors = assignColors(sortedUsers.length);

  return sortedUsers.map((user, i): UserMapData => {
    const conns = userGroups.get(user)!.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return { 
      user, 
      color: colors[i] || '#7dd3fc', 
      allConnections: conns, 
      latestConnection: conns[conns.length - 1]! 
    };
  });
}