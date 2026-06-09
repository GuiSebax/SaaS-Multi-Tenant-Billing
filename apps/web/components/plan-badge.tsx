import { cn } from '@/lib/utils';
import type { Plan } from '@saas-platform/shared';

const styles: Record<Plan, string> = {
  free: 'bg-zinc-800 text-zinc-400 border border-white/[0.06]',
  pro: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  enterprise: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
};

export function PlanBadge({ plan, className }: { plan: Plan; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium font-mono uppercase tracking-wide',
        styles[plan],
        className,
      )}
    >
      {plan}
    </span>
  );
}
