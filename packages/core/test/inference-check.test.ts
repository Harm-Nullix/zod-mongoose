import {describe, expect, test} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {OutputMongoose, InferMongoose} from '../src/zod-helpers.js';

describe('Mongoose Inference', () => {
  test('should include _id as ObjectId even if not in schema', () => {
    const schema = z.object({
      name: z.string(),
    });

    type Out = OutputMongoose<typeof schema>;

    // This should work at type level
    const doc: Out = {
      name: 'test',
      _id: new mongoose.Types.ObjectId(),
    };

    expect(doc._id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(doc.name).toBe('test');
  });

  test('should handle schema with existing _id as string', () => {
    const schema = z.object({
      _id: z.string(),
      name: z.string(),
      deeper: z
        .object({
          _id: z.string(),
          name: z.string(),
        })
        .optional(),
    });

    type Out = OutputMongoose<typeof schema>;

    // In our improved implementation, Omit<O, '_id'> & { _id: ObjectId }
    // means _id should be exactly ObjectId, NOT string & ObjectId.

    const doc: Out = {
      _id: new mongoose.Types.ObjectId(),
      name: 'test',
    };

    expect(doc._id).toBeInstanceOf(mongoose.Types.ObjectId);
  });

  test('z.infer should also use Mongoose inference', () => {
    const schema = z.object({
      name: z.string(),
    });

    type Doc = InferMongoose<typeof schema>;

    const doc: Doc = {
      name: 'test',
      _id: new mongoose.Types.ObjectId(),
    };

    expect(doc._id).toBeInstanceOf(mongoose.Types.ObjectId);
  });

  test('InferMongoose should be same as OutputMongoose', () => {
    const schema = z.object({name: z.string()});
    type Out = OutputMongoose<typeof schema>;
    type Inf = InferMongoose<typeof schema>;

    const a: Out = {name: 'a', _id: new mongoose.Types.ObjectId()};
    const b: Inf = a;
    expect(b).toBe(a);
  });
});
