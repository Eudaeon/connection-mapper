<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  value: {
    type: Number,
    default: 0,
    validator: (v: number) => v >= 0 && v <= 100,
  },
  text: {
    type: String,
    default: '',
  },
  size: {
    type: Number,
    default: 50,
  },
  strokeWidth: {
    type: Number,
    default: 5,
  },
});

const circumference = computed(() => {
  return (props.size - props.strokeWidth) * Math.PI;
});

const strokeDashoffset = computed(() => {
  return circumference.value - (props.value / 100) * circumference.value;
});

const radius = computed(() => (props.size - props.strokeWidth) / 2);
const center = computed(() => props.size / 2);
</script>

<template>
  <div
    class="progress-ring"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      '--ring-size': `${size}px`,
      '--stroke-width': `${strokeWidth}px`,
    }"
    role="progressbar"
    :aria-valuenow="value"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <svg
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      class="ring-svg"
    >
      <circle
        class="ring-track"
        :r="radius"
        :cx="center"
        :cy="center"
        :stroke-width="strokeWidth"
      />
      <circle
        class="ring-indicator"
        :r="radius"
        :cx="center"
        :cy="center"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="strokeDashoffset"
      />
    </svg>
    <div v-if="text" class="ring-text">
      {{ text }}
    </div>
  </div>
</template>

<style scoped>
.progress-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 600;
}

.ring-svg {
  transform: rotate(-90deg);
}

.ring-track {
  fill: none;
  stroke: var(--color-border);
}

.ring-indicator {
  fill: none;
  stroke: var(--color-slider-fill);
  stroke-linecap: round;
  transition: stroke-dashoffset 0.3s linear;
}

.ring-text {
  position: absolute;
  color: var(--color-text);
}
</style>
