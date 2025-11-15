import pako from 'pako';
import type { UserMapData } from '../types/index';

export function generateShareUrl(data: UserMapData[]): string {
  try {
    const json = JSON.stringify(data);
    const compressed = pako.deflate(json);
    const binaryString = Array.from(compressed as Uint8Array, (byte: number) =>
      String.fromCharCode(byte)
    ).join('');
    const base64 = btoa(binaryString);
    return `${window.location.origin}${
      window.location.pathname
    }?data=${encodeURIComponent(base64)}`;
  } catch (e) {
    console.error('Error generating share URL:', e);
    return '';
  }
}

export function loadDataFromUrl(): UserMapData[] | null {
  const urlParams = new URLSearchParams(window.location.search);
  const data = urlParams.get('data');

  if (!data) {
    return null;
  }

  try {
    const base64 = decodeURIComponent(data);
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const decompressed = pako.inflate(bytes, { to: 'string' });
    const jsonData = JSON.parse(decompressed);

    if (Array.isArray(jsonData)) {
      for (const user of jsonData) {
        if (user?.allConnections && Array.isArray(user.allConnections)) {
          for (const conn of user.allConnections) {
            if (
              conn &&
              (typeof conn.timestamp === 'string' ||
                typeof conn.timestamp === 'number')
            ) {
              conn.timestamp = new Date(conn.timestamp);
            }
          }
        }

        if (
          user?.latestConnection &&
          user.latestConnection.timestamp &&
          (typeof user.latestConnection.timestamp === 'string' ||
            typeof user.latestConnection.timestamp === 'number')
        ) {
          user.latestConnection.timestamp = new Date(
            user.latestConnection.timestamp
          );
        }
      }
    }

    window.history.replaceState({}, document.title, window.location.pathname);
    return jsonData as UserMapData[];
  } catch (e) {
    console.error('Error loading shared map data:', e);
    window.history.replaceState({}, document.title, window.location.pathname);
    return null;
  }
}
