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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';

@Controller('projects')
@UseGuards(TenantGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRole('owner', 'admin', 'member')
  create(@Req() req: Request, @Body() dto: CreateProjectDto): Promise<ProjectResponseDto> {
    return this.projectsService.create(req.member!.organizationId, req.member!.userId, dto);
  }

  @Get()
  findAll(@Req() req: Request): Promise<ProjectResponseDto[]> {
    return this.projectsService.findAll(req.member!.organizationId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') projectId: string): Promise<ProjectResponseDto> {
    return this.projectsService.findOne(req.member!.organizationId, projectId);
  }

  @Patch(':id')
  @RequireRole('owner', 'admin')
  update(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.update(req.member!.organizationId, projectId, dto);
  }

  @Delete(':id')
  @RequireRole('owner', 'admin')
  archive(@Req() req: Request, @Param('id') projectId: string): Promise<ProjectResponseDto> {
    return this.projectsService.archive(req.member!.organizationId, projectId);
  }
}
