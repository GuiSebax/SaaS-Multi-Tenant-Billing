import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { userId: string } => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as { userId: string };
  },
);
