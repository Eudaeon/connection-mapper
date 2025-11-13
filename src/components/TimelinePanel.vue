<script setup lang="ts">
import { ref } from 'vue';
import { useConnectionData } from '../composables/useConnectionData';
import { ChevronDown, ChevronUp } from 'lucide-vue-next';

const {
  allUsers,
  minTimestamp,
  maxTimestamp,
  startRange,
  endRange,
  onStartChange,
  onEndChange,
  sliderFillStyle,
  formatDate,
} = useConnectionData();

const isTimelinePanelCollapsed = ref(true);
</script>

<template>
  <div v-if="allUsers.length > 0" id="timeline-panel-wrapper">
    <button
      class="collapse-toggle collapse-toggle-top"
      title="Toggle Timeline Panel"
      @click="isTimelinePanelCollapsed = !isTimelinePanelCollapsed"
    >
      <ChevronDown v-if="!isTimelinePanelCollapsed" :size="20" />
      <ChevronUp v-else :size="20" />
    </button>

    <div
      v-if="!isTimelinePanelCollapsed"
      id="timeline-panel"
      v-motion
      class="floating-panel"
      :initial="{ opacity: 0, y: 50 }"
      :enter="{
        opacity: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 300, damping: 30 },
      }"
      :leave="{ opacity: 0, y: 50, transition: { duration: 150 } }"
    >
      <div class="panel-content">
        <div class="timeline-labels">
          <div class="timeline-label-start">
            Start: <span>{{ formatDate(startRange) }}</span>
          </div>
          <div class="timeline-label-end">
            End: <span>{{ formatDate(endRange) }}</span>
          </div>
        </div>
        <div class="slider-container">
          <div class="slider-fill" :style="sliderFillStyle"></div>
          <input
            v-model.number="startRange"
            type="range"
            class="timeline-slider-input"
            :min="minTimestamp"
            :max="maxTimestamp"
            title="Timeline Start"
            @input="onStartChange"
          />
          <input
            v-model.number="endRange"
            type="range"
            class="timeline-slider-input"
            :min="minTimestamp"
            :max="maxTimestamp"
            title="Timeline End"
            @input="onEndChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#timeline-panel-wrapper {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 50%;
  max-width: 600px;
  z-index: 10;
}

#timeline-panel {
  padding: 0.5rem 1rem;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.panel-content {
  overflow: hidden;
}

.timeline-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  padding-top: 0.25rem;
}
.timeline-labels span {
  color: var(--color-text);
  font-weight: 500;
}
.slider-container {
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
}
.slider-container::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  background-color: var(--color-slider-track);
  border-radius: 3px;
}
.slider-fill {
  position: absolute;
  height: 6px;
  background-color: var(--color-slider-fill);
  border-radius: 3px;
  z-index: 1;
}
.timeline-slider-input {
  position: absolute;
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  margin: 0;
  pointer-events: none;
  z-index: 2;
}
.timeline-slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 18px;
  width: 18px;
  background-color: var(--color-thumb-bg);
  border-radius: 50%;
  border: 2px solid var(--color-thumb-border);
  cursor: pointer;
  pointer-events: auto;
  margin-top: -6px;
  box-shadow: 0 1px 3px var(--color-panel-shadow);
}
.timeline-slider-input::-moz-range-thumb {
  height: 14px;
  width: 14px;
  background-color: var(--color-thumb-bg);
  border-radius: 50%;
  border: 2px solid var(--color-thumb-border);
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 1px 3px var(--color-panel-shadow);
}
.timeline-slider-input::-webkit-slider-runnable-track {
  background: transparent;
  height: 0;
}
.timeline-slider-input::-moz-range-track {
  background: transparent;
  height: 0;
}

.collapse-toggle {
  position: absolute;
  z-index: 11;
  width: 80px;
  height: 24px;
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 0.375rem;
  color: var(--color-button-text);
  transition: background-color 0.2s;
  background-color: var(--color-panel-bg);
  backdrop-filter: blur(4px);
  border: none;
  box-shadow: 0 -2px 4px -1px var(--color-panel-shadow);
  cursor: pointer;
}
.collapse-toggle:hover {
  background-color: var(--color-button-hover-bg);
}
.collapse-toggle-top {
  bottom: 0; /* Position at the bottom of the wrapper */
  left: 50%;
  transform: translate(-50%);
  margin-top: 0; /* Remove top margin */
  border-top-left-radius: 0.375rem; /* Round top corners */
  border-top-right-radius: 0.375rem;
  border-bottom-left-radius: 0; /* Un-round bottom corners */
  border-bottom-right-radius: 0;
}

#timeline-panel-wrapper:has(#timeline-panel) .collapse-toggle-top {
  top: auto;
  bottom: 100%;
  transform: translateX(-50%);
}

#timeline-panel-wrapper:has(#timeline-panel) {
  bottom: 1rem;
}
</style>
