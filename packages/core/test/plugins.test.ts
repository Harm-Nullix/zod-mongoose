import {expect, test, describe, mock} from 'bun:test';
import {z} from 'zod/v4';
import {toMongooseSchema, withMongoose, hooks} from '../src/index.js';
import mongoose from 'mongoose';

describe('Mongoose Plugin Support', () => {
  test('should support root Mongoose plugins via options', () => {
    const schema = z.object({
      name: z.string(),
    });

    const plugin = mock((s: mongoose.Schema) => {
      s.virtual('pluginVirtual').get(() => 'hello');
    });

    const mongooseSchema = toMongooseSchema(schema, {
      plugins: [plugin],
    });

    expect(plugin).toHaveBeenCalled();
    expect((mongooseSchema.virtuals as any).pluginVirtual).toBeDefined();
  });

  test('should support plugins in nested subschemas', () => {
    let pluginCalled = false;
    const testPlugin = () => {
      pluginCalled = true;
    };

    const nested = withMongoose(
      z.object({
        name: z.string(),
      }),
      {schema: {plugins: [testPlugin]}},
    );

    const schema = z.object({
      child: nested,
    });

    toMongooseSchema(schema);
    expect(pluginCalled).toBe(true);
  });

  test('should support both Mongoose plugins and zod-mongoose hooks together', () => {
    const schema = z.object({
      name: z.string(),
    });

    const plugin = mock((s: mongoose.Schema) => {
      s.virtual('p1').get(() => 1);
    });

    const hookCallback = mock(({mongooseSchema}: {mongooseSchema: mongoose.Schema}) => {
      mongooseSchema.virtual('h1').get(() => 2);
    });

    const unhook = hooks.hook('schema:created', hookCallback);

    const mongooseSchema = toMongooseSchema(schema, {
      plugins: [plugin],
    });

    expect(plugin).toHaveBeenCalled();
    expect(hookCallback).toHaveBeenCalled();
    expect((mongooseSchema.virtuals as any).p1).toBeDefined();
    expect((mongooseSchema.virtuals as any).h1).toBeDefined();

    unhook();
  });
});
