import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { type Connection } from 'mongoose';
import { type Migration } from './migrations/migration';

export const MIGRATIONS_TOKEN = Symbol('MIGRATIONS');
export const MIGRATIONS_COLLECTION = 'migrations';

interface MigrationRecord {
  _id: string;
  appliedAt: Date;
  durationMs: number;
}

/**
 * Runs pending migrations before the app starts listening (`app.init()` / `app.listen()` wait
 * for `onApplicationBootstrap`). With `autoIndex` off in production this is how indexes,
 * including the release-blocking unique ones, get created.
 */
@Injectable()
export class MigrationRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationRunner.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(MIGRATIONS_TOKEN) private readonly migrations: Migration[],
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.runPending();
  }

  /** Returns the names applied in this run. */
  async runPending(): Promise<string[]> {
    const names = this.migrations.map((m) => m.name);
    if (new Set(names).size !== names.length) throw new Error('Duplicate migration name');
    const records = this.connection.collection<MigrationRecord>(MIGRATIONS_COLLECTION);
    const done = new Set(
      (await records.find({}, { projection: { _id: 1 } }).toArray()).map((r) => r._id),
    );

    const applied: string[] = [];
    for (const migration of this.migrations) {
      if (done.has(migration.name)) continue;
      const started = Date.now();
      await migration.up(this.connection);
      const durationMs = Date.now() - started;
      // Upsert so two instances racing on the same migration both succeed.
      await records.updateOne(
        { _id: migration.name },
        { $setOnInsert: { appliedAt: new Date(), durationMs } },
        { upsert: true },
      );
      this.logger.log(`Applied migration ${migration.name} in ${durationMs} ms`);
      applied.push(migration.name);
    }
    return applied;
  }
}
