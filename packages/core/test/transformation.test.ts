import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import {toMongooseSchema} from '../src/index.js';
import mongoose from 'mongoose';

describe('Zod Transformation and Validation Pipelines', () => {
  test('should handle .transform()', () => {
    const zodSchema = z.object({
      name: z.string().transform((val) => val.toUpperCase()),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    expect(mongooseSchema.path('name')).toBeInstanceOf(mongoose.Schema.Types.String);
  });

  test('should handle .pipe()', () => {
    const zodSchema = z.object({
      age: z.string().pipe(z.coerce.number()),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    // .pipe(z.coerce.number()) in zod v4 usually has the 'out' schema as the second one
    // our converter should extract the 'out' part (number)
    expect(mongooseSchema.path('age')).toBeInstanceOf(mongoose.Schema.Types.Number);
  });

  test('should handle .preprocess()', () => {
    const zodSchema = z.object({
      count: z.preprocess(Number, z.number()),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    expect(mongooseSchema.path('count')).toBeInstanceOf(mongoose.Schema.Types.Number);
  });

  test('should handle .refine()', () => {
    const zodSchema = z.object({
      email: z.email().refine((val) => val.endsWith('@example.com')),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    expect(mongooseSchema.path('email')).toBeInstanceOf(mongoose.Schema.Types.String);
  });

  test('should handle .superRefine()', () => {
    const zodSchema = z.object({
      password: z.string().superRefine((val, ctx) => {
        if (val.length < 8) {
          ctx.addIssue({
            code: 'custom',
            message: 'Too short',
          });
        }
      }),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    expect(mongooseSchema.path('password')).toBeInstanceOf(mongoose.Schema.Types.String);
  });

  test('should handle nested transformations', () => {
    const zodSchema = z.object({
      nested: z.object({
        val: z.preprocess(
          String,
          z.string().transform((v) => v.trim()),
        ),
      }),
    });

    const mongooseSchema = toMongooseSchema(zodSchema);
    expect(mongooseSchema.path('nested.val')).toBeInstanceOf(mongoose.Schema.Types.String);
  });
});
