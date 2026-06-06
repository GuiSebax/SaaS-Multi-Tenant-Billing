import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export const STRIPE_CLIENT = 'STRIPE_CLIENT';

export const stripeProvider = {
  provide: STRIPE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): InstanceType<typeof Stripe> =>
    new Stripe(config.getOrThrow('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-05-27.dahlia',
    }),
};
