import L from 'leaflet';
import type { UserMapData, Connection } from '../types/index';

export interface MarkerData {
  ips: string[];
  lat: number;
  lon: number;
  users: Map<string, { color: string; connections: Connection[] }>;
}

export function clusterLocations(
  users: UserMapData[],
  mapInstance: L.Map
): MarkerData[] {
  const uniqueLocations = new Map<string, MarkerData>();

  for (const user of users) {
    for (const conn of user.allConnections) {
      if (!conn.lat || !conn.lon) continue;

      if (!uniqueLocations.has(conn.ip)) {
        uniqueLocations.set(conn.ip, {
          ips: [conn.ip],
          lat: conn.lat,
          lon: conn.lon,
          users: new Map(),
        });
      }

      const locData = uniqueLocations.get(conn.ip)!;
      if (!locData.users.has(user.user)) {
        locData.users.set(user.user, {
          color: user.color,
          connections: [],
        });
      }
      locData.users.get(user.user)!.connections.push(conn);
    }
  }

  if (uniqueLocations.size === 0) return [];

  const CLUSTER_THRESHOLD_PX = 50;
  const finalMarkers: MarkerData[] = [];

  const grid = new Map<string, MarkerData>();

  function getGridKey(point: L.Point): string {
    const x = Math.floor(point.x / CLUSTER_THRESHOLD_PX);
    const y = Math.floor(point.y / CLUSTER_THRESHOLD_PX);
    return `${x}:${y}`;
  }

  for (const candidate of uniqueLocations.values()) {
    const point = mapInstance.latLngToLayerPoint([
      candidate.lat,
      candidate.lon,
    ]);
    const gridKey = getGridKey(point);

    let foundCluster: MarkerData | null = null;

    const [gx, gy] = gridKey.split(':').map(Number) as [number, number];

    searchLoop: for (let x = gx - 1; x <= gx + 1; x++) {
      for (let y = gy - 1; y <= gy + 1; y++) {
        const neighborKey = `${x}:${y}`;
        const neighbor = grid.get(neighborKey);

        if (neighbor) {
          const neighborPoint = mapInstance.latLngToLayerPoint([
            neighbor.lat,
            neighbor.lon,
          ]);
          if (point.distanceTo(neighborPoint) < CLUSTER_THRESHOLD_PX) {
            foundCluster = neighbor;
            break searchLoop;
          }
        }
      }
    }

    if (foundCluster) {
      foundCluster.ips.push(...candidate.ips);
      for (const [user, data] of candidate.users) {
        if (!foundCluster.users.has(user)) {
          foundCluster.users.set(user, {
            color: data.color,
            connections: [...data.connections],
          });
        } else {
          foundCluster.users.get(user)!.connections.push(...data.connections);
        }
      }
    } else {
      const usersClone = new Map();
      for (const [u, d] of candidate.users) {
        usersClone.set(u, { color: d.color, connections: [...d.connections] });
      }

      const newMarker: MarkerData = {
        ips: [...candidate.ips],
        lat: candidate.lat,
        lon: candidate.lon,
        users: usersClone,
      };

      finalMarkers.push(newMarker);
      grid.set(gridKey, newMarker);
    }
  }

  return finalMarkers;
}
