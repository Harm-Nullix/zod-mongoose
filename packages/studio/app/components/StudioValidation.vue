<script setup lang="ts">
import type { ValidationResult } from "../composables/useStudioRunner";

defineProps<{ result: ValidationResult; stale: boolean }>();
</script>

<template>
  <section class="studio-card studio-validation" aria-labelledby="validation-title">
    <div class="studio-card-head">
      <div class="studio-card-heading">
        <div>
          <p class="studio-eyebrow">Zod</p>
          <h2 id="validation-title">Validation</h2>
        </div>
      </div>
      <div class="studio-card-actions">
        <span v-if="stale" class="studio-status studio-status-stale">Edited</span>
        <span v-else-if="result.status === 'valid'" class="studio-status studio-status-valid">Valid</span>
        <span v-else-if="result.status === 'invalid' || result.status === 'json-error' || result.status === 'parse-error'" class="studio-status studio-status-invalid">Invalid</span>
        <span v-else class="studio-status">Ready</span>
        <slot name="actions" />
      </div>
    </div>

    <div class="studio-validation-body">
      <div v-if="result.status === 'valid'" class="studio-result-intro">
        <span class="studio-result-icon studio-result-icon-valid">✓</span>
        <div><strong>Parsed successfully</strong><p>Defaults, transforms and stripped fields appear below.</p></div>
      </div>
      <div v-else-if="result.status === 'invalid'" class="studio-result-intro">
        <span class="studio-result-icon studio-result-icon-invalid">!</span>
        <div><strong>{{ result.issues?.length }} validation issue{{ result.issues?.length === 1 ? '' : 's' }}</strong><p>Update the JSON input and run again.</p></div>
      </div>
      <div v-else class="studio-result-intro">
        <span class="studio-result-icon">{ }</span>
        <div><strong>{{ result.status === 'json-error' ? 'JSON could not be read' : result.status === 'parse-error' ? 'Validation could not run' : 'Ready to validate' }}</strong><p>{{ result.message }}</p></div>
      </div>

      <pre v-if="result.status === 'valid'" class="studio-parsed" aria-label="Parsed data">{{ result.parsed }}</pre>
      <ul v-else-if="result.status === 'invalid'" class="studio-issues">
        <li v-for="(issue, index) in result.issues" :key="`${issue.path}-${index}`">
          <code>{{ issue.path }}</code><span>{{ issue.message }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
