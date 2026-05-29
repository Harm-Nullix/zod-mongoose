import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import {toMongooseSchema, withMongoose} from '../src/index.js';
import mongoose from 'mongoose';

describe('Advanced Zod Transformation and Validation', () => {
  test('should handle combined preprocess, transform, and refine', () => {
    const zodSchema = z.object({
      combined: z
        .preprocess(Number, z.number())
        .transform((v) => v * 2)
        .refine((v) => v > 0),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    expect(mongooseSchema.path('combined')).toBeInstanceOf(mongoose.Schema.Types.Number);
  });

  test('should handle deep pipe with multiple schemas', () => {
    const zodSchema = z.object({
      deepPipe: z
        .string()
        .pipe(z.email())
        .pipe(z.string().transform((v) => v.toLowerCase())),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    expect(mongooseSchema.path('deepPipe')).toBeInstanceOf(mongoose.Schema.Types.String);
  });

  test('should handle transformations on arrays', () => {
    const zodSchema = z.object({
      tags: z.array(z.string().transform((v) => v.trim())).transform((arr) => arr.filter(Boolean)),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    // Mongoose schema for array of strings
    const path = mongooseSchema.path('tags');
    expect(path).toBeInstanceOf(mongoose.Schema.Types.Array);
    // @ts-expect-error - access internal embeddedSchemaType
    expect(path.embeddedSchemaType).toBeInstanceOf(mongoose.Schema.Types.String);
  });

  test('should preserve Mongoose metadata through transformations', () => {
    const baseSchema = z.string();
    const schemaWithMeta = withMongoose(baseSchema, {unique: true, index: true});

    const transformedSchema = schemaWithMeta
      .transform((v) => v.toUpperCase())
      .refine((v) => v.length > 0);

    const zodObject = z.object({
      field: transformedSchema,
    });

    const mongooseSchema = toMongooseSchema(zodObject);
    const fieldPath = mongooseSchema.path('field') as any;

    expect(fieldPath).toBeInstanceOf(mongoose.Schema.Types.String);
    expect(fieldPath.options.unique).toBe(true);
    expect(fieldPath.options.index).toBe(true);
  });

  test('should handle .pipe() with coercion', () => {
    const zodSchema = z.object({
      coercedDate: z.string().pipe(z.coerce.date()),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    // In zod v4 pipe(z.coerce.date()), the 'in' is string.
    // Our converter extracts the 'in' type for Mongoose mapping.
    expect(mongooseSchema.path('coercedDate')).toBeInstanceOf(mongoose.Schema.Types.String);
  });

  test('should handle transformations on nested objects', () => {
    const innerObject = z
      .object({
        key: z.string().transform((v) => v.trim()),
      })
      .transform((obj) => ({...obj, extra: 'field'}));

    const zodSchema = z.object({
      nested: innerObject,
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    // Even if transformed, the underlying structure for Mongoose is the object before transform
    expect(mongooseSchema.path('nested.key')).toBeInstanceOf(mongoose.Schema.Types.String);
  });
});
