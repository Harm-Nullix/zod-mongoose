import {describe, expect, test} from 'bun:test';
import mongoose from 'mongoose';
import {z} from 'zod/v4';
import {toMongooseSchema, zObjectId, zRef} from '../src/index.js';

describe('Mongoose query casting', () => {
  test('casts string _id values on a schema extended from a base schema', () => {
    const budgetOwnerBaseZodSchema = z.object({
      _id: zObjectId(),
      displayName: z.string().min(1).max(32),
      removed: z.boolean(),
    });
    const budgetOwnerZodMongooseSchema = budgetOwnerBaseZodSchema.extend({});
    const schema = toMongooseSchema(budgetOwnerZodMongooseSchema, {
      collection: 'budgetOwners',
      collation: {locale: 'nl', strength: 2},
    });
    const modelName = 'BudgetOwnerQueryCasting';
    const model = mongoose.model(modelName, schema);
    const id = '507f1f77bcf86cd799439011';

    try {
      const query = model.findOne({_id: id});

      query.cast(model);

      expect(query.getFilter()._id).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(query.getFilter()._id.toString()).toBe(id);
    } finally {
      delete mongoose.models[modelName];
    }
  });

  test('casts values for the supported primitive query paths', () => {
    const schema = toMongooseSchema(
      z.object({
        text: z.string(),
        amount: z.number(),
        enabled: z.boolean(),
        createdAt: z.date(),
        tags: z.array(z.string()),
        ownerId: zObjectId(),
      }),
    );
    const modelName = 'PrimitiveQueryCasting';
    const model = mongoose.model(modelName, schema);

    const cases = [
      ['text', 'Alice', 'Alice'],
      ['amount', '42', 42],
      ['enabled', 'true', true],
      ['createdAt', '2025-01-02T03:04:05.000Z', new Date('2025-01-02T03:04:05.000Z')],
      ['tags', 'important', 'important'],
      ['ownerId', '507f1f77bcf86cd799439011', new mongoose.Types.ObjectId('507f1f77bcf86cd799439011')],
    ] as const;

    try {
      for (const [path, input, expected] of cases) {
        const query = model.findOne({[path]: input});

        expect(() => query.cast(model)).not.toThrow();
        const castValue = query.getFilter()[path];

        if (expected instanceof Date) {
          expect(castValue).toEqual(expected);
        } else if (expected instanceof mongoose.Types.ObjectId) {
          expect(castValue).toBeInstanceOf(mongoose.Types.ObjectId);
          expect(castValue.toString()).toBe(expected.toString());
        } else {
          expect(castValue).toBe(expected);
        }
      }
    } finally {
      delete mongoose.models[modelName];
    }
  });

  test('requires a prefix for top-level discriminator model names', () => {
    const referenced = z.object({name: z.string()});
    const budgetPlanSchema = z.discriminatedUnion('type', [
      z.object({
        _id: zObjectId(),
        type: z.literal('BudgetOwner'),
        budgetOwner: zRef('BudgetOwner', referenced).optional(),
      }),
      z.object({
        _id: zObjectId(),
        type: z.literal('OtherBudgetPlan'),
      }),
    ]);
    const budgetPlanModelName = 'BudgetPlanDiscriminatorCollision';

    try {
      expect(() => toMongooseSchema(budgetPlanSchema, {collection: 'budgetPlans'})).toThrow(
        /discriminatorModelPrefix/,
      );

      const budgetPlanModel = mongoose.model(
        budgetPlanModelName,
        toMongooseSchema(budgetPlanSchema, {
          collection: 'budgetPlans',
          discriminatorModelPrefix: 'BudgetPlan',
        }),
      );

      expect(mongoose.models.BudgetOwner).toBeUndefined();
      expect(mongoose.models.BudgetPlanBudgetOwner).toBe(budgetPlanModel.discriminators?.BudgetPlanBudgetOwner);
      expect(budgetPlanModel.discriminators?.BudgetPlanBudgetOwner).toBeDefined();
    } finally {
      delete mongoose.models.BudgetOwner;
      delete mongoose.models.OtherBudgetPlan;
      delete mongoose.models.BudgetPlanBudgetOwner;
      delete mongoose.models.BudgetPlanOtherBudgetPlan;
      delete mongoose.models[budgetPlanModelName];
    }
  });
});
