import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, max } from 'drizzle-orm';
import { TenantDbService } from '@database/tenant-db.service';
import { organizationMembers, projects, taskComments, tasks, users } from '@database/schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { TaskDetailResponseDto } from './dto/task-detail-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';

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

  async findOne(organizationId: string, taskId: string): Promise<TaskDetailResponseDto> {
    return this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [row] = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          status: tasks.status,
          position: tasks.position,
          projectId: tasks.projectId,
          organizationId: tasks.organizationId,
          assigneeId: tasks.assigneeId,
          createdBy: tasks.createdBy,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
          assigneeName: users.name,
          assigneeEmail: users.email,
        })
        .from(tasks)
        .leftJoin(users, eq(tasks.assigneeId, users.id))
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
        .limit(1);

      if (!row) throw new NotFoundException('Task not found');

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        position: row.position,
        projectId: row.projectId,
        organizationId: row.organizationId,
        assigneeId: row.assigneeId,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        assignee: row.assigneeId
          ? { id: row.assigneeId, name: row.assigneeName!, email: row.assigneeEmail! }
          : null,
      };
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

  async deleteTask(organizationId: string, taskId: string): Promise<void> {
    await this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [existing] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
        .limit(1);

      if (!existing) throw new NotFoundException('Task not found');

      await db
        .delete(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)));
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

  async createComment(
    organizationId: string,
    taskId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [task] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
        .limit(1);

      if (!task) throw new NotFoundException('Task not found');

      // organization_id is intentionally omitted — the DB trigger derives it from task_id.
      const [comment] = await db
        .insert(taskComments)
        .values({
          taskId,
          userId,
          content: dto.content,
        } as unknown as typeof taskComments.$inferInsert)
        .returning();

      return { ...comment, authorName: null };
    });
  }

  async findCommentsByTask(
    organizationId: string,
    taskId: string,
  ): Promise<CommentResponseDto[]> {
    return this.tenantDb.withTenantContext(organizationId, (db) =>
      db
        .select({
          id: taskComments.id,
          content: taskComments.content,
          taskId: taskComments.taskId,
          organizationId: taskComments.organizationId,
          userId: taskComments.userId,
          authorName: users.name,
          createdAt: taskComments.createdAt,
        })
        .from(taskComments)
        .leftJoin(users, eq(taskComments.userId, users.id))
        .where(
          and(
            eq(taskComments.taskId, taskId),
            eq(taskComments.organizationId, organizationId),
          ),
        )
        .orderBy(asc(taskComments.createdAt)),
    );
  }

  async deleteComment(
    organizationId: string,
    commentId: string,
    userId: string,
  ): Promise<void> {
    await this.tenantDb.withTenantContext(organizationId, async (db) => {
      const [comment] = await db
        .select({ id: taskComments.id, userId: taskComments.userId })
        .from(taskComments)
        .where(and(eq(taskComments.id, commentId), eq(taskComments.organizationId, organizationId)))
        .limit(1);

      if (!comment) throw new NotFoundException('Comment not found');
      if (comment.userId !== userId) throw new ForbiddenException('Cannot delete another user comment');

      await db.delete(taskComments).where(eq(taskComments.id, commentId));
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
