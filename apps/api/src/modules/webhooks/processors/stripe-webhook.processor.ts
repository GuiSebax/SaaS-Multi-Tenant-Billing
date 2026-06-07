import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import Stripe from 'stripe';
import { Plan } from '@saas-platform/shared';
import { BillingService } from '@modules/billing/billing.service';

type StripeClient = InstanceType<typeof Stripe>;
type StripeEvent = ReturnType<StripeClient['webhooks']['constructEvent']>;
type StripeSubscription = Awaited<ReturnType<StripeClient['subscriptions']['retrieve']>>;
type StripeCheckoutSession = Awaited<ReturnType<StripeClient['checkout']['sessions']['retrieve']>>;

@Processor('stripe-webhooks')
export class StripeWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(StripeWebhookProcessor.name);
  private readonly proPriceId: string;
  private readonly enterprisePriceId: string;

  constructor(
    private readonly billingService: BillingService,
    config: ConfigService,
  ) {
    super();
    this.proPriceId = config.getOrThrow('STRIPE_PRO_PRICE_ID');
    this.enterprisePriceId = config.getOrThrow('STRIPE_ENTERPRISE_PRICE_ID');
  }

  async process(job: Job<StripeEvent>): Promise<void> {
    const event = job.data;

    switch (job.name) {
      case 'checkout.session.completed': {
        const session = event.data.object as StripeCheckoutSession;
        const organizationId = session.metadata?.organization_id;
        const subscriptionId = session.subscription as string | null;
        if (!organizationId || !subscriptionId) {
          this.logger.warn(`checkout.session.completed missing metadata or subscription: ${event.id}`);
          return;
        }
        await this.billingService.handleCheckoutCompleted(event.id, organizationId, subscriptionId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as StripeSubscription;
        const organizationId = subscription.metadata?.organization_id;
        if (!organizationId) {
          this.logger.warn(`customer.subscription.updated missing metadata: ${event.id}`);
          return;
        }
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = this.mapPriceIdToPlan(priceId);
        await this.billingService.handleSubscriptionUpdated(event.id, organizationId, plan, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as StripeSubscription;
        const organizationId = subscription.metadata?.organization_id;
        if (!organizationId) {
          this.logger.warn(`customer.subscription.deleted missing metadata: ${event.id}`);
          return;
        }
        await this.billingService.handleSubscriptionDeleted(event.id, organizationId);
        break;
      }

      default:
        this.logger.log(`Unhandled event type: ${job.name}`);
    }
  }

  private mapPriceIdToPlan(priceId: string | undefined): Plan {
    if (priceId === this.proPriceId) return 'pro';
    if (priceId === this.enterprisePriceId) return 'enterprise';
    return 'free';
  }
}
