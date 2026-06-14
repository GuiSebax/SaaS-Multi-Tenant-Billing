import { cn } from '@/lib/utils';
import type { Plan } from '@saas-platform/shared';

const styles: Record<Plan, string> = {
  free: 'bg-zinc-800/80 text-zinc-400 border border-white/[0.08]',
  pro: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25',
  enterprise: 'bg-violet-500/15 text-violet-300 border border-violet-500/25',
};

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export function PlanBadge({ plan, className }: { plan: Plan; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide',
        styles[plan],
        className,
      )}
    >
      {plan === 'pro' && <span className="w-1 h-1 rounded-full bg-indigo-400 inline-block" />}
      {plan === 'enterprise' && <span className="w-1 h-1 rounded-full bg-violet-400 inline-block" />}
      {PLAN_LABELS[plan]}
    </span>
  );
}
