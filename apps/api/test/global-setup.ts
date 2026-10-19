import { MongoMemoryReplSet } from 'mongodb-memory-server';

/** One in-memory replica set for the whole e2e run (replica set mode for later transactions, BE-03). */
export default async function globalSetup(): Promise<void> {
  const rs = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  (globalThis as { __MONGO_RS__?: MongoMemoryReplSet }).__MONGO_RS__ = rs;
  process.env.MONGODB_URI = rs.getUri();
}
