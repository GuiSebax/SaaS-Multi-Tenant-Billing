import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, raw } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { JsonLoggerService } from '@common/logger/json-logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: new JsonLoggerService(),
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  });

  // raw body for Stripe signature validation — must come before json()
  app.use('/api/webhooks/stripe', raw({ type: 'application/json' }));
  app.use(json());

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

bootstrap();
