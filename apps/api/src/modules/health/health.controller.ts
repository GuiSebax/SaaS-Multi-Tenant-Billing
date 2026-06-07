import { Controller, Get, Inject, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { Public } from '@common/decorators/public.decorator';
import { PG_POOL } from '@database/database.tokens';

@Public()
@Controller('health')
export class HealthController implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    config: ConfigService,
  ) {
    this.redis = new Redis(config.getOrThrow<string>('REDIS_URL'));
  }

  @Get()
  async check(): Promise<{ status: string; timestamp: string; services: { database: string; redis: string } }> {
    const [dbResult, redisResult] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const dbUp = dbResult.status === 'fulfilled';
    const redisUp = redisResult.status === 'fulfilled';

    return {
      status: dbUp && redisUp ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: dbUp ? 'up' : 'down',
        redis: redisUp ? 'up' : 'down',
      },
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private async checkDatabase(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  private async checkRedis(): Promise<void> {
    await this.redis.ping();
  }
}
