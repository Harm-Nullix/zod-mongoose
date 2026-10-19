import mongoose from 'mongoose';
import {toMongooseSchema, setMongoose} from '@nullix/zod-mongoose';
import {
  UserZodSchema,
  PostZodSchema,
  ActivityZodSchema,
  SettingsZodSchema,
  AssetZodSchema,
  TaskZodSchema,
  type User,
  type Post,
  type Activity,
  type Settings,
  type Asset,
  type Task,
} from '#shared/schemas';

// Expose mongoose for the converter to find in ESM/Nitro environments
setMongoose(mongoose);
(globalThis as any).mongoose = mongoose;

// User Model
export const UserSchema = toMongooseSchema(UserZodSchema);
export const UserModel =
  (mongoose.models.User as mongoose.Model<User>) || mongoose.model<User>('User', UserSchema);

// Post Model
export const PostSchema = toMongooseSchema(PostZodSchema, {
  plugins: [
    (schema: mongoose.Schema) => {
      schema.virtual('isRecent').get(function (this: any) {
        if (!this.createdAt) return false;
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return this.createdAt > oneHourAgo;
      });
    },
  ],
} as any);
// Apply timestamps handled by Zod Schema
PostSchema.set('timestamps', true);

export const PostModel =
  (mongoose.models.Post as mongoose.Model<Post>) || mongoose.model<Post>('Post', PostSchema);

// Activity Model (Discriminator example)
export const ActivitySchema = toMongooseSchema(ActivityZodSchema, {
  modelName: 'Activity',
});
export const ActivityModel =
  (mongoose.models.Activity as mongoose.Model<Activity>) ||
  mongoose.model<Activity>('Activity', ActivitySchema);

// Settings Model (Tuple, Record, Map example)
export const SettingsSchema = toMongooseSchema(SettingsZodSchema);
export const SettingsModel =
  (mongoose.models.Settings as mongoose.Model<Settings>) ||
  mongoose.model<Settings>('Settings', SettingsSchema);

// Asset Model (Buffer, Literal example)
export const AssetSchema = toMongooseSchema(AssetZodSchema);
export const AssetModel =
  (mongoose.models.Asset as mongoose.Model<Asset>) || mongoose.model<Asset>('Asset', AssetSchema);

// Task Model (Composite ID example)
export const TaskSchema = toMongooseSchema(TaskZodSchema);
export const TaskModel =
  (mongoose.models.Task as mongoose.Model<Task>) || mongoose.model<Task>('Task', TaskSchema);

const seedDB = async () => {
  const count = await UserModel.countDocuments();
  if (count === 0) {
    console.time('Seeding fake users...');
    try {
      await UserModel.create([
        {
          username: 'alice',
          email: 'alice@example.com',
          fullName: 'Alice Wonder',
          contact: {type: 'phone', phoneNumber: '555-0123'},
        },
        {
          username: 'bob',
          email: 'bob@example.com',
          fullName: 'Bob Builder',
          contact: {type: 'slack', slackId: 'U12345678'},
        },
        {
          username: 'charlie',
          email: 'charlie@example.com',
          fullName: 'Charlie Brown',
        },
      ]);
      console.timeEnd('Seeding fake users...');
    } catch (err) {
      console.error('Error seeding users:', err);
    }
  }
};

// Mongoose initialization (ideally this should be in a separate plugin or utility)
export const initDB = async () => {
  if (mongoose.connection.readyState !== 0) return;

  let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/playground';

  // Use mongodb-memory-server if explicitly requested or if no URI provided in development
  if (process.env.NODE_ENV === 'development' && !process.env.MONGODB_URI) {
    try {
      const {MongoMemoryServer} = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      MONGODB_URI = mongod.getUri();
      console.log('Using In-Memory MongoDB:', MONGODB_URI);
    } catch (err) {
      console.warn('Failed to start MongoMemoryServer, falling back to localhost:', err);
    }
  }

  await mongoose
    .connect(MONGODB_URI)
    .catch((err) => console.error('Mongoose connection error:', err));

  // Seed some fake users if the collection is empty
  await seedDB();
};

// Start connection (Nitro will wait for this during the first request or we can call it in a server plugin)
// Note: In some environments top-level await is not allowed, so we call it without await here,
// and the event handlers will await initDB() to ensure connection.
// eslint-disable-next-line unicorn/prefer-top-level-await
initDB().catch(console.error);
