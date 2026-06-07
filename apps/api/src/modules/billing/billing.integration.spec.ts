import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { TenantDbService } from '@database/tenant-db.service';
import { billingSubscriptions } from '@database/schema';
import { BillingService } from './billing.service';
import { STRIPE_CLIENT } from './stripe.provider';
import { StripeWebhookProcessor } from '@modules/webhooks/processors/stripe-webhook.processor';
import { EmailProcessor } from '@modules/email/email.processor';

const ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ?? 'postgresql://postgres:postgres@localhost:5432/saas_dev';

interface StripeMock {
  customers: { create: jest.Mock };
  checkout: { sessions: { create: jest.Mock } };
  billingPortal: { sessions: { create: jest.Mock } };
  subscriptions: { retrieve: jest.Mock };
  webhooks: { constructEvent: jest.Mock };
}

describe('Billing — integração', () => {
  let app: INestApplication;
  let adminPool: Pool;
  let tenantDb: TenantDbService;
  let billingService: BillingService;
  let stripeMock: StripeMock;
  let queueMock: { add: jest.Mock };

  async function cleanupAllTables(): Promise<void> {
    const client = await adminPool.connect();
    try {
      await client.query(`
        DELETE FROM processed_webhook_events;
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

    stripeMock = {
      customers: { create: jest.fn() },
      checkout: { sessions: { create: jest.fn() } },
      billingPortal: { sessions: { create: jest.fn() } },
      subscriptions: { retrieve: jest.fn() },
      webhooks: { constructEvent: jest.fn() },
    };

    queueMock = { add: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STRIPE_CLIENT)
      .useValue(stripeMock)
      .overrideProvider(getQueueToken('stripe-webhooks'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('email'))
      .useValue({ add: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(StripeWebhookProcessor)
      .useValue({})
      .overrideProvider(EmailProcessor)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    tenantDb = moduleRef.get(TenantDbService);
    billingService = moduleRef.get(BillingService);
  });

  afterAll(async () => {
    await cleanupAllTables();
    await adminPool.end();
    await app.close();
  });

  beforeEach(async () => {
    await cleanupAllTables();
    jest.resetAllMocks();
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

  async function setCustomerId(orgId: string, customerId: string): Promise<void> {
    const client = await adminPool.connect();
    try {
      await client.query(
        `UPDATE billing_subscriptions SET stripe_customer_id = $1 WHERE organization_id = $2`,
        [customerId, orgId],
      );
    } finally {
      client.release();
    }
  }

  async function setPlan(orgId: string, plan: string): Promise<void> {
    const client = await adminPool.connect();
    try {
      await client.query(
        `UPDATE billing_subscriptions SET plan = $1 WHERE organization_id = $2`,
        [plan, orgId],
      );
    } finally {
      client.release();
    }
  }

  // ── 1. GET /billing/subscription — retorna plano free ─────────────────────

  it('GET /billing/subscription — retorna plan free e status active', async () => {
    const { accessToken } = await registerAndLogin('owner1@test.com', 'Owner1');
    const { id: orgId } = await createOrg(accessToken, 'Org1', 'org1');

    const res = await request(app.getHttpServer())
      .get('/api/billing/subscription')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ plan: 'free', status: 'active' });
  });

  // ── 2. POST /billing/create-checkout-session — cria customer e session ────

  it('POST /billing/create-checkout-session — cria Stripe customer e retorna url', async () => {
    const { accessToken } = await registerAndLogin('owner2@test.com', 'Owner2');
    const { id: orgId } = await createOrg(accessToken, 'Org2', 'org2');

    stripeMock.customers.create.mockResolvedValueOnce({ id: 'cus_test_123' });
    stripeMock.checkout.sessions.create.mockResolvedValueOnce({
      url: 'https://checkout.stripe.com/test',
    });

    const res = await request(app.getHttpServer())
      .post('/api/billing/create-checkout-session')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ priceId: 'price_pro' });

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:\/\//);

    const [sub] = await tenantDb.withoutTenantContext((db) =>
      db
        .select({ stripeCustomerId: billingSubscriptions.stripeCustomerId })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.organizationId, orgId))
        .limit(1),
    );
    expect(sub.stripeCustomerId).toBe('cus_test_123');
  });

  // ── 3. POST /billing/create-checkout-session — customer já existe ──────────

  it('POST /billing/create-checkout-session — não cria novo customer se já existe', async () => {
    const { accessToken } = await registerAndLogin('owner3@test.com', 'Owner3');
    const { id: orgId } = await createOrg(accessToken, 'Org3', 'org3');

    await setCustomerId(orgId, 'cus_existing');
    stripeMock.checkout.sessions.create.mockResolvedValueOnce({
      url: 'https://checkout.stripe.com/existing',
    });

    const res = await request(app.getHttpServer())
      .post('/api/billing/create-checkout-session')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId)
      .send({ priceId: 'price_pro' });

    expect(res.status).toBe(200);
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
  });

  // ── 4. POST /billing/create-portal-session — sem subscription ativa ───────

  it('POST /billing/create-portal-session — retorna 400 com stripeCustomerId pending_*', async () => {
    const { accessToken } = await registerAndLogin('owner4@test.com', 'Owner4');
    const { id: orgId } = await createOrg(accessToken, 'Org4', 'org4');

    const res = await request(app.getHttpServer())
      .post('/api/billing/create-portal-session')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId);

    expect(res.status).toBe(400);
  });

  // ── 5. POST /billing/create-portal-session — com customer válido ──────────

  it('POST /billing/create-portal-session — retorna url quando customer existe', async () => {
    const { accessToken } = await registerAndLogin('owner5@test.com', 'Owner5');
    const { id: orgId } = await createOrg(accessToken, 'Org5', 'org5');

    await setCustomerId(orgId, 'cus_existing');
    stripeMock.billingPortal.sessions.create.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/test',
    });

    const res = await request(app.getHttpServer())
      .post('/api/billing/create-portal-session')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', orgId);

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:\/\//);
  });

  // ── 6. handleCheckoutCompleted — idempotência ─────────────────────────────

  it('handleCheckoutCompleted — segunda chamada com mesmo eventId é no-op', async () => {
    const { accessToken } = await registerAndLogin('owner6@test.com', 'Owner6');
    const { id: orgId } = await createOrg(accessToken, 'Org6', 'org6');

    const proPriceId = process.env.STRIPE_PRO_PRICE_ID!;
    const eventId = `evt_${randomUUID()}`;

    stripeMock.subscriptions.retrieve.mockResolvedValueOnce({
      status: 'trialing',
      trial_end: Math.floor(Date.now() / 1000) + 86400,
      items: { data: [{ price: { id: proPriceId } }] },
    });

    await billingService.handleCheckoutCompleted(eventId, orgId, 'sub_test');
    await billingService.handleCheckoutCompleted(eventId, orgId, 'sub_test');

    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledTimes(1);

    const [sub] = await tenantDb.withoutTenantContext((db) =>
      db.select().from(billingSubscriptions).where(eq(billingSubscriptions.organizationId, orgId)).limit(1),
    );
    expect(sub.plan).toBe('pro');
  });

  // ── 7. handleCheckoutCompleted — atualiza plano no banco ──────────────────

  it('handleCheckoutCompleted — atualiza plan, status e trialEndsAt no banco', async () => {
    const { accessToken } = await registerAndLogin('owner7@test.com', 'Owner7');
    const { id: orgId } = await createOrg(accessToken, 'Org7', 'org7');

    const proPriceId = process.env.STRIPE_PRO_PRICE_ID!;
    const trialEnd = Math.floor(Date.now() / 1000) + 86400;

    stripeMock.subscriptions.retrieve.mockResolvedValueOnce({
      status: 'trialing',
      trial_end: trialEnd,
      items: { data: [{ price: { id: proPriceId } }] },
    });

    await billingService.handleCheckoutCompleted(`evt_${randomUUID()}`, orgId, 'sub_test');

    const [sub] = await tenantDb.withoutTenantContext((db) =>
      db.select().from(billingSubscriptions).where(eq(billingSubscriptions.organizationId, orgId)).limit(1),
    );

    expect(sub.plan).toBe('pro');
    expect(sub.status).toBe('trialing');
    expect(sub.trialEndsAt).not.toBeNull();
  });

  // ── 8. handleSubscriptionDeleted — volta para free ────────────────────────

  it('handleSubscriptionDeleted — reverte para plan free e status canceled', async () => {
    const { accessToken } = await registerAndLogin('owner8@test.com', 'Owner8');
    const { id: orgId } = await createOrg(accessToken, 'Org8', 'org8');

    await setPlan(orgId, 'pro');

    await billingService.handleSubscriptionDeleted(`evt_${randomUUID()}`, orgId);

    const [sub] = await tenantDb.withoutTenantContext((db) =>
      db.select().from(billingSubscriptions).where(eq(billingSubscriptions.organizationId, orgId)).limit(1),
    );

    expect(sub.plan).toBe('free');
    expect(sub.status).toBe('canceled');
  });

  // ── 9. CRÍTICO: POST /webhooks/stripe — assinatura inválida ───────────────

  it('POST /api/webhooks/stripe — assinatura inválida retorna 400', async () => {
    stripeMock.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const res = await request(app.getHttpServer())
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 't=invalid,v1=invalid')
      .set('Content-Type', 'application/json')
      .send({ type: 'test.event' });

    expect(res.status).toBe(400);
  });

  // ── 10. CRÍTICO: POST /webhooks/stripe — enfileira evento ─────────────────

  it('POST /api/webhooks/stripe — enfileira evento e retorna { received: true }', async () => {
    const stripeEvent = {
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: { object: {} },
    };

    stripeMock.webhooks.constructEvent.mockReturnValueOnce(stripeEvent);
    queueMock.add.mockResolvedValueOnce(undefined);

    const res = await request(app.getHttpServer())
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 't=123,v1=abc')
      .set('Content-Type', 'application/json')
      .send({ type: 'checkout.session.completed' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(queueMock.add).toHaveBeenCalledWith('checkout.session.completed', stripeEvent);
  });
});
