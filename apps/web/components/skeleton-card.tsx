import { cn } from '@/lib/utils';

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-xl p-5 animate-pulse', className)}
      style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="h-3 w-3/4 rounded-md mb-3" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="h-2 w-1/2 rounded-md mb-4" style={{ background: 'rgba(255,255,255,0.04)' }} />
      <div className="flex items-center gap-2">
        <div className="h-2 w-16 rounded-md" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="h-2 w-10 rounded-md" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
    </div>
  );
}

export function SkeletonLine({ width = 'w-full', height = 'h-2' }: { width?: string; height?: string }) {
  return (
    <div
      className={cn('rounded-md animate-pulse', width, height)}
      style={{ background: 'rgba(255,255,255,0.06)' }}
    />
  );
}
