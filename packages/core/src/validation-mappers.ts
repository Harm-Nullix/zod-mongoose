import { callHookSync } from './hooks.js';

/**
 * Helper to map Zod checks (min, max, regex, etc.) to Mongoose Schema properties.
 */
export function mapZodChecksToMongoose(checks: any[], mongooseProp: any) {
  if (!checks || !Array.isArray(checks)) return;

  for (const check of checks) {
    const traitSet = check._zod?.traits;
    const checkDef = check._zod?.def;
    if (!traitSet || !checkDef) continue;

    // String Lengths
    if (traitSet.has('$ZodCheckMinLength')) {
      mongooseProp.minlength = checkDef.minimum;
    }
    if (traitSet.has('$ZodCheckMaxLength')) {
      mongooseProp.maxlength = checkDef.maximum;
    }
    if (traitSet.has('$ZodCheckLengthEquals')) {
      mongooseProp.minlength = checkDef.length;
      mongooseProp.maxlength = checkDef.length;
    }

    // Numbers and Dates Comparisons
    if (traitSet.has('$ZodCheckGreaterThan')) {
      mongooseProp.min = checkDef.value;
    }
    if (traitSet.has('$ZodCheckLessThan')) {
      mongooseProp.max = checkDef.value;
    }

    // Regex / Match
    if (traitSet.has('$ZodCheckRegex')) {
      mongooseProp.match = checkDef.pattern;
    }

    // UUID
    if (traitSet.has('$ZodUUID')) {
      const mongoose = (globalThis as any).mongoose || (globalThis as any).__mongoose;
      if (mongoose?.Schema.Types.UUID) {
        mongooseProp.type = mongoose.Schema.Types.UUID;
      }
    }

    // String Transforms (trim, lowercase, uppercase)
    if (traitSet.has('$ZodCheckOverwrite') && typeof checkDef.tx === 'function') {
      const txStr = checkDef.tx.toString();
      if (txStr.includes('.trim()')) {
        mongooseProp.trim = true;
      } else if (txStr.includes('.toLowerCase()')) {
        mongooseProp.lowercase = true;
      } else if (txStr.includes('.toUpperCase()')) {
        mongooseProp.uppercase = true;
      }
    }
  }

  callHookSync('validation:mappers', { checks, mongooseProp });
}
