'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import type { OrgMember } from '@/lib/types';

export function useOrgMembers(orgId: string) {
  return useQuery({
    queryKey: ['org-members', orgId],
    queryFn: async () => {
      const res = await api.get<OrgMember[]>(`/organizations/${orgId}/members`);
      return res.data;
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
