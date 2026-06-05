/**
 * Seed script — realistic demo data for development and demonstrations.
 * Run: pnpm seed (from project root) or pnpm --filter @saas-platform/api seed
 * Idempotent: safe to run multiple times without duplicating data.
 */
try {
  // Loads apps/api/.env when run from the apps/api directory
  require('dotenv').config();
} catch {}

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, count, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import {
  users,
  organizations,
  organizationMembers,
  billingSubscriptions,
  projects,
} from './schema';

// ── DB connection (uses superuser to bypass RLS) ──────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL,
});
const db = drizzle(pool);

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'owner' | 'admin' | 'member';
type Plan = 'free' | 'pro' | 'enterprise';
type ProjectStatus = 'active' | 'archived';
type TaskStatus = 'todo' | 'in_progress' | 'done';

type MemberDef = { email: string; role: Role };
type ProjectDef = {
  name: string;
  description: string;
  status: ProjectStatus;
  createdByEmail: string;
  taskTitles: string[];
};
type OrgDef = {
  name: string;
  slug: string;
  plan: Plan;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  members: MemberDef[];
  projects: ProjectDef[];
};

// ── Seed Data ─────────────────────────────────────────────────────────────────

const SEED_PASSWORD = 'seed_password_123';

const SEED_USERS: Array<{ email: string; name: string }> = [
  // Acme Corp members
  { email: 'alice@acme.com', name: 'Alice Johnson' },
  { email: 'bob@acme.com', name: 'Bob Smith' },
  { email: 'carol@acme.com', name: 'Carol Williams' },
  { email: 'kevin@acme.com', name: 'Kevin Park' },
  { email: 'laura@acme.com', name: 'Laura Thompson' },
  { email: 'mike@acme.com', name: 'Mike Johnson' },
  // Cross-tenant users (belong to 2 orgs each — validates tenant isolation)
  { email: 'david@example.com', name: 'David Brown' },
  { email: 'grace@example.com', name: 'Grace Lee' },
  // Startup X members
  { email: 'eve@startup-x.com', name: 'Eve Davis' },
  { email: 'frank@startup-x.com', name: 'Frank Wilson' },
  // Dev Agency members
  { email: 'henry@dev-agency.com', name: 'Henry Martinez' },
  { email: 'ivan@dev-agency.com', name: 'Ivan Chen' },
  { email: 'julia@dev-agency.com', name: 'Julia Rodriguez' },
  { email: 'nina@dev-agency.com', name: 'Nina Patel' },
];

const SEED_ORGS: OrgDef[] = [
  {
    name: 'Acme Corp',
    slug: 'acme',
    plan: 'pro',
    stripeCustomerId: 'cus_seed_acme_001',
    stripeSubscriptionId: 'sub_seed_acme_001',
    members: [
      { email: 'alice@acme.com', role: 'owner' },
      { email: 'bob@acme.com', role: 'admin' },
      { email: 'carol@acme.com', role: 'member' },
      { email: 'kevin@acme.com', role: 'member' },
      { email: 'laura@acme.com', role: 'member' },
      { email: 'mike@acme.com', role: 'member' },
      { email: 'david@example.com', role: 'admin' },   // cross-tenant: also owner of Startup X
      { email: 'grace@example.com', role: 'member' },  // cross-tenant: also owner of Dev Agency
    ],
    projects: [
      {
        name: 'Customer Portal',
        description: 'Self-service portal for customer support and account management',
        status: 'active',
        createdByEmail: 'alice@acme.com',
        taskTitles: [
          'Design wireframes and user flows',
          'Scaffold Next.js project with component library',
          'Implement JWT authentication',
          'Build user profile and settings page',
          'Create ticket submission and tracking UI',
          'Integrate live chat support widget',
          'Build knowledge base with search',
          'Implement email notification preferences',
          'Add two-factor authentication (TOTP)',
          'Build billing and subscription management page',
          'Write Cypress E2E tests for auth flows',
          'Accessibility audit — WCAG 2.1 AA',
          'Implement real-time notifications via WebSocket',
          'Performance audit — Core Web Vitals',
          'Add dark mode support',
          'Build admin panel for support agents',
          'Security review — OWASP top 10',
          'Configure CDN and static asset caching',
          'Load testing with k6',
          'Write end-user documentation',
        ],
      },
      {
        name: 'API Integration Platform',
        description: 'Internal service mesh and third-party integrations',
        status: 'active',
        createdByEmail: 'bob@acme.com',
        taskTitles: [
          'Design integration architecture and API contracts',
          'Set up API gateway with NestJS',
          'Implement OAuth 2.0 client credentials flow',
          'Build Slack webhook integration',
          'Build Salesforce CRM sync connector',
          'Add Jira integration for ticket management',
          'Implement rate limiting and throttling',
          'Build retry logic with exponential backoff',
          'Add distributed tracing with OpenTelemetry',
          'Create integration health dashboard',
          'Write integration tests with real services',
          'Add webhook delivery with signature verification',
          'Build event replay mechanism',
          'Implement dead-letter queue for failed events',
          'API documentation with Swagger',
          'Monitoring and alerting for integration failures',
          'Load test critical integration paths',
          'Security audit of API credentials storage',
        ],
      },
      {
        name: 'Mobile App v2',
        description: 'Cross-platform mobile app rewrite in React Native',
        status: 'active',
        createdByEmail: 'alice@acme.com',
        taskTitles: [
          'Define mobile app architecture',
          'Set up React Native with Expo',
          'Implement deep linking and navigation',
          'Build onboarding flow (3-step)',
          'Create home dashboard screen',
          'Implement push notifications (FCM + APNs)',
          'Build offline support with local SQLite cache',
          'Add biometric authentication',
          'Create task creation and editing UI',
          'Build project overview screen',
          'Implement real-time sync via WebSocket',
          'Add file attachment support',
          'Performance profiling and bundle size optimization',
          'Implement in-app purchases (iOS + Android)',
          'Submit to App Store and Google Play',
          'Write Detox E2E tests',
          'Crash reporting with Sentry',
          'A/B test onboarding variants',
          'Localization: EN, PT, ES',
          'Beta testing program setup',
          'Accessibility — screen reader support',
          'Post-launch monitoring setup',
        ],
      },
      {
        name: 'Analytics Dashboard',
        description: 'Real-time business intelligence and reporting',
        status: 'active',
        createdByEmail: 'bob@acme.com',
        taskTitles: [
          'Define KPIs and metrics catalog',
          'Set up ClickHouse data warehouse',
          'Build ETL pipeline from production DB',
          'Implement event tracking SDK',
          'Create revenue overview dashboard',
          'Build user cohort analysis',
          'Implement funnel visualization',
          'Add custom report builder',
          'Build CSV/PDF export functionality',
          'Create scheduled email reports',
          'Implement dashboard sharing and permissions',
          'Add anomaly detection for key metrics',
          'Performance optimization for large datasets',
          'Cache strategy for expensive queries',
          'Unit tests for aggregation logic',
          'Data retention and GDPR compliance',
        ],
      },
      {
        name: 'DevOps Modernization',
        description: 'CI/CD pipeline, IaC, and observability stack',
        status: 'active',
        createdByEmail: 'david@example.com',
        taskTitles: [
          'Migrate from Jenkins to GitHub Actions',
          'Write Terraform modules for AWS infrastructure',
          'Set up multi-environment deployments (dev/staging/prod)',
          'Implement blue-green deployment strategy',
          'Add automated rollback on deployment failure',
          'Set up centralized logging with ELK stack',
          'Configure Prometheus + Grafana for metrics',
          'Implement distributed tracing with Jaeger',
          'Secrets management with AWS Secrets Manager',
          'Container security scanning with Trivy',
          'Database backup automation and recovery testing',
          'Implement chaos engineering experiments',
          'SLO/SLA monitoring and alerting',
          'Cost optimization review',
          'Disaster recovery runbook',
        ],
      },
      {
        name: 'CRM Migration',
        description: 'Migrating from legacy CRM to new system',
        status: 'archived',
        createdByEmail: 'alice@acme.com',
        taskTitles: [
          'Data audit and mapping from legacy system',
          'Write data transformation scripts',
          'Test migration on staging environment',
          'Execute production migration (zero-downtime)',
          'Validate data integrity post-migration',
          'Decommission legacy CRM system',
          'Update internal documentation',
          'Team training on new CRM',
        ],
      },
    ],
  },
  {
    name: 'Startup X',
    slug: 'startup-x',
    plan: 'free',
    stripeCustomerId: 'cus_seed_startupx_001',
    stripeSubscriptionId: null,
    members: [
      { email: 'david@example.com', role: 'owner' },
      { email: 'eve@startup-x.com', role: 'admin' },
      { email: 'frank@startup-x.com', role: 'member' },
    ],
    projects: [
      {
        name: 'Landing Page',
        description: 'Marketing landing page and lead capture',
        status: 'active',
        createdByEmail: 'david@example.com',
        taskTitles: [
          'Define brand identity and color palette',
          'Design hero section with value proposition',
          'Write copy for all landing page sections',
          'Build landing page with Next.js',
          'Implement email capture form with validation',
          'Integrate with Mailchimp for lead nurturing',
          'Add testimonials section',
          'Implement pricing comparison table',
          'SEO optimization and meta tags',
          'Set up Google Analytics and Hotjar',
          'A/B test headline copy',
          'Optimize images for Core Web Vitals',
          'Add cookie consent banner (GDPR)',
          'Configure domain and SSL',
          'Launch and monitor conversion rate',
        ],
      },
      {
        name: 'MVP Backend',
        description: 'Core REST API for the product MVP',
        status: 'active',
        createdByEmail: 'david@example.com',
        taskTitles: [
          'Define API contract and OpenAPI spec',
          'Set up NestJS project structure',
          'Implement user registration and login',
          'JWT access + refresh token strategy',
          'Build workspace CRUD endpoints',
          'Build project CRUD endpoints',
          'Implement task management endpoints',
          'Add file upload with S3',
          'Implement role-based access control',
          'Request validation with class-validator',
          'Set up PostgreSQL with Drizzle ORM',
          'Write integration tests for all endpoints',
          'Add rate limiting per user',
          'Error handling and consistent error responses',
          'API documentation with Swagger',
          'Deploy to Railway',
          'Configure production environment variables',
          'Monitoring with Sentry',
          'Performance baseline testing',
          'Beta user onboarding guide',
        ],
      },
      {
        name: 'User Onboarding Flow',
        description: 'Guided in-product onboarding for new users',
        status: 'active',
        createdByEmail: 'eve@startup-x.com',
        taskTitles: [
          'Map user journey from signup to first value',
          'Design onboarding checklist UI component',
          'Implement welcome email sequence (3 emails)',
          'Build interactive product tour with intro.js',
          'Create empty state illustrations',
          'Add progress indicator for setup steps',
          'Implement "invite your team" step',
          'Build sample project creation wizard',
          'Track onboarding funnel events',
          'A/B test onboarding step order',
          'Write onboarding microcopy',
          'Test with 5 beta users',
        ],
      },
      {
        name: 'Initial Prototype',
        description: 'Early proof-of-concept (superseded by MVP)',
        status: 'archived',
        createdByEmail: 'david@example.com',
        taskTitles: [
          'Bootstrap prototype with Create React App',
          'Build basic task board UI',
          'Implement local storage persistence',
          'User feedback session with 3 participants',
          'Document learnings from prototype',
          'Decision: proceed to full MVP',
        ],
      },
    ],
  },
  {
    name: 'Dev Agency',
    slug: 'dev-agency',
    plan: 'pro',
    stripeCustomerId: 'cus_seed_devagency_001',
    stripeSubscriptionId: 'sub_seed_devagency_001',
    members: [
      { email: 'grace@example.com', role: 'owner' },
      { email: 'henry@dev-agency.com', role: 'admin' },
      { email: 'ivan@dev-agency.com', role: 'member' },
      { email: 'julia@dev-agency.com', role: 'member' },
      { email: 'nina@dev-agency.com', role: 'member' },
    ],
    projects: [
      {
        name: 'E-commerce Platform',
        description: 'Client project: full-stack e-commerce solution',
        status: 'active',
        createdByEmail: 'grace@example.com',
        taskTitles: [
          'Requirements gathering and technical scoping',
          'Design system and component library setup',
          'Build product catalog with filtering and search',
          'Implement shopping cart with persistent sessions',
          'Stripe payment integration',
          'Order management system (admin panel)',
          'Build customer order history page',
          'Inventory management with stock alerts',
          'Transactional emails: order confirm, shipment',
          'Product review and rating system',
          'Discount codes and promotions engine',
          'Build affiliate tracking system',
          'SEO: dynamic sitemap, structured data',
          'Performance: image optimization, lazy loading',
          'Mobile-first responsive design',
          'Integration tests for checkout flow',
          'Load testing with 1000 concurrent users',
          'Security audit: SQL injection, XSS',
          'Client UAT and feedback round',
          'Production deployment and handover',
          'Post-launch monitoring (7 days)',
          'Final documentation and knowledge transfer',
        ],
      },
      {
        name: 'SaaS Dashboard',
        description: 'Client project: analytics dashboard for a SaaS company',
        status: 'active',
        createdByEmail: 'henry@dev-agency.com',
        taskTitles: [
          'Define dashboard KPIs with client',
          'UI/UX mockups for main dashboard views',
          'Set up React app with Recharts',
          'Build MRR and churn metrics panel',
          'Implement user growth chart',
          'Build cohort retention heatmap',
          'Add date range picker with presets',
          'Implement CSV export for all charts',
          'Real-time data refresh via polling',
          'Build user permissions for dashboard access',
          'Performance optimization for large datasets',
          'Cross-browser testing: Chrome, FF, Safari',
          'Mobile responsive design',
          'Client demo and revision cycle',
          'Final delivery and code handover',
          'Documentation: architecture + API reference',
          'Post-delivery support agreement',
          'Invoice and project closure',
        ],
      },
      {
        name: 'Internal Tooling',
        description: 'Developer productivity tools and automation',
        status: 'active',
        createdByEmail: 'grace@example.com',
        taskTitles: [
          'Audit current manual processes',
          'Build client onboarding automation',
          'Create project kickoff template generator',
          'Automate invoice generation with PDF export',
          'Build time tracking integration with Toggl',
          'Create Slack bot for daily standup prompts',
          'Automate weekly client status report emails',
          'Build shared component snippet library',
          'One-click dev environment setup (Makefile)',
          'Automated dependency update PRs (Renovate)',
          'Security vulnerability scanning in CI',
          'Code quality gate: coverage > 80%',
          'Retrospective action item tracker',
          'Internal docs with Notion-style editor',
        ],
      },
      {
        name: 'Agency Website Rebrand',
        description: 'New agency website with updated positioning and portfolio',
        status: 'active',
        createdByEmail: 'grace@example.com',
        taskTitles: [
          'Brand strategy workshop and positioning',
          'New logo design (3 concepts)',
          'Typography and color palette selection',
          'Wireframes for all pages',
          'Design system in Figma',
          'Build with Next.js App Router',
          'Animate hero section with Framer Motion',
          'Portfolio case studies (5 projects)',
          'Services and pricing page',
          'Team bios and about page',
          'Blog with MDX support',
          'SEO optimization and meta strategy',
        ],
      },
      {
        name: 'Design System v2',
        description: 'Component library and design tokens for all client projects',
        status: 'active',
        createdByEmail: 'julia@dev-agency.com',
        taskTitles: [
          'Audit v1 components and token gaps',
          'Define design token schema: colors, spacing, typography',
          'Build Figma → CSS variables pipeline',
          'Migrate button and input components',
          'Migrate navigation and layout components',
          'Migrate data display components: tables, cards',
          'Add Storybook stories for all components',
          'Visual regression tests with Chromatic',
          'Accessibility audit: keyboard nav, ARIA',
          'Dark mode token variants',
          'Publish to npm registry',
          'Migration guide for existing projects',
          'Demo app using new design system',
          'Design system documentation site',
          'Announce v2 to team and clients',
          'Deprecate v1 with sunset timeline',
        ],
      },
      {
        name: '2023 Projects Archive',
        description: 'Completed client projects from 2023',
        status: 'archived',
        createdByEmail: 'grace@example.com',
        taskTitles: [
          'Archive source code to cold storage',
          'Export final client deliverables',
          'Close out client contracts',
          'Record lessons learned',
          'Update portfolio with project case studies',
        ],
      },
    ],
  },
];

// ── Comment templates ─────────────────────────────────────────────────────────

const COMMENT_TEMPLATES = [
  'Starting work on this — will have an update by EOD.',
  'Found a blocker, needs clarification from the client. Sending a message now.',
  'PR is up for review. Please take a look when you get a chance.',
  'Completed and deployed to staging. Ready for QA.',
  'Quick call with the team confirmed the approach. Moving forward.',
  'This is more complex than initially estimated. Breaking into smaller pieces.',
  'Dependencies resolved. Should be done by tomorrow.',
  'Reviewed the requirements again — found an edge case. Updating the spec.',
  'Tests are green. Merging after one more review.',
  'Discovered a related issue while working on this. Opening a new task.',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function taskStatus(index: number, total: number): TaskStatus {
  if (index < total * 0.3) return 'done';
  if (index < total * 0.5) return 'in_progress';
  return 'todo';
}

async function seedTasks(
  projectId: string,
  titles: string[],
  memberIds: string[],
  createdById: string | null,
): Promise<string[]> {
  const ids: string[] = [];
  const safeMembers = memberIds.length > 0 ? memberIds : [createdById].filter(Boolean) as string[];

  for (let i = 0; i < titles.length; i++) {
    const status = taskStatus(i, titles.length);
    const assigneeId = i % 3 === 2 || safeMembers.length === 0
      ? null
      : safeMembers[i % safeMembers.length];

    const result = await db.execute<{ id: string }>(sql`
      INSERT INTO tasks (project_id, title, status, assignee_id, position, created_by)
      VALUES (
        ${projectId},
        ${titles[i]},
        ${status}::task_status,
        ${assigneeId},
        ${i},
        ${createdById}
      )
      RETURNING id
    `);
    ids.push(result.rows[0].id);
  }
  return ids;
}

async function seedComments(taskIds: string[], memberIds: string[]): Promise<void> {
  if (memberIds.length === 0) return;

  for (let ti = 0; ti < taskIds.length; ti++) {
    const commentCount = 2 + (ti % 2);
    for (let ci = 0; ci < commentCount; ci++) {
      const userId = memberIds[(ti * 2 + ci) % memberIds.length];
      const content = COMMENT_TEMPLATES[(ti * 3 + ci) % COMMENT_TEMPLATES.length];
      await db.execute(sql`
        INSERT INTO task_comments (task_id, user_id, content)
        VALUES (${taskIds[ti]}, ${userId}, ${content})
      `);
    }
  }
}

async function seedOrgContent(
  orgDef: OrgDef,
  orgId: string,
  userIdMap: Map<string, string>,
): Promise<void> {
  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.organizationId, orgId));

  if (Number(existing) > 0) {
    console.log(`  ↩  ${orgDef.name}: projects already exist, skipping`);
    return;
  }

  const memberIds = orgDef.members
    .map((m) => userIdMap.get(m.email))
    .filter((id): id is string => id !== undefined);

  for (const projectDef of orgDef.projects) {
    const createdById = userIdMap.get(projectDef.createdByEmail) ?? null;

    const [{ id: projectId }] = await db
      .insert(projects)
      .values({
        organizationId: orgId,
        name: projectDef.name,
        description: projectDef.description,
        status: projectDef.status,
        createdBy: createdById,
      })
      .returning({ id: projects.id });

    const taskIds = await seedTasks(projectId, projectDef.taskTitles, memberIds, createdById);

    // Add comments to the first 3 tasks of each project
    await seedComments(taskIds.slice(0, 3), memberIds);

    console.log(
      `    ✓  ${projectDef.name} [${projectDef.status}] — ${projectDef.taskTitles.length} tasks`,
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n');

  // 1. Hash password (same hash for all seed users)
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  // 2. Upsert users
  console.log('→ Users');
  const insertedUsers = await db
    .insert(users)
    .values(SEED_USERS.map((u) => ({ email: u.email, name: u.name, passwordHash })))
    .onConflictDoUpdate({
      target: users.email,
      set: { name: sql`excluded.name`, passwordHash: sql`excluded.password_hash` },
    })
    .returning({ id: users.id, email: users.email });

  const userIdMap = new Map(insertedUsers.map((u) => [u.email, u.id]));
  console.log(`   ${insertedUsers.length} users upserted\n`);

  // 3. Upsert organizations
  console.log('→ Organizations');
  const insertedOrgs = await db
    .insert(organizations)
    .values(SEED_ORGS.map((o) => ({ name: o.name, slug: o.slug })))
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { name: sql`excluded.name` },
    })
    .returning({ id: organizations.id, slug: organizations.slug });

  const orgIdMap = new Map(insertedOrgs.map((o) => [o.slug, o.id]));
  console.log(`   ${insertedOrgs.length} organizations upserted\n`);

  // 4. Upsert billing subscriptions
  console.log('→ Billing subscriptions');
  for (const orgDef of SEED_ORGS) {
    const orgId = orgIdMap.get(orgDef.slug)!;
    await db
      .insert(billingSubscriptions)
      .values({
        organizationId: orgId,
        stripeCustomerId: orgDef.stripeCustomerId,
        stripeSubscriptionId: orgDef.stripeSubscriptionId,
        plan: orgDef.plan,
        status: 'active',
      })
      .onConflictDoNothing();
  }
  console.log(`   ${SEED_ORGS.length} subscriptions upserted\n`);

  // 5. Upsert organization members
  console.log('→ Organization members');
  let totalMembers = 0;
  for (const orgDef of SEED_ORGS) {
    const orgId = orgIdMap.get(orgDef.slug)!;
    const memberRows = orgDef.members
      .map((m) => ({ organizationId: orgId, userId: userIdMap.get(m.email)!, role: m.role }))
      .filter((m) => m.userId !== undefined);

    await db.insert(organizationMembers).values(memberRows).onConflictDoNothing();
    totalMembers += memberRows.length;
  }
  console.log(`   ${totalMembers} memberships upserted\n`);

  // 6. Seed projects, tasks, and comments per org
  console.log('→ Projects, tasks, and comments');
  for (const orgDef of SEED_ORGS) {
    const orgId = orgIdMap.get(orgDef.slug)!;
    console.log(`  ${orgDef.name}:`);
    await seedOrgContent(orgDef, orgId, userIdMap);
  }

  // 7. Summary
  const totalTasks = SEED_ORGS.flatMap((o) => o.projects).reduce(
    (sum, p) => sum + p.taskTitles.length,
    0,
  );
  console.log(`\n✅ Seed complete!\n`);
  console.log('─'.repeat(56));
  console.log('User credentials (password is the same for all):');
  console.log(`  Password: ${SEED_PASSWORD}\n`);
  console.log('  Email                         Org(s)');
  console.log('  ─'.repeat(28));

  const orgMemberships = new Map<string, string[]>();
  for (const orgDef of SEED_ORGS) {
    for (const m of orgDef.members) {
      const orgs = orgMemberships.get(m.email) ?? [];
      orgs.push(`${orgDef.slug} (${m.role})`);
      orgMemberships.set(m.email, orgs);
    }
  }

  for (const u of SEED_USERS) {
    const orgs = orgMemberships.get(u.email)?.join(', ') ?? '';
    console.log(`  ${u.email.padEnd(32)}${orgs}`);
  }

  console.log('─'.repeat(56));
  console.log(
    `\n  ${SEED_USERS.length} users · ${SEED_ORGS.length} organizations · ` +
      `${SEED_ORGS.flatMap((o) => o.projects).length} projects · ~${totalTasks} tasks`,
  );
}

main()
  .catch((err) => {
    console.error('\n❌ Seed failed:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
