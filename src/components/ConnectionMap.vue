<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { PropType } from 'vue';
import type { UserMapData, Connection } from '../types/index';
import L from 'leaflet';

const props = defineProps({
  users: {
    type: Array as PropType<UserMapData[]>,
    required: true,
  },
});

const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let markersLayer = L.layerGroup();
const iconCache = new Map<string, L.DivIcon>();

interface IpData {
  ip: string;
  lat: number;
  lon: number;
  users: Map<string, { color: string; connections: Connection[] }>;
}

function createMarkerIcon(ipData: IpData): L.DivIcon {
  const userColors = Array.from(ipData.users.values()).map((u) => u.color);
  const uniqueColors = [...new Set(userColors)];
  const cacheKey = uniqueColors.sort().join(',');

  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  const count = uniqueColors.length;
  const size = 24;
  const center = size / 2;
  const radius = size / 2 - 1;

  const stroke = document.documentElement.classList.contains('dark')
    ? '#e5e7eb'
    : '#374151';

  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.7));">`;

  if (count === 1) {
    svg += `<circle cx="${center}" cy="${center}" r="${radius}" fill="${uniqueColors[0]}" stroke="${stroke}" stroke-width="1" />`;
  } else {
    let startAngle = -90;
    const sliceAngle = 360 / count;

    for (let i = 0; i < count; i++) {
      const endAngle = startAngle + sliceAngle;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);
      const largeArcFlag = sliceAngle <= 180 ? 0 : 1;
      const d = [
        `M ${center},${center}`,
        `L ${x1},${y1}`,
        `A ${radius},${radius} 0 ${largeArcFlag} 1 ${x2},${y2}`,
        'Z',
      ].join(' ');
      svg += `<path d="${d}" fill="${uniqueColors[i]}" />`;
      startAngle = endAngle;
    }
    svg += `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${stroke}" stroke-width="1" />`;
  }
  svg += '</svg>';

  const icon = L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [center, center],
    popupAnchor: [0, -center],
  });
  iconCache.set(cacheKey, icon);
  return icon;
}

function createPopupContent(ipData: IpData): string {
  let content = `<h3>${ipData.ip}</h3>`;

  for (const [user, data] of ipData.users.entries()) {
    content += `<details style="margin-top: 10px; margin-bottom: 10px;">`;
    content += `<summary style="cursor: pointer; display: flex; align-items: center; gap: 6px;">`;
    content += `<span style="width: 12px; height: 12px; border-radius: 3px; background-color: ${data.color}; border: 1px solid var(--color-border); flex-shrink: 0;"></span>`;
    content += `<strong>${user}</strong>`;
    content += `</summary>`;

    content += '<ul class="connection-list">';
    for (const conn of data.connections) {
      content += `<li class="connection-item">`;
      content += `<span class="connection-timestamp">${conn.timestamp.toLocaleString()}</span>`;

      content += `<ul class="connection-details">`;

      if (conn.application)
        content += `<li>Application: ${conn.application}</li>`;
      if (conn.browser) content += `<li>Browser: ${conn.browser}</li>`;
      if (conn.userAgent) content += `<li>User Agent: ${conn.userAgent}</li>`;
      if (conn.os) content += `<li>Operating System: ${conn.os}</li>`;
      if (conn.managed) content += `<li>Managed: ${conn.managed}</li>`;
      if (conn.compliant) content += `<li>Compliant: ${conn.compliant}</li>`;

      if (conn.mfaRequirement) {
        content += `<li>MFA Requirement: ${conn.mfaRequirement}</li>`;
        if (
          conn.mfaRequirement.toLowerCase().includes('multifacteur') &&
          conn.mfaMethod
        ) {
          content += `<li>MFA Method: ${conn.mfaMethod}</li>`;
        }
      }

      content += `</ul>`;
      content += `</li>`;
    }
    content += '</ul>';
    content += `</details>`;
  }

  return content;
}

function initMap() {
  if (mapContainer.value && !map) {
    const maxLat = 85.05112878;
    const minLat = -85.05112878;
    const bounds = L.latLngBounds(
      L.latLng(minLat, -180),
      L.latLng(maxLat, 180)
    );

    map = L.map(mapContainer.value, {
      attributionControl: false,
      center: [20, 0],
      zoom: 3,
      minZoom: 3,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
    });

    const tileUrl = document.documentElement.classList.contains('dark')
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    const tileLayer = L.tileLayer(tileUrl, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      noWrap: true,
    }).addTo(map);

    map.createPane('tilePane');
    (map as any).tileLayer = tileLayer;

    markersLayer.addTo(map);
  }
}

function updateMap() {
  if (!map) return;

  markersLayer.clearLayers();
  iconCache.clear();

  if (props.users.length === 0) {
    map.setView([20, 0], 3);
    return;
  }

  const ipMap = new Map<string, IpData>();

  for (const user of props.users) {
    for (const conn of user.allConnections) {
      if (!conn.lat || !conn.lon) continue;

      if (!ipMap.has(conn.ip)) {
        ipMap.set(conn.ip, {
          ip: conn.ip,
          lat: conn.lat,
          lon: conn.lon,
          users: new Map(),
        });
      }

      const ipData = ipMap.get(conn.ip)!;

      if (!ipData.users.has(user.user)) {
        ipData.users.set(user.user, {
          color: user.color,
          connections: [],
        });
      }

      ipData.users.get(user.user)!.connections.push(conn);
    }
  }

  if (ipMap.size === 0) return;

  const allMarkers: L.Marker[] = [];
  for (const ipData of ipMap.values()) {
    for (const userData of ipData.users.values()) {
      userData.connections.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
    }

    const icon = createMarkerIcon(ipData);
    const marker = L.marker([ipData.lat, ipData.lon], { icon }).bindPopup(
      createPopupContent(ipData)
    );

    markersLayer.addLayer(marker);
    allMarkers.push(marker);
  }

  if (allMarkers.length > 0) {
    const group = L.featureGroup(allMarkers);
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

onMounted(() => {
  initMap();
  updateMap();

  const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && map && (map as any).tileLayer) {
        const isDark = document.documentElement.classList.contains('dark');
        const newUrl = isDark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

        (map as any).tileLayer.setUrl(newUrl);

        iconCache.clear();
        updateMap();
      }
    });
  });

  themeObserver.observe(document.documentElement, { attributes: true });
});

watch(() => props.users, updateMap, { deep: true });
</script>

<template>
  <div id="map-container" ref="mapContainer"></div>
</template>

<style scoped>
#map-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}
</style>
