import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { TenantDbService } from './tenant-db.service';
import { MigrationRunnerService } from './migration-runner.service';
import { PG_POOL, DRIZZLE_DB } from './database.tokens';

export { PG_POOL, DRIZZLE_DB } from './database.tokens';

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
