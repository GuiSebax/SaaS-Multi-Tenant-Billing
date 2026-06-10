import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth';
import type { PlanLimitErrorResponse } from '@saas-platform/shared';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
});

// Queue pattern: múltiplas requests que chegam com 401 enquanto o refresh está em andamento
// ficam suspensas aqui e são resolvidas/rejeitadas juntas ao final do refresh.
let isRefreshing = false;
let pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function flushPending(newToken: string) {
  pendingRequests.forEach(({ resolve }) => resolve(newToken));
  pendingRequests = [];
}

function rejectPending(err: unknown) {
  pendingRequests.forEach(({ reject }) => reject(err));
  pendingRequests = [];
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof window !== 'undefined') {
    const orgId = localStorage.getItem('current_organization_id');
    if (orgId) {
      config.headers['X-Organization-Id'] = orgId;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (typeof window === 'undefined') return Promise.reject(error);
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401) {
      // A própria chamada de refresh falhou — encerrar sessão sem tentar novamente
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest._retry) {
        clearTokens();
        window.location.href = '/auth/login';
        return Promise.reject(error);
      }

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        window.location.href = '/auth/login';
        return Promise.reject(error);
      }

      // Já há um refresh em andamento — enfileirar e aguardar
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (newToken) => {
              originalRequest._retry = true;
              originalRequest.headers = {
                ...originalRequest.headers,
                Authorization: `Bearer ${newToken}`,
              };
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Usa axios puro (não a instância `api`) para não entrar no interceptor novamente
        const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken },
        );

        setTokens(data.accessToken, data.refreshToken);
        isRefreshing = false;
        flushPending(data.accessToken);

        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${data.accessToken}`,
        };
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        rejectPending(refreshError);
        clearTokens();
        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      }
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
