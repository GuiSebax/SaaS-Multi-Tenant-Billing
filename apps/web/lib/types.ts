import type { Organization, Task } from '@saas-platform/shared';

export type OrgWithRole = Organization & { role: 'owner' | 'admin' | 'member' };

export interface TaskDetail extends Task {
  assignee: { id: string; name: string; email: string } | null;
}

export interface CommentWithAuthor {
  id: string;
  content: string;
  taskId: string;
  organizationId: string;
  userId: string;
  authorName: string | null;
  createdAt: string;
}

export interface OrgMember {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  name: string;
  email: string;
}
