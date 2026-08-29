import {describe, expect, test} from 'bun:test';
import mongoose from 'mongoose';
import {z} from 'zod/v4';
import {toMongooseSchema, zObjectId, zRef} from '../src/index.js';

describe('Mongoose query casting', () => {
  test('casts string _id values on a schema extended from a base schema', () => {
    const activityBaseZodSchema = z.object({
      _id: zObjectId(),
      name: z.string().min(1).max(32),
      archived: z.boolean(),
    });
    const activityZodMongooseSchema = activityBaseZodSchema.extend({});
    const schema = toMongooseSchema(activityZodMongooseSchema, {
      collection: 'activities',
      collation: {locale: 'nl', strength: 2},
    });
    const modelName = 'ActivityQueryCasting';
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

  test('derives discriminator model names from modelName or collection', () => {
    const referenced = z.object({name: z.string()});
    const activitySchema = z.discriminatedUnion('type', [
      z.object({
        _id: zObjectId(),
        type: z.literal('clicked'),
        target: zRef('Activity', referenced).optional(),
      }),
      z.object({
        _id: zObjectId(),
        type: z.literal('viewed'),
      }),
    ]);
    const activityModelName = 'ActivityDiscriminatorCollision';

    try {
      expect(() => toMongooseSchema(activitySchema)).toThrow(
        /modelName.*collection|collection.*modelName/,
      );

      const collectionFallbackModelName = 'CollectionFallbackActivity';
      const collectionFallbackModel = mongoose.model(
        collectionFallbackModelName,
        toMongooseSchema(activitySchema, {collection: 'activities'}),
      );

      expect(mongoose.models.Activity_clicked).toBe(
        collectionFallbackModel.discriminators?.Activity_clicked,
      );
      delete mongoose.models.Activity_clicked;
      delete mongoose.models.Activity_viewed;
      delete mongoose.models[collectionFallbackModelName];

      const activityModel = mongoose.model(
        activityModelName,
        toMongooseSchema(activitySchema, {
          collection: 'activities',
          modelName: 'Activity',
        }),
      );

      expect(mongoose.models.clicked).toBeUndefined();
      expect(mongoose.models.Activity_clicked).toBe(activityModel.discriminators?.Activity_clicked);
      expect(activityModel.discriminators?.Activity_clicked).toBeDefined();
    } finally {
      delete mongoose.models.clicked;
      delete mongoose.models.viewed;
      delete mongoose.models.Activity_clicked;
      delete mongoose.models.Activity_viewed;
      delete mongoose.models[activityModelName];
    }
  });
});
