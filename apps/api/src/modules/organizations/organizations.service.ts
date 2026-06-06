import { ConflictException, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { TenantDbService } from '@database/tenant-db.service';
import { organizations, organizationMembers, billingSubscriptions } from '@database/schema';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(userId: string, dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    return this.tenantDb.withoutTenantContext(async (db) => {
      const existing = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, dto.slug))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictException('Slug already taken');
      }

      const [org] = await db
        .insert(organizations)
        .values({ name: dto.name, slug: dto.slug })
        .returning();

      const [billing] = await db
        .insert(billingSubscriptions)
        .values({
          organizationId: org.id,
          stripeCustomerId: `pending_${org.id}`,
          plan: 'free',
          status: 'active',
        })
        .returning();

      await db.insert(organizationMembers).values({
        organizationId: org.id,
        userId,
        role: 'owner',
      });

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: org.createdAt,
        plan: billing.plan,
        status: billing.status,
        role: 'owner',
      };
    });
  }

  async findAllByUser(userId: string): Promise<OrganizationResponseDto[]> {
    return this.tenantDb.withoutTenantContext(async (db) => {
      const rows = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          createdAt: organizations.createdAt,
          plan: billingSubscriptions.plan,
          status: billingSubscriptions.status,
          role: organizationMembers.role,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
        .innerJoin(billingSubscriptions, eq(billingSubscriptions.organizationId, organizations.id))
        .where(eq(organizationMembers.userId, userId));

      return rows;
    });
  }
}
