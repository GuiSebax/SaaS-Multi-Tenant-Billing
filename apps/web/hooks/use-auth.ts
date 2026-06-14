'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { setUser } from '@/lib/auth';

export interface MeUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get<MeUser>('/auth/me');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await api.patch<MeUser>('/auth/me', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data);
      setUser({ name: data.name, email: data.email });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/change-password',
        data,
      );
      return res.data;
    },
  });
}
