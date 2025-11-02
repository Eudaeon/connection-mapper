<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { PropType } from 'vue';
import type { UserMapData, Connection } from '../types';
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
  const userColors = Array.from(ipData.users.values()).map(u => u.color);
  const uniqueColors = [...new Set(userColors)];
  const cacheKey = uniqueColors.sort().join(',');

  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  const count = uniqueColors.length;
  const size = 24;
  const center = size / 2;
  const radius = size / 2 - 1; // Leave 1px for border
  const stroke = "#e5e7eb";
  
  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.7));">`;

  if (count === 1) {
    svg += `<circle cx="${center}" cy="${center}" r="${radius}" fill="${uniqueColors[0]}" stroke="${stroke}" stroke-width="1" />`;
  } else {
    // Multi-user pie chart
    let startAngle = -90; // Start at the top
    const sliceAngle = 360 / count;

    for (let i = 0; i < count; i++) {
      const endAngle = startAngle + sliceAngle;

      // Calculate start and end points
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      // Flag for arcs larger than 180 degrees
      const largeArcFlag = sliceAngle <= 180 ? 0 : 1;

      // Create the path for the pie slice
      const d = [
        `M ${center},${center}`, // Move to center
        `L ${x1},${y1}`,       // Line to start of arc
        `A ${radius},${radius} 0 ${largeArcFlag} 1 ${x2},${y2}`, // Arc to end
        'Z' // Close path
      ].join(' ');

      svg += `<path d="${d}" fill="${uniqueColors[i]}" />`;

      startAngle = endAngle;
    }
    
    // Add an outer border circle
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
    content += `<div style="margin-top: 10px; margin-bottom: 10px;">`;
    content += `<strong style="color: ${data.color};">${user}</strong>`;
    content += '<ul>';
    for (const conn of data.connections) {
      content += `<li>${conn.timestamp.toLocaleString()}</li>`;
    }
    content += '</ul></div>';
  }
  
  return content;
}

function initMap() {
  if (mapContainer.value && !map) {
    // Define the map boundaries to prevent vertical panning off-map
    const maxLat = 85.05112878; // Max latitude for Web Mercator
    const minLat = -85.05112878; // Min latitude for Web Mercator
    const bounds = L.latLngBounds(L.latLng(minLat, -180), L.latLng(maxLat, 180));

    map = L.map(mapContainer.value, {
      attributionControl: false,
      center: [20, 0],
      zoom: 3,
      minZoom: 3,
      maxBounds: bounds, // Set the boundaries
      maxBoundsViscosity: 1.0 // Make the boundaries solid
    });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      noWrap: true // Prevent horizontal wrapping
    }).addTo(map);

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
      userData.connections.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    const icon = createMarkerIcon(ipData);
    const marker = L.marker([ipData.lat, ipData.lon], { icon })
      .bindPopup(createPopupContent(ipData));
    
    markersLayer.addLayer(marker);
    allMarkers.push(marker);
  }

  const group = L.featureGroup(allMarkers);
  map.fitBounds(group.getBounds().pad(0.1));
}

onMounted(() => {
  initMap();
  updateMap();
});

watch(() => props.users, updateMap, { deep: true });
</script>

<template>
  <div ref="mapContainer" class="w-full h-full absolute top-0 left-0 z-0"></div>
</template>

<style>
/* Make Leaflet popups dark-themed */
.leaflet-popup-content-wrapper {
  background-color: #1f2937;
  color: #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
.leaflet-popup-content {
  margin: 12px;
  max-width: 300px;
  max-height: 250px; /* Constrain height */
  overflow-y: auto; /* Add vertical scrollbar when needed */
}
.leaflet-popup-content h3 {
  font-size: 1.1rem;
  font-weight: 600;
  border-bottom: 1px solid #4b5563;
  padding-bottom: 5px;
  margin-top: 0;
  
  overflow-wrap: break-word;
  word-break: break-all;
}
.leaflet-popup-content ul {
  list-style-type: disc;
  padding-left: 20px;
  margin-top: 5px;
  font-size: 0.9rem;
  
  overflow-wrap: break-word;
  word-break: break-all;
}
.leaflet-popup-content strong {
  overflow-wrap: break-word;
  word-break: break-all;
  display: inline-block;
}
.leaflet-popup-tip {
  background-color: #1f2937;
}
.leaflet-popup-close-button {
  color: #9ca3af !important;
}
.leaflet-popup-close-button:hover {
  color: #ffffff !important;
}
</style>

