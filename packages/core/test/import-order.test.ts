import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {zObjectId, setMongoose, setFrontendMode, getMongoose} from '../src/index.js';

describe('Import Order and setMongoose', () => {
  test('should work when zObjectId is defined before setMongoose', () => {
    // Force getMongoose to return null initially
    setFrontendMode(true);
    expect(getMongoose()).toBeNull();

    // Create schema BEFORE setting mongoose
    const schema = z.object({
      id: zObjectId(),
    });

    // Now set mongoose and disable frontend mode
    setFrontendMode(false);
    setMongoose(mongoose);
    expect(getMongoose()).toBe(mongoose);

    const id = new mongoose.Types.ObjectId();

    // Validating ObjectId
    const parsed1 = schema.parse({id});
    expect(parsed1.id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(parsed1.id.toString()).toBe(id.toString());

    // Validating string ID
    const stringId = id.toString();
    const parsed2 = schema.parse({id: stringId});
    expect(parsed2.id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(parsed2.id.toString()).toBe(stringId);
  });
});
