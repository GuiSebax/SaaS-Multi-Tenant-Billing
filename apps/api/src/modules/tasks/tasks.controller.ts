import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { RequireRole } from '@common/decorators/require-role.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { TaskDetailResponseDto } from './dto/task-detail-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';

@Controller('projects')
@UseGuards(TenantGuard, RolesGuard)
export class ProjectTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(':projectId/tasks')
  findAllByProject(
    @Req() req: Request,
    @Param('projectId') projectId: string,
  ): Promise<TaskResponseDto[]> {
    return this.tasksService.findAllByProject(req.member!.organizationId, projectId);
  }

  @Post(':projectId/tasks')
  @HttpCode(HttpStatus.CREATED)
  @RequireRole('owner', 'admin', 'member')
  create(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.create(req.member!.organizationId, projectId, req.member!.userId, dto);
  }
}

@Controller('tasks')
@UseGuards(TenantGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // Specific paths before generic :id to avoid routing conflicts
  @Get(':taskId/comments')
  findCommentsByTask(
    @Req() req: Request,
    @Param('taskId') taskId: string,
  ): Promise<CommentResponseDto[]> {
    return this.tasksService.findCommentsByTask(req.member!.organizationId, taskId);
  }

  @Post(':taskId/comments')
  @HttpCode(HttpStatus.CREATED)
  createComment(
    @Req() req: Request,
    @Param('taskId') taskId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.tasksService.createComment(req.member!.organizationId, taskId, req.member!.userId, dto);
  }

  @Delete(':taskId/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteComment(
    @Req() req: Request,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    return this.tasksService.deleteComment(req.member!.organizationId, commentId, req.member!.userId);
  }

  @Get(':id')
  findOne(
    @Req() req: Request,
    @Param('id') taskId: string,
  ): Promise<TaskDetailResponseDto> {
    return this.tasksService.findOne(req.member!.organizationId, taskId);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.update(req.member!.organizationId, taskId, dto);
  }

  @Patch(':id/move')
  move(
    @Req() req: Request,
    @Param('id') taskId: string,
    @Body() dto: MoveTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.move(req.member!.organizationId, taskId, dto);
  }

  @Patch(':id/assign')
  assign(
    @Req() req: Request,
    @Param('id') taskId: string,
    @Body() dto: AssignTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.assign(req.member!.organizationId, taskId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTask(
    @Req() req: Request,
    @Param('id') taskId: string,
  ): Promise<void> {
    return this.tasksService.deleteTask(req.member!.organizationId, taskId);
  }
}
