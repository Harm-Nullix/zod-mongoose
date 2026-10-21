import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import {toMongooseSchema, withMongoose} from '../src/index.js';
import mongoose from 'mongoose';

describe('Zod Transformation and Validation Pipelines', () => {
  describe('Basic Transforms & Refinements', () => {
    test('should handle .transform()', () => {
      const zodSchema = z.object({
        name: z.string().transform((val) => val.toUpperCase()).pipe(z.string()),
      });

      const mongooseSchema = toMongooseSchema(zodSchema);
      expect(mongooseSchema.path('name')).toBeInstanceOf(mongoose.Schema.Types.String);
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
            z.string().transform((v) => v.trim()).pipe(z.string()),
          ),
        }),
      });

      const mongooseSchema = toMongooseSchema(zodSchema);
      expect(mongooseSchema.path('nested.val')).toBeInstanceOf(mongoose.Schema.Types.String);
    });

    test('should handle combined preprocess, transform, and refine', () => {
      const zodSchema = z.object({
        combined: z
          .preprocess(Number, z.number())
          .transform((v) => v * 2)
          .refine((v) => v > 0).pipe(z.number()),
      });

      const mongooseSchema = toMongooseSchema(zodSchema);
      expect(mongooseSchema.path('combined')).toBeInstanceOf(mongoose.Schema.Types.Number);
    });

    test('should handle transformations on arrays', () => {
      const zodSchema = z.object({
        tags: z.array(z.string().transform((v) => v.trim())).transform((arr) => arr.filter(Boolean)).pipe(z.array(z.string())),
      });

      const mongooseSchema = toMongooseSchema(zodSchema);
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
        .refine((v) => v.length > 0).pipe(z.string());

      const zodObject = z.object({
        field: transformedSchema,
      });

      const mongooseSchema = toMongooseSchema(zodObject);
      const fieldPath = mongooseSchema.path('field') as any;

      expect(fieldPath).toBeInstanceOf(mongoose.Schema.Types.String);
      expect(fieldPath.options.unique).toBe(true);
      expect(fieldPath.options.index).toBe(true);
    });

    test('should handle transformations on nested objects', () => {
      const innerObject = z
        .object({
          key: z.string().transform((v) => v.trim()),
        })
        .transform((obj) => ({...obj, extra: 'field'})).pipe(z.object({key: z.string(), extra: z.string()}));

      const zodSchema = z.object({
        nested: innerObject,
      });

      const mongooseSchema = toMongooseSchema(zodSchema);
      expect(mongooseSchema.path('nested.key')).toBeInstanceOf(mongoose.Schema.Types.String);
    });
  });

  describe('Pipes and Coercion', () => {
    test('should handle .pipe()', () => {
      const zodSchema = z.object({
        age: z.string().pipe(z.coerce.number()),
      });

      const mongooseSchema = toMongooseSchema(zodSchema);
      expect(mongooseSchema.path('age')).toBeInstanceOf(mongoose.Schema.Types.Number);
    });

    test('should handle deep pipe with multiple schemas', () => {
      const zodSchema = z.object({
        deepPipe: z
          .string()
          .pipe(z.email())
          .pipe(z.string().transform((v) => v.toLowerCase())).pipe(z.string()),
      });

      const mongooseSchema = toMongooseSchema(zodSchema);
      expect(mongooseSchema.path('deepPipe')).toBeInstanceOf(mongoose.Schema.Types.String);
    });

    test('should handle .pipe() with coercion', () => {
      const zodSchema = z.object({
        coercedDate: z.string().pipe(z.coerce.date()),
      });

      const mongooseSchema = toMongooseSchema(zodSchema);
      expect(mongooseSchema.path('coercedDate')).toBeInstanceOf(mongoose.Schema.Types.Date);
    });

    test('an output pipe supplies the Boolean type', () => {
      const schema = toMongooseSchema(z.object({
        active: z.string().transform((value) => value === 'true').pipe(z.boolean()),
      }));
      expect(schema.path('active').instance).toBe('Boolean');
    });
  });

  describe('Inference and Mixed Fallbacks', () => {
    test('an opaque callback uses Mixed without executing or inspecting it', () => {
      let calls = 0;
      const callback = (value: string) => {
        calls++;
        return value === 'true';
      };
      callback.toString = () => {
        throw new Error('Callback source must not be inspected');
      };
      const schema = toMongooseSchema(z.object({active: z.string().transform(callback)}));
      expect(schema.path('active').instance).toBe('Mixed');
      expect(calls).toBe(0);
    });

    test('a default does not constrain every possible callback result', () => {
      const schema = toMongooseSchema(z.object({
        value: z.string().transform((value) => (value === 'true' || value === 'false' ? value === 'true' : value)).default(false),
      }));
      expect(schema.path('value').instance).toBe('Mixed');
      expect(schema.path('value').options.default).toBe(false);
    });

    test('the built-in stringbool codec declares its Boolean output', async () => {
      const input = z.object({active: z.stringbool()});
      const connection = mongoose.createConnection();
      try {
        const Model = connection.model('StringboolOutput', toMongooseSchema(input));
        const doc = new Model(input.parse({active: 'yes'}));
        expect(Model.schema.path('active').instance).toBe('Boolean');
        await doc.validate();
        expect(doc.active).toBe(true);
      } finally {
        connection.deleteModel(/.*/);
      }
    });
  });
});
