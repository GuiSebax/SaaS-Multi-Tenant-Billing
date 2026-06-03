export const PLAN_LIMITS = {
  free: {
    members: 3,
    projects: 3,
  },
  pro: {
    members: 25,
    projects: Infinity,
  },
  enterprise: {
    members: Infinity,
    projects: Infinity,
  },
} as const;

export const JWT_ACCESS_TOKEN_EXPIRY = '15m';
export const JWT_REFRESH_TOKEN_EXPIRY = '7d';
