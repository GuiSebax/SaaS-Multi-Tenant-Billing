export type Plan = 'free' | 'pro' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface OrganizationMember {
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface Task {
  id: string;
  projectId: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: string | null;
  createdBy: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSubscription {
  id: string;
  organizationId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  plan: Plan;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PlanLimitError extends ApiError {
  error: 'PLAN_LIMIT_REACHED';
  resource: string;
  limit: number;
  current: number;
  upgrade_url: string;
}
