import { ref, computed } from 'vue';

const ONE_HOUR_MS = 1000 * 60 * 60;
const ONE_DAY_MS = ONE_HOUR_MS * 24;

const minTimestamp = ref(0);
const maxTimestamp = ref(0);
const startRange = ref(0);
const endRange = ref(0);

export function useTimeline() {
  const isHourlyRange = computed(() => {
    const range = maxTimestamp.value - minTimestamp.value;
    return range > 0 && range < ONE_DAY_MS;
  });

  const snapStep = computed(() => {
    return isHourlyRange.value ? ONE_HOUR_MS : ONE_DAY_MS;
  });

  const roundedMinTimestamp = computed(() => {
    if (minTimestamp.value === 0) return 0;
    const date = new Date(minTimestamp.value);
    if (isHourlyRange.value) {
      date.setMinutes(0, 0, 0);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    return date.getTime();
  });

  const roundedMaxTimestamp = computed(() => {
    if (maxTimestamp.value === 0) return 0;
    const date = new Date(maxTimestamp.value);
    if (isHourlyRange.value) {
      date.setMinutes(0, 0, 0);
      if (date.getTime() < maxTimestamp.value) {
        date.setTime(date.getTime() + ONE_HOUR_MS);
      }
    } else {
      date.setHours(0, 0, 0, 0);
      if (date.getTime() < maxTimestamp.value) {
        date.setTime(date.getTime() + ONE_DAY_MS);
      }
    }
    return date.getTime();
  });

  const sliderFillStyle = computed(() => {
    if (maxTimestamp.value === minTimestamp.value) {
      return { left: '0%', right: '0%' };
    }
    const total = roundedMaxTimestamp.value - roundedMinTimestamp.value;
    if (total === 0) return { left: '0%', right: '0%' };
    const leftPercent =
      ((startRange.value - roundedMinTimestamp.value) / total) * 100;
    const rightPercent =
      ((endRange.value - roundedMinTimestamp.value) / total) * 100;
    return {
      left: `${leftPercent}%`,
      right: `${100 - rightPercent}%`,
    };
  });

  function setTimelineBounds(timestamps: number[]) {
    if (timestamps.length === 0) {
      minTimestamp.value = 0;
      maxTimestamp.value = 0;
    } else {
      minTimestamp.value = Math.min(...timestamps);
      maxTimestamp.value = Math.max(...timestamps);
    }
    startRange.value = roundedMinTimestamp.value;
    endRange.value = roundedMaxTimestamp.value;
  }

  function formatDate(timestamp: number): string {
    if (timestamp === 0) return '---';
    const date = new Date(timestamp);
    if (isHourlyRange.value) {
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString();
  }

  function onStartChange() {
    if (startRange.value > endRange.value) {
      endRange.value = startRange.value;
    }
  }

  function onEndChange() {
    if (endRange.value < startRange.value) {
      startRange.value = endRange.value;
    }
  }

  return {
    minTimestamp,
    maxTimestamp,
    roundedMinTimestamp,
    roundedMaxTimestamp,
    startRange,
    endRange,
    snapStep,
    sliderFillStyle,
    setTimelineBounds,
    formatDate,
    onStartChange,
    onEndChange,
  };
}
