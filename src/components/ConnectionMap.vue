<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { PropType } from 'vue';
import type { UserMapData } from '../types/index';
import {
  clusterLocations,
  type MarkerData,
} from '../utils/mapClustering';
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

const zoomCache = new Map<number, MarkerData[]>();

function createMarkerIcon(markerData: MarkerData): L.DivIcon {
  const userColors: string[] = [];
  for (const data of markerData.users.values()) {
    userColors.push(data.color);
  }
  const uniqueColors = [...new Set(userColors)].sort();

  const isCluster = markerData.ips.length > 1;
  const count = markerData.ips.length;

  const cacheKey = uniqueColors.join(',') + `-${count}`;

  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  const colorCount = uniqueColors.length;
  const size = isCluster ? 40 : 24;
  const center = size / 2;
  const radius = size / 2;
  const innerRadius = isCluster ? radius - 6 : 0;

  const stroke = document.documentElement.classList.contains('dark')
    ? '#e5e7eb'
    : '#374151';
  const bgColor = document.documentElement.classList.contains('dark')
    ? '#1f2937'
    : '#ffffff';
  const textColor = document.documentElement.classList.contains('dark')
    ? '#e5e7eb'
    : '#111827';

  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;

  if (colorCount === 1) {
    svg += `<circle cx="${center}" cy="${center}" r="${radius - 1}" fill="${uniqueColors[0]}" stroke="${stroke}" stroke-width="1" />`;
  } else {
    let startAngle = -90;
    const sliceAngle = 360 / colorCount;

    for (let i = 0; i < colorCount; i++) {
      const endAngle = startAngle + sliceAngle;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = center + (radius - 1) * Math.cos(startRad);
      const y1 = center + (radius - 1) * Math.sin(startRad);
      const x2 = center + (radius - 1) * Math.cos(endRad);
      const y2 = center + (radius - 1) * Math.sin(endRad);

      const largeArcFlag = sliceAngle <= 180 ? 0 : 1;

      const d = [
        `M ${center},${center}`,
        `L ${x1},${y1}`,
        `A ${radius - 1},${radius - 1} 0 ${largeArcFlag} 1 ${x2},${y2}`,
        'Z',
      ].join(' ');

      svg += `<path d="${d}" fill="${uniqueColors[i]}" />`;
      startAngle = endAngle;
    }
    svg += `<circle cx="${center}" cy="${center}" r="${radius - 1}" fill="none" stroke="${stroke}" stroke-width="1" />`;
  }

  if (isCluster) {
    svg += `<circle cx="${center}" cy="${center}" r="${innerRadius}" fill="${bgColor}" stroke="${stroke}" stroke-width="1" />`;

    svg += `
      <text 
        x="50%" 
        y="50%" 
        dy="0.35em" 
        text-anchor="middle" 
        font-family="sans-serif" 
        font-weight="bold" 
        font-size="12px" 
        fill="${textColor}"
      >${count}</text>
    `;
  }

  svg += '</svg>';

  const icon = L.divIcon({
    html: svg,
    className: 'custom-map-icon',
    iconSize: [size, size],
    iconAnchor: [center, center],
    popupAnchor: [0, -center],
  });

  iconCache.set(cacheKey, icon);
  return icon;
}

function createPopupContent(markerData: MarkerData): string {
  let content = '<div class="map-popup-content">';

  if (markerData.ips.length > 1) {
    content += `<h3>Cluster (${markerData.ips.length} Locations)</h3>`;
    content += `<div class="cluster-ip-list">`;
    content += `<strong>IPs:</strong>`;
    content += `<ul class="ip-list-ul">`;
    for (const ip of markerData.ips) {
      content += `<li>${ip}</li>`;
    }
    content += `</ul>`;
    content += `</div>`;
  } else {
    content += `<h3>${markerData.ips[0]}</h3>`;
  }

  const sortedUsers = Array.from(markerData.users.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [user, data] of sortedUsers) {
    content += `<details class="user-details">`;
    content += `<summary>`;
    content += `<span class="user-dot" style="background-color: ${data.color};"></span>`;
    content += `<strong>${user}</strong>`;
    content += `<span class="conn-count">(${data.connections.length})</span>`;
    content += `</summary>`;

    content += '<ul class="connection-list">';

    data.connections.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    for (const conn of data.connections) {
      content += `<li class="connection-item">`;
      content += `<div class="connection-header">`;

      content += `<div class="timestamp-stack">`;
      content += `<div class="ts-date">${conn.timestamp.toLocaleDateString()}</div>`;
      content += `<div class="ts-time">${conn.timestamp.toLocaleTimeString()}</div>`;
      content += `</div>`;

      if (markerData.ips.length > 1) {
        content += `<span class="connection-ip">${conn.ip}</span>`;
      }

      content += `</div>`;

      content += `<ul class="connection-details">`;

      if (conn.application)
        content += `<li><span class="cat-label">Application:</span> ${conn.application}</li>`;
      if (conn.browser)
        content += `<li><span class="cat-label">Browser:</span> ${conn.browser}</li>`;
      if (conn.userAgent)
        content += `<li><span class="cat-label">User Agent:</span> ${conn.userAgent}</li>`;
      if (conn.os)
        content += `<li><span class="cat-label">OS:</span> ${conn.os}</li>`;
      if (conn.managed)
        content += `<li><span class="cat-label">Managed:</span> ${conn.managed}</li>`;
      if (conn.compliant)
        content += `<li><span class="cat-label">Compliant:</span> ${conn.compliant}</li>`;

      if (conn.mfaRequirement) {
        content += `<li><span class="cat-label">MFA Requirement:</span> ${conn.mfaRequirement}</li>`;
        if (
          conn.mfaRequirement.toLowerCase().includes('multifacteur') &&
          conn.mfaMethod
        ) {
          content += `<li><span class="cat-label">MFA Method:</span> ${conn.mfaMethod}</li>`;
        }
      }

      content += `</ul>`;
      content += `</li>`;
    }
    content += '</ul>';
    content += `</details>`;
  }
  content += '</div>';

  return content;
}

function initMap() {
  if (mapContainer.value && !map) {
    const maxLat = 85.05112878;
    const minLat = -85.05112878;
    const bounds = L.latLngBounds(L.latLng(minLat, -180), L.latLng(maxLat, 180));

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
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
      noWrap: true,
    }).addTo(map);

    (map as any).tileLayer = tileLayer;
    markersLayer.addTo(map);

    map.on('zoomend', () => {
      updateMap(false);
    });
  }
}

function fitMapBounds() {
  if (!map || markersLayer.getLayers().length === 0) return;
  const group = L.featureGroup(markersLayer.getLayers() as L.Layer[]);
  if (group.getLayers().length > 0) {
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

function updateMap(shouldFitBounds = false) {
  if (!map) return;
  
  requestAnimationFrame(() => {
    if (!map) return;
    
    const currentZoom = map.getZoom();
    
    let finalMarkers: MarkerData[] = [];
    
    if (zoomCache.has(currentZoom) && !shouldFitBounds) {
      finalMarkers = zoomCache.get(currentZoom)!;
    } else {
      if (props.users.length > 0) {
         finalMarkers = clusterLocations(props.users, map!);
         if (!shouldFitBounds) {
           zoomCache.set(currentZoom, finalMarkers);
         }
      }
    }

    markersLayer.clearLayers();
    
    if (shouldFitBounds) iconCache.clear();

    for (const markerData of finalMarkers) {
      const icon = createMarkerIcon(markerData);
      const marker = L.marker([markerData.lat, markerData.lon], {
        icon,
      }).bindPopup(createPopupContent(markerData));
      markersLayer.addLayer(marker);
    }

    if (shouldFitBounds) {
      fitMapBounds();
    }
  });
}

onMounted(() => {
  initMap();
  updateMap(true);

  const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && map && (map as any).tileLayer) {
        const isDark = document.documentElement.classList.contains('dark');
        const newUrl = isDark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

        (map as any).tileLayer.setUrl(newUrl);
        iconCache.clear();
        updateMap(false);
      }
    });
  });
  themeObserver.observe(document.documentElement, { attributes: true });
});

watch(() => props.users, () => {
  zoomCache.clear();
  updateMap(true);
}, { deep: true });
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

:deep(.map-popup-content) {
  font-family: system-ui, sans-serif;
}
:deep(.map-popup-content h3) {
  margin-top: 0;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}
:deep(.cluster-ip-list) {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
  max-height: 80px;
  overflow-y: auto;
}
:deep(.ip-list-ul) {
  margin: 4px 0 0 0;
  padding-left: 20px;
  list-style-type: disc;
}
:deep(.user-details summary) {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}
:deep(.user-dot) {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}
:deep(.conn-count) {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
:deep(.connection-header) {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  width: 100%;
}
:deep(.timestamp-stack) {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  text-align: left;
  flex-shrink: 0;
}
:deep(.ts-date) {
  font-weight: 600;
  color: var(--color-text);
}
:deep(.ts-time) {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
:deep(.cat-label) {
  font-weight: 700;
}
:deep(.connection-ip) {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-button-hover-bg);
  padding: 2px 6px;
  border-radius: 4px;
  word-break: break-all;
  text-align: right;
  max-width: 60%;
}
</style>