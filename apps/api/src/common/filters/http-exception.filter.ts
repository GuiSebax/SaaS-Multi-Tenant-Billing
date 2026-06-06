import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionBody = (() => {
      if (!(exception instanceof HttpException)) return null;
      const res = exception.getResponse();
      return typeof res === 'object' && res !== null ? (res as Record<string, unknown>) : null;
    })();

    const message = (() => {
      if (!(exception instanceof HttpException)) return 'Internal server error';
      const res = exception.getResponse();
      if (typeof res === 'string') return res;
      const body = res as Record<string, unknown>;
      return typeof body.message === 'string' ? body.message : exception.message;
    })();

    // Prefer a custom error code in the body (e.g. 'PLAN_LIMIT_REACHED') over the class name.
    const error = exceptionBody?.error ?? (exception instanceof HttpException ? exception.name : 'InternalServerError');

    // Spread any extra fields from a custom body (resource, limit, current, upgrade_url, …).
    const { error: _e, message: _m, statusCode: _s, ...extraFields } = exceptionBody ?? {};

    response.status(statusCode).json({
      error,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...extraFields,
    });
  }
}
