import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, register as promRegister } from 'prom-client';
import { validateEnv } from '@config/env.config';
import { DatabaseModule } from '@database/database.module';
import { AuthModule } from '@modules/auth/auth.module';
import { OrganizationsModule } from '@modules/organizations/organizations.module';
import { OrganizationsController } from '@modules/organizations/organizations.controller';
import { ProjectsModule } from '@modules/projects/projects.module';
import { ProjectsController } from '@modules/projects/projects.controller';
import { TasksModule } from '@modules/tasks/tasks.module';
import { ProjectTasksController, TasksController } from '@modules/tasks/tasks.controller';
import { EmailModule } from '@modules/email/email.module';
import { BillingModule } from '@modules/billing/billing.module';
import { BillingController } from '@modules/billing/billing.controller';
import { WebhooksModule } from '@modules/webhooks/webhooks.module';
import { HealthModule } from '@modules/health/health.module';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { TenantMiddleware } from '@common/middleware/tenant.middleware';
import { RequestIdMiddleware } from '@common/middleware/request-id.middleware';
import {
  LoggingInterceptor,
  HTTP_DURATION_TOKEN,
  PLAN_LIMIT_TOKEN,
} from '@common/interceptors/logging.interceptor';

// Safe for multiple AppModule initializations (e.g. parallel integration test suites)
function getOrCreateHistogram(
  name: string,
  help: string,
  labelNames: string[],
  buckets: number[],
): Histogram<string> {
  const existing = promRegister.getSingleMetric(name);
  if (existing) return existing as Histogram<string>;
  return new Histogram({ name, help, labelNames, buckets });
}

function getOrCreateCounter(
  name: string,
  help: string,
  labelNames: string[],
): Counter<string> {
  const existing = promRegister.getSingleMetric(name);
  if (existing) return existing as Counter<string>;
  return new Counter({ name, help, labelNames });
}

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
    // defaultMetrics disabled to avoid duplicate registration across test suites
    PrometheusModule.register({ path: '/metrics', defaultMetrics: { enabled: false } }),
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    TasksModule,
    EmailModule,
    BillingModule,
    WebhooksModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    {
      provide: HTTP_DURATION_TOKEN,
      useFactory: () =>
        getOrCreateHistogram(
          'http_request_duration_ms',
          'HTTP request duration in milliseconds',
          ['method', 'route', 'status'],
          [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
        ),
    },
    {
      provide: PLAN_LIMIT_TOKEN,
      useFactory: () =>
        getOrCreateCounter('plan_limit_reached_total', 'Plan limit reached errors by resource', [
          'resource',
        ]),
    },
    {
      provide: 'PROM_METRIC_WEBHOOK_PROCESSING_DURATION_MS',
      useFactory: () =>
        getOrCreateHistogram(
          'webhook_processing_duration_ms',
          'Stripe webhook processing duration in milliseconds',
          ['event_type'],
          [10, 50, 100, 500, 1000, 5000],
        ),
    },
    {
      provide: 'PROM_METRIC_BULLMQ_JOB_FAILED_TOTAL',
      useFactory: () =>
        getOrCreateCounter('bullmq_job_failed_total', 'BullMQ failed jobs total', ['job_type']),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
    consumer
      .apply(TenantMiddleware)
      .forRoutes(
        OrganizationsController,
        ProjectsController,
        ProjectTasksController,
        TasksController,
        BillingController,
      );
  }
}
