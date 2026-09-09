import {describe, expect, test} from 'bun:test';
import {z} from 'zod/v4';
import * as NuxtServer from '../src/index.nuxt.js';
import * as NuxtClient from '../src/index.nuxt.frontend.js';

describe('Nuxt entry point', () => {
  test('exposes the server conversion API', () => {
    expect(typeof NuxtServer.toMongooseSchema).toBe('function');
    expect(typeof NuxtServer.zObjectId).toBe('function');
  });

  test('uses browser-safe helpers in Nuxt client code', () => {
    const schema = z.object({_id: NuxtClient.zObjectId()});
    expect(schema.parse({_id: '507f1f77bcf86cd799439011'})).toEqual({
      _id: '507f1f77bcf86cd799439011',
    });
  });
});
