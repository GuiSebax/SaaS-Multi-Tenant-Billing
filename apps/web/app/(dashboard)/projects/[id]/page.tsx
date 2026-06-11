'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Plus, FolderKanban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '@/hooks/use-projects';
import { useTasks, useCreateTask, useUpdateTask, useMoveTask } from '@/hooks/use-tasks';
import { useOrganization } from '@/hooks/use-organization';
import { StatusDot } from '@/components/status-dot';
import { TaskDetailDialog } from '@/components/task-detail-dialog';
import { SkeletonCard } from '@/components/skeleton-card';
import { EmptyState } from '@/components/empty-state';
import type { Task, TaskStatus } from '@saas-platform/shared';

const COLUMNS: { label: string; status: TaskStatus }[] = [
  { label: 'Todo', status: 'todo' },
  { label: 'In Progress', status: 'in_progress' },
  { label: 'Done', status: 'done' },
];

const COLUMN_STATUSES = new Set<string>(['todo', 'in_progress', 'done']);

const inputClass =
  'w-full rounded-lg bg-[#0A0A0B] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors';

// ─── Shared card content ─────────────────────────────────────────────────────

function TaskCardContent({ task }: { task: Task }) {
  return (
    <>
      <p className="text-sm text-white leading-snug mb-2">{task.title}</p>
      {task.description && (
        <p className="text-xs text-zinc-500 leading-relaxed mb-2 line-clamp-2">
          {task.description}
        </p>
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
    </>
  );
}

// ─── Sortable task card ──────────────────────────────────────────────────────

function SortableTaskCard({ task, index, onClick }: { task: Task; index: number; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.18 }}
        className="rounded-lg px-4 py-3 border border-white/[0.08] hover:border-white/[0.14] transition-colors duration-200"
        style={{ background: '#1C1C1F' }}
      >
        <TaskCardContent task={task} />
      </motion.div>
    </div>
  );
}

// ─── Drag overlay card ───────────────────────────────────────────────────────

function DragOverlayCard({ task }: { task: Task }) {
  return (
    <div
      className="rounded-lg px-4 py-3 w-[280px]"
      style={{
        background: '#1C1C1F',
        border: '1px solid rgba(99,102,241,0.3)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        transform: 'rotate(2deg)',
        cursor: 'grabbing',
      }}
    >
      <TaskCardContent task={task} />
    </div>
  );
}

// ─── Inline new task form ────────────────────────────────────────────────────

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

// ─── Droppable column ────────────────────────────────────────────────────────

interface DroppableColumnProps {
  label: string;
  status: TaskStatus;
  tasks: Task[];
  projectId: string;
  isLoading: boolean;
  isHighlighted: boolean;
  onTaskClick: (taskId: string) => void;
}

function DroppableColumn({
  label,
  status,
  tasks,
  projectId,
  isLoading,
  isHighlighted,
  onTaskClick,
}: DroppableColumnProps) {
  const [adding, setAdding] = useState(false);
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div
      className="flex flex-col flex-1 min-w-[280px] rounded-lg transition-colors duration-150"
      style={{
        background: '#111113',
        border: isHighlighted
          ? '1px solid rgba(99,102,241,0.3)'
          : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <StatusDot status={status} showLabel={false} />
          <span className="text-xs font-semibold text-white">{label}</span>
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded text-[10px] font-mono font-medium text-zinc-500"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="text-zinc-600 hover:text-zinc-300 transition-colors duration-150"
          aria-label={`Add task to ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Body — droppable target + sortable context */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex-1 flex flex-col gap-2 p-3 min-h-[200px]">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              {tasks.map((task, i) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  index={i}
                  onClick={() => onTaskClick(task.id)}
                />
              ))}
              {tasks.length === 0 && !adding && (
                <p className="text-xs text-zinc-700 text-center mt-4">No tasks</p>
              )}
            </>
          )}

          {adding && (
            <NewTaskInline
              status={status}
              projectId={projectId}
              onDone={() => setAdding(false)}
            />
          )}
        </div>
      </SortableContext>

      {/* Footer */}
      {!adding && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] border border-dashed border-white/[0.08] hover:border-white/[0.14] transition-all duration-150"
          >
            <Plus size={12} />
            New Task
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProjectBoardPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(projectId);
  const { currentOrg } = useOrganization();
  const updateTask = useUpdateTask(projectId);
  const moveTask = useMoveTask(projectId);

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overColumnId, setOverColumnId] = useState<TaskStatus | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  function resolveColumn(id: UniqueIdentifier): TaskStatus | null {
    const task = tasks.find((t) => t.id === id);
    if (task) return task.status;
    if (COLUMN_STATUSES.has(id as string)) return id as TaskStatus;
    return null;
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id);
  }

  function onDragOver({ over }: DragOverEvent) {
    setOverColumnId(over ? resolveColumn(over.id) : null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOverColumnId(null);

    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const targetColumn = resolveColumn(over.id);
    if (!targetColumn) return;

    // Cross-column: update status only
    if (task.status !== targetColumn) {
      updateTask.mutate({ taskId, status: targetColumn });
      return;
    }

    // Same column, dropped on another task: reorder by position
    if (active.id !== over.id && !COLUMN_STATUSES.has(over.id as string)) {
      const columnTasks = tasks
        .filter((t) => t.status === task.status)
        .sort((a, b) => a.position - b.position);

      const activeIndex = columnTasks.findIndex((t) => t.id === taskId);
      const overIndex = columnTasks.findIndex((t) => t.id === over.id);

      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return;

      const newOrder = arrayMove(columnTasks, activeIndex, overIndex);
      const prevPos = newOrder[overIndex - 1]?.position;
      const nextPos = newOrder[overIndex + 1]?.position;

      let newPosition: number;
      if (prevPos === undefined) {
        newPosition = Math.max(0, (nextPos ?? 2000) - 1000);
      } else if (nextPos === undefined) {
        newPosition = prevPos + 1000;
      } else {
        newPosition = (prevPos + nextPos) / 2;
      }

      moveTask.mutate({ taskId, position: newPosition });
    }
  }

  if (projectLoading) {
    return (
      <div className="space-y-4">
        <div
          className="h-6 w-48 rounded animate-pulse"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
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
      {/* Project header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-base font-semibold text-white">{project.name}</h1>
          <StatusDot status={project.status} />
        </div>
        {project.description && (
          <p className="text-xs text-zinc-500">{project.description}</p>
        )}
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(({ label, status }) => (
            <DroppableColumn
              key={status}
              label={label}
              status={status}
              tasks={tasks
                .filter((t) => t.status === status)
                .sort((a, b) => a.position - b.position)}
              projectId={projectId}
              isLoading={tasksLoading}
              isHighlighted={overColumnId === status}
              onTaskClick={(id) => setSelectedTaskId(id)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <DragOverlayCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {selectedTaskId && currentOrg && (
        <TaskDetailDialog
          taskId={selectedTaskId}
          projectId={projectId}
          orgId={currentOrg.id}
          open={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
