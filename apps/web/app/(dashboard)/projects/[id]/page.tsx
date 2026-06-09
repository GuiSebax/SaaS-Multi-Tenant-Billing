'use client';

import { useState } from 'react';
import { use } from 'react';
import { motion } from 'framer-motion';
import { Plus, FolderKanban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '@/hooks/use-projects';
import { useTasks, useCreateTask } from '@/hooks/use-tasks';
import { StatusDot } from '@/components/status-dot';
import { SkeletonCard } from '@/components/skeleton-card';
import { EmptyState } from '@/components/empty-state';
import type { Task, TaskStatus } from '@saas-platform/shared';

const COLUMNS: { label: string; status: TaskStatus }[] = [
  { label: 'Todo', status: 'todo' },
  { label: 'In Progress', status: 'in_progress' },
  { label: 'Done', status: 'done' },
];

const STATUS_COLORS: Record<string, string> = {
  todo: 'rgba(96,165,250,0.1)',
  in_progress: 'rgba(234,179,8,0.1)',
  done: 'rgba(34,197,94,0.1)',
};

const inputClass =
  'w-full rounded-lg bg-[#0A0A0B] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors';

function TaskCard({ task, index }: { task: Task; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.18 }}
      className="rounded-lg p-3"
      style={{ background: '#0A0A0B', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <p className="text-sm text-white leading-snug mb-2">{task.title}</p>
      {task.description && (
        <p className="text-xs text-zinc-500 leading-relaxed mb-2 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between">
        <StatusDot status={task.status} showLabel={false} />
        {task.assigneeId ? (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-zinc-400"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            title={task.assigneeId}
          >
            U
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function NewTaskInline({
  status,
  projectId,
  onDone,
}: {
  status: TaskStatus;
  projectId: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState('');
  const createTask = useCreateTask(projectId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await createTask.mutateAsync({ title: title.trim(), status });
      setTitle('');
      onDone();
    } catch {
      toast.error('Failed to create task');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title…"
        className={inputClass}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={createTask.isPending || !title.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-xs font-medium transition-colors"
        >
          {createTask.isPending ? <Loader2 size={10} className="animate-spin" /> : null}
          Add
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-zinc-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

interface KanbanColumnProps {
  label: string;
  status: TaskStatus;
  tasks: Task[];
  projectId: string;
  isLoading: boolean;
}

function KanbanColumn({ label, status, tasks, projectId, isLoading }: KanbanColumnProps) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col min-w-[280px] w-full max-w-sm">
      {/* Column Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-xl"
        style={{
          background: STATUS_COLORS[status] ?? 'rgba(255,255,255,0.03)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2">
          <StatusDot status={status} showLabel={false} />
          <span className="text-xs font-semibold text-white">{label}</span>
          <span className="text-[10px] text-zinc-500 font-mono">{tasks.length}</span>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="text-zinc-500 hover:text-white transition-colors duration-150"
          aria-label={`Add task to ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Column Body */}
      <div
        className="flex-1 flex flex-col gap-2 p-3 rounded-b-xl min-h-[200px]"
        style={{
          background: 'rgba(255,255,255,0.01)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {tasks.map((task, i) => (
              <TaskCard key={task.id} task={task} index={i} />
            ))}
            {tasks.length === 0 && !adding && (
              <p className="text-xs text-zinc-700 text-center mt-4">No tasks</p>
            )}
          </>
        )}

        {adding && (
          <NewTaskInline status={status} projectId={projectId} onDone={() => setAdding(false)} />
        )}

        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-colors duration-150 mt-auto"
          >
            <Plus size={12} />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(projectId);

  if (projectLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="min-w-[280px]">
              <SkeletonCard />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Project not found"
        description="This project may have been deleted or you don't have access to it."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-base font-semibold text-white">{project.name}</h1>
          <StatusDot status={project.status} />
        </div>
        {project.description && (
          <p className="text-xs text-zinc-500">{project.description}</p>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(({ label, status }) => (
          <KanbanColumn
            key={status}
            label={label}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
            projectId={projectId}
            isLoading={tasksLoading}
          />
        ))}
      </div>
    </div>
  );
}
