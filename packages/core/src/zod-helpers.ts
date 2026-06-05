import {z} from 'zod/v4';

export interface SchemaFeatures {
  default?: any;
  required?: boolean;
  isOptional?: boolean;
  isNullable?: boolean;
  readOnly?: boolean;
  checks?: any;
  transformations?: any[];
}

/**
 * Recursively unwrap Zod schemas (Optional, Nullable, Default, Effects, Pipelines)
 * using Zod's public API and internal _def.type identifiers.
 */
export function unwrapZodSchema(
  schema: z.ZodTypeAny,
  // eslint-disable-next-line unicorn/no-object-as-default-parameter
  features: SchemaFeatures = {required: true},
  visited: Set<z.ZodTypeAny> = new Set(),
): {schema: z.ZodTypeAny; features: SchemaFeatures} {
  if (!schema) return {schema, features};
  if (visited.has(schema)) return {schema, features};

  const def = (schema as any)._def;
  if (!def) return {schema, features};

  // Skip visited check for wrappers to allow deep unwrapping
  if (
    !(schema instanceof z.ZodOptional) &&
    !(schema instanceof z.ZodNullable) &&
    !(schema instanceof z.ZodDefault) &&
    def.type !== 'pipe'
  ) {
    visited.add(schema);
  }

  if (schema instanceof z.ZodOptional) {
    const inner = schema.unwrap();
    return unwrapZodSchema(
      // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
      inner,
      {
        ...features,
        required: false,
        isOptional: true,
      },
      visited,
    );
  }

  if (schema instanceof z.ZodNullable) {
    return unwrapZodSchema(
      // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
      schema.unwrap(),
      {
        ...features,
        isNullable: true,
      },
      visited,
    );
  }

  if (schema instanceof z.ZodDefault) {
    const defaultValue =
      typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
    return unwrapZodSchema(
      def.innerType,
      {
        ...features,
        default: defaultValue,
      },
      visited,
    );
  }

  const {type} = def;

  // In Zod v4, transform, preprocess, and refine are often implemented as pipes.
  // For transform: in = schema, out = transformation
  // For preprocess: in = preprocessing, out = schema
  if (type === 'pipe') {
    const inType = def.in?._def?.type;
    const outType = def.out?._def?.type;

    if (inType === 'transform') {
      // It's a preprocess (in is transformation, out is schema)
      return unwrapZodSchema(def.out, features, visited);
    }

    if (outType === 'transform' || outType === 'refinement') {
      // It's a transform or refine (in is schema, out is logic)
      // We should still collect transformations from the 'out' part
      const transformFeatures = {...features};
      const outDef = def.out?._def;
      const effects = outDef?.effects || outDef?.transformations || (outType === 'transform' ? [outDef] : []);
      if (effects && Array.isArray(effects)) {
        transformFeatures.transformations = [
          ...(transformFeatures.transformations || []),
          ...effects,
        ];
      }
      return unwrapZodSchema(def.in, transformFeatures, visited);
    }

    // Default pipe behavior (extract the output part)
    return unwrapZodSchema(def.out, features, visited);
  }

  if (
    type === 'transform' ||
    type === 'preprocess' ||
    type === 'refinement' ||
    type === 'effects'
  ) {
    const transformFeatures = {...features};
    const effects = def.effects || def.transformations || (def.type === 'transform' || type === 'transform' ? [def] : []);
    if (effects && Array.isArray(effects)) {
      transformFeatures.transformations = [
        ...(transformFeatures.transformations || []),
        ...effects,
      ];
    }
    const inner = def.schema || def.innerType;
    if (inner) {
      const result = unwrapZodSchema(inner, transformFeatures, visited);
      return result;
    }
  }

  if (type === 'lazy') {
    // For lazy types, we need to be careful with infinite recursion.
    // If we've already seen this specific lazy schema in this unwrapping chain,
    // we return it as is to stop recursion.
    // NOTE: In Zod v4, getter() might return different objects each time if not careful.
    return {schema, features};
  }

  if (type === 'branded' || type === 'readonly') {
    return unwrapZodSchema(
      (schema as any).unwrap(),
      {
        ...features,
        ...(type === 'readonly' ? {readOnly: true} : {}),
      },
      visited,
    );
  }

  // Extract checks if present
  if (def.checks && Array.isArray(def.checks)) {
    features.checks = [...(features.checks || []), ...def.checks];
  }

  return {schema, features};
}
