declare namespace Express {
  interface Request {
    requestId?: string;
    organizationId?: string;
    user?: { userId: string };
    member?: {
      organizationId: string;
      userId: string;
      role: 'owner' | 'admin' | 'member';
    };
  }
}
