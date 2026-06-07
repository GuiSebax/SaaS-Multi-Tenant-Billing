import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Inject,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { Counter, Histogram } from 'prom-client';

export const HTTP_DURATION_TOKEN = 'PROM_METRIC_HTTP_REQUEST_DURATION_MS';
export const PLAN_LIMIT_TOKEN = 'PROM_METRIC_PLAN_LIMIT_REACHED_TOTAL';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(HTTP_DURATION_TOKEN) private readonly httpDuration: Histogram<string>,
    @Inject(PLAN_LIMIT_TOKEN) private readonly planLimitCounter: Counter<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    if (req.path.startsWith('/api/metrics')) return next.handle();

    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        this.record(req, res.statusCode, Date.now() - start);
      }),
      catchError((err: unknown) => {
        const status = err instanceof HttpException ? err.getStatus() : 500;
        if (err instanceof HttpException) {
          const body = err.getResponse() as Record<string, unknown>;
          if (body?.error === 'PLAN_LIMIT_REACHED') {
            this.planLimitCounter.inc({ resource: String(body.resource ?? 'unknown') });
          }
        }
        this.record(req, status, Date.now() - start);
        return throwError(() => err);
      }),
    );
  }

  private record(req: Request, status: number, durationMs: number): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const route = (req as any).route?.path ?? req.path;
    this.httpDuration.observe({ method: req.method, route, status: String(status) }, durationMs);
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: status >= 500 ? 'error' : 'info',
        request_id: req.requestId ?? null,
        tenant_id: req.organizationId ?? null,
        user_id: req.user?.userId ?? null,
        method: req.method,
        path: req.path,
        status,
        duration_ms: durationMs,
        query_count: 0,
      }),
    );
  }
}
