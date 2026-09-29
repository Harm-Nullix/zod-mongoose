<script setup lang="ts">
const source = defineModel<string>({ required: true });
</script>

<template>
  <section class="studio-card studio-schema" aria-labelledby="schema-title">
    <div class="studio-card-head">
      <div class="studio-card-heading">
        <div><p class="studio-eyebrow">TypeScript</p><h2 id="schema-title">Schema</h2></div>
      </div>
      <slot name="actions" />
    </div>
    <div class="studio-editor-surface"><ClientOnly><StudioEditor v-model="source" label="Zod schema TypeScript editor" /></ClientOnly></div>
    <div class="studio-card-foot">Use <code>z</code> and zod-mongoose helpers directly. You can define multiple schemas.</div>
  </section>
</template>
