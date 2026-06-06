import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { TenantDbService } from '@database/tenant-db.service';
import { OrganizationsService } from './organizations.service';
import { invitations, organizationMembers } from '@database/schema/organizations';

// Superuser pool — bypasses RLS. Used only for test setup/teardown, never in
// business-logic paths. app_user cannot DELETE from invitations without tenant
// context (RLS blocks it), so we must use postgres to clean up between tests.
const ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/saas_dev';

describe('Organizations — integração', () => {
  let app: INestApplication;
  let tenantDb: TenantDbService;
  let adminPool: Pool;

  async function cleanupAllTables(): Promise<void> {
    const client = await adminPool.connect();
    try {
      await client.query(`
        DELETE FROM invitations;
        DELETE FROM organization_members;
        DELETE FROM billing_subscriptions;
        DELETE FROM organizations;
        DELETE FROM refresh_tokens;
        DELETE FROM users;
      `);
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    tenantDb = moduleRef.get(TenantDbService);

    // Replace the emailQueue on the service instance so emailQueue.add() is a no-op.
    // Using jest.spyOn on the DI-resolved queue risks hitting the wrong instance when
    // multiple modules register the same queue name. Direct property injection is safe.
    const orgService = moduleRef.get(OrganizationsService);
    (orgService as any).emailQueue = { add: jest.fn().mockResolvedValue(undefined) };
  });

  afterAll(async () => {
    await cleanupAllTables();
    await adminPool.end();
    await app.close();
  });

  beforeEach(async () => {
    await cleanupAllTables();
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function registerAndLogin(
    email: string,
    name: string,
  ): Promise<{ accessToken: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'password123', name });
    return { accessToken: res.body.accessToken as string, userId: res.body.user.id as string };
  }

  async function createOrg(
    accessToken: string,
    name: string,
    slug: string,
  ): Promise<{ id: string; slug: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name, slug });
    return { id: res.body.id as string, slug: res.body.slug as string };
  }

  async function inviteAndAccept(
    ownerToken: string,
    memberToken: string,
    orgId: string,
    email: string,
    role: 'admin' | 'member' = 'member',
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Organization-Id', orgId)
      .send({ email, role });

    const [inv] = await tenantDb.withoutTenantContext((db) =>
      db
        .select({ token: invitations.token })
        .from(invitations)
        .where(and(eq(invitations.organizationId, orgId), eq(invitations.email, email)))
        .limit(1),
    );

    if (!inv) {
      throw new Error(`inviteAndAccept: invitation not found in DB for email=${email} orgId=${orgId}`);
    }

    await request(app.getHttpServer())
      .post(`/api/invitations/${inv.token}/accept`)
      .set('Authorization', `Bearer ${memberToken}`);
  }

  // ── 1. POST /organizations — sucesso ──────────────────────────────────────

  it('POST /organizations — retorna 201 com id, name, slug, plan free e role owner', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');

    const res = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Acme Corp', slug: 'acme' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'free',
      role: 'owner',
    });
  });

  // ── 2. POST /organizations — slug duplicado ───────────────────────────────

  it('POST /organizations — slug duplicado retorna 409', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    await createOrg(accessToken, 'Acme', 'acme');

    const res = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Acme 2', slug: 'acme' });

    expect(res.status).toBe(409);
  });

  // ── 3. GET /organizations/mine — lista orgs do usuário ───────────────────

  it('GET /organizations/mine — retorna as 2 orgs criadas pelo mesmo usuário', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    await createOrg(accessToken, 'Org A', 'org-a');
    await createOrg(accessToken, 'Org B', 'org-b');

    const res = await request(app.getHttpServer())
      .get('/api/organizations/mine')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  // ── 4. GET /organizations/mine — usuário em múltiplas orgs ───────────────

  it('GET /organizations/mine — membro aceita convite e vê org com role correto', async () => {
    const { accessToken: tokenA } = await registerAndLogin('owner@test.com', 'Owner');
    const { accessToken: tokenB } = await registerAndLogin('member@test.com', 'Member');
    const { id: orgId } = await createOrg(tokenA, 'Acme', 'acme');

    await inviteAndAccept(tokenA, tokenB, orgId, 'member@test.com', 'member');

    const res = await request(app.getHttpServer())
      .get('/api/organizations/mine')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: orgId, role: 'member' });
  });

  // ── 5. POST /organizations/:id/invitations — sucesso ─────────────────────

  it('POST /organizations/:id/invitations — retorna 201 com dados do convite', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');

    const res = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ email: 'new@test.com', role: 'member' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      email: 'new@test.com',
      role: 'member',
      expiresAt: expect.any(String),
    });
  });

  // ── 6. POST /organizations/:id/invitations — membro já existente ──────────

  it('POST /organizations/:id/invitations — usuário já membro retorna 409', async () => {
    const { accessToken: tokenA } = await registerAndLogin('owner@test.com', 'Owner');
    const { accessToken: tokenB } = await registerAndLogin('member@test.com', 'Member');
    const { id: orgId } = await createOrg(tokenA, 'Acme', 'acme');

    await inviteAndAccept(tokenA, tokenB, orgId, 'member@test.com');

    const res = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Organization-Id', orgId)
      .send({ email: 'member@test.com', role: 'member' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('User is already a member');
  });

  // ── 7. POST /organizations/:id/invitations — convite pendente ─────────────

  it('POST /organizations/:id/invitations — convite pendente retorna 409', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');

    await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ email: 'pending@test.com', role: 'member' });

    const res = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ email: 'pending@test.com', role: 'member' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Invitation already pending');
  });

  // ── 8. POST /invitations/:token/accept — sucesso ──────────────────────────

  it('POST /invitations/:token/accept — aceita convite, preenche accepted_at e adiciona membro', async () => {
    const { accessToken: tokenA } = await registerAndLogin('owner@test.com', 'Owner');
    const { accessToken: tokenB } = await registerAndLogin('member@test.com', 'Member');
    const { id: orgId } = await createOrg(tokenA, 'Acme', 'acme');

    await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Organization-Id', orgId)
      .send({ email: 'member@test.com', role: 'admin' });

    const [inv] = await tenantDb.withoutTenantContext((db) =>
      db
        .select({ token: invitations.token, id: invitations.id })
        .from(invitations)
        .where(eq(invitations.organizationId, orgId))
        .limit(1),
    );

    const acceptRes = await request(app.getHttpServer())
      .post(`/api/invitations/${inv.token}/accept`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(acceptRes.status).toBe(200);

    const [updated] = await tenantDb.withoutTenantContext((db) =>
      db
        .select({ acceptedAt: invitations.acceptedAt })
        .from(invitations)
        .where(eq(invitations.id, inv.id)),
    );
    expect(updated.acceptedAt).not.toBeNull();

    const mineRes = await request(app.getHttpServer())
      .get('/api/organizations/mine')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(mineRes.body).toHaveLength(1);
    expect(mineRes.body[0]).toMatchObject({ id: orgId, role: 'admin' });
  });

  // ── 9. POST /invitations/:token/accept — token inválido ───────────────────

  it('POST /invitations/:token/accept — token inexistente retorna 404', async () => {
    const { accessToken } = await registerAndLogin('user@test.com', 'User');

    const res = await request(app.getHttpServer())
      .post('/api/invitations/token-invalido-que-nao-existe/accept')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  // ── 10. PATCH /organizations/:id/members/:userId — alterar role ───────────

  it('PATCH /organizations/:id/members/:userId — owner promove member a admin', async () => {
    const { accessToken: tokenA } = await registerAndLogin('owner@test.com', 'Owner');
    const { accessToken: tokenB, userId: userBId } = await registerAndLogin('member@test.com', 'Member');
    const { id: orgId } = await createOrg(tokenA, 'Acme', 'acme');

    await inviteAndAccept(tokenA, tokenB, orgId, 'member@test.com', 'member');

    const res = await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/members/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Organization-Id', orgId)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: userBId, role: 'admin' });
  });

  // ── 11. DELETE /organizations/:id/members/:userId — remover membro ────────

  it('DELETE /organizations/:id/members/:userId — owner remove membro e retorna 204', async () => {
    const { accessToken: tokenA } = await registerAndLogin('owner@test.com', 'Owner');
    const { accessToken: tokenB, userId: userBId } = await registerAndLogin('member@test.com', 'Member');
    const { id: orgId } = await createOrg(tokenA, 'Acme', 'acme');

    await inviteAndAccept(tokenA, tokenB, orgId, 'member@test.com');

    const res = await request(app.getHttpServer())
      .delete(`/api/organizations/${orgId}/members/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Organization-Id', orgId);

    expect(res.status).toBe(204);

    const [member] = await tenantDb.withoutTenantContext((db) =>
      db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, orgId),
            eq(organizationMembers.userId, userBId),
          ),
        ),
    );
    expect(member).toBeUndefined();
  });

  // ── 12. DELETE — proteger owner ───────────────────────────────────────────

  it('DELETE /organizations/:id/members/:userId — remover owner retorna 403', async () => {
    const { accessToken, userId } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');

    const res = await request(app.getHttpServer())
      .delete(`/api/organizations/${orgId}/members/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Cannot remove owner');
  });

  // ── 13. CRÍTICO — isolamento entre organizações ───────────────────────────

  it('CRÍTICO — token de orgA não consegue operar em orgB (TenantGuard rejeita)', async () => {
    const { accessToken: tokenA } = await registerAndLogin('user-a@test.com', 'User A');
    const { accessToken: tokenB } = await registerAndLogin('user-b@test.com', 'User B');

    await createOrg(tokenA, 'Org A', 'org-a');
    const { id: orgBId } = await createOrg(tokenB, 'Org B', 'org-b');

    const res = await request(app.getHttpServer())
      .post(`/api/organizations/${orgBId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Organization-Id', orgBId)
      .send({ email: 'victim@test.com', role: 'member' });

    expect(res.status).toBe(403);
  });
});
