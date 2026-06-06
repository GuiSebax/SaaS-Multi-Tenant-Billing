import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

type StripeClient = InstanceType<typeof Stripe>;
import { TenantDbService } from '@database/tenant-db.service';
import { billingSubscriptions } from '@database/schema';
import { STRIPE_CLIENT } from './stripe.provider';
import { CheckoutSessionResponseDto } from './dto/checkout-session-response.dto';
import { PortalSessionResponseDto } from './dto/portal-session-response.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

@Injectable()
export class BillingService {
  private readonly frontendUrl: string;

  constructor(
    private readonly tenantDb: TenantDbService,
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeClient,
    config: ConfigService,
  ) {
    this.frontendUrl = config.getOrThrow('FRONTEND_URL');
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
}
