import {describe, it, expect, beforeAll, afterAll} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {toMongooseSchema, zRef, toStrictModel} from '../src/index.js';

let mongoServer: MongoMemoryServer;

describe('StrictModel', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  const AuthorSchema = z.object({
    name: z.string(),
    age: z.number(),
  });

  const PostSchema = z.object({
    title: z.string(),
    author: zRef('Author', AuthorSchema),
    mentions: z.array(zRef('Author', AuthorSchema)),
  });

  type Post = z.infer<typeof PostSchema>;
  type Author = z.infer<typeof AuthorSchema>;

  it('should provide strict types for .populate()', async () => {
    const authorSchemaMongoose = toMongooseSchema(AuthorSchema);
    const postSchemaMongoose = toMongooseSchema(PostSchema);

    // Register models
    mongoose.model('Author', authorSchemaMongoose);
    const PostModel = toStrictModel<Post>('Post', postSchemaMongoose);
    // Create data
    const author = await mongoose.model<Author>('Author').create({name: 'John Doe', age: 30});
    await PostModel.create({
      title: 'Hello World',
      author: author._id,
      mentions: [author._id],
    });

    // 1. Test Query population
    const foundPost = await PostModel.findOne({title: 'Hello World'}).populate('author').exec();
    expect(foundPost).toBeDefined();
    if (foundPost && foundPost.author) {
      expect(foundPost.author).toHaveProperty('name', 'John Doe');

      // Type check - this should compile if everything is correct
      const authorName: string = foundPost.author.name;
      expect(authorName).toBe('John Doe');
    }

    // 2. Test Array population
    const populatedMentions = await PostModel.findOne({title: 'Hello World'})
      .populate('mentions')
      .exec();

    expect(populatedMentions).toBeDefined();
    if (populatedMentions && populatedMentions.mentions) {
      expect(populatedMentions.mentions[0]).toHaveProperty('name', 'John Doe');
      const mentionName: string = populatedMentions.mentions[0].name;
      expect(mentionName).toBe('John Doe');
    }

    // 3. Test Document population
    const rawPost = await PostModel.findOne({title: 'Hello World'}).exec();
    expect(rawPost).toBeDefined();
    if (rawPost) {
      const populatedDoc = await rawPost.populate('author');

      if (populatedDoc.author) {
        expect(populatedDoc.author).toHaveProperty('name', 'John Doe');
        const authorName: string = populatedDoc.author.name;
        expect(authorName).toBe('John Doe');
      }
    }
  });

  it('should support multiple levels of population (theoretically)', async () => {
    const UserSchema = z.object({
      username: z.string(),
    });
    const AuthorSchemaWithUser = z.object({
      name: z.string(),
      user: zRef('DeepUser', UserSchema),
    });
    const PostSchemaWithAuthor = z.object({
      title: z.string(),
      author: zRef('DeepAuthor', AuthorSchemaWithUser),
    });

    type Post = z.infer<typeof PostSchemaWithAuthor>;
    type Author = z.infer<typeof AuthorSchemaWithUser>;
    type User = z.infer<typeof UserSchema>;

    const userSchemaMongoose = toMongooseSchema(UserSchema);
    const authorSchemaMongoose = toMongooseSchema(AuthorSchemaWithUser);
    const postSchemaMongoose = toMongooseSchema(PostSchemaWithAuthor);

    mongoose.model('DeepUser', userSchemaMongoose);
    mongoose.model('DeepAuthor', authorSchemaMongoose);
    const PostModel = toStrictModel<Post>('PostDeep', postSchemaMongoose);

    const user = await mongoose.model<User>('DeepUser').create({username: 'johndoe'});
    const author = await mongoose
      .model<Author>('DeepAuthor')
      .create({name: 'John Doe', user: user._id});
    await PostModel.create({
      title: 'Deep Population',
      author: author._id,
    });

    // 1. Test dot-notation population on Query
    const postWithUser = await PostModel.findOne({title: 'Deep Population'})
      .populate({path: 'author', populate: {path: 'user'}})
      .exec();
    expect(postWithUser).toBeDefined();
    if (postWithUser) {
      expect(postWithUser.author.name).toBe('John Doe');
      expect(postWithUser.author.user.username).toBe('johndoe');
    }

    // 2. Test chained population on Document
    const post = await PostModel.findOne({title: 'Deep Population'}).populate('author').exec();
    expect(post).toBeDefined();
    if (post && post.author) {
      expect(post.author.name).toBe('John Doe');

      const populatedAuthor = await post.author.populate('user');
      if (populatedAuthor.user) {
        expect(populatedAuthor.user.username).toBe('johndoe');
      }
    }
  });

  it('should handle optional zRefs correctly', async () => {
    const OptionalPostSchema = z.object({
      title: z.string(),
      author: zRef('Author', AuthorSchema).optional(),
    });
    type OptionalPost = z.infer<typeof OptionalPostSchema>;
    const model = toStrictModel<OptionalPost>('OptionalPost', toMongooseSchema(OptionalPostSchema));

    const post = await model.findOne({title: 'Non-existent'}).populate('author').exec();
    // post should be StrictDocument<Hydrated> | null
    if (post && post.author) {
      // post.author should be Author | undefined
      const {name} = post.author;
      expect(name).toBeUndefined();
    }
  });

  it('should not break non-document queries like countDocuments', async () => {
    const PostModel = mongoose.model('Post');
    const count = await PostModel.countDocuments();
    expect(typeof count).toBe('number');
  });

  it('should return StrictDocument from .create()', async () => {
    const PostModel = toStrictModel<Post>('PostCreate', toMongooseSchema(PostSchema));
    const doc = await PostModel.create({
      title: 'New',
      author: new mongoose.Types.ObjectId().toString(),
      mentions: [],
    });
    // doc should be StrictDocument<Post>
    const populated = await doc.populate('author');
    expect(populated.author).toBeDefined();
  });
});
