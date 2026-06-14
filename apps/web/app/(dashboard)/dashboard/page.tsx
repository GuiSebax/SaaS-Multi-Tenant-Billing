'use client';

import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { FolderKanban, CheckCircle2, Clock, ListTodo, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useProjects } from '@/hooks/use-projects';
import { SkeletonCard, SkeletonLine } from '@/components/skeleton-card';
import { StatusDot } from '@/components/status-dot';
import { EmptyState } from '@/components/empty-state';
import { NumberTicker } from '@/components/ui/number-ticker';
import api from '@/lib/axios';
import type { Task } from '@saas-platform/shared';

type CardColor = 'indigo' | 'emerald' | 'amber' | 'sky';

const CARD_COLORS: Record<CardColor, { iconClass: string; bg: string }> = {
  indigo: { iconClass: 'text-indigo-400', bg: 'rgba(99,102,241,0.12)' },
  emerald: { iconClass: 'text-emerald-400', bg: 'rgba(52,211,153,0.1)' },
  amber: { iconClass: 'text-amber-400', bg: 'rgba(251,191,36,0.1)' },
  sky: { iconClass: 'text-sky-400', bg: 'rgba(56,189,248,0.1)' },
};

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  loading?: boolean;
  index: number;
  color: CardColor;
}

function StatCard({ label, value, icon: Icon, loading, index, color }: StatCardProps) {
  const { iconClass, bg } = CARD_COLORS[color];
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 12, scale: 0.97 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, type: 'tween' } } } as import('framer-motion').Variants}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="rounded-xl p-5 flex flex-col gap-4 cursor-default"
      style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: bg }}
        >
          <Icon size={18} className={iconClass} />
        </div>
        <span className="text-xs text-zinc-500 font-medium text-right">{label}</span>
      </div>
      {loading ? (
        <SkeletonLine width="w-16" height="h-8" />
      ) : (
        <p className="text-3xl font-bold text-white font-mono">
          <NumberTicker value={typeof value === 'number' ? value : 0} delay={index * 0.06} />
        </p>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const { data: projects, isLoading: projectsLoading } = useProjects();

  const taskQueries = useQueries({
    queries: (projects ?? []).map((p) => ({
      queryKey: ['tasks', p.id],
      queryFn: async () => {
        const res = await api.get<Task[]>(`/projects/${p.id}/tasks`);
        return res.data;
      },
    })),
  });

  const tasksLoading = taskQueries.some((q) => q.isLoading);
  const allTasks = taskQueries.flatMap((q) => q.data ?? []);

  const activeProjects = projects?.filter((p) => p.status === 'active') ?? [];
  const inProgress = allTasks.filter((t) => t.status === 'in_progress').length;
  const done = allTasks.filter((t) => t.status === 'done').length;

  const recentProjects = activeProjects.slice(0, 5);

  const stats = [
    { label: 'Active Projects', value: activeProjects.length, icon: FolderKanban, loading: projectsLoading, color: 'indigo' as CardColor },
    { label: 'Total Tasks', value: allTasks.length, icon: ListTodo, loading: tasksLoading, color: 'sky' as CardColor },
    { label: 'In Progress', value: inProgress, icon: Clock, loading: tasksLoading, color: 'amber' as CardColor },
    { label: 'Completed', value: done, icon: CheckCircle2, loading: tasksLoading, color: 'emerald' as CardColor },
  ];

  return (
    <div className="space-y-8 w-full">
      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
      >
        {stats.map((stat, i) => (
          <StatCard key={stat.label} index={i} {...stat} />
        ))}
      </motion.div>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Recent Projects</h2>
          <Link
            href="/projects"
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-indigo-400 transition-colors duration-150"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {projectsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : recentProjects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to start tracking work."
            action={
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors duration-150"
              >
                Create project
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {recentProjects.map((project, i) => {
              const projectTasks = taskQueries[i]?.data ?? [];
              const taskCount = projectTasks.length;
              const doneTasks = projectTasks.filter((t) => t.status === 'done').length;
              const pct = taskCount > 0 ? Math.round((doneTasks / taskCount) * 100) : 0;
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                >
                  <Link
                    href={`/projects/${project.id}`}
                    className="group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer"
                    style={{
                      background: '#111113',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold text-indigo-400 flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.1)' }}
                    >
                      {project.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{project.name}</p>
                      {taskCount > 0 ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', maxWidth: 80 }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : '#6366f1' }}
                            />
                          </div>
                          <span className="text-[10px] text-zinc-600 font-mono">{doneTasks}/{taskCount}</span>
                        </div>
                      ) : (
                        project.description && (
                          <p className="text-xs text-zinc-500 truncate mt-0.5">{project.description}</p>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-zinc-600 font-mono">
                        {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                      </span>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-zinc-700 group-hover:text-zinc-400 transition-colors duration-150 flex-shrink-0"
                    />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
