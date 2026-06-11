'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronDown, Trash2, Send, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useTask,
  useUpdateTask,
  useAssignTask,
  useTaskComments,
  useCreateComment,
  useDeleteComment,
  useDeleteTask,
} from '@/hooks/use-tasks';
import { useOrgMembers } from '@/hooks/use-org-members';
import { StatusDot } from '@/components/status-dot';
import { getUser } from '@/lib/auth';
import type { TaskStatus } from '@saas-platform/shared';
import type { OrgMember } from '@/lib/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const inputClass =
  'w-full rounded-lg bg-[#0A0A0B] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors resize-none';

// ─── Status dropdown ─────────────────────────────────────────────────────────

function StatusDropdown({
  value,
  onChange,
}: {
  value: TaskStatus;
  onChange: (s: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const current = STATUS_OPTIONS.find((o) => o.value === value)!;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <StatusDot status={value} showLabel={false} />
        <span className="text-zinc-300">{current.label}</span>
        <ChevronDown size={10} className="text-zinc-500" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-36 rounded-lg overflow-hidden z-10 py-1"
          style={{ background: '#1A1A1D', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.05] transition-colors"
            >
              <StatusDot status={opt.value} showLabel={false} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Assignee dropdown ───────────────────────────────────────────────────────

function AssigneeDropdown({
  assigneeId,
  members,
  onChange,
}: {
  assigneeId: string | null;
  members: OrgMember[];
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const assigned = members.find((m) => m.userId === assigneeId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg w-full transition-colors hover:bg-white/[0.04] text-left"
        style={{ border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {assigned ? (
          <>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-indigo-300 flex-shrink-0"
              style={{ background: 'rgba(55,48,163,0.5)' }}
            >
              {assigned.name[0]?.toUpperCase()}
            </div>
            <span className="text-sm text-white truncate flex-1">{assigned.name}</span>
          </>
        ) : (
          <>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <User size={12} className="text-zinc-500" />
            </div>
            <span className="text-sm text-zinc-500 flex-1">Unassigned</span>
          </>
        )}
        <ChevronDown size={12} className="text-zinc-600 flex-shrink-0" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 w-full rounded-lg overflow-hidden z-10 py-1"
          style={{ background: '#1A1A1D', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-white/[0.05] transition-colors"
          >
            <User size={12} className="text-zinc-600" />
            Unassigned
          </button>
          {members.map((m) => (
            <button
              key={m.userId}
              onClick={() => { onChange(m.userId); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.05] transition-colors"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-indigo-300 flex-shrink-0"
                style={{ background: 'rgba(55,48,163,0.5)' }}
              >
                {m.name[0]?.toUpperCase()}
              </div>
              <span className="truncate">{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main dialog ─────────────────────────────────────────────────────────────

interface TaskDetailDialogProps {
  taskId: string;
  projectId: string;
  orgId: string;
  open: boolean;
  onClose: () => void;
}

export function TaskDetailDialog({ taskId, projectId, orgId, open, onClose }: TaskDetailDialogProps) {
  const { data: task, isLoading: taskLoading } = useTask(taskId);
  const { data: comments = [], isLoading: commentsLoading } = useTaskComments(taskId);
  const { data: members = [] } = useOrgMembers(orgId);

  const updateTask = useUpdateTask(projectId);
  const assignTask = useAssignTask(projectId);
  const createComment = useCreateComment(taskId);
  const deleteComment = useDeleteComment(taskId);
  const deleteTask = useDeleteTask(projectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [commentText, setCommentText] = useState('');
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUser = getUser();

  // Sync form state whenever the task loads / changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
    }
  }, [task?.id]);

  // Cleanup debounce on unmount
  useEffect(() => () => { if (descTimerRef.current) clearTimeout(descTimerRef.current); }, []);

  function handleTitleBlur() {
    const trimmed = title.trim();
    if (task && trimmed && trimmed !== task.title) {
      updateTask.mutate({ taskId, title: trimmed });
    }
  }

  function handleDescChange(v: string) {
    setDescription(v);
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
    descTimerRef.current = setTimeout(() => {
      if (task && v !== (task.description ?? '')) {
        updateTask.mutate({ taskId, description: v });
      }
    }, 500);
  }

  function handleDescBlur() {
    if (descTimerRef.current) { clearTimeout(descTimerRef.current); descTimerRef.current = null; }
    if (task && description !== (task.description ?? '')) {
      updateTask.mutate({ taskId, description });
    }
  }

  async function handleSubmitComment(e?: React.FormEvent) {
    e?.preventDefault();
    if (!commentText.trim()) return;
    try {
      await createComment.mutateAsync({ content: commentText.trim() });
      setCommentText('');
    } catch {
      // error handled by hook
    }
  }

  function handleCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmitComment();
  }

  function handleDeleteTask() {
    deleteTask.mutate(taskId, {
      onSuccess: () => {
        toast.success('Task deleted');
        onClose();
      },
    });
  }

  const createdByMember = members.find((m) => m.userId === task?.createdBy);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl p-0 gap-0 overflow-hidden"
        style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {taskLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={20} className="animate-spin text-zinc-600" />
          </div>
        ) : !task ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-zinc-500">Task not found</p>
          </div>
        ) : (
          <>
            {/* ── Header ─────────────────────────────────────────── */}
            <div
              className="flex items-start gap-3 px-6 pt-5 pb-4 pr-12"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="flex-1 bg-transparent text-lg font-semibold text-white outline-none border-b border-transparent focus:border-white/[0.12] transition-colors min-w-0"
                aria-label="Task title"
              />
              <StatusDropdown
                value={task.status as TaskStatus}
                onChange={(status) => updateTask.mutate({ taskId, status })}
              />
            </div>

            {/* ── Body ───────────────────────────────────────────── */}
            <div className="overflow-y-auto px-6 py-5 space-y-5" style={{ maxHeight: 'calc(80vh - 160px)' }}>

              {/* Description */}
              <div>
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Description</p>
                <textarea
                  value={description}
                  onChange={(e) => handleDescChange(e.target.value)}
                  onBlur={handleDescBlur}
                  rows={3}
                  placeholder="Add description…"
                  className={inputClass}
                />
              </div>

              {/* Assignee + Metadata grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Assignee</p>
                  <AssigneeDropdown
                    assigneeId={task.assigneeId}
                    members={members}
                    onChange={(assigneeId) => assignTask.mutate({ taskId, assigneeId })}
                  />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Details</p>
                  <dl className="space-y-1 font-mono text-xs text-zinc-500">
                    <div className="flex gap-2">
                      <dt>Created</dt>
                      <dd className="text-zinc-400">{format(new Date(task.createdAt), 'MMM d, yyyy')}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt>Updated</dt>
                      <dd className="text-zinc-400">{format(new Date(task.updatedAt), 'MMM d, yyyy')}</dd>
                    </div>
                    {createdByMember && (
                      <div className="flex gap-2">
                        <dt>Created&nbsp;by</dt>
                        <dd className="text-zinc-400 truncate">{createdByMember.name}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* Comments */}
              <div>
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-3">
                  Comments
                  {comments.length > 0 && (
                    <span
                      className="ml-1.5 inline-flex items-center justify-center px-1 rounded text-[10px] font-mono text-zinc-600"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      {comments.length}
                    </span>
                  )}
                </p>

                {commentsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 size={14} className="animate-spin text-zinc-700" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {comments.map((comment, i) => (
                        <motion.div
                          key={comment.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.15 }}
                          className="group flex gap-3"
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-indigo-300 flex-shrink-0 mt-0.5"
                            style={{ background: 'rgba(55,48,163,0.5)' }}
                          >
                            {(comment.authorName ?? comment.userId)[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-zinc-300">
                                {comment.authorName ?? 'Unknown'}
                              </span>
                              <span className="text-[11px] text-zinc-600">
                                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                              </span>
                              {currentUser && comment.userId === (task.assigneeId /* approximate — real userId from auth needed */) && null}
                            </div>
                            <div className="flex items-start gap-2">
                              <p
                                className="text-sm text-zinc-400 leading-relaxed flex-1 rounded-lg px-3 py-2"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                              >
                                {comment.content}
                              </p>
                              {/* Delete appears for all comments (server enforces owner check) */}
                              <button
                                onClick={() => deleteComment.mutate(comment.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-600 hover:text-red-400 transition-all mt-1 flex-shrink-0"
                                aria-label="Delete comment"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {comments.length === 0 && (
                      <p className="text-xs text-zinc-700 text-center py-2">No comments yet</p>
                    )}
                  </div>
                )}

                {/* New comment */}
                <form onSubmit={handleSubmitComment} className="mt-4">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={handleCommentKeyDown}
                    rows={2}
                    placeholder="Add a comment… (Ctrl+Enter to send)"
                    className={inputClass}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={createComment.isPending || !commentText.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                    >
                      {createComment.isPending ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Send size={10} />
                      )}
                      Comment
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* ── Footer ─────────────────────────────────────────── */}
            <div
              className="px-6 py-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={deleteTask.isPending}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    {deleteTask.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                    Delete task
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent
                  style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Delete task?</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      This will permanently delete &ldquo;{task.title}&rdquo; and all its comments. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      className="text-zinc-300"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteTask}
                      className="bg-red-500 hover:bg-red-600 text-white border-0"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
