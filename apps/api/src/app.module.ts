import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from '@config/env.config';
import { DatabaseModule } from '@database/database.module';
import { AuthModule } from '@modules/auth/auth.module';
import { OrganizationsModule } from '@modules/organizations/organizations.module';
import { OrganizationsController } from '@modules/organizations/organizations.controller';
import { ProjectsModule } from '@modules/projects/projects.module';
import { ProjectsController } from '@modules/projects/projects.controller';
import { EmailModule } from '@modules/email/email.module';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { TenantMiddleware } from '@common/middleware/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
    }),
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes(OrganizationsController, ProjectsController);
  }
}
