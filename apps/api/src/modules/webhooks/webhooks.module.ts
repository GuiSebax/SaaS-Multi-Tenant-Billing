import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BillingModule } from '@modules/billing/billing.module';
import { WebhooksController } from './webhooks.controller';
import { StripeWebhookProcessor } from './processors/stripe-webhook.processor';

@Module({
  imports: [
    BillingModule,
    BullModule.registerQueue({ name: 'stripe-webhooks' }),
  ],
  controllers: [WebhooksController],
  providers: [StripeWebhookProcessor],
})
export class WebhooksModule {}
