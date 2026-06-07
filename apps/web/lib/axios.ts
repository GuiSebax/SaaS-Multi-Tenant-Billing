import axios from 'axios';
import { toast } from 'sonner';
import { getAccessToken, clearTokens } from './auth';
import type { PlanLimitErrorResponse } from '@saas-platform/shared';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (typeof window === 'undefined') return Promise.reject(error);

    if (!axios.isAxiosError(error)) return Promise.reject(error);

    if (error.response?.status === 401) {
      clearTokens();
      window.location.href = '/auth/login';
      return Promise.reject(error);
    }

    if (error.response?.status === 403) {
      const data = error.response.data as PlanLimitErrorResponse;
      if (data?.error === 'PLAN_LIMIT_REACHED') {
        toast.error('Limite do plano atingido', {
          description: `Faça upgrade para aumentar o limite de ${data.resource}.`,
          action: {
            label: 'Upgrade',
            onClick: () => {
              window.location.href = data.upgrade_url;
            },
          },
        });
      }
    }

    return Promise.reject(error);
  },
);

export default api;
