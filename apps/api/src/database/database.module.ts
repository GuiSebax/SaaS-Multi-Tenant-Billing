import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { TenantDbService } from './tenant-db.service';
import { MigrationRunnerService } from './migration-runner.service';

export const PG_POOL = Symbol('PG_POOL');
export const DRIZZLE_DB = Symbol('DRIZZLE_DB');

@Global()
@Module({
  providers: [
    MigrationRunnerService,
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({ connectionString: config.getOrThrow<string>('DATABASE_URL') }),
    },
    {
      provide: DRIZZLE_DB,
      inject: [PG_POOL],
      useFactory: (pool: Pool): NodePgDatabase => drizzle(pool),
    },
    TenantDbService,
  ],
  exports: [PG_POOL, DRIZZLE_DB, TenantDbService],
})
export class DatabaseModule {}
