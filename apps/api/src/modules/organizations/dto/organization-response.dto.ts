export class OrganizationResponseDto {
  declare id: string;
  declare name: string;
  declare slug: string;
  declare createdAt: Date;
  declare plan: 'free' | 'pro' | 'enterprise';
  declare status: 'active' | 'trialing' | 'past_due' | 'canceled';
  declare role: 'owner' | 'admin' | 'member';
}
