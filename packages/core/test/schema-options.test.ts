import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {withMongoose, toMongooseSchema} from '../src/index.js';

describe('Mongoose Schema Options via withMongoose', () => {
  test('should apply top-level schema options like collection and versionKey', () => {
    const UserZodSchema = withMongoose(
      z.object({
        name: z.string(),
      }),
      {
        collection: 'custom_users',
        versionKey: '__v_custom',
        timestamps: true,
      },
    );

    const schema = toMongooseSchema(UserZodSchema);

    expect(schema.get('collection')).toBe('custom_users');
    expect(schema.options.versionKey).toBe('__v_custom');
    expect(schema.options.timestamps).toBe(true);
  });

  test('should allow overriding options in toMongooseSchema', () => {
    const UserZodSchema = withMongoose(
      z.object({
        name: z.string(),
      }),
      {
        collection: 'original_collection',
      },
    );

    const schema = toMongooseSchema(UserZodSchema, {
      collection: 'overridden_collection',
    });

    expect(schema.get('collection')).toBe('overridden_collection');
  });

  test('should support _id: false and id: false in schema options', () => {
    const UserZodSchema = withMongoose(
      z.object({
        name: z.string(),
      }),
      {_id: false, id: false},
    );

    const UserSchema = toMongooseSchema(UserZodSchema);

    // Mongoose schema options are stored in schema.options
    expect(UserSchema.get('_id')).toBe(false);
    expect(UserSchema.get('id')).toBe(false);

    // Check if _id is present in paths
    expect(UserSchema.path('_id')).toBeUndefined();
  });
  test('reflects literal timestamp, ID and version options without changing the Zod shape', () => {
    const value = z.object({name: z.string()});
    const meta = withMongoose(value, {timestamps: true, _id: false, id: false});
    const schema = toMongooseSchema(meta, {
      timestamps: {createdAt: 'created_on', updatedAt: false},
      versionKey: 'revision',
    });
    expect(schema.path('created_on')?.instance).toBe('Date');
    expect(schema.path('createdAt')).toBeUndefined();
    expect(schema.path('updatedAt')).toBeUndefined();
    const Model = mongoose.model('LiteralOptionsRuntime', schema);
    const doc = new Model({name: 'Ada'});
    expect(Object.keys(doc.toObject())).toEqual(['name']);
    expect(doc.name).toBe('Ada');
    expect(doc.get('_id')).toBeUndefined();
    expect(doc.get('id')).toBeUndefined();
    expect(schema.options.versionKey).toBe('revision');
    expect(value.parse({name: 'Ada'})).toEqual({name: 'Ada'});
    const overridden = toMongooseSchema(meta, {timestamps: false, _id: true});
    expect(overridden.path('createdAt')).toBeUndefined();
    expect(overridden.path('_id')).toBeDefined();
    expect(
      toMongooseSchema(withMongoose(meta, {timestamps: false})).path('createdAt'),
    ).toBeUndefined();
  });
});
