import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { TenantDbService } from './tenant-db.service';

// app_user é o usuário da aplicação — NOSUPERUSER NOBYPASSRLS, então RLS é aplicado.
const APP_URL =
  process.env.DATABASE_URL ?? 'postgresql://app_user:dev_password@localhost:5432/saas_dev';

// postgres é o superuser administrativo — usado apenas no setup do teste.
const ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/saas_dev';

const TEST_TABLE = '_test_rls_items';
const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';

jest.setTimeout(30_000);

describe('TenantDbService — isolamento RLS', () => {
  let adminPool: Pool;
  let appPool: Pool;
  let service: TenantDbService;

  beforeAll(async () => {
    // adminPool (postgres/superuser): cria tabela, habilita RLS, insere seed.
    // Superusers ignoram RLS — exatamente o que queremos no setup.
    adminPool = new Pool({ connectionString: ADMIN_URL });

    // appPool (app_user/non-superuser): usado pelo TenantDbService em runtime.
    // RLS é aplicado normalmente a este usuário.
    appPool = new Pool({ connectionString: APP_URL });
    service = new TenantDbService(appPool);

    const admin = await adminPool.connect();
    try {
      await admin.query(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
      await admin.query(`
        CREATE TABLE ${TEST_TABLE} (
          id     SERIAL PRIMARY KEY,
          label  TEXT NOT NULL,
          org_id UUID NOT NULL
        )
      `);
      await admin.query(`ALTER TABLE ${TEST_TABLE} ENABLE ROW LEVEL SECURITY`);
      // FORCE ROW SECURITY garante que o dono da tabela também respeite o RLS
      // (relevante quando app_user for dono das tabelas em produção).
      await admin.query(`ALTER TABLE ${TEST_TABLE} FORCE ROW LEVEL SECURITY`);
      await admin.query(`
        CREATE POLICY tenant_isolation ON ${TEST_TABLE}
          USING (org_id::text = current_setting('app.current_tenant_id', true))
      `);

      // Seed inserido como superuser — bypassa RLS para popular ambos os tenants.
      await admin.query(
        `INSERT INTO ${TEST_TABLE} (label, org_id) VALUES ($1, $2::uuid), ($3, $4::uuid)`,
        ['Item A', ORG_A, 'Item B', ORG_B],
      );
    } finally {
      admin.release();
    }
  });

  afterAll(async () => {
    const admin = await adminPool.connect();
    try {
      await admin.query(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
    } finally {
      admin.release();
    }
    await adminPool.end();
    await appPool.end();
  });

  // ── Isolamento RLS ──────────────────────────────────────────────────────────
  // Estes são os testes mais críticos: provam que app_user (não-superuser)
  // recebe apenas os dados do seu tenant, sem nenhum workaround de role.

  it('tenant A vê apenas seus próprios dados', async () => {
    const result = await service.withTenantContext(ORG_A, async (db) =>
      db.execute(sql`SELECT label FROM _test_rls_items ORDER BY label`),
    );
    const rows = result.rows as Array<{ label: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Item A');
  });

  it('tenant B vê apenas seus próprios dados', async () => {
    const result = await service.withTenantContext(ORG_B, async (db) =>
      db.execute(sql`SELECT label FROM _test_rls_items ORDER BY label`),
    );
    const rows = result.rows as Array<{ label: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Item B');
  });

  // ── Comportamento do serviço ────────────────────────────────────────────────

  it('withTenantContext define app.current_tenant_id na transação', async () => {
    const result = await service.withTenantContext(ORG_A, async (db) =>
      db.execute(sql`SELECT current_setting('app.current_tenant_id', true) AS tid`),
    );
    const rows = result.rows as Array<{ tid: string }>;
    expect(rows[0].tid).toBe(ORG_A);
  });

  it('tenant context não vaza entre transações (SET LOCAL é descartado no COMMIT)', async () => {
    await service.withTenantContext(ORG_A, async () => {
      /* no-op — apenas seta e comita */
    });

    const result = await service.withoutTenantContext(async (db) =>
      db.execute(sql`SELECT current_setting('app.current_tenant_id', true) AS tid`),
    );
    const rows = result.rows as Array<{ tid: string }>;
    expect(rows[0].tid).toBe('');
  });

  it('erro na callback dispara ROLLBACK e re-lança a exceção', async () => {
    await expect(
      service.withTenantContext(ORG_A, async () => {
        throw new Error('falha intencional');
      }),
    ).rejects.toThrow('falha intencional');
  });

  it('withoutTenantContext NÃO define tenant context', async () => {
    const result = await service.withoutTenantContext(async (db) =>
      db.execute(sql`SELECT current_setting('app.current_tenant_id', true) AS tid`),
    );
    const rows = result.rows as Array<{ tid: string }>;
    expect(rows[0].tid).toBe('');
  });
});
