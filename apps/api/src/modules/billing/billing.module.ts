import { Module } from '@nestjs/common';
import { DatabaseModule } from '@database/database.module';
import { stripeProvider } from './stripe.provider';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BillingController],
  providers: [stripeProvider, BillingService],
})
export class BillingModule {}
