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

    const message = (() => {
      if (!(exception instanceof HttpException)) return 'Internal server error';
      const res = exception.getResponse();
      if (typeof res === 'string') return res;
      const body = res as Record<string, unknown>;
      return typeof body.message === 'string' ? body.message : exception.message;
    })();

    const error = exception instanceof HttpException ? exception.name : 'InternalServerError';

    response.status(statusCode).json({
      error,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
