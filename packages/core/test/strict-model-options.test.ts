import {afterAll, expect, test} from 'bun:test';
import mongoose from 'mongoose';
import {z} from 'zod/v4';
import {toMongooseSchema, toStrictModel, zRef} from '../src/index.js';

const modelName = 'StrictSchemaOptionsRuntime';
afterAll(() => mongoose.deleteModel(modelName));

test('preserves schema extensions when compiling a strict model', () => {
  const author = z.object({name: z.string()});
  const schema = toMongooseSchema(
    z.object({name: z.string(), author: zRef('StrictOptionsAuthor', author)}),
    {
      query: {
        byName(name: string) {
          return this.where({name});
        },
      },
      methods: {
        greet() {
          return `Hello ${this.name}`;
        },
      },
      statics: {
        named(name: string) {
          return this.findOne({name});
        },
      },
      virtuals: {
        displayName: {
          get() {
            return this.name.toUpperCase();
          },
        },
      },
    },
  );
  const Model = toStrictModel(modelName, schema);
  const doc = new Model({name: 'Ada', author: new mongoose.Types.ObjectId()});
  expect(doc.greet()).toBe('Hello Ada');
  expect(doc.displayName).toBe('ADA');
  expect(Model.named('Ada').getFilter()).toEqual({name: 'Ada'});
  expect(Model.find().byName('Ada').populate('author').getFilter()).toEqual({name: 'Ada'});
  expect(Model.find().populate('author').byName('Ada').getFilter()).toEqual({name: 'Ada'});
  expect(Model.find().sort({name: 1}).byName('Ada').getFilter()).toEqual({name: 'Ada'});
});
