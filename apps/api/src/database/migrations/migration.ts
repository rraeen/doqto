import { type Connection } from 'mongoose';

/** A startup migration. `up` must be idempotent: it may run again after a crash mid-way. */
export interface Migration {
  /** Unique, sortable: `NNNN-short-name`. Recorded in the `migrations` collection once applied. */
  name: string;
  up(connection: Connection): Promise<void>;
}

/** Builds a migration that creates the indexes declared on the given models' schemas. */
export function indexMigration(name: string, modelNames: string[]): Migration {
  return {
    name,
    async up(connection) {
      for (const modelName of modelNames) {
        // createIndexes only adds missing indexes; it never drops one.
        await connection.model(modelName).createIndexes();
      }
    },
  };
}
