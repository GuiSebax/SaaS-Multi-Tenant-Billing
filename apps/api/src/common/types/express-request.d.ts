declare namespace Express {
  interface Request {
    organizationId?: string;
    user?: { userId: string };
    member?: {
      organizationId: string;
      userId: string;
      role: 'owner' | 'admin' | 'member';
    };
  }
}
