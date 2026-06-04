import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PG_POOL } from './database.module';

export type DrizzleTransaction = NodePgDatabase;

@Injectable()
export class TenantDbService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async withTenantContext<T>(
    tenantId: string,
    callback: (tx: DrizzleTransaction) => Promise<T>,
  ): Promise<T> {
    return this.inTransaction(async (client) => {
      // set_config with is_local=true is equivalent to SET LOCAL — scoped to this transaction only.
      // Using parameterized form to prevent injection via tenantId.
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId]);
      return callback(drizzle(client));
    });
  }

  async withoutTenantContext<T>(
    callback: (tx: DrizzleTransaction) => Promise<T>,
  ): Promise<T> {
    return this.inTransaction((client) => callback(drizzle(client)));
  }

  private async inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
