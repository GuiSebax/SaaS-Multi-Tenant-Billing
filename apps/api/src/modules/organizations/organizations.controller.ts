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
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { RequireRole } from '@common/decorators/require-role.decorator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { InvitationResponseDto } from './dto/invitation-response.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.create(user.userId, dto);
  }

  @Get('mine')
  findAllByUser(@CurrentUser() user: { userId: string }): Promise<OrganizationResponseDto[]> {
    return this.organizationsService.findAllByUser(user.userId);
  }

  @Post(':id/invitations')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(TenantGuard, RolesGuard)
  @RequireRole('owner', 'admin')
  invite(
    @Param('id') organizationId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: InviteMemberDto,
  ): Promise<InvitationResponseDto> {
    return this.organizationsService.invite(organizationId, user.userId, dto);
  }

  @Patch(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TenantGuard, RolesGuard)
  @RequireRole('owner', 'admin')
  updateMemberRole(
    @Param('id') organizationId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: Request,
  ): Promise<{ userId: string; role: string }> {
    return this.organizationsService.updateMemberRole(organizationId, targetUserId, dto, req.member!);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(TenantGuard, RolesGuard)
  @RequireRole('owner', 'admin')
  removeMember(
    @Param('id') organizationId: string,
    @Param('userId') targetUserId: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.organizationsService.removeMember(organizationId, targetUserId, req.member!);
  }
}

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: { userId: string },
  ): Promise<void> {
    return this.organizationsService.acceptInvitation(token, user.userId);
  }
}
