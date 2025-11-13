<script setup lang="ts">
import { useConnectionData } from '../composables/useConnectionData';
import ConnectionMap from '../components/ConnectionMap.vue';
import ControlPanel from '../components/ControlPanel.vue';
import ThemeToggle from '../components/ThemeToggle.vue';
import UserPanel from '../components/UserPanel.vue';
import FilterPanel from '../components/FilterPanel.vue';
import TimelinePanel from '../components/TimelinePanel.vue';

// Initialize the composable to trigger its onMounted hook
// and get the reactive data
const { filteredUsers, isLoading } = useConnectionData();
</script>

<template>
  <div id="app-container">
    <ConnectionMap :users="filteredUsers" />
    <ControlPanel />
    <ThemeToggle />
    <UserPanel />
    <FilterPanel />
    <TimelinePanel />
    <div v-if="isLoading" class="loading-overlay"></div>
  </div>
</template>

<style scoped>
#app-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100; /* Must be above map but below panels */
}
</style>
