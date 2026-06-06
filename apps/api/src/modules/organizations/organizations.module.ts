import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@database/database.module';
import { OrganizationsController, InvitationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: 'email' }),
  ],
  controllers: [OrganizationsController, InvitationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
