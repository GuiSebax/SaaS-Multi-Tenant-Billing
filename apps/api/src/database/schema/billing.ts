import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const planEnum = pgEnum('plan', ['free', 'pro', 'enterprise']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'trialing',
  'past_due',
  'canceled',
]);

export const billingSubscriptions = pgTable('billing_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .unique()
    .references(() => organizations.id),
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  plan: planEnum('plan').notNull(),
  status: subscriptionStatusEnum('status').notNull(),
  trialEndsAt: timestamp('trial_ends_at'),
  currentPeriodEnd: timestamp('current_period_end'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
