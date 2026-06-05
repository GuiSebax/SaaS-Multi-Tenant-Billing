import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';

@Injectable()
export class MigrationRunnerService implements OnModuleInit {
  private readonly logger = new Logger(MigrationRunnerService.name);

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const adminUrl = this.config.get<string>('DATABASE_ADMIN_URL');
    if (!adminUrl) {
      this.logger.warn('DATABASE_ADMIN_URL not set — skipping automatic migration run');
      return;
    }

    const pool = new Pool({ connectionString: adminUrl });
    try {
      await this.runPending(pool);
    } finally {
      await pool.end();
    }
  }

  private async runPending(pool: Pool): Promise<void> {
    const client = await pool.connect();
    try {
      await this.ensureMigrationsTable(client);
      const applied = await this.loadApplied(client);
      const pending = this.listPendingFiles(applied);

      if (pending.length === 0) {
        this.logger.log('No pending migrations');
        return;
      }

      for (const file of pending) {
        await this.applyFile(client, file);
      }
    } finally {
      client.release();
    }
  }

  private async ensureMigrationsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name       TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async loadApplied(client: PoolClient): Promise<Set<string>> {
    const { rows } = await client.query<{ name: string }>('SELECT name FROM _migrations');
    return new Set(rows.map((r) => r.name));
  }

  private listPendingFiles(applied: Set<string>): string[] {
    const dir = path.join(__dirname, 'migrations');
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
      .sort()
      .filter((f) => !applied.has(f));
  }

  private async applyFile(client: PoolClient, file: string): Promise<void> {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf-8');
    this.logger.log(`Applying migration: ${file}`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      this.logger.log(`Migration applied: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Migration failed: ${file}`, err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }
}
