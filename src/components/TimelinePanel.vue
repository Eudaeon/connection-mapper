<script setup lang="ts">
import { ref } from 'vue';
import { useConnectionData } from '../composables/useConnectionData';
import { ChevronDown, ChevronUp } from 'lucide-vue-next';
import Slider from './Slider.vue';

const {
  allUsers,
  roundedMinTimestamp,
  roundedMaxTimestamp,
  startRange,
  endRange,
  formatDate,
  snapStep,
} = useConnectionData();

const isTimelinePanelCollapsed = ref(true);

const handleSliderInput = (payload: { minValue: number; maxValue: number }) => {
  if (typeof payload.minValue === 'number') {
    startRange.value = payload.minValue;
  }
  if (typeof payload.maxValue === 'number') {
    endRange.value = payload.maxValue;
  }
};
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
          <Slider
            class="timeline-slider"
            with-tooltip
            :min="roundedMinTimestamp"
            :max="roundedMaxTimestamp"
            :min-value="startRange"
            :max-value="endRange"
            :snap-step="snapStep"
            :value-formatter="formatDate"
            @input="handleSliderInput"
          >
          </Slider>
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
  overflow: visible;
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
  height: auto;
  display: flex;
  align-items: center;
  padding: 0.5rem 0;
  margin-top: 0.5rem;
}

.timeline-slider {
  width: 100%;
  --track-size: 6px;
  --thumb-width: 18px;
  --thumb-height: 18px;
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
  bottom: 0;
  left: 50%;
  transform: translate(-50%);
  margin-top: 0;
  border-top-left-radius: 0.375rem;
  border-top-right-radius: 0.375rem;
  border-bottom-left-radius: 0;
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
