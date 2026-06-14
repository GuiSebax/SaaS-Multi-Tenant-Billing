import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EmailProcessor } from './email.processor';
import { resendProvider } from './resend.provider';

@Module({
  imports: [BullModule.registerQueue({ name: 'email' }), ConfigModule],
  providers: [resendProvider, EmailProcessor],
})
export class EmailModule {}
