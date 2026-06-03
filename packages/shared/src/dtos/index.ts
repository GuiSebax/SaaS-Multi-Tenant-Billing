export interface PaginationDto {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

export interface PlanLimitErrorResponse {
  error: 'PLAN_LIMIT_REACHED';
  resource: string;
  limit: number;
  current: number;
  upgrade_url: string;
}
