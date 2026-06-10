'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CreditCard, Sparkles, Check, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { PlanBadge } from '@/components/plan-badge';
import { SkeletonCard } from '@/components/skeleton-card';
import { useProjects } from '@/hooks/use-projects';
import { PLAN_LIMITS } from '@saas-platform/shared';
import type { BillingSubscription, Plan } from '@saas-platform/shared';

const PRO_FEATURES = [
  'Up to 25 team members',
  'Unlimited projects',
  'Priority support',
  'Advanced analytics',
  'Custom integrations',
];

const FREE_FEATURES = [
  'Up to 3 projects',
  'Up to 3 team members',
  'Community support',
];

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border border-green-500/20',
  trialing: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  past_due: 'bg-red-500/10 text-red-400 border border-red-500/20',
  canceled: 'bg-zinc-800 text-zinc-400 border border-white/[0.06]',
};

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const isUnlimited = limit === null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-xs font-mono text-zinc-500">
          {current}
          {isUnlimited ? ' / ∞' : ` / ${limit}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {!isUnlimited && (
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: pct >= 90 ? '#f87171' : '#6366f1',
            }}
          />
        )}
        {isUnlimited && (
          <div className="h-full w-full rounded-full" style={{ background: 'rgba(99,102,241,0.3)' }} />
        )}
      </div>
    </div>
  );
}

export default function BillingSettingsPage() {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: async () => {
      const res = await api.get<BillingSubscription>('/billing/subscription');
      return res.data;
    },
  });

  const { data: projects = [] } = useProjects();

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

  const plan = (subscription?.plan ?? 'free') as Plan;
  const isPaid = plan === 'pro' || plan === 'enterprise';
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const projectLimit = PLAN_LIMITS[plan].projects;
  const memberLimit = PLAN_LIMITS[plan].members;

  return (
    <div className="w-full space-y-6">
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
          className="rounded-xl p-8"
          style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
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

          {/* Plan features */}
          <ul className="space-y-2 mb-5">
            {(isPaid ? PRO_FEATURES : FREE_FEATURES).map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-xs text-zinc-400">
                <Check size={12} className={isPaid ? 'text-indigo-400' : 'text-zinc-600'} />
                {feature}
              </li>
            ))}
          </ul>

          {isPaid ? (
            <div
              className="flex items-center justify-between pt-5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
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
            <div className="pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-zinc-500 mb-3">
                You are on the free plan. Upgrade to Pro to unlock more capacity and features.
              </p>
              <button
                onClick={() => checkout.mutate()}
                disabled={checkout.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-xs font-medium transition-colors duration-150"
              >
                {checkout.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Upgrade to Pro
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Usage */}
      {!isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="rounded-xl p-6"
          style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Usage</h2>
          <div className="space-y-4">
            <UsageBar
              label="Projects"
              current={activeProjects}
              limit={projectLimit === Infinity ? null : projectLimit}
            />
            <UsageBar
              label="Team Members"
              current={1}
              limit={memberLimit === Infinity ? null : memberLimit}
            />
          </div>
        </motion.div>
      )}

      {/* Upgrade Card — shown only on free plan */}
      {!isLoading && !isPaid && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="rounded-xl p-8"
          style={{
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <div className="flex items-start gap-3 mb-5">
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

          <ul className="space-y-2 mb-6">
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
