import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { eq, and } from 'drizzle-orm';
import { TenantDbService } from '@database/tenant-db.service';
import { organizationMembers } from '@database/schema';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantDb: TenantDbService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const organizationId = req.organizationId;
    const userId = (req.user as { userId: string } | undefined)?.userId;

    if (!organizationId || !userId) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const [member] = await this.tenantDb.withoutTenantContext((db) =>
      db
        .select({
          organizationId: organizationMembers.organizationId,
          userId: organizationMembers.userId,
          role: organizationMembers.role,
        })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, userId),
          ),
        )
        .limit(1),
    );

    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }

    req.member = member;
    return true;
  }
}
