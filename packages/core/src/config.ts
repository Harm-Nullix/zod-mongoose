let mongooseInstance: any = null;
let isFrontend: boolean | undefined;

/**
 * @deprecated Conditional exports select the appropriate implementation automatically.
 * Import from `@nullix/zod-mongoose/nuxt` in Nuxt applications instead.
 */
export const setFrontendMode = (enabled: boolean) => {
  // eslint-disable-next-line no-console
  console.warn(
    '[zod-mongoose] setFrontendMode() is deprecated and will be removed in v4. ' +
      'Conditional exports select the appropriate implementation automatically. ' +
      'Use @nullix/zod-mongoose/nuxt for Nuxt applications.',
  );
  isFrontend = enabled;
};

export const getFrontendMode = () => {
  // Try to auto-detect if not explicitly set
  // This is a simple heuristic: check for window/document
  if (isFrontend === undefined || isFrontend === null) {
    return (globalThis as any).window !== undefined && (globalThis as any).document !== undefined;
  }
  return isFrontend;
};

/**
 * Manually set the Mongoose instance.
 * Useful in ESM environments where automatic detection via require() might fail.
 */
export const setMongoose = (m: any) => {
  mongooseInstance = m;
};

// Helper to get mongoose instance safely
export const getMongoose = () => {
  if (getFrontendMode()) {
    return null;
  }
  if (mongooseInstance) {
    return mongooseInstance;
  }
  try {
    if (typeof require !== 'undefined') {
      // eslint-disable-next-line global-require
      const m = require('mongoose');
      if (m && (m.Schema || m.default?.Schema)) {
        return m.default || m;
      }
      return m;
    }
    return null;
  } catch {
    // Try to see if mongoose is globally available (e.g. in some environments)
    if ((globalThis as any).mongoose) {
      return (globalThis as any).mongoose;
    }
    return null;
  }
};
