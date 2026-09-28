import mongoose from 'mongoose';
import {z} from 'zod/v4';
import {toMongooseSchema, type ToMongooseSchemaOptions} from '../src/index.js';

const userZodSchema = z.object({name: z.string()});
type User = z.infer<typeof userZodSchema>;

interface UserMethods {
  greet(): string;
}

interface UserQueryHelpers {
  byName(
    name: string,
  ): mongoose.QueryWithHelpers<unknown, mongoose.HydratedDocument<User>, UserQueryHelpers>;
}

interface UserStatics {
  findByName(name: string): Promise<mongoose.HydratedDocument<User> | null>;
}

interface UserVirtuals {
  displayName: string;
}

const options: ToMongooseSchemaOptions<
  User,
  UserMethods,
  UserQueryHelpers,
  UserStatics,
  UserVirtuals
> = {
  query: {
    byName(name) {
      return this.where({name});
    },
  },
  methods: {
    greet() {
      return this.name;
    },
  },
  statics: {
    async findByName(name) {
      return this.findOne({name});
    },
  },
  virtuals: {
    displayName: {
      get() {
        return this.name;
      },
    },
  },
};

export function checkSchemaOptionTypes() {
  const UserModel = mongoose.model(
    'UserSchemaOptionTypes',
    toMongooseSchema(userZodSchema, options),
  );
  UserModel.find().byName('Ada');
  UserModel.findByName('Ada');
  const user = new UserModel({name: 'Ada'});
  user.greet();
  const name: string = user.displayName;
  // @ts-expect-error Unknown query helpers are not available.
  UserModel.find().unknownHelper();
  // @ts-expect-error Unknown statics are not available.
  UserModel.unknownStatic();
  // @ts-expect-error Query helpers keep their parameter types on the compiled model.
  UserModel.find().byName(1);
  // @ts-expect-error Statics keep their parameter types on the compiled model.
  UserModel.findByName(1);
  // @ts-expect-error Methods keep their return types on hydrated documents.
  const invalid: number = user.greet();
  // @ts-expect-error Virtuals keep their value types on hydrated documents.
  const invalidVirtual: number = user.displayName;
  return {name, invalid, invalidVirtual};
}

export function checkInlineOptions() {
  const UserModel = mongoose.model(
    'InlineSchemaOptionTypes',
    toMongooseSchema(userZodSchema, {
      query: {
        byName(name: string) {
          return this.where({name});
        },
      },
      methods: {
        greet() {
          return this.name;
        },
      },
      statics: {
        findByName(name: string) {
          return this.findOne({name});
        },
      },
      virtuals: {
        displayName: {
          get() {
            return this.name;
          },
        },
      },
    }),
  );
  UserModel.find().byName('Ada');
  UserModel.findByName('Ada');
  const user = new UserModel({name: 'Ada'});
  user.greet();
  const name: string = user.displayName;
  // @ts-expect-error Inferred query helpers keep their parameter types.
  UserModel.find().byName(1);
  // @ts-expect-error Inferred statics keep their parameter types.
  UserModel.findByName(1);
  // @ts-expect-error Inferred methods keep their return types.
  const invalidMethod: number = user.greet();
  // @ts-expect-error The Zod document supplies the method's `this` type.
  user.unknownMethod();
  return {name, invalidMethod};
}
