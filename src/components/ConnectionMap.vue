<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { PropType } from 'vue';
import type { UserMapData } from '../types/index';
import { clusterLocations, type MarkerData } from '../utils/mapClustering';
import L from 'leaflet';
import { useConnectionData } from '../composables/useConnectionData';

const props = defineProps({
  users: {
    type: Array as PropType<UserMapData[]>,
    required: true,
  },
});

const { allUsers } = useConnectionData();
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let markersLayer = L.layerGroup();
const iconCache = new Map<string, L.DivIcon>();
const zoomCache = new Map<number, MarkerData[]>();
const svgPathCache = new Map<string, string>();

const popupPriority = new Map<string, number>();
const expandedSections = new Set<string>();

let isUpdatingMap = false;
let highestZIndex = 10000;
let priorityCounter = 0;
let lastAllUsersRef = allUsers.value;

function bringToFront(el: HTMLElement, ips?: string[]) {
  highestZIndex++;
  priorityCounter++;
  el.style.zIndex = highestZIndex.toString();
  if (ips) {
    ips.forEach((ip) => popupPriority.set(ip, priorityCounter));
  }
}

function getArcPath(
  center: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const key = `${radius}-${startAngle}-${endAngle}`;
  if (svgPathCache.has(key)) return svgPathCache.get(key)!;

  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = center + radius * Math.cos(startRad);
  const y1 = center + radius * Math.sin(startRad);
  const x2 = center + radius * Math.cos(endRad);
  const y2 = center + radius * Math.sin(endRad);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  const d = `M ${center},${center} L ${x1},${y1} A ${radius},${radius} 0 ${largeArcFlag} 1 ${x2},${y2} Z`;
  svgPathCache.set(key, d);
  return d;
}

function createMarkerIcon(markerData: MarkerData): L.DivIcon {
  const userColors: string[] = [];
  for (const data of markerData.users.values()) {
    userColors.push(data.color);
  }
  const uniqueColors = [...new Set(userColors)].sort();
  const isCluster = markerData.ips.length > 1;
  const count = markerData.ips.length;
  const cacheKey = uniqueColors.join(',') + `-${count}`;

  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;

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
      svg += `<path d="${getArcPath(center, radius - 1, startAngle, endAngle)}" fill="${uniqueColors[i]}" />`;
      startAngle = endAngle;
    }
    svg += `<circle cx="${center}" cy="${center}" r="${radius - 1}" fill="none" stroke="${stroke}" stroke-width="1" />`;
  }

  if (isCluster) {
    svg += `<circle cx="${center}" cy="${center}" r="${innerRadius}" fill="${bgColor}" stroke="${stroke}" stroke-width="1" />`;
    svg += `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="12px" fill="${textColor}">${count}</text>`;
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
    content += `<h3>Cluster (${markerData.ips.length} Locations)</h3><div class="cluster-ip-list"><strong>IPs:</strong><ul class="ip-list-ul">`;
    for (const ip of markerData.ips) content += `<li>${ip}</li>`;
    content += `</ul></div>`;
  } else {
    content += `<h3>${markerData.ips[0]}</h3>`;
  }

  const sortedUsers = Array.from(markerData.users.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [user, data] of sortedUsers) {
    const isExpanded = markerData.ips.some((ip) =>
      expandedSections.has(`${ip}|${user}`)
    );
    content += `<details class="user-details" ${isExpanded ? 'open' : ''} data-user="${user}"><summary><span class="user-dot" style="background-color: ${data.color};"></span><strong>${user}</strong><span class="conn-count">(${data.connections.length})</span></summary><ul class="connection-list">`;
    data.connections.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    for (const conn of data.connections) {
      content += `<li class="connection-item"><div class="connection-header"><div class="timestamp-stack"><div class="ts-date">${conn.timestamp.toLocaleDateString()}</div><div class="ts-time">${conn.timestamp.toLocaleTimeString()}</div></div>${markerData.ips.length > 1 ? `<span class="connection-ip">${conn.ip}</span>` : ''}</div><ul class="connection-details"><li><span class="cat-label">Status:</span> ${conn.status || 'N/A'}</li><li><span class="cat-label">Reason:</span> ${conn.reason || 'N/A'}</li><li><span class="cat-label">Application:</span> ${conn.application || 'N/A'}</li><li><span class="cat-label">Browser:</span> ${conn.browser || 'N/A'}</li><li><span class="cat-label">OS:</span> ${conn.os || 'N/A'}</li><li><span class="cat-label">Managed:</span> ${conn.managed || 'N/A'}</li><li><span class="cat-label">Compliant:</span> ${conn.compliant || 'N/A'}</li><li><span class="cat-label">MFA Requirement:</span> ${conn.mfaRequirement || 'N/A'}</li><li><span class="cat-label">MFA Method:</span> ${conn.mfaMethod || 'N/A'}</li></ul></li>`;
    }
    content += '</ul></details>';
  }
  return content + '</div>';
}

function initMap() {
  if (mapContainer.value && !map) {
    const bounds = L.latLngBounds(L.latLng(-85.05, -180), L.latLng(85.05, 180));
    map = L.map(mapContainer.value, {
      renderer: L.canvas(),
      attributionControl: false,
      center: [20, 0],
      zoom: 3,
      minZoom: 3,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
      closePopupOnClick: false,
      doubleClickZoom: false,
    });

    const isDark = document.documentElement.classList.contains('dark');
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    const tileLayer = L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 20,
      noWrap: true,
    }).addTo(map);
    (map as any).tileLayer = tileLayer;
    markersLayer.addTo(map);

    map.on('popupopen', (e) => {
      const markerIps = (e.popup as any)._markerIps as string[];
      const el = e.popup.getElement();
      if (el) {
        if (!isUpdatingMap) bringToFront(el, markerIps);
        el.addEventListener('mousedown', () => bringToFront(el, markerIps));
        el.querySelectorAll('details.user-details').forEach((details) => {
          details.addEventListener('toggle', () => {
            const user = details.getAttribute('data-user');
            if (user && markerIps) {
              markerIps.forEach((ip) => {
                if ((details as HTMLDetailsElement).open)
                  expandedSections.add(`${ip}|${user}`);
                else expandedSections.delete(`${ip}|${user}`);
              });
            }
          });
        });
      }
    });

    map.on('popupclose', (e) => {
      if (!isUpdatingMap) {
        const markerIps = (e.popup as any)._markerIps;
        if (markerIps)
          markerIps.forEach((ip: string) => popupPriority.delete(ip));
      }
    });

    map.on('zoomend', () => debouncedUpdate(false));
  }
}

let updateTimeout: number | null = null;
function debouncedUpdate(shouldFitBounds = false) {
  if (updateTimeout) window.clearTimeout(updateTimeout);
  updateTimeout = window.setTimeout(() => updateMap(shouldFitBounds), 50);
}

function updateMap(shouldFitBounds = false) {
  if (!map) return;
  const currentZoom = map.getZoom();
  let finalMarkers: MarkerData[] = [];

  if (zoomCache.has(currentZoom) && !shouldFitBounds) {
    finalMarkers = zoomCache.get(currentZoom)!;
  } else if (props.users.length > 0) {
    finalMarkers = clusterLocations(props.users, map);
    if (!shouldFitBounds) zoomCache.set(currentZoom, finalMarkers);
  }

  isUpdatingMap = true;
  markersLayer.clearLayers();
  if (shouldFitBounds) iconCache.clear();

  const markersToReopen: { marker: L.Marker; priority: number }[] = [];

  for (const markerData of finalMarkers) {
    const marker = L.marker([markerData.lat, markerData.lon], {
      icon: createMarkerIcon(markerData),
    });
    const popup = L.popup({
      autoClose: false,
      closeOnClick: false,
      autoPan: false,
      maxWidth: 320,
    }).setContent(createPopupContent(markerData));
    (popup as any)._markerIps = markerData.ips;
    marker.bindPopup(popup).on('click', () => {
      const p = marker.getPopup();
      if (p?.isOpen()) {
        const pel = p.getElement();
        if (pel) bringToFront(pel, markerData.ips);
      }
    });

    markersLayer.addLayer(marker);
    let maxPriority = -1;
    for (const ip of markerData.ips) {
      if (popupPriority.has(ip))
        maxPriority = Math.max(maxPriority, popupPriority.get(ip)!);
    }
    if (maxPriority !== -1)
      markersToReopen.push({ marker, priority: maxPriority });
  }

  markersToReopen
    .sort((a, b) => a.priority - b.priority)
    .forEach((item) => item.marker.openPopup());
  isUpdatingMap = false;
  if (shouldFitBounds && markersLayer.getLayers().length > 0) {
    map.fitBounds(
      L.featureGroup(markersLayer.getLayers() as L.Layer[])
        .getBounds()
        .pad(0.1)
    );
  }
}

onMounted(() => {
  initMap();
  updateMap(false);
  const themeObserver = new MutationObserver(() => {
    if (map && (map as any).tileLayer) {
      const isDark = document.documentElement.classList.contains('dark');
      (map as any).tileLayer.setUrl(
        isDark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      );
      iconCache.clear();
      updateMap(false);
    }
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
});

watch(
  () => props.users,
  () => {
    zoomCache.clear();
    const isNewData = allUsers.value !== lastAllUsersRef;
    if (isNewData) lastAllUsersRef = allUsers.value;
    debouncedUpdate(false);
  },
  { deep: true }
);
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
:deep(.user-details summary) {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  position: sticky;
  top: -1px;
  background-color: var(--color-popup-bg);
  z-index: 10;
  border-bottom: 1px solid var(--color-border);
}
:deep(.user-dot) {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}
:deep(.connection-header) {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  width: 100%;
}
:deep(.connection-header) > *:first-child {
  max-width: 40%;
}
:deep(.connection-header) > *:not(:first-child) {
  max-width: 60%;
}
:deep(.ts-date) {
  font-weight: 600;
  color: var(--color-text);
}
:deep(.connection-ip) {
  font-size: 0.85rem;
  font-weight: 600;
  background: var(--color-button-hover-bg);
  padding: 2px 6px;
  border-radius: 4px;
  word-break: break-all;
}
:deep(.cat-label) {
  font-weight: 600;
}
</style>
