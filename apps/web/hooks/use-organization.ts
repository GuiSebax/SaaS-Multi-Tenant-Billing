'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import type { OrgWithRole } from '@/lib/types';

const ORG_KEY = 'current_organization_id';

export function useOrganization() {
  const queryClient = useQueryClient();

  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ORG_KEY);
  });

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await api.get<OrgWithRole[]>('/organizations/mine');
      return res.data;
    },
  });

  // Auto-select first org when none is stored
  useEffect(() => {
    if (!currentOrgId && organizations.length > 0) {
      const firstId = organizations[0].id;
      localStorage.setItem(ORG_KEY, firstId);
      setCurrentOrgId(firstId);
    }
  }, [currentOrgId, organizations]);

  const currentOrg = organizations.find((o) => o.id === currentOrgId) ?? organizations[0] ?? null;

  const switchOrg = useCallback(
    (orgId: string) => {
      localStorage.setItem(ORG_KEY, orgId);
      setCurrentOrgId(orgId);
      queryClient.clear();
    },
    [queryClient],
  );

  return { currentOrg, currentOrgId, organizations, isLoading, switchOrg };
}
