import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { Plan } from '@saas-platform/shared';

type StripeClient = InstanceType<typeof Stripe>;
type StripeSubscription = Awaited<ReturnType<StripeClient['subscriptions']['retrieve']>>;
type StripeSubStatus = StripeSubscription['status'];

import { TenantDbService } from '@database/tenant-db.service';
import { billingSubscriptions } from '@database/schema';
import { STRIPE_CLIENT } from './stripe.provider';
import { CheckoutSessionResponseDto } from './dto/checkout-session-response.dto';
import { PortalSessionResponseDto } from './dto/portal-session-response.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly frontendUrl: string;
  private readonly proPriceId: string;
  private readonly enterprisePriceId: string;

  constructor(
    private readonly tenantDb: TenantDbService,
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeClient,
    config: ConfigService,
  ) {
    this.frontendUrl = config.getOrThrow('FRONTEND_URL');
    this.proPriceId = config.getOrThrow('STRIPE_PRO_PRICE_ID');
    this.enterprisePriceId = config.getOrThrow('STRIPE_ENTERPRISE_PRICE_ID');
  }

  async getSubscription(organizationId: string): Promise<SubscriptionResponseDto> {
    return this.tenantDb.withoutTenantContext(async (db) => {
      const [sub] = await db
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.organizationId, organizationId))
        .limit(1);

      if (!sub) throw new NotFoundException('Subscription not found');
      return sub;
    });
  }

  async createCheckoutSession(
    organizationId: string,
    _userId: string,
    priceId: string,
  ): Promise<CheckoutSessionResponseDto> {
    return this.tenantDb.withoutTenantContext(async (db) => {
      const [sub] = await db
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.organizationId, organizationId))
        .limit(1);

      if (!sub) throw new NotFoundException('Subscription not found');

      let customerId = sub.stripeCustomerId;

      if (customerId.startsWith('pending_')) {
        const customer = await this.stripe.customers.create({
          metadata: { organization_id: organizationId },
        });
        customerId = customer.id;
        await db
          .update(billingSubscriptions)
          .set({ stripeCustomerId: customerId, updatedAt: new Date() })
          .where(eq(billingSubscriptions.organizationId, organizationId));
      }

      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { organization_id: organizationId },
        success_url: `${this.frontendUrl}/settings/billing?success=true`,
        cancel_url: `${this.frontendUrl}/settings/billing?canceled=true`,
        subscription_data: {
          trial_period_days: 14,
          metadata: { organization_id: organizationId },
        },
      });

      return { url: session.url! };
    });
  }

  async createPortalSession(organizationId: string): Promise<PortalSessionResponseDto> {
    return this.tenantDb.withoutTenantContext(async (db) => {
      const [sub] = await db
        .select({ stripeCustomerId: billingSubscriptions.stripeCustomerId })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.organizationId, organizationId))
        .limit(1);

      if (!sub) throw new NotFoundException('Subscription not found');
      if (sub.stripeCustomerId.startsWith('pending_')) {
        throw new BadRequestException('No active subscription');
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${this.frontendUrl}/settings/billing`,
      });

      return { url: session.url };
    });
  }

  async handleCheckoutCompleted(eventId: string, organizationId: string, subscriptionId: string): Promise<void> {
    return this.tenantDb.withoutTenantContext(async (db) => {
      const result = await db.execute(
        sql`INSERT INTO processed_webhook_events (event_id) VALUES (${eventId}) ON CONFLICT DO NOTHING`,
      );
      if (!result.rowCount) {
        this.logger.log(`Skipping already-processed event: ${eventId}`);
        return;
      }

      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price?.id;
      const plan = this.mapPriceIdToPlan(priceId);
      const status = this.mapStripeStatus(subscription.status);

      await db
        .update(billingSubscriptions)
        .set({
          stripeSubscriptionId: subscriptionId,
          plan,
          status,
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          updatedAt: new Date(),
        })
        .where(eq(billingSubscriptions.organizationId, organizationId));

      this.logger.log(`Checkout completed for org=${organizationId} plan=${plan} status=${status}`);
    });
  }

  async handleSubscriptionUpdated(
    eventId: string,
    organizationId: string,
    plan: Plan,
    subscription: StripeSubscription,
  ): Promise<void> {
    return this.tenantDb.withoutTenantContext(async (db) => {
      const result = await db.execute(
        sql`INSERT INTO processed_webhook_events (event_id) VALUES (${eventId}) ON CONFLICT DO NOTHING`,
      );
      if (!result.rowCount) {
        this.logger.log(`Skipping already-processed event: ${eventId}`);
        return;
      }

      const status = this.mapStripeStatus(subscription.status);

      await db
        .update(billingSubscriptions)
        .set({
          plan,
          status,
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          updatedAt: new Date(),
        })
        .where(eq(billingSubscriptions.organizationId, organizationId));

      this.logger.log(`Subscription updated for org=${organizationId} plan=${plan} status=${status}`);
    });
  }

  async handleSubscriptionDeleted(eventId: string, organizationId: string): Promise<void> {
    return this.tenantDb.withoutTenantContext(async (db) => {
      const result = await db.execute(
        sql`INSERT INTO processed_webhook_events (event_id) VALUES (${eventId}) ON CONFLICT DO NOTHING`,
      );
      if (!result.rowCount) {
        this.logger.log(`Skipping already-processed event: ${eventId}`);
        return;
      }

      await db
        .update(billingSubscriptions)
        .set({ plan: 'free', status: 'canceled', updatedAt: new Date() })
        .where(eq(billingSubscriptions.organizationId, organizationId));

      this.logger.log(`Subscription deleted for org=${organizationId}`);
    });
  }

  private mapPriceIdToPlan(priceId: string | undefined): Plan {
    if (priceId === this.proPriceId) return 'pro';
    if (priceId === this.enterprisePriceId) return 'enterprise';
    return 'free';
  }

  private mapStripeStatus(stripeStatus: StripeSubStatus): SubscriptionStatus {
    const mapping: Partial<Record<StripeSubStatus, SubscriptionStatus>> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
    };
    return mapping[stripeStatus] ?? 'active';
  }
}
