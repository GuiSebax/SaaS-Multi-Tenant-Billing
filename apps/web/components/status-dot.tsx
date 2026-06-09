import { cn } from '@/lib/utils';
import type { TaskStatus } from '@saas-platform/shared';

type ProjectStatus = 'active' | 'archived';

const dotStyles: Record<ProjectStatus | TaskStatus, string> = {
  active: 'bg-green-500',
  archived: 'bg-zinc-600',
  backlog: 'bg-zinc-500',
  todo: 'bg-blue-400',
  in_progress: 'bg-yellow-500',
  done: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const labels: Record<ProjectStatus | TaskStatus, string> = {
  active: 'Active',
  archived: 'Archived',
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

interface StatusDotProps {
  status: ProjectStatus | TaskStatus;
  showLabel?: boolean;
  className?: string;
}

export function StatusDot({ status, showLabel = true, className }: StatusDotProps) {
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotStyles[status])} />
      {showLabel && <span className="text-xs text-zinc-400">{labels[status]}</span>}
    </span>
  );
}
