<script setup lang="ts">
import { ref } from 'vue';
import { useConnectionData } from '../composables/useConnectionData';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

const { filterableCategories, selectedFilters, toggleFilter } =
  useConnectionData();
const isFilterPanelCollapsed = ref(true);

const PRETTY_NAMES: Record<string, string> = {
  application: 'Application',
  os: 'Operating System',
  browser: 'Browser',
  compliant: 'Compliant',
  managed: 'Managed',
  mfaRequirement: 'MFA Requirement',
  mfaMethod: 'MFA Method',
  userAgent: 'User Agent',
};

function prettifyCategory(category: string): string {
  return PRETTY_NAMES[category] || category;
}

function sortedValues(values: Set<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}
</script>

<template>
  <div v-if="filterableCategories.size > 0" id="filter-panel-wrapper">
    <button
      class="collapse-toggle collapse-toggle-left"
      title="Toggle Filter Panel"
      @click="isFilterPanelCollapsed = !isFilterPanelCollapsed"
    >
      <ChevronRight v-if="!isFilterPanelCollapsed" :size="20" />
      <ChevronLeft v-else :size="20" />
    </button>

    <div
      v-if="!isFilterPanelCollapsed"
      id="filter-panel"
      v-motion
      class="floating-panel"
      :initial="{ opacity: 0, x: 50 }"
      :enter="{
        opacity: 1,
        x: 0,
        transition: { type: 'spring', stiffness: 300, damping: 30 },
      }"
      :leave="{ opacity: 0, x: 50, transition: { duration: 150 } }"
    >
      <div class="panel-content">
        <h4>Filtres</h4>
        <div class="filter-categories-list">
          <details
            v-for="[category, values] in filterableCategories"
            :key="category"
            class="filter-category"
            open
          >
            <summary>
              {{ prettifyCategory(category) }}
            </summary>
            <ul class="filter-list">
              <li
                v-for="value in sortedValues(values)"
                :key="value"
                class="filter-item"
              >
                <input
                  :id="`filter-${category}-${value}`"
                  type="checkbox"
                  :checked="selectedFilters.get(category)?.has(value)"
                  @change="toggleFilter(category, value)"
                />
                <label :for="`filter-${category}-${value}`" :title="value">
                  {{ value }}
                </label>
              </li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#filter-panel-wrapper {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
}

#filter-panel {
  padding: 0.5rem 0.75rem;
  width: 200px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
}

.panel-content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-grow: 1;
  min-height: 0;
}

h4 {
  margin: 0 0 0.5rem 0;
  padding: 0.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.9rem;
  margin-top: 0;
  text-align: center;
}

.filter-categories-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex-grow: 1;
}

.filter-category summary {
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
}

.filter-list {
  list-style: none;
  padding-left: 10px;
  margin: 0 0 10px 0;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.filter-item label {
  font-weight: 400;
  font-size: 0.9rem;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-item input[type='checkbox'] {
  cursor: pointer;
  flex-shrink: 0;
}

.collapse-toggle {
  position: absolute;
  z-index: 11;
  width: 24px; /* Narrower width */
  height: 80px; /* Taller height */
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 0;
  color: var(--color-button-text);
  transition: background-color 0.2s;
  background-color: var(--color-panel-bg);
  backdrop-filter: blur(4px);
  border: none;
  box-shadow: -2px 0 4px -1px var(--color-panel-shadow);
  cursor: pointer;
}
.collapse-toggle:hover {
  background-color: var(--color-button-hover-bg);
}
.collapse-toggle-left {
  top: 50%;
  transform: translateY(-50%);
  right: 100%;
  margin-right: 0; /* Removed overlap */
  /* Round the left corners */
  border-top-left-radius: 0.5rem;
  border-bottom-left-radius: 0.5rem;
}

#filter-panel-wrapper:has(#filter-panel) .collapse-toggle-left {
  right: auto;
  left: -24px; /* Match width */
}

#filter-panel-wrapper:has(#filter-panel) {
  right: 1rem;
}
</style>
