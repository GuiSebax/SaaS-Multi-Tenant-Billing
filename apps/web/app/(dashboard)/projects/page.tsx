'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Plus, FolderKanban, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useProjects, useCreateProject } from '@/hooks/use-projects';
import { useOrganization } from '@/hooks/use-organization';
import { useSidebar } from '../sidebar-context';
import { StatusDot } from '@/components/status-dot';
import { SkeletonCard } from '@/components/skeleton-card';
import { EmptyState } from '@/components/empty-state';
import { Sheet } from '@/components/ui/sheet';
import type { Plan } from '@saas-platform/shared';

const PLAN_LIMITS: Record<Plan, number | null> = {
  free: 3,
  pro: null,
  enterprise: null,
};

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const inputClass =
  'w-full rounded-lg bg-[#0A0A0B] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors';

const gridVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, type: 'tween' } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

function projectColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return `hsl(${hash % 360}, 55%, 42%)`;
}

export default function ProjectsPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: projects = [], isLoading } = useProjects();
  const { currentOrg } = useOrganization();
  const { close: closeSidebar } = useSidebar();
  const createProject = useCreateProject();

  const plan = ((currentOrg as unknown as { plan?: Plan })?.plan ?? 'free') as Plan;
  const activeProjects = projects.filter((p) => p.status === 'active');
  const limit = PLAN_LIMITS[plan];
  const atLimit = limit !== null && activeProjects.length >= limit;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function handleOpen() {
    if (atLimit) return;
    closeSidebar();
    reset();
    setSheetOpen(true);
  }

  async function onSubmit(data: FormData) {
    try {
      await createProject.mutateAsync(data);
      setSheetOpen(false);
      toast.success('Project created');
    } catch {
      // Plan limit errors are handled by the axios interceptor
    }
  }

  return (
    <>
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Projects</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {activeProjects.length} active
              {limit !== null && (
                <span className="ml-1 text-zinc-600">/ {limit}</span>
              )}
            </p>
          </div>
          <div className="relative group">
            <button
              onClick={handleOpen}
              disabled={atLimit}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-white text-sm font-medium transition-colors duration-150"
            >
              <Plus size={14} />
              New Project
            </button>
            {atLimit && (
              <div
                className="absolute right-0 top-full mt-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 whitespace-nowrap z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ background: '#1A1A1D', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Upgrade to Pro to create more projects
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project and start organizing work for your team."
            action={
              <button
                onClick={handleOpen}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors duration-150"
              >
                <Plus size={14} />
                New Project
              </button>
            }
          />
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full"
            variants={gridVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence>
            {projects.map((project) => {
              const color = projectColor(project.name);
              return (
                <motion.div
                  key={project.id}
                  variants={cardVariants}
                  exit="exit"
                  layout
                >
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex flex-col rounded-xl p-6 transition-all duration-200 group cursor-pointer"
                    style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)';
                      (e.currentTarget as HTMLElement).style.background = '#141416';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                      (e.currentTarget as HTMLElement).style.background = '#111113';
                    }}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm"
                        style={{ background: color }}
                      >
                        {project.name[0].toUpperCase()}
                      </div>
                      <StatusDot status={project.status} />
                    </div>

                    {/* Card body */}
                    <h3 className="text-sm font-semibold text-white mb-1.5 truncate">{project.name}</h3>
                    {project.description ? (
                      <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed flex-1">{project.description}</p>
                    ) : (
                      <p className="text-sm text-zinc-700 italic flex-1">No description</p>
                    )}

                    {/* Card footer */}
                    <div
                      className="flex items-center justify-between pt-3 mt-4"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span className="text-xs text-zinc-600">
                        {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                      </span>
                      <ArrowRight
                        size={13}
                        className="text-zinc-700 group-hover:text-indigo-400 transition-colors duration-200"
                      />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="New Project">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name</label>
            <input
              {...register('name')}
              type="text"
              placeholder="Marketing Website"
              className={inputClass}
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Description <span className="text-zinc-600">(optional)</span>
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="What's this project about?"
              className={`${inputClass} resize-none`}
            />
          </div>
          <button
            type="submit"
            disabled={createProject.isPending}
            className="mt-2 w-full rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
          >
            {createProject.isPending ? 'Creating…' : 'Create Project'}
          </button>
        </form>
      </Sheet>
    </>
  );
}
