import {z} from 'zod/v4';
import {withMongoose} from '../../src/index.js';

export const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
});

// safeExtend makes a separate Zod instance. Metadata stays on this variant.
export const AddressWithoutIdSchema = withMongoose(AddressSchema.safeExtend({}), {
  schema: {_id: false, id: false},
});
