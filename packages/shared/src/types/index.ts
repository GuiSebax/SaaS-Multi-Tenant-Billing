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
