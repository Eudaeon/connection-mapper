<script setup lang="ts">
import { useConnectionData } from '../composables/useConnectionData';
import ConnectionMap from '../components/ConnectionMap.vue';
import ControlPanel from '../components/ControlPanel.vue';
import ThemeToggle from '../components/ThemeToggle.vue';
import UserPanel from '../components/UserPanel.vue';
import FilterPanel from '../components/FilterPanel.vue';
import TimelinePanel from '../components/TimelinePanel.vue';
import ProgressRing from '../components/ProgressRing.vue';

const { filteredUsers, isLoading, statusMessage, progressValue, progressText } =
  useConnectionData();
</script>

<template>
  <div id="app-container">
    <ConnectionMap :users="filteredUsers" />
    <ControlPanel />
    <ThemeToggle />
    <UserPanel />
    <FilterPanel />
    <TimelinePanel />

    <div v-if="isLoading" class="loading-overlay">
      <div class="loader-content">
        <ProgressRing
          :value="progressValue"
          :text="progressText"
          :size="80"
          :stroke-width="6"
        />
        <span class="loading-status">{{ statusMessage }}</span>
      </div>
    </div>
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
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
  backdrop-filter: blur(4px);
}

.loader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  background-color: var(--color-panel-bg);
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px var(--color-panel-shadow);
}

.loading-status {
  font-weight: 500;
  color: var(--color-text);
}
</style>
