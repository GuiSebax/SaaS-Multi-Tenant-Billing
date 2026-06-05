import { pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'member']);
export const invitationRoleEnum = pgEnum('invitation_role', ['admin', 'member']);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: memberRoleEnum('role').notNull(),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.userId] })],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    email: text('email').notNull(),
    role: invitationRoleEnum('role').notNull(),
    token: text('token').notNull().unique(),
    invitedBy: uuid('invited_by').references(() => users.id),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
  },
  (table) => [unique('invitations_org_email_unique').on(table.organizationId, table.email)],
);
