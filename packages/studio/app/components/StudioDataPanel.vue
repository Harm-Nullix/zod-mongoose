<script setup lang="ts">
defineProps<{ isRunning: boolean; canRun: boolean }>();
const emit = defineEmits<{ loadExample: [] }>();
const input = defineModel<string>({ required: true });
</script>

<template>
  <section class="studio-card studio-data" aria-labelledby="data-title">
    <div class="studio-card-head">
      <div class="studio-card-heading">
        <div><p class="studio-eyebrow">JSON</p><h2 id="data-title">Input data</h2></div>
      </div>
      <div class="studio-card-actions">
        <button type="button" class="studio-example-button" :disabled="isRunning || !canRun" @click="emit('loadExample')">Load example</button>
        <slot name="actions" />
      </div>
    </div>
    <div class="studio-editor-surface"><ClientOnly><StudioEditor v-model="input" language="json" label="JSON data editor" /></ClientOnly></div>
    <div class="studio-card-foot">Enter a JSON value, then run to see what Zod returns.</div>
  </section>
</template>
