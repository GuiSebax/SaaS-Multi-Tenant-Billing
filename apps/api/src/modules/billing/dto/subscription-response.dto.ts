export class SubscriptionResponseDto {
  organizationId!: string;
  plan!: 'free' | 'pro' | 'enterprise';
  status!: 'active' | 'trialing' | 'past_due' | 'canceled';
  trialEndsAt!: Date | null;
  currentPeriodEnd!: Date | null;
  stripeCustomerId!: string;
}
