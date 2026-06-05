import { relations } from 'drizzle-orm';
import { refreshTokens } from './auth';
import { billingSubscriptions } from './billing';
import { invitations, organizationMembers, organizations } from './organizations';
import { projects } from './projects';
import { taskComments, tasks } from './tasks';
import { users } from './users';

export const usersRelations = relations(users, ({ many }) => ({
  organizationMembers: many(organizationMembers),
  createdProjects: many(projects),
  assignedTasks: many(tasks, { relationName: 'taskAssignee' }),
  createdTasks: many(tasks, { relationName: 'taskCreatedBy' }),
  taskComments: many(taskComments),
  refreshTokens: many(refreshTokens),
  sentInvitations: many(invitations),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  members: many(organizationMembers),
  subscription: one(billingSubscriptions, {
    fields: [organizations.id],
    references: [billingSubscriptions.organizationId],
  }),
  projects: many(projects),
  tasks: many(tasks),
  taskComments: many(taskComments),
  invitations: many(invitations),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const billingSubscriptionsRelations = relations(billingSubscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [billingSubscriptions.organizationId],
    references: [organizations.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  organization: one(organizations, {
    fields: [tasks.organizationId],
    references: [organizations.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: 'taskAssignee',
  }),
  createdBy: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: 'taskCreatedBy',
  }),
  comments: many(taskComments),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  organization: one(organizations, {
    fields: [taskComments.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [taskComments.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));
