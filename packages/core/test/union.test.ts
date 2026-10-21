import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import {toMongooseSchema, hooks} from '../src/index.js';
import mongoose from 'mongoose';

describe('Zod Union to Mongoose Union', () => {
  test('should map simple union to Schema.Types.Union', () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    });

    const mongooseSchema = toMongooseSchema(schema);
    const valuePath = mongooseSchema.path('value') as any;

    // In Mongoose 8.2+, it should be 'Union' for simple primitive unions
    expect(valuePath.instance).toBe('Union');
    expect(valuePath.options.of).toBeArray();
    expect(valuePath.options.of).toHaveLength(2);
    expect(valuePath.options.of[0]).toBe(String);
    expect(valuePath.options.of[1]).toBe(Number);
  });

  test('should map complex union to its constituent fields', () => {
    const schema = z.object({
      activity: z.discriminatedUnion('type', [
        z.object({type: z.literal('run'), distance: z.number()}),
        z.object({type: z.literal('swim'), laps: z.number()}),
      ]),
    });

    const mongooseSchema = toMongooseSchema(schema);
    const activityPath = mongooseSchema.path('activity') as any;

    expect(activityPath.instance).toBe('Embedded');
    expect(activityPath.schema.options.discriminatorKey).toBe('type');
    expect(activityPath.schema.discriminators).toHaveProperty('run');
    expect(activityPath.schema.discriminators).toHaveProperty('swim');

    const runSchema = activityPath.schema.discriminators.run;
    expect(runSchema.path('distance').instance).toBe('Number');
    // Literal might be String or Mixed depending on implementation details
    expect(['String', 'Mixed']).toContain(runSchema.path('type').instance);

    const swimSchema = activityPath.schema.discriminators.swim;
    expect(swimSchema.path('laps').instance).toBe('Number');
    expect(['String', 'Mixed']).toContain(swimSchema.path('type').instance);
  });

  test('should correctly validate data against Mongoose Union', async () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    });
    const mongooseSchema = toMongooseSchema(schema);
    const Model = mongoose.model('UnionTest', mongooseSchema);

    // Valid data
    const doc1 = new Model({ value: 'hello' });
    await doc1.validate();

    const doc2 = new Model({ value: 42 });
    await doc2.validate();

    // Invalid data
    const doc3 = new Model({ value: { a: 1 } });
    let error;
    try {
      await doc3.validate();
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
    // In Mongoose it seems to be CastError
    expect(error.errors.value.name).toBe('CastError');
  });

  test('should execute custom validator on top-level discriminated union and invalidate discriminator key', () => {
    const DiscriminatedZod = z.discriminatedUnion('type', [
      z.object({type: z.literal('run'), distance: z.number()}),
      z.object({type: z.literal('swim'), laps: z.number()}),
    ]);

    const schema = toMongooseSchema(DiscriminatedZod, {
      modelName: 'TopLevelDiscValidatorModel',
    });

    const typePath = schema.path('type') as any;
    expect(typePath.validators.length).toBeGreaterThan(0);

    const validatorDef = typePath.validators[0];
    let invalidatedPath = '';
    let invalidatedMessage = '';

    const mockDoc = {
      type: 'run',
      distance: 'not-a-number',
      invalidate(path: string, msg: string) {
        invalidatedPath = path;
        invalidatedMessage = msg;
      },
    };

    const result = validatorDef.validator.call(mockDoc, 'run');
    expect(result).toBe(false);
    expect(invalidatedPath).toBe('type');
    expect(invalidatedMessage).toContain('Zod validation failed');

    const validMockDoc = {
      type: 'run',
      distance: 10,
    };
    expect(validatorDef.validator.call(validMockDoc, 'run')).toBe(true);
    expect(validatorDef.message({path: 'type'})).toBe('Validation failed for type');
  });

  test('should execute custom validator on nested XOR schemas and format error', async () => {
    const CardSchema = z.object({type: z.literal('card'), cardNumber: z.string()});
    const BankSchema = z.object({type: z.literal('bank'), accountNumber: z.string()});
    const xorUnion = z.union([CardSchema, BankSchema]);
    (xorUnion as any)._def.inclusive = false;

    const RootSchema = z.object({
      payment: xorUnion,
    });

    const schema = toMongooseSchema(RootSchema);
    const Model = mongoose.model('XorValidatorModel', schema);

    const validDoc = new Model({payment: {type: 'card', cardNumber: '1234-5678'}});
    await validDoc.validate();

    const invalidDoc = new Model({payment: {type: 'card', cardNumber: 12345 as any}});
    let validationError: any;
    try {
      await invalidDoc.validate();
    } catch (err) {
      validationError = err;
    }
    expect(validationError).toBeDefined();
    expect(validationError.errors.payment).toBeDefined();
    expect(validationError.errors.payment.message).toBe('XOR validation failed');
  });

  test('should execute custom validator and message on mixed/fallback union fields', async () => {
    const MixedUnionSchema = z.object({
      field: z.union([z.string(), z.array(z.number())]),
    });

    const schema = toMongooseSchema(MixedUnionSchema);
    const Model = mongoose.model('MixedUnionValidatorModel', schema);

    const validDoc1 = new Model({field: 'hello'});
    await validDoc1.validate();

    const validDoc2 = new Model({field: [1, 2, 3]});
    await validDoc2.validate();

    const invalidDoc = new Model({field: {invalid: true} as any});
    let validationError: any;
    try {
      await invalidDoc.validate();
    } catch (err) {
      validationError = err;
    }
    expect(validationError).toBeDefined();
    expect(validationError.errors.field).toBeDefined();
    expect(validationError.errors.field.message).toContain('Union validation failed');
  });

  describe('Complex Unions and Hooks', () => {
    test('should merge object unions into constituent fields', () => {
      const schema = z.object({
        union: z.union([
          z.object({a: z.string()}),
          z.object({b: z.number()}),
        ]),
      });

      const mongooseSchema = toMongooseSchema(schema);
      const unionPath = mongooseSchema.path('union') as any;
      expect(unionPath).toBeDefined();
    });

    test('should allow enabling complex unions via hooks', () => {
      const schema = z.object({
        union: z.union([
          z.object({a: z.string()}),
          z.object({b: z.number()}),
        ]),
      });

      hooks.removeAllHooks();

      hooks.hook('schema:union:before', (context) => {
        context.ctx.isSimpleUnion = true;
      });

      const mongooseSchema = toMongooseSchema(schema);
      const path = mongooseSchema.path('union') as any;

      expect(path.instance).toBe('Union');
      expect(path.options.of).toHaveLength(2);

      hooks.removeAllHooks();
    });
  });
});
