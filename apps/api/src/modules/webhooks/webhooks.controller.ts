import { BadRequestException, Controller, HttpCode, HttpStatus, Inject, Logger, Post, Req } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Request } from 'express';
import Stripe from 'stripe';
import { Public } from '@common/decorators/public.decorator';
import { STRIPE_CLIENT } from '@modules/billing/stripe.provider';

type StripeClient = InstanceType<typeof Stripe>;
type StripeEvent = ReturnType<StripeClient['webhooks']['constructEvent']>;

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    @InjectQueue('stripe-webhooks') private readonly stripeQueue: Queue,
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeClient,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(@Req() req: Request): Promise<{ received: boolean }> {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');

    let event: StripeEvent;
    try {
      event = this.stripe.webhooks.constructEvent(req.body as Buffer, sig as string, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    await this.stripeQueue.add(event.type, event);
    this.logger.log(`Enqueued Stripe event: ${event.type} (${event.id})`);

    return { received: true };
  }
}
