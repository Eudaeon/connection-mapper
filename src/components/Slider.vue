<script setup lang="ts">
import { ref, computed, onUnmounted, type PropType } from 'vue';

const props = defineProps({
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  snapStep: { type: Number, default: 1 },
  minValue: { type: Number, default: 0 },
  maxValue: { type: Number, default: 50 },
  withTooltip: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  valueFormatter: {
    type: Function as PropType<(value: number) => string>,
    default: (value: number) => value.toString(),
  },
});

const emit = defineEmits<{
  (e: 'input', value: { minValue: number; maxValue: number }): void;
}>();

const track = ref<HTMLElement | null>(null);
const activeThumb = ref<'min' | 'max' | null>(null);
const isDragging = ref(false);
const trackBoundingRect = ref<DOMRect | null>(null);
const showTooltipMin = ref(false);
const showTooltipMax = ref(false);

const minThumbPosition = computed(() => {
  const range = props.max - props.min;
  if (range === 0) return 0;
  return ((props.minValue - props.min) / range) * 100;
});
const maxThumbPosition = computed(() => {
  const range = props.max - props.min;
  if (range === 0) return 0;
  return ((props.maxValue - props.min) / range) * 100;
});

const indicatorStart = computed(() =>
  Math.min(minThumbPosition.value, maxThumbPosition.value)
);
const indicatorEnd = computed(() =>
  Math.max(minThumbPosition.value, maxThumbPosition.value)
);

const isMinTooltipVisible = computed(
  () =>
    props.withTooltip &&
    (showTooltipMin.value || (isDragging.value && activeThumb.value === 'min'))
);

const isMaxTooltipVisible = computed(
  () =>
    props.withTooltip &&
    (showTooltipMax.value || (isDragging.value && activeThumb.value === 'max'))
);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function clampAndRound(value: number) {
  const stepPrecision = (String(props.snapStep).split('.')[1] || '').replace(
    /0+$/g,
    ''
  ).length;
  let roundedValue = Math.round(value / props.snapStep) * props.snapStep;
  roundedValue = clamp(roundedValue, props.min, props.max);
  return parseFloat(roundedValue.toFixed(stepPrecision));
}

function getValueFromCoordinates(x: number) {
  if (!trackBoundingRect.value) return props.min;

  const { left, width } = trackBoundingRect.value;
  const relativePosition = x - left;
  const percentage = clamp(relativePosition / width, 0, 1);
  const range = props.max - props.min;

  if (range === 0) return props.min;

  const value = props.min + range * percentage;

  return clampAndRound(value);
}

function getClientX(event: MouseEvent | TouchEvent): number {
  return 'touches' in event ? (event.touches[0]?.clientX ?? 0) : event.clientX;
}

function onDragStart(
  event: MouseEvent | TouchEvent,
  thumb: 'min' | 'max' | 'track'
) {
  if (props.disabled || props.readonly || !track.value) return;

  event.preventDefault();
  trackBoundingRect.value = track.value.getBoundingClientRect();
  isDragging.value = true;

  const value = getValueFromCoordinates(getClientX(event));

  if (thumb === 'track') {
    const minDistance = Math.abs(value - props.minValue);
    const maxDistance = Math.abs(value - props.maxValue);
    activeThumb.value = minDistance <= maxDistance ? 'min' : 'max';
  } else {
    activeThumb.value = thumb;
  }

  onDragMove(event);

  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
  window.addEventListener('touchmove', onDragMove);
  window.addEventListener('touchend', onDragEnd);
}

function onDragMove(event: MouseEvent | TouchEvent) {
  if (!isDragging.value || !activeThumb.value) return;

  const value = getValueFromCoordinates(getClientX(event));
  let newMin = props.minValue;
  let newMax = props.maxValue;

  if (activeThumb.value === 'min') {
    newMin = value > props.maxValue ? props.maxValue : value;
  } else {
    newMax = value < props.minValue ? props.minValue : value;
  }

  if (newMin !== props.minValue || newMax !== props.maxValue) {
    emit('input', { minValue: newMin, maxValue: newMax });
  }
}

function onDragEnd() {
  isDragging.value = false;
  activeThumb.value = null;

  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  window.removeEventListener('touchmove', onDragMove);
  window.removeEventListener('touchend', onDragEnd);
}

function onKeyDown(event: KeyboardEvent, thumb: 'min' | 'max') {
  if (props.disabled || props.readonly) return;

  const current = thumb === 'min' ? props.minValue : props.maxValue;
  let newValue = current;
  let preventDefault = true;

  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      newValue = current + props.snapStep;
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      newValue = current - props.snapStep;
      break;
    case 'Home':
      newValue = props.min;
      break;
    case 'End':
      newValue = props.max;
      break;
    default:
      preventDefault = false;
  }

  if (preventDefault) {
    event.preventDefault();
    const value = clampAndRound(newValue);

    let newMin = props.minValue;
    let newMax = props.maxValue;

    if (thumb === 'min') {
      newMin = value > newMax ? newMax : value;
    } else {
      newMax = value < newMin ? newMin : value;
    }

    if (newMin !== props.minValue || newMax !== props.maxValue) {
      emit('input', { minValue: newMin, maxValue: newMax });
    }
  }
}

onUnmounted(() => {
  if (isDragging.value) {
    onDragEnd();
  }
});
</script>

<template>
  <div
    class="slider-component-wrapper horizontal"
    :class="{ disabled: disabled, 'with-tooltip': withTooltip }"
  >
    <div
      id="slider"
      ref="track"
      part="slider"
      class="horizontal"
      @mousedown="onDragStart($event, 'track')"
      @touchstart="onDragStart($event, 'track')"
    >
      <div id="track" part="track">
        <div
          id="indicator"
          part="indicator"
          :style="{
            '--start': `${indicatorStart}%`,
            '--end': `${indicatorEnd}%`,
          }"
        ></div>

        <span
          id="thumb-min"
          part="thumb thumb-min"
          :style="{ '--position': `${minThumbPosition}%` }"
          role="slider"
          :aria-valuemin="min"
          :aria-valuenow="minValue"
          :aria-valuemax="max"
          aria-label="Minimum value"
          :aria-disabled="disabled"
          :aria-readonly="readonly"
          :tabindex="disabled ? -1 : 0"
          @blur="showTooltipMin = false"
          @focus="showTooltipMin = true"
          @keydown="onKeyDown($event, 'min')"
          @mousedown.stop="onDragStart($event, 'min')"
          @touchstart.stop="onDragStart($event, 'min')"
        >
          <div v-if="isMinTooltipVisible" class="tooltip">
            {{ valueFormatter(minValue) }}
          </div>
        </span>

        <span
          id="thumb-max"
          part="thumb thumb-max"
          :style="{ '--position': `${maxThumbPosition}%` }"
          role="slider"
          :aria-valuemin="min"
          :aria-valuenow="maxValue"
          :aria-valuemax="max"
          aria-label="Maximum value"
          :aria-disabled="disabled"
          :aria-readonly="readonly"
          :tabindex="disabled ? -1 : 0"
          @blur="showTooltipMax = false"
          @focus="showTooltipMax = true"
          @keydown="onKeyDown($event, 'max')"
          @mousedown.stop="onDragStart($event, 'max')"
          @touchstart.stop="onDragStart($event, 'max')"
        >
          <div v-if="isMaxTooltipVisible" class="tooltip">
            {{ valueFormatter(maxValue) }}
          </div>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slider-component-wrapper {
  --track-size: 0.5em;
  --thumb-width: 1.4em;
  --thumb-height: 1.4em;
}

#slider {
  touch-action: none;
  position: relative;
}

#slider:focus {
  outline: none;
}

#slider.horizontal {
  width: 100%;
}

#track {
  position: relative;
  border-radius: 9999px;
  background: var(--color-slider-track);
  isolation: isolate;
}

.horizontal #track {
  height: var(--track-size);
}

.disabled #track {
  cursor: not-allowed;
  opacity: 0.5;
}

#indicator {
  position: absolute;
  border-radius: inherit;
  background-color: var(--color-slider-fill);
  right: calc(100% - var(--end));
  left: var(--start);
}

.horizontal #indicator {
  top: 0;
  height: 100%;
}

#thumb-min,
#thumb-max {
  z-index: 3;
  position: absolute;
  width: var(--thumb-width);
  height: var(--thumb-height);
  border: solid 0.125em var(--color-thumb-border);
  border-radius: 50%;
  background-color: var(--color-slider-fill);
  cursor: pointer;
}

.disabled #thumb-min,
.disabled #thumb-max {
  cursor: inherit;
}

.horizontal #thumb-min,
.horizontal #thumb-max {
  top: calc(50% - var(--thumb-height) / 2);
  left: calc(var(--position) - var(--thumb-width) / 2);
}

.slider-component-wrapper #thumb-min:focus-visible,
.slider-component-wrapper #thumb-max:focus-visible {
  z-index: 4;
  outline: 0 0 0 2px var(--color-slider-fill);
}

.tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);

  background-color: var(--color-panel-bg);
  color: var(--color-text);
  border-radius: 0.375rem;
  padding: 0.25rem 0.75rem;
  box-shadow:
    0 4px 6px -1px var(--color-panel-shadow),
    0 2px 4px -2px var(--color-panel-shadow);
  backdrop-filter: blur(4px);

  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
  border: none;
}
</style>
