import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, max } from 'drizzle-orm';
import { TenantDbService } from '@database/tenant-db.service';
import { organizationMembers, projects, tasks } from '@database/schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { TaskResponseDto } from './dto/task-response.dto';

@Injectable()
export class TasksService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(
    organizationId: string,
    projectId: string,
    userId: string,
    dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .limit(1);

      if (!project) throw new NotFoundException('Project not found');

      const [row] = await db
        .select({ maxPos: max(tasks.position) })
        .from(tasks)
        .where(eq(tasks.projectId, projectId));
      const nextPosition = Number(row.maxPos ?? 0) + 1;

      // organization_id is intentionally omitted — the DB trigger derives it from project_id.
      const [task] = await db
        .insert(tasks)
        .values({
          projectId,
          title: dto.title,
          description: dto.description ?? null,
          assigneeId: dto.assigneeId ?? null,
          position: nextPosition,
          createdBy: userId,
        } as unknown as typeof tasks.$inferInsert)
        .returning();

      return task;
    });
  }

  async findAllByProject(
    organizationId: string,
    projectId: string,
  ): Promise<TaskResponseDto[]> {
    return this.tenantDb.withTenantContext(organizationId, (db) =>
      db
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.organizationId, organizationId)))
        .orderBy(asc(tasks.position)),
    );
  }

  async update(
    organizationId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [existing] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
        .limit(1);

      if (!existing) throw new NotFoundException('Task not found');

      const updateData: Partial<{
        title: string;
        description: string | null;
        status: 'todo' | 'in_progress' | 'done';
        updatedAt: Date;
      }> = { updatedAt: new Date() };

      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.status !== undefined) updateData.status = dto.status;

      const [updated] = await db
        .update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
        .returning();

      return updated;
    });
  }

  async move(
    organizationId: string,
    taskId: string,
    dto: MoveTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [existing] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
        .limit(1);

      if (!existing) throw new NotFoundException('Task not found');

      // RLS on projects ensures the destination belongs to this org.
      const [destProject] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, dto.projectId))
        .limit(1);

      if (!destProject) throw new NotFoundException('Destination project not found');

      // Updating project_id fires the trigger that refreshes organization_id.
      const [updated] = await db
        .update(tasks)
        .set({ projectId: dto.projectId, position: dto.position, updatedAt: new Date() })
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
        .returning();

      return updated;
    });
  }

  async assign(
    organizationId: string,
    taskId: string,
    dto: AssignTaskDto,
  ): Promise<TaskResponseDto> {
    // organization_members has no RLS — use withoutTenantContext for the membership check.
    if (dto.assigneeId !== null) {
      const [member] = await this.tenantDb.withoutTenantContext((db) =>
        db
          .select({ userId: organizationMembers.userId })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, organizationId),
              eq(organizationMembers.userId, dto.assigneeId!),
            ),
          )
          .limit(1),
      );

      if (!member) throw new NotFoundException('Assignee is not a member of this organization');
    }

    return this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [existing] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
        .limit(1);

      if (!existing) throw new NotFoundException('Task not found');

      const [updated] = await db
        .update(tasks)
        .set({ assigneeId: dto.assigneeId, updatedAt: new Date() })
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
        .returning();

      return updated;
    });
  }
}
