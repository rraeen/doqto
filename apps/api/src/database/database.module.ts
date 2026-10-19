import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from '../config/app-config.service';
import { MigrationRunner, MIGRATIONS_TOKEN } from './migration-runner.service';
import { MIGRATIONS } from './migrations';
import { MODELS } from './models';

/** Mongo connection, every model, and the startup migration runner (BE-03). */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        uri: config.get('MONGODB_URI'),
        dbName: config.get('MONGODB_DB_NAME'),
        // Indexes come from migrations in production; autoIndex is a dev convenience only.
        autoIndex: !config.isProduction,
        autoCreate: !config.isProduction,
        serverSelectionTimeoutMS: 10_000,
        appName: 'doqto-api',
      }),
    }),
    MongooseModule.forFeature(MODELS),
  ],
  providers: [MigrationRunner, { provide: MIGRATIONS_TOKEN, useValue: MIGRATIONS }],
  exports: [MongooseModule, MigrationRunner],
})
export class DatabaseModule {}
