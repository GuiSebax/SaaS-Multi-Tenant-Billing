'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CreditCard, Sparkles, Check, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { PlanBadge } from '@/components/plan-badge';
import { SkeletonCard } from '@/components/skeleton-card';
import type { BillingSubscription } from '@saas-platform/shared';

const PRO_FEATURES = [
  'Up to 25 team members',
  'Unlimited projects',
  'Priority support',
  'Advanced analytics',
  'Custom integrations',
];

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border border-green-500/20',
  trialing: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  past_due: 'bg-red-500/10 text-red-400 border border-red-500/20',
  canceled: 'bg-zinc-800 text-zinc-400 border border-white/[0.06]',
};

export default function BillingSettingsPage() {
  const router = useRouter();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: async () => {
      const res = await api.get<BillingSubscription>('/billing/subscription');
      return res.data;
    },
  });

  const checkout = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ url: string }>('/billing/create-checkout-session');
      return res.data;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: () => toast.error('Failed to start checkout. Please try again.'),
  });

  const portal = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ url: string }>('/billing/create-portal-session');
      return res.data;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: () => toast.error('Failed to open billing portal. Please try again.'),
  });

  const plan = subscription?.plan ?? 'free';
  const isPaid = plan === 'pro' || plan === 'enterprise';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-base font-semibold text-white">Billing</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Manage your plan and subscription</p>
      </div>

      {/* Current Plan Card */}
      {isLoading ? (
        <SkeletonCard />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl p-5"
          style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={14} className="text-zinc-400" />
                <span className="text-xs text-zinc-400 font-medium">Current Plan</span>
              </div>
              <div className="flex items-center gap-2">
                <PlanBadge plan={plan} />
                {subscription?.status && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${STATUS_STYLES[subscription.status] ?? STATUS_STYLES.canceled}`}
                  >
                    {subscription.status.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
            {subscription?.trialEndsAt && subscription.status === 'trialing' && (
              <div className="text-right">
                <p className="text-[10px] text-zinc-500">Trial ends</p>
                <p className="text-xs font-medium text-white">
                  {new Date(subscription.trialEndsAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {isPaid ? (
            <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-zinc-500">
                Manage payment method, invoices, and cancel subscription.
              </p>
              <button
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] text-xs text-zinc-300 hover:text-white hover:bg-white/[0.04] disabled:opacity-60 transition-colors duration-150 flex-shrink-0 ml-4"
              >
                {portal.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ExternalLink size={12} />
                )}
                Manage Subscription
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              You are on the free plan. Upgrade to Pro to unlock more features.
            </p>
          )}
        </motion.div>
      )}

      {/* Upgrade Card — shown only on free plan */}
      {!isLoading && !isPaid && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="rounded-xl p-5"
          style={{
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.15)' }}
            >
              <Sparkles size={16} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-0.5">Upgrade to Pro</h3>
              <p className="text-xs text-zinc-400">
                Get unlimited projects, more team members and priority support.
              </p>
            </div>
          </div>

          <ul className="space-y-2 mb-5">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-xs text-zinc-300">
                <Check size={12} className="text-indigo-400 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          <button
            onClick={() => checkout.mutate()}
            disabled={checkout.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-medium transition-colors duration-150"
          >
            {checkout.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Redirecting…
              </>
            ) : (
              'Upgrade to Pro — starts at $29/mo'
            )}
          </button>
          <p className="text-center text-[10px] text-zinc-600 mt-2">14-day free trial · Cancel anytime</p>
        </motion.div>
      )}
    </div>
  );
}
