<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { ConversionResult } from "../composables/useStudioRunner";

const props = defineProps<{ result: ConversionResult }>();
const active = shallowRef<"definition" | "obj" | "tree" | "paths">("definition");
const views = [
  { key: "definition", label: "Definition" },
  { key: "obj", label: ".obj" },
  { key: "tree", label: ".tree" },
  { key: "paths", label: ".paths" },
] as const;
const output = computed(() => {
  if (props.result.error) return `// Conversion error\n${props.result.error}`;
  switch (active.value) {
    case "definition": return props.result.definition || "// Run a schema to see its Mongoose definition.";
    case "obj": return props.result.schemaObj || "// No schema object yet.";
    case "tree": return props.result.schemaTree || "// No schema tree yet.";
    case "paths": return props.result.schemaPaths || "// No schema paths yet.";
  }
});
</script>

<template>
  <section class="studio-card studio-conversion" aria-labelledby="conversion-title">
    <div class="studio-card-head">
      <div class="studio-card-heading">
        <div><p class="studio-eyebrow">Mongoose</p><h2 id="conversion-title">Schema output</h2></div>
      </div>
      <slot name="actions" />
    </div>
    <div class="studio-tabs" role="tablist" aria-label="Mongoose output view">
      <button v-for="view in views" :key="view.key" type="button" role="tab"
        :aria-selected="active === view.key" :class="{ 'is-active': active === view.key }"
        @click="active = view.key">{{ view.label }}</button>
    </div>
    <div class="studio-conversion-output" role="tabpanel">
      <ClientOnly><StudioOutput :model-value="output" /></ClientOnly>
    </div>
  </section>
</template>
