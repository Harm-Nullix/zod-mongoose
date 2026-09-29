<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { useStudioRunner } from "../composables/useStudioRunner";

const config = useRuntimeConfig();
const root = ref<HTMLElement | null>(null);
const mobileView = shallowRef<"schema" | "data" | "result" | "mongoose">(
  "schema",
);
type Panel = "schema" | "data" | "result" | "mongoose";
const expandedPanel = shallowRef<Panel | null>(null);
let transitioning = false;
const mobileViews = [
  { key: "schema", label: "Schema" },
  { key: "data", label: "Data" },
  { key: "result", label: "Result" },
  { key: "mongoose", label: "Mongoose" },
] as const;

const {
  sourceCode,
  inputData,
  schemaNames,
  selectedSchema,
  validation,
  conversion,
  isRunning,
  isDirty,
  hasRun,
  error,
  exampleError,
  run,
  selectSchema,
} = useStudioRunner();

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && expandedPanel.value) {
    togglePanel(expandedPanel.value);
    return;
  }
  if (!root.value?.contains(document.activeElement)) return;
  if (
    !(event.metaKey || event.ctrlKey) ||
    event.altKey ||
    event.shiftKey ||
    event.repeat
  )
    return;
  if (event.key.toLowerCase() !== "s" && event.key.toLowerCase() !== "r")
    return;
  event.preventDefault();
  event.stopPropagation();
  void run();
}

function togglePanel(panel: Panel) {
  if (transitioning) return;
  const card = root.value?.querySelector<HTMLElement>(`.studio-${panel}`);
  const change = () => {
    expandedPanel.value = expandedPanel.value === panel ? null : panel;
  };
  if (card && "startViewTransition" in document) {
    transitioning = true;
    card.style.viewTransitionName = "studio-expanded-panel";
    const transition = document.startViewTransition(() => {
      change();
      return nextTick();
    });
    void transition.finished.finally(() => {
      card.style.viewTransitionName = "";
      transitioning = false;
    });
  } else change();
}

onMounted(() => document.addEventListener("keydown", onKeydown, true));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown, true));
</script>

<template>
  <div
    ref="root"
    class="studio-shell"
    :class="{
      'studio-shell-docs': config.public.isDocsMode,
      'is-focused': expandedPanel,
    }"
  >
    <header class="studio-header">
      <div class="studio-brand">
        <div>
          <p class="studio-eyebrow">@nullix/zod-mongoose</p>
          <h1>Studio</h1>
        </div>
      </div>
      <div class="studio-header-actions">
        <span class="studio-mode">{{
          config.public.isDocsMode ? "Playground" : "Local mode"
        }}</span>
        <span class="studio-shortcut" aria-hidden="true"
          >⌘ / Ctrl + S or R</span
        >
        <button
          type="button"
          class="studio-run"
          :disabled="isRunning || !config.public.isExecutionEnabled"
          @click="run()"
        >
          {{ isRunning ? "Running…" : "Run" }}
        </button>
      </div>
    </header>

    <div class="studio-subbar">
      <div class="studio-subbar-copy">
        <span
          class="studio-pulse"
          :class="{ 'is-busy': isRunning, error: error }"
        />
        <span>{{
          isRunning
            ? "Working through your schema…"
            : error
              ? "Run failed"
              : !hasRun
                ? "Waiting for first run"
                : isDirty
                  ? "Changes ready to run"
                  : "Schema and data in sync"
        }}</span>
      </div>
      <label class="studio-schema-picker">
        <span>ACTIVE SCHEMA</span>
        <select
          :value="selectedSchema"
          :disabled="schemaNames.length < 2"
          aria-label="Active schema"
          @change="selectSchema(($event.target as HTMLSelectElement).value)"
        >
          <option v-if="!schemaNames.length" value="">
            Run to find schemas
          </option>
          <option v-for="name in schemaNames" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
      </label>
    </div>

    <nav class="studio-mobile-nav" aria-label="Studio sections">
      <button
        v-for="view in mobileViews"
        :key="view.key"
        type="button"
        :class="{ 'is-active': mobileView === view.key }"
        @click="mobileView = view.key"
      >
        {{ view.label }}
      </button>
    </nav>

    <div v-if="error" class="studio-error-banner" role="alert">
      <strong>Run failed</strong><span>{{ error }}</span>
    </div>
    <div
      v-if="exampleError"
      class="studio-error-banner studio-example-banner"
      role="status"
    >
      <strong>Example unavailable</strong><span>{{ exampleError }}</span>
    </div>

    <main class="studio-workspace">
      <div class="studio-column studio-input-column">
        <StudioSourcePanel
          v-model="sourceCode"
          :class="{
            'is-mobile-active': mobileView === 'schema',
            'is-expanded': expandedPanel === 'schema',
          }"
        >
          <template #actions
            ><StudioExpandButton
              label="schema editor"
              :expanded="expandedPanel === 'schema'"
              @toggle="togglePanel('schema')"
          /></template>
        </StudioSourcePanel>
        <StudioDataPanel
          v-model="inputData"
          :is-running="isRunning"
          :can-run="config.public.isExecutionEnabled"
          :class="{
            'is-mobile-active': mobileView === 'data',
            'is-expanded': expandedPanel === 'data',
          }"
          @load-example="run('example')"
        >
          <template #actions
            ><StudioExpandButton
              label="data editor"
              :expanded="expandedPanel === 'data'"
              @toggle="togglePanel('data')"
          /></template>
        </StudioDataPanel>
      </div>

      <div class="studio-column studio-output-column">
        <StudioValidation
          class="studio-result"
          :class="{
            'is-mobile-active': mobileView === 'result',
            'is-expanded': expandedPanel === 'result',
          }"
          :result="validation"
          :stale="isDirty"
        >
          <template #actions
            ><StudioExpandButton
              label="validation result"
              :expanded="expandedPanel === 'result'"
              @toggle="togglePanel('result')"
          /></template>
        </StudioValidation>
        <StudioConversion
          class="studio-mongoose"
          :class="{
            'is-mobile-active': mobileView === 'mongoose',
            'is-expanded': expandedPanel === 'mongoose',
          }"
          :result="conversion"
        >
          <template #actions
            ><StudioExpandButton
              label="Mongoose output"
              :expanded="expandedPanel === 'mongoose'"
              @toggle="togglePanel('mongoose')"
          /></template>
        </StudioConversion>
      </div>
    </main>
  </div>
</template>
