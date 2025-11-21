import { parseCSV } from './csvParser';
import type { GeolocationData, Connection, UserMapData } from '../types/index';

type ProgressReporter = (
  message: string,
  progressValue?: number,
  progressText?: string
) => void;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 3;

async function geocodeIPs(
  ips: string[],
  onProgress: ProgressReporter,
  startProgress: number = 0,
  endProgress: number = 100
): Promise<Map<string, GeolocationData>> {
  const geoMap = new Map<string, GeolocationData>();
  const totalIps = ips.length;

  if (totalIps === 0) {
    onProgress(`Geocoding complete.`, endProgress, `0`);
    return geoMap;
  }

  const ipChunks: string[][] = [];
  for (let i = 0; i < totalIps; i += 100) {
    ipChunks.push(ips.slice(i, i + 100));
  }
  const totalChunks = ipChunks.length;
  let completedChunks = 0;
  const progressRange = endProgress - startProgress;

  const updateOverallProgress = () => {
    const fractionalProgress = completedChunks / totalChunks;
    const progressPercent = Math.round(
      startProgress + fractionalProgress * progressRange
    );
    onProgress(
      `Geocoding IPs...`,
      Math.min(progressPercent, endProgress - 1),
      `${geoMap.size}`
    );
  };

  const processChunk = async (chunk: string[]): Promise<void> => {
    let attempts = 0;
    while (attempts < MAX_RETRIES) {
      try {
        const payload = chunk.map((ip) => ({
          query: ip,
          fields: 'query,lon,lat',
        }));
        const response = await fetch(
          'https://ip-geolocation-api.eudaeon.workers.dev/',
          { method: 'POST', body: JSON.stringify(payload) }
        );

        if (!response.ok) throw new Error(`${response.status}`);

        const geoData: GeolocationData[] = await response.json();
        for (const geo of geoData) {
          if (geo.lat && geo.lon) {
            geoMap.set(geo.query, geo);
          }
        }
        completedChunks++;
        updateOverallProgress();
        return;
      } catch (e) {
        attempts++;
        if (attempts >= MAX_RETRIES)
          console.warn(`Failed chunk after ${MAX_RETRIES} attempts`, e);
        else await sleep(RETRY_DELAY_MS * attempts);
      }
    }
  };

  await Promise.all(ipChunks.map((chunk) => processChunk(chunk)));

  onProgress(`Geocoding complete.`, endProgress - 1, `${geoMap.size}`);
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

export async function processLogFile(
  file: File,
  onProgress: ProgressReporter
): Promise<UserMapData[]> {
  onProgress('Reading file...', 5, '');
  const csvContent = await file.text();

  onProgress('Parsing CSV...', 10, '');
  await sleep(10);

  const logs = parseCSV(csvContent);
  if (logs.length === 0) {
    throw new Error('No valid log entries found in the file.');
  }

  const uniqueIPs = [...new Set(logs.map((log) => log.ip))];
  const geoData = await geocodeIPs(uniqueIPs, onProgress, 10, 90);

  onProgress('Processing connections...', 95);
  await sleep(10);

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

  const users = [...new Set(connections.map((c) => c.user))]
    .filter((user): user is string => user !== undefined)
    .sort((a, b) => a.localeCompare(b));
  const userColors = assignColors(users.length);
  const userMap = new Map<string, UserMapData>();

  for (let i = 0; i < users.length; i++) {
    const user = users[i] as string;
    const userConnections = connections
      .filter((c) => c.user === user)
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

  onProgress('Successfully processed data.', 100);
  return [...userMap.values()];
}
