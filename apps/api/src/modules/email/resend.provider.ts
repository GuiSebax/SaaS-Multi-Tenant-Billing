import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export const RESEND_CLIENT = 'RESEND_CLIENT';

export const resendProvider = {
  provide: RESEND_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => new Resend(config.getOrThrow('RESEND_API_KEY')),
};
