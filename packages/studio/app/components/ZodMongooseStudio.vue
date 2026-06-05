<script setup lang="ts">
import { ref, watch } from "vue";
// Use lodash/debounce or vueuse in a real app, but setTimeout works for now
let debounceTimer: any;

const config = useRuntimeConfig();
const isLocalMode = ref(config.public.isLocalMode);
const isDocsMode = ref(config.public.isDocsMode);

const sourceCode = ref(`import { z } from 'zod/v4';
import { extractMongooseDef, toMongooseSchema } from '@nullix/zod-mongoose';

const UserSchema = z.object({
  name: z.string(),
  age: z.number().optional()
});

// Export your schema so the Studio can transform it
export default UserSchema;`);

const outputDef = ref("// Definition output...");
const outputSchema = ref("// Mongoose Schema output...");
const outputTree = ref("// Mongoose Schema tree output...");
const outputPaths = ref("// Mongoose Schema paths output...");
const activeSchemaView = ref<"obj" | "tree" | "paths">("obj");
const activeSchemaViewOutput = computed(() => {
  switch (activeSchemaView.value) {
    case "obj":
      return outputSchema;
    case "tree":
      return outputTree;
    case "paths":
      return outputPaths;
  }
});
const isDefOpen = ref(true);
const isSchemaOpen = ref(true);

const isCompiling = ref(false);

const handleCompile = async () => {
  isCompiling.value = true;
  try {
    const response = await $fetch("/api/parse", {
      method: "POST",
      body: { sourceCode: sourceCode.value },
    });
    outputDef.value = `// Result of extractMongooseDef()\nconst definition = ${response.definition};`;
    outputSchema.value = `// Result of toMongooseSchema().obj\nconst schemaObj = ${response.schemaObj};`;
    outputTree.value = `// Result of toMongooseSchema().tree\nconst schemaTree = ${response.schemaTree};`;
    outputPaths.value = `// Result of toMongooseSchema().paths\nconst schemaPaths = ${response.schemaPaths};`;
  } catch (error: any) {
    const errText = `// Error\n${error.data?.message || error.message}`;
    outputDef.value = errText;
    outputSchema.value = errText;
    outputTree.value = errText;
    outputPaths.value = errText;
  } finally {
    isCompiling.value = false;
  }
};

// Auto-compile with a slight delay as they type
watch(sourceCode, () => {
  if (isDocsMode.value) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(handleCompile, 600);
});

// Initial compile for Docs Mode
if (isDocsMode.value) {
  handleCompile();
}
</script>

<template>
  <div
    class="flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden relative"
    :class="[
      isDocsMode
        ? 'h-[calc(100vh-var(--ui-header-height,64px))] sticky top-[var(--ui-header-height,64px)]'
        : 'h-screen',
    ]"
  >
    <header
      class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-3 px-4 flex justify-between items-center shrink-0 z-20"
    >
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold text-primary">
          @nullix/zod-mongoose Studio
        </h1>
        <UBadge v-if="isLocalMode" color="success" variant="soft"
          >Local Mode</UBadge
        >
        <UBadge v-else color="info" variant="soft">Docs Mode</UBadge>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="isDocsMode"
          icon="i-heroicons-play-solid"
          color="primary"
          :loading="isCompiling"
          @click="handleCompile"
        >
          Run
        </UButton>
        <span v-else-if="isCompiling" class="text-sm text-gray-500"
          >Transforming...</span
        >
      </div>
    </header>

    <UDashboardGroup
      class="flex-1 min-h-0 !relative !inset-auto"
      storage-key="studio-layout"
    >
      <!-- Left: Editor -->
      <UDashboardPanel id="editor" collapsible resizable :min-size="20">
        <div class="h-full relative bg-white dark:bg-gray-950">
          <ClientOnly>
            <StudioEditor v-model="sourceCode" />
          </ClientOnly>
        </div>
      </UDashboardPanel>

      <!-- Right: Split Outputs -->
      <UDashboardPanel
        id="outputs"
        resizable
        :min-size="20"
        class="flex flex-col h-full bg-gray-200 dark:bg-gray-800 overflow-hidden"
      >
        <!-- Top Right: Definition -->
        <UCollapsible
          v-model:open="isDefOpen"
          :class="[isDefOpen ? 'flex-1' : 'flex-none']"
          :ui="{ content: 'flex-1 flex flex-col min-h-0' }"
          class="bg-white dark:bg-gray-950 flex flex-col min-h-0"
        >
          <template #default="{ open }">
            <div
              class="px-3 py-1 bg-gray-100 dark:bg-gray-900 text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 z-10 flex justify-between items-center cursor-pointer select-none"
            >
              <span>extractMongooseDef()</span>
              <UIcon
                :name="
                  open
                    ? 'i-heroicons-chevron-down'
                    : 'i-heroicons-chevron-right'
                "
              />
            </div>
          </template>
          <template #content>
            <div class="flex-1 relative">
              <ClientOnly>
                <StudioOutput :model-value="outputDef" />
              </ClientOnly>
            </div>
          </template>
        </UCollapsible>

        <!-- Bottom Right: Schema -->
        <UCollapsible
          v-model:open="isSchemaOpen"
          :class="[isSchemaOpen ? 'flex-1' : 'flex-none']"
          :ui="{ content: 'flex-1 flex flex-col min-h-0' }"
          class="bg-white dark:bg-gray-950 flex flex-col min-h-0"
        >
          <template #default="{ open }">
            <div
              class="px-3 py-1 bg-gray-100 dark:bg-gray-900 text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 z-10 flex justify-between items-center cursor-pointer select-none"
            >
              <div class="flex items-center gap-2">
                <span>toMongooseSchema()</span>
                <div class="flex gap-1" @click.stop>
                  <UButton
                    size="xs"
                    variant="ghost"
                    :color="activeSchemaView === 'obj' ? 'primary' : 'neutral'"
                    @click="activeSchemaView = 'obj'"
                  >
                    .obj
                  </UButton>
                  <UButton
                    size="xs"
                    variant="ghost"
                    :color="activeSchemaView === 'tree' ? 'primary' : 'neutral'"
                    @click="activeSchemaView = 'tree'"
                  >
                    .tree
                  </UButton>
                  <UButton
                    size="xs"
                    variant="ghost"
                    :color="
                      activeSchemaView === 'paths' ? 'primary' : 'neutral'
                    "
                    @click="activeSchemaView = 'paths'"
                  >
                    .paths
                  </UButton>
                </div>
              </div>
              <UIcon
                :name="
                  open
                    ? 'i-heroicons-chevron-down'
                    : 'i-heroicons-chevron-right'
                "
              />
            </div>
          </template>
          <template #content>
            <div class="flex-1 relative">
              <ClientOnly>
                <StudioOutput :model-value="activeSchemaViewOutput.value" />
              </ClientOnly>
            </div>
          </template>
        </UCollapsible>
      </UDashboardPanel>
    </UDashboardGroup>
  </div>
</template>
