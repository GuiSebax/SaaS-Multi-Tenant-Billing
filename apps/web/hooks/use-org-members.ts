'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import type { OrgInvitation, OrgMember } from '@/lib/types';

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

export function useOrgInvitations(orgId: string, enabled = true) {
  return useQuery({
    queryKey: ['org-invitations', orgId],
    queryFn: async () => {
      const res = await api.get<OrgInvitation[]>(`/organizations/${orgId}/invitations`);
      return res.data;
    },
    enabled: !!orgId && enabled,
    staleTime: 60_000,
  });
}

export function useInviteMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; role: 'admin' | 'member' }) => {
      const res = await api.post<OrgInvitation>(`/organizations/${orgId}/invitations`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-invitations', orgId] });
    },
  });
}

export function useUpdateMemberRole(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'member' }) => {
      const res = await api.patch<{ userId: string; role: string }>(
        `/organizations/${orgId}/members/${userId}`,
        { role },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] });
    },
  });
}

export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/organizations/${orgId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] });
    },
  });
}
