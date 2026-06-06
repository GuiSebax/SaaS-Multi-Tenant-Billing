import { randomUUID } from 'crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { TenantDbService } from '@database/tenant-db.service';
import {
  organizations,
  organizationMembers,
  billingSubscriptions,
  invitations,
  users,
} from '@database/schema';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { InvitationResponseDto } from './dto/invitation-response.dto';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly tenantDb: TenantDbService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

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

  async invite(
    organizationId: string,
    invitedBy: string,
    dto: InviteMemberDto,
  ): Promise<InvitationResponseDto> {
    const { invitation, emailPayload } = await this.tenantDb.withoutTenantContext(async (db) => {
      const [org] = await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org) {
        throw new NotFoundException('Organization not found');
      }

      const [alreadyMember] = await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .innerJoin(users, eq(users.id, organizationMembers.userId))
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(users.email, dto.email),
          ),
        )
        .limit(1);

      if (alreadyMember) {
        throw new ConflictException('User is already a member');
      }

      const [pendingInvite] = await db
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, organizationId),
            eq(invitations.email, dto.email),
            isNull(invitations.acceptedAt),
            gt(invitations.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (pendingInvite) {
        throw new ConflictException('Invitation already pending');
      }

      const [inviter] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, invitedBy))
        .limit(1);

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);

      const [newInvitation] = await db
        .insert(invitations)
        .values({
          organizationId,
          email: dto.email,
          role: dto.role,
          token,
          invitedBy,
          expiresAt,
        })
        .returning();

      return {
        invitation: newInvitation,
        emailPayload: {
          to: dto.email,
          organizationName: org.name,
          inviterName: inviter?.name ?? 'A team member',
          token,
          role: dto.role,
        },
      };
    });

    await this.emailQueue.add('send-invitation', emailPayload);

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(token: string, userId: string): Promise<void> {
    await this.tenantDb.withoutTenantContext(async (db) => {
      const [invitation] = await db
        .select({
          id: invitations.id,
          organizationId: invitations.organizationId,
          role: invitations.role,
        })
        .from(invitations)
        .where(
          and(
            eq(invitations.token, token),
            isNull(invitations.acceptedAt),
            gt(invitations.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!invitation) {
        throw new NotFoundException('Invitation not found or expired');
      }

      const [alreadyMember] = await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, invitation.organizationId),
            eq(organizationMembers.userId, userId),
          ),
        )
        .limit(1);

      if (alreadyMember) {
        throw new ConflictException('Already a member');
      }

      await db
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, invitation.id));

      await db.insert(organizationMembers).values({
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      });
    });
  }
}
