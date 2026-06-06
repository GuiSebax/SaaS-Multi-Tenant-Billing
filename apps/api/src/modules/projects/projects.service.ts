import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { PLAN_LIMITS } from '@saas-platform/shared';
import { TenantDbService } from '@database/tenant-db.service';
import { billingSubscriptions, projects } from '@database/schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    const [billing] = await this.tenantDb.withoutTenantContext((db) =>
      db
        .select({ plan: billingSubscriptions.plan })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.organizationId, organizationId))
        .limit(1),
    );

    return this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [{ value }] = await db
        .select({ value: count() })
        .from(projects)
        .where(
          and(eq(projects.organizationId, organizationId), eq(projects.status, 'active')),
        );
      const activeCount = Number(value);

      const limit = PLAN_LIMITS[billing?.plan ?? 'free'].projects;
      if (limit !== Infinity && activeCount >= limit) {
        throw new HttpException(
          {
            error: 'PLAN_LIMIT_REACHED',
            resource: 'projects',
            limit,
            current: activeCount,
            upgrade_url: '/settings/billing',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      const [project] = await db
        .insert(projects)
        .values({
          organizationId,
          name: dto.name,
          description: dto.description ?? null,
          createdBy: userId,
        })
        .returning();

      return project;
    });
  }

  async findAll(organizationId: string): Promise<ProjectResponseDto[]> {
    return this.tenantDb.withTenantContext(organizationId, (db) =>
      db
        .select()
        .from(projects)
        .where(eq(projects.organizationId, organizationId))
        .orderBy(desc(projects.createdAt)),
    );
  }

  async findOne(organizationId: string, projectId: string): Promise<ProjectResponseDto> {
    return this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .limit(1);

      if (!project) throw new NotFoundException('Project not found');
      return project;
    });
  }

  async update(
    organizationId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [existing] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .limit(1);

      if (!existing) throw new NotFoundException('Project not found');

      const updateData: Partial<{ name: string; description: string | null; status: 'active' | 'archived' }> = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.status !== undefined) updateData.status = dto.status;

      const [updated] = await db
        .update(projects)
        .set(updateData)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .returning();

      return updated;
    });
  }

  async archive(organizationId: string, projectId: string): Promise<ProjectResponseDto> {
    return this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [existing] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .limit(1);

      if (!existing) throw new NotFoundException('Project not found');

      const [archived] = await db
        .update(projects)
        .set({ status: 'archived' })
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .returning();

      return archived;
    });
  }
}
