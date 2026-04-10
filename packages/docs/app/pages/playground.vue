<script setup lang="ts">
definePageMeta({
  layout: "default",
});

useSeoMeta({
  title: "Playground - zod-mongoose",
  description:
    "Experiment with Zod to Mongoose schema transformations in real-time.",
});

defineOgImageComponent("Docs", {
  title: "Playground - zod-mongoose",
  description:
    "Experiment with Zod to Mongoose schema transformations in real-time.",
});
</script>

<template>
  <ZodMongooseStudio />
</template>
