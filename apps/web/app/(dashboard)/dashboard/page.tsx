'use client';

import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { FolderKanban, CheckCircle2, Clock, ListTodo, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useProjects } from '@/hooks/use-projects';
import { SkeletonCard, SkeletonLine } from '@/components/skeleton-card';
import { StatusDot } from '@/components/status-dot';
import { EmptyState } from '@/components/empty-state';
import api from '@/lib/axios';
import type { Task } from '@saas-platform/shared';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  loading?: boolean;
  index: number;
}

function StatCard({ label, value, icon: Icon, loading, index }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className="rounded-xl p-5 min-h-[100px] flex flex-col justify-between"
      style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{label}</span>
        <Icon size={20} className="text-zinc-700 flex-shrink-0" />
      </div>
      {loading ? (
        <SkeletonLine width="w-16" height="h-9" />
      ) : (
        <p className="text-4xl font-bold text-white font-mono">{value}</p>
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
    { label: 'Active Projects', value: activeProjects.length, icon: FolderKanban, loading: projectsLoading },
    { label: 'Total Tasks', value: allTasks.length, icon: ListTodo, loading: tasksLoading },
    { label: 'In Progress', value: inProgress, icon: Clock, loading: tasksLoading },
    { label: 'Completed', value: done, icon: CheckCircle2, loading: tasksLoading },
  ];

  return (
    <div className="space-y-8 w-full">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <StatCard key={stat.label} index={i} {...stat} />
        ))}
      </div>

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
          <div className="space-y-1">
            {recentProjects.map((project, i) => {
              const projectTasks = taskQueries[i]?.data ?? [];
              const taskCount = projectTasks.length;
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                >
                  <Link
                    href={`/projects/${project.id}`}
                    className="group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-150 hover:bg-white/[0.03]"
                    style={{
                      background: '#111113',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold text-indigo-400 flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.1)' }}
                    >
                      {project.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{project.name}</p>
                      {project.description && (
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{project.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="text-xs text-zinc-600 font-mono">
                        {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                      </span>
                      <StatusDot status={project.status} showLabel={false} />
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0"
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
