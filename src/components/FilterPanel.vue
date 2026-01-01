<script setup lang="ts">
import { ref } from 'vue';
import { useConnectionData } from '../composables/useConnectionData';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

const {
  filterableCategories,
  selectedFilters,
  applicableCounts,
  toggleFilter,
  toggleSelectAllFilterCategory,
} = useConnectionData();
const isFilterPanelCollapsed = ref(true);

const PRETTY_NAMES: Record<string, string> = {
  ip: 'IP Address',
  status: 'Status',
  reason: 'Reason',
  application: 'Application',
  os: 'Operating System',
  browser: 'Browser',
  compliant: 'Compliant',
  managed: 'Managed',
  mfaRequirement: 'MFA Requirement',
  mfaMethod: 'MFA Method',
  userAgent: 'User Agent',
};

const MOBILE_SAFARI_GROUP_NAME = 'Safari Mobile';
const MOBILE_SAFARI_PREFIX = 'Mobile Safari';

function prettifyCategory(category: string): string {
  return PRETTY_NAMES[category] || category;
}

function sortedValues(values: Set<string>): string[] {
  return [...values].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

function getSelectedCount(category: string): number {
  return selectedFilters.value.get(category)?.size ?? 0;
}

function isAllSelected(category: string): boolean {
  const total = filterableCategories.value.get(category)?.size ?? 0;
  const selected = getSelectedCount(category);
  return total > 0 && selected === total;
}

function isPartiallySelected(category: string): boolean {
  const total = filterableCategories.value.get(category)?.size ?? 0;
  const selected = getSelectedCount(category);
  return selected > 0 && selected < total;
}

function getMatchCount(category: string, value: string): number {
  return applicableCounts.value.get(category)?.get(value) ?? 0;
}

function isMuted(category: string, value: string): boolean {
  const isSelected = selectedFilters.value.get(category)?.has(value) ?? false;
  const isApplicable = getMatchCount(category, value) > 0;
  return !isSelected || !isApplicable;
}

function isCategoryMuted(category: string): boolean {
  const counts = applicableCounts.value.get(category);
  if (!counts) return true;
  let totalMatches = 0;
  for (const count of counts.values()) {
    totalMatches += count;
  }
  return totalMatches === 0;
}

const groupedCategoriesCache = new Map<
  string,
  { groups: Map<string, string[]>; ungrouped: string[] }
>();

function processGroupableCategory(
  category: string,
  values: Set<string>
): { groups: Map<string, string[]>; ungrouped: string[] } {
  const cacheKey = category + JSON.stringify([...values]);
  if (groupedCategoriesCache.has(cacheKey)) {
    return groupedCategoriesCache.get(cacheKey)!;
  }

  const groups = new Map<string, string[]>();
  const ungrouped: string[] = [];

  for (const value of values) {
    const originalValue = value.trim();

    if (category === 'ip') {
      const groupName = originalValue.includes(':') ? 'IPv6' : 'IPv4';
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName)!.push(originalValue);
    } else if (category === 'os' || category === 'browser') {
      const lastSpaceIndex = originalValue.lastIndexOf(' ');
      let prefix: string | null = null;
      let isVersioned = false;

      if (lastSpaceIndex > 0) {
        const potentialVersion = originalValue
          .substring(lastSpaceIndex + 1)
          .trim();
        const potentialGroupName = originalValue
          .substring(0, lastSpaceIndex)
          .trim();

        if (potentialVersion && potentialVersion.match(/\d/)) {
          prefix = potentialGroupName;
          isVersioned = true;
        }
      }

      if (isVersioned && prefix) {
        let groupName = prefix;

        if (category === 'browser' && groupName === MOBILE_SAFARI_PREFIX) {
          groupName = MOBILE_SAFARI_GROUP_NAME;
        }

        if (!groups.has(groupName)) groups.set(groupName, []);
        groups.get(groupName)!.push(originalValue);
      } else if (
        category === 'browser' &&
        originalValue === MOBILE_SAFARI_PREFIX
      ) {
        const groupName = MOBILE_SAFARI_GROUP_NAME;
        if (!groups.has(groupName)) groups.set(groupName, []);
        groups.get(groupName)!.push(originalValue);
      } else {
        ungrouped.push(originalValue);
      }
    } else {
      ungrouped.push(originalValue);
    }
  }

  const sortedGroups = new Map(
    [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  );

  for (const [key, val] of sortedGroups.entries()) {
    sortedGroups.set(
      key,
      val.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    );
  }

  ungrouped.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const result = { groups: sortedGroups, ungrouped };
  groupedCategoriesCache.set(cacheKey, result);
  return result;
}

function getGroupStatus(category: string, fullValues: string[]) {
  const currentFilters = selectedFilters.value.get(category);
  if (!currentFilters || fullValues.length === 0)
    return { checked: false, indeterminate: false, selectedCount: 0 };

  let selectedCount = 0;
  for (const v of fullValues) {
    if (currentFilters.has(v)) selectedCount++;
  }

  return {
    checked: selectedCount === fullValues.length,
    indeterminate: selectedCount > 0 && selectedCount < fullValues.length,
    selectedCount: selectedCount,
  };
}

function toggleGroup(category: string, fullValues: string[]) {
  const { checked } = getGroupStatus(category, fullValues);
  const shouldSelect = !checked;

  const newFilters = new Map(selectedFilters.value);
  const categorySet = new Set(newFilters.get(category) || []);

  for (const v of fullValues) {
    if (shouldSelect) {
      categorySet.add(v);
    } else {
      categorySet.delete(v);
    }
  }

  newFilters.set(category, categorySet);
  selectedFilters.value = newFilters;
}

function getVersionOnly(fullValue: string, category: string): string {
  if (category !== 'os' && category !== 'browser') return fullValue;

  const lastSpaceIndex = fullValue.lastIndexOf(' ');

  if (lastSpaceIndex > 0) {
    const potentialVersion = fullValue.substring(lastSpaceIndex + 1).trim();

    if (potentialVersion && potentialVersion.match(/\d/)) {
      return potentialVersion;
    }
  }

  if (category === 'browser') {
    return 'Unknown';
  }

  return fullValue;
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
        <h4>Filters</h4>
        <div class="filter-categories-list">
          <details
            v-for="[category, values] in filterableCategories"
            :key="category"
            class="filter-category"
            :class="{ 'category-muted': isCategoryMuted(category) }"
          >
            <summary>
              <div class="category-summary-content">
                <input
                  :id="`select-all-${category}`"
                  type="checkbox"
                  :checked="isAllSelected(category)"
                  :indeterminate.prop="isPartiallySelected(category)"
                  @click.stop="toggleSelectAllFilterCategory(category)"
                />
                <label
                  :for="`select-all-${category}`"
                  @click.stop="toggleSelectAllFilterCategory(category)"
                >
                  {{ prettifyCategory(category) }}
                  <span> ({{ getSelectedCount(category) }}) </span>
                </label>
              </div>
            </summary>
            <ul class="filter-list">
              <template
                v-if="
                  category === 'os' ||
                  category === 'browser' ||
                  category === 'ip'
                "
              >
                <template
                  v-if="
                    processGroupableCategory(category, values).groups.size > 0
                  "
                >
                  <li
                    v-for="[groupName, fullValues] in processGroupableCategory(
                      category,
                      values
                    ).groups"
                    :key="groupName"
                    class="filter-group"
                  >
                    <details>
                      <summary>
                        <div class="group-summary-content">
                          <input
                            type="checkbox"
                            :checked="
                              getGroupStatus(category, fullValues).checked
                            "
                            :indeterminate.prop="
                              getGroupStatus(category, fullValues).indeterminate
                            "
                            @click.stop="toggleGroup(category, fullValues)"
                          />
                          <label
                            @click.stop="toggleGroup(category, fullValues)"
                          >
                            {{ groupName }}
                            <span>
                              ({{
                                getGroupStatus(category, fullValues)
                                  .selectedCount
                              }})
                            </span>
                          </label>
                        </div>
                      </summary>
                      <ul class="sub-filter-list">
                        <li
                          v-for="value in fullValues"
                          :key="value"
                          class="filter-item"
                          :class="{ 'is-muted': isMuted(category, value) }"
                        >
                          <input
                            :id="`filter-${category}-${value}`"
                            type="checkbox"
                            :checked="selectedFilters.get(category)?.has(value)"
                            @change="toggleFilter(category, value)"
                          />
                          <label
                            :for="`filter-${category}-${value}`"
                            :title="value"
                          >
                            {{ getVersionOnly(value, category) }}
                            <span class="match-count"
                              >({{ getMatchCount(category, value) }})</span
                            >
                          </label>
                        </li>
                      </ul>
                    </details>
                  </li>

                  <li
                    v-for="value in processGroupableCategory(category, values)
                      .ungrouped"
                    :key="value"
                    class="filter-item"
                    :class="{ 'is-muted': isMuted(category, value) }"
                  >
                    <input
                      :id="`filter-${category}-${value}`"
                      type="checkbox"
                      :checked="selectedFilters.get(category)?.has(value)"
                      @change="toggleFilter(category, value)"
                    />
                    <label :for="`filter-${category}-${value}`" :title="value">
                      {{ value }}
                      <span class="match-count"
                        >({{ getMatchCount(category, value) }})</span
                      >
                    </label>
                  </li>
                </template>

                <template v-else>
                  <li
                    v-for="value in sortedValues(values)"
                    :key="value"
                    class="filter-item"
                    :class="{ 'is-muted': isMuted(category, value) }"
                  >
                    <input
                      :id="`filter-${category}-${value}`"
                      type="checkbox"
                      :checked="selectedFilters.get(category)?.has(value)"
                      @change="toggleFilter(category, value)"
                    />
                    <label :for="`filter-${category}-${value}`" :title="value">
                      {{ value }}
                      <span class="match-count"
                        >({{ getMatchCount(category, value) }})</span
                      >
                    </label>
                  </li>
                </template>
              </template>

              <template v-else>
                <li
                  v-for="value in sortedValues(values)"
                  :key="value"
                  class="filter-item"
                  :class="{ 'is-muted': isMuted(category, value) }"
                >
                  <input
                    :id="`filter-${category}-${value}`"
                    type="checkbox"
                    :checked="selectedFilters.get(category)?.has(value)"
                    @change="toggleFilter(category, value)"
                  />
                  <label :for="`filter-${category}-${value}`" :title="value">
                    {{ value }}
                    <span class="match-count"
                      >({{ getMatchCount(category, value) }})</span
                    >
                  </label>
                </li>
              </template>
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
  width: 280px;
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
  padding-right: 16px;
}

.filter-category summary {
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
}

.category-muted {
  opacity: 0.45;
}

.category-summary-content {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.category-summary-content input[type='checkbox'] {
  flex-shrink: 0;
  cursor: pointer;
  margin-top: 4px;
}

.category-summary-content label {
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  white-space: normal;
  word-break: break-word;
}

.category-summary-content label span {
  font-weight: 500;
  color: var(--color-text-muted);
}

.filter-list {
  list-style: none;
  padding-left: 14px;
  margin: 0 0 10px 0;
}

.filter-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.25rem 0;
  transition: opacity 0.2s;
}

.filter-item.is-muted {
  opacity: 0.45;
}

.match-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-left: 0.25rem;
}

.filter-item label {
  font-weight: 400;
  font-size: 0.9rem;
  cursor: pointer;
  user-select: none;
  white-space: normal;
  word-break: break-word;
}

.filter-item input[type='checkbox'] {
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 4px;
}

.filter-group details summary {
  cursor: pointer;
  user-select: none;
  padding: 2px 0;
  font-size: 0.9rem;
}

.group-summary-content {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.group-summary-content input[type='checkbox'] {
  flex-shrink: 0;
  cursor: pointer;
  margin-top: 4px;
}

.group-summary-content label {
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  white-space: normal;
  word-break: break-word;
}

.group-summary-content label span {
  font-weight: 400;
  color: var(--color-text-muted);
}

.sub-filter-list {
  list-style: none;
  padding-left: 18px;
  margin: 0;
}

.collapse-toggle {
  position: absolute;
  z-index: 11;
  width: 24px;
  height: 80px;
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
  margin-right: 0;
  border-top-left-radius: 0.5rem;
  border-bottom-left-radius: 0.5rem;
}

#filter-panel-wrapper:has(#filter-panel) .collapse-toggle-left {
  right: auto;
  left: -24px;
}

#filter-panel-wrapper:has(#filter-panel) {
  right: 1rem;
}
</style>
