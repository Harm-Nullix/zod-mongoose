let mongooseInstance: any = null;
let isFrontend: boolean | undefined;

/**
 * @deprecated Conditional exports select the appropriate implementation automatically.
 */
export const setFrontendMode = (enabled: boolean) => {
  // eslint-disable-next-line no-console
  console.warn(
    '[zod-mongoose] setFrontendMode() is deprecated and will be removed in v4. ' +
      'Conditional exports select the appropriate implementation automatically.',
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
  if ((globalThis as any).mongoose) {
    const m = (globalThis as any).mongoose;
    return m.default || m;
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
  } catch {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && typeof (process as any).getBuiltinModule === 'function') {
      const nodeModule = (process as any).getBuiltinModule('node:module') || (process as any).getBuiltinModule('module');
      if (nodeModule && typeof nodeModule.createRequire === 'function') {
        const req = nodeModule.createRequire(`${process.cwd()}/`);
        const m = req('mongoose');
        if (m && (m.Schema || m.default?.Schema)) {
          return m.default || m;
        }
        return m;
      }
    }
  } catch {
    // ignore
  }
  return null;
};
