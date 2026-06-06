import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';

const ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/saas_dev';

describe('Tasks — integração', () => {
  let app: INestApplication;
  let adminPool: Pool;

  async function cleanupAllTables(): Promise<void> {
    const client = await adminPool.connect();
    try {
      await client.query(`
        DELETE FROM task_comments;
        DELETE FROM tasks;
        DELETE FROM projects;
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
  ): Promise<{ id: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name, slug });
    return { id: res.body.id as string };
  }

  async function createProject(
    accessToken: string,
    orgId: string,
    name: string,
  ): Promise<{ id: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ name });
    return { id: res.body.id as string };
  }

  async function createTask(
    accessToken: string,
    orgId: string,
    projectId: string,
    title: string,
  ): Promise<{ id: string }> {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ title });
    return { id: res.body.id as string };
  }

  // Insere membro diretamente via admin (evita dependência do fluxo de convite nos testes de task)
  async function addMember(orgId: string, userId: string, role = 'member'): Promise<void> {
    const client = await adminPool.connect();
    try {
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)`,
        [orgId, userId, role],
      );
    } finally {
      client.release();
    }
  }

  // ── 1. POST /projects/:projectId/tasks — sucesso ─────────────────────────

  it('POST /projects/:projectId/tasks — retorna 201 com id, title, status todo e position > 0', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');
    const { id: projectId } = await createProject(accessToken, orgId, 'Alpha');

    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ title: 'Primeira task' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      title: 'Primeira task',
      status: 'todo',
    });
    expect(res.body.position).toBeGreaterThan(0);
  });

  // ── 2. POST /projects/:projectId/tasks — projeto inexistente ─────────────

  it('POST /projects/:projectId/tasks — projeto inexistente retorna 404', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');

    const res = await request(app.getHttpServer())
      .post(`/api/projects/${randomUUID()}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ title: 'Task sem projeto' });

    expect(res.status).toBe(404);
  });

  // ── 3. GET /projects/:projectId/tasks — lista ordenada por position ───────

  it('GET /projects/:projectId/tasks — retorna 3 tarefas em ordem crescente de position', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');
    const { id: projectId } = await createProject(accessToken, orgId, 'Alpha');

    await createTask(accessToken, orgId, projectId, 'Task A');
    await createTask(accessToken, orgId, projectId, 'Task B');
    await createTask(accessToken, orgId, projectId, 'Task C');

    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);

    const positions = res.body.map((t: { position: number }) => t.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  // ── 4. PATCH /tasks/:id — atualizar status ────────────────────────────────

  it('PATCH /tasks/:id — atualiza status para in_progress', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');
    const { id: projectId } = await createProject(accessToken, orgId, 'Alpha');
    const { id: taskId } = await createTask(accessToken, orgId, projectId, 'Task 1');

    const res = await request(app.getHttpServer())
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  // ── 5. PATCH /tasks/:id/move — mover para outro projeto ──────────────────

  it('PATCH /tasks/:id/move — move task para outro projeto da mesma org', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');
    const { id: projectId1 } = await createProject(accessToken, orgId, 'Projeto 1');
    const { id: projectId2 } = await createProject(accessToken, orgId, 'Projeto 2');
    const { id: taskId } = await createTask(accessToken, orgId, projectId1, 'Task para mover');

    const res = await request(app.getHttpServer())
      .patch(`/api/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ projectId: projectId2, position: 1 });

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(projectId2);
  });

  // ── 6. PATCH /tasks/:id/assign — atribuir a membro válido ────────────────

  it('PATCH /tasks/:id/assign — atribui task ao criador (membro válido)', async () => {
    const { accessToken, userId } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');
    const { id: projectId } = await createProject(accessToken, orgId, 'Alpha');
    const { id: taskId } = await createTask(accessToken, orgId, projectId, 'Task 1');

    const res = await request(app.getHttpServer())
      .patch(`/api/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ assigneeId: userId });

    expect(res.status).toBe(200);
    expect(res.body.assigneeId).toBe(userId);
  });

  // ── 7. PATCH /tasks/:id/assign — atribuir a não-membro ───────────────────

  it('PATCH /tasks/:id/assign — não-membro retorna 404', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');
    const { id: projectId } = await createProject(accessToken, orgId, 'Alpha');
    const { id: taskId } = await createTask(accessToken, orgId, projectId, 'Task 1');

    const res = await request(app.getHttpServer())
      .patch(`/api/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ assigneeId: randomUUID() });

    expect(res.status).toBe(404);
  });

  // ── 8. POST /tasks/:taskId/comments — criar comentário ───────────────────

  it('POST /tasks/:taskId/comments — retorna 201 com id, content e userId', async () => {
    const { accessToken, userId } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');
    const { id: projectId } = await createProject(accessToken, orgId, 'Alpha');
    const { id: taskId } = await createTask(accessToken, orgId, projectId, 'Task 1');

    const res = await request(app.getHttpServer())
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ content: 'Primeiro comentário' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      content: 'Primeiro comentário',
      userId,
    });
  });

  // ── 9. GET /tasks/:taskId/comments — listar em ordem cronológica ──────────

  it('GET /tasks/:taskId/comments — retorna 2 comentários em ordem cronológica', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');
    const { id: projectId } = await createProject(accessToken, orgId, 'Alpha');
    const { id: taskId } = await createTask(accessToken, orgId, projectId, 'Task 1');

    await request(app.getHttpServer())
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ content: 'Comentário 1' });

    await request(app.getHttpServer())
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ content: 'Comentário 2' });

    const res = await request(app.getHttpServer())
      .get(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].content).toBe('Comentário 1');
    expect(res.body[1].content).toBe('Comentário 2');
  });

  // ── 10. DELETE — autor deleta próprio comentário ──────────────────────────

  it('DELETE /tasks/:taskId/comments/:commentId — autor deleta comentário retorna 204', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');
    const { id: projectId } = await createProject(accessToken, orgId, 'Alpha');
    const { id: taskId } = await createTask(accessToken, orgId, projectId, 'Task 1');

    const commentRes = await request(app.getHttpServer())
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ content: 'Meu comentário' });

    const commentId = commentRes.body.id as string;

    const res = await request(app.getHttpServer())
      .delete(`/api/tasks/${taskId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId);

    expect(res.status).toBe(204);
  });

  // ── 11. DELETE — não pode deletar comentário de outro usuário ─────────────

  it('DELETE /tasks/:taskId/comments/:commentId — deletar comentário de outro retorna 403', async () => {
    const { accessToken: tokenA } = await registerAndLogin('owner@test.com', 'Owner');
    const { accessToken: tokenB, userId: userBId } = await registerAndLogin('member@test.com', 'Member');

    const { id: orgId } = await createOrg(tokenA, 'Acme', 'acme');
    await addMember(orgId, userBId);

    const { id: projectId } = await createProject(tokenA, orgId, 'Alpha');
    const { id: taskId } = await createTask(tokenA, orgId, projectId, 'Task 1');

    // userA cria o comentário
    const commentRes = await request(app.getHttpServer())
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Organization-Id', orgId)
      .send({ content: 'Comentário de A' });

    const commentId = commentRes.body.id as string;

    // userB tenta deletar o comentário de userA
    const res = await request(app.getHttpServer())
      .delete(`/api/tasks/${taskId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Organization-Id', orgId);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Cannot delete another user comment');
  });

  // ── 12. CRÍTICO — isolamento de tenant via RLS ────────────────────────────

  it('CRÍTICO — task de orgA invisível em contexto de orgB: RLS retorna 404', async () => {
    const { accessToken: tokenA } = await registerAndLogin('user-a@test.com', 'User A');
    const { accessToken: tokenB } = await registerAndLogin('user-b@test.com', 'User B');

    const { id: orgAId } = await createOrg(tokenA, 'Org A', 'org-a');
    await createOrg(tokenB, 'Org B', 'org-b');

    // userA cria projeto e task em orgA
    const { id: projectId } = await createProject(tokenA, orgAId, 'Projeto A');
    const { id: taskAId } = await createTask(tokenA, orgAId, projectId, 'Task de orgA');

    // Obtém orgBId para usar no header
    const orgsRes = await request(app.getHttpServer())
      .get('/api/organizations/mine')
      .set('Authorization', `Bearer ${tokenB}`);
    const orgBId = orgsRes.body[0].id as string;

    // userB usa orgB como contexto e tenta acessar taskA — RLS impede
    const res = await request(app.getHttpServer())
      .patch(`/api/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Organization-Id', orgBId)
      .send({ title: 'Tentativa de alteração' });

    expect(res.status).toBe(404);
  });

  // ── 13. CRÍTICO — limite de plano free ───────────────────────────────────

  it('CRÍTICO — plano free: 4º projeto retorna 403 PLAN_LIMIT_REACHED', async () => {
    const { accessToken } = await registerAndLogin('owner@test.com', 'Owner');
    const { id: orgId } = await createOrg(accessToken, 'Acme', 'acme');

    await createProject(accessToken, orgId, 'Projeto 1');
    await createProject(accessToken, orgId, 'Projeto 2');
    await createProject(accessToken, orgId, 'Projeto 3');

    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ name: 'Projeto 4' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_LIMIT_REACHED');
    expect(res.body.resource).toBe('projects');
    expect(res.body.limit).toBe(3);
    expect(res.body.current).toBe(3);
  });
});
