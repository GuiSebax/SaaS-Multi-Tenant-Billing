import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { TenantDbService } from '@database/tenant-db.service';
import { users } from '@database/schema/users';
import { refreshTokens } from '@database/schema/auth';

describe('Auth — integração', () => {
  let app: INestApplication;
  let tenantDb: TenantDbService;

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await tenantDb.withoutTenantContext(async (db) => {
      await db.delete(refreshTokens);
      await db.delete(users);
    });
  });

  // ── Helper ────────────────────────────────────────────────────────────────

  function registerUser(overrides: Partial<{ email: string; password: string; name: string }> = {}) {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'password123', name: 'Test User', ...overrides });
  }

  // ── 1. register — sucesso ─────────────────────────────────────────────────

  it('register — retorna 201 com accessToken, refreshToken e user.email', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: { email: 'user@example.com' },
    });
  });

  // ── 2. register — email duplicado ─────────────────────────────────────────

  it('register — email duplicado retorna 409 ConflictException', async () => {
    await registerUser();
    const res = await registerUser();

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  // ── 3. register — validação ───────────────────────────────────────────────

  it('register — email inválido retorna 400', async () => {
    const res = await registerUser({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  // ── 4. login — sucesso ────────────────────────────────────────────────────

  it('login — retorna 200 com tokens', async () => {
    await registerUser({ email: 'login@example.com', password: 'pass1234' });

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'pass1234' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: { email: 'login@example.com' },
    });
  });

  // ── 5. login — senha errada ───────────────────────────────────────────────

  it('login — senha errada retorna 401', async () => {
    await registerUser({ email: 'pw@example.com', password: 'correct-pw' });

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'pw@example.com', password: 'wrong-pw' });

    expect(res.status).toBe(401);
  });

  // ── 6. login — email inexistente ──────────────────────────────────────────

  it('login — email inexistente retorna 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  // ── 7. refresh — rotation ────────────────────────────────────────────────

  it('refresh — emite tokens diferentes e invalida o token anterior', async () => {
    const { body: loginBody } = await registerUser();
    const originalRefresh = loginBody.refreshToken as string;

    const refreshRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefresh });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toEqual(expect.any(String));
    expect(refreshRes.body.refreshToken).not.toBe(originalRefresh);

    const retryRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefresh });

    expect(retryRes.status).toBe(401);
  });

  // ── 8. logout ─────────────────────────────────────────────────────────────

  it('logout — revoga o token e impede refresh posterior', async () => {
    const { body } = await registerUser();
    const { accessToken, refreshToken } = body as { accessToken: string; refreshToken: string };

    const logoutRes = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(401);
  });

  // ── 9. rota protegida sem token ───────────────────────────────────────────

  it('rota protegida sem Authorization header retorna 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: 'any-token' });

    expect(res.status).toBe(401);
  });

  // ── 10. detecção de roubo ─────────────────────────────────────────────────

  it('roubo — usar token já rotacionado revoga toda a família e retorna 401', async () => {
    const { body: loginBody } = await registerUser();
    const { refreshToken: originalRefresh, user } = loginBody as {
      refreshToken: string;
      user: { id: string };
    };

    // Rotaciona o token — originalRefresh está revogado a partir daqui
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefresh });

    // Reusar o token original deve sinalizar roubo
    const stolenRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefresh });

    expect(stolenRes.status).toBe(401);
    expect(stolenRes.body.message).toBe('Session compromised');

    // Todos os tokens da família devem estar revogados
    const allTokens = await tenantDb.withoutTenantContext((db) =>
      db
        .select({ revokedAt: refreshTokens.revokedAt })
        .from(refreshTokens)
        .where(eq(refreshTokens.userId, user.id)),
    );

    expect(allTokens.length).toBeGreaterThan(0);
    for (const token of allTokens) {
      expect(token.revokedAt).not.toBeNull();
    }
  });
});
