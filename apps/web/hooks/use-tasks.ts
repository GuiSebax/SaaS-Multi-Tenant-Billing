'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/axios';
import type { Task, TaskStatus } from '@saas-platform/shared';
import type { TaskDetail, CommentWithAuthor } from '@/lib/types';

// ─── Task list (kanban board) ────────────────────────────────────────────────

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const res = await api.get<Task[]>(`/projects/${projectId}/tasks`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; status?: string; description?: string }) => {
      const res = await api.post<Task>(`/projects/${projectId}/tasks`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}

// ─── Task detail ─────────────────────────────────────────────────────────────

export function useTask(taskId: string) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const res = await api.get<TaskDetail>(`/tasks/${taskId}`);
      return res.data;
    },
    enabled: !!taskId,
  });
}

// ─── Update task (status, title, description) ────────────────────────────────

type UpdateTaskVars = {
  taskId: string;
  status?: TaskStatus;
  title?: string;
  description?: string | null;
};

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, ...fields }: UpdateTaskVars) => {
      const res = await api.patch<Task>(`/tasks/${taskId}`, fields);
      return res.data;
    },
    onMutate: async ({ taskId, ...fields }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      queryClient.setQueryData<Task[]>(['tasks', projectId], (old = []) =>
        old.map((t) => (t.id === taskId ? { ...t, ...fields } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks', projectId], context.previous);
      toast.error('Failed to update task');
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task', vars.taskId] });
    },
  });
}

// ─── Assign task ─────────────────────────────────────────────────────────────

export function useAssignTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, assigneeId }: { taskId: string; assigneeId: string | null }) => {
      const res = await api.patch<Task>(`/tasks/${taskId}/assign`, { assigneeId });
      return res.data;
    },
    onMutate: async ({ taskId, assigneeId }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      queryClient.setQueryData<Task[]>(['tasks', projectId], (old = []) =>
        old.map((t) => (t.id === taskId ? { ...t, assigneeId } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks', projectId], context.previous);
      toast.error('Failed to assign task');
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task', vars.taskId] });
    },
  });
}

// ─── Move task (reorder position) ────────────────────────────────────────────

export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, position }: { taskId: string; position: number }) => {
      const res = await api.patch<Task>(`/tasks/${taskId}/move`, { projectId, position });
      return res.data;
    },
    onMutate: async ({ taskId, position }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      queryClient.setQueryData<Task[]>(['tasks', projectId], (old = []) =>
        old.map((t) => (t.id === taskId ? { ...t, position } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks', projectId], context.previous);
      toast.error('Failed to reorder task');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}

// ─── Delete task ─────────────────────────────────────────────────────────────

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      await api.delete(`/tasks/${taskId}`);
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      queryClient.setQueryData<Task[]>(['tasks', projectId], (old = []) =>
        old.filter((t) => t.id !== taskId),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks', projectId], context.previous);
      toast.error('Failed to delete task');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: async () => {
      const res = await api.get<CommentWithAuthor[]>(`/tasks/${taskId}/comments`);
      return res.data;
    },
    enabled: !!taskId,
  });
}

export function useCreateComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const res = await api.post<CommentWithAuthor>(`/tasks/${taskId}/comments`, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
    },
    onError: () => {
      toast.error('Failed to post comment');
    },
  });
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(`/tasks/${taskId}/comments/${commentId}`);
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ['comments', taskId] });
      const previous = queryClient.getQueryData<CommentWithAuthor[]>(['comments', taskId]);
      queryClient.setQueryData<CommentWithAuthor[]>(['comments', taskId], (old = []) =>
        old.filter((c) => c.id !== commentId),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['comments', taskId], context.previous);
      toast.error('Failed to delete comment');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
    },
  });
}
