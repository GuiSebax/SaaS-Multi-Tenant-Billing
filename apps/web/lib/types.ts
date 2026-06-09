import type { Organization } from '@saas-platform/shared';

export type OrgWithRole = Organization & { role: 'owner' | 'admin' | 'member' };
