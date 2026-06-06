import {
  Body,
  Controller,
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
}
