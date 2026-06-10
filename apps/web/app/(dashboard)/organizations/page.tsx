'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Building2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { PlanBadge } from '@/components/plan-badge';
import { EmptyState } from '@/components/empty-state';
import { SkeletonCard } from '@/components/skeleton-card';
import { Sheet } from '@/components/ui/sheet';
import { useOrganization } from '@/hooks/use-organization';
import { useSidebar } from '../sidebar-context';
import type { OrgWithRole } from '@/lib/types';
import type { Plan } from '@saas-platform/shared';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers and hyphens'),
});
type FormData = z.infer<typeof schema>;

const inputClass =
  'w-full rounded-lg bg-[#0A0A0B] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};


function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function OrganizationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentOrg, switchOrg } = useOrganization();
  const { close: closeSidebar } = useSidebar();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await api.get<OrgWithRole[]>('/organizations/mine');
      return res.data;
    },
  });

  const createOrg = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await api.post<OrgWithRole>('/organizations', data);
      return res.data;
    },
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      switchOrg(org.id);
      setSheetOpen(false);
      toast.success('Organization created');
      router.push('/dashboard');
    },
    onError: () => toast.error('Failed to create organization'),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const nameValue = watch('name') ?? '';

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue('name', e.target.value);
    setValue('slug', slugify(e.target.value));
  }

  function handleOpen() {
    closeSidebar();
    reset();
    setSheetOpen(true);
  }

  function handleSwitch(orgId: string) {
    switchOrg(orgId);
    router.push('/dashboard');
  }

  return (
    <>
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Organizations</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Manage your workspaces</p>
          </div>
          <button
            onClick={handleOpen}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors duration-150"
          >
            <Plus size={14} />
            New Organization
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : organizations.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No organizations yet"
            description="Create an organization to start collaborating with your team."
            action={
              <button
                onClick={handleOpen}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors duration-150"
              >
                <Plus size={14} />
                New Organization
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {organizations.map((org, i) => {
              const isActive = org.id === currentOrg?.id;
              const plan = ((org as unknown as { plan?: Plan }).plan ?? 'free') as Plan;
              return (
                <motion.div
                  key={org.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className="rounded-xl p-4"
                  style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold text-indigo-400 flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.1)' }}
                    >
                      {org.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-white truncate">{org.name}</span>
                        <PlanBadge plan={plan} />
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                            <Check size={8} />
                            Current
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 font-mono">{org.slug}</span>
                        <span className="text-xs text-zinc-600">·</span>
                        <span className="text-xs text-zinc-500">{ROLE_LABELS[org.role]}</span>
                      </div>
                    </div>
                    {!isActive && (
                      <button
                        onClick={() => handleSwitch(org.id)}
                        className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors duration-150 flex-shrink-0"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="New Organization">
        <form onSubmit={handleSubmit((data) => createOrg.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name</label>
            <input
              {...register('name')}
              onChange={handleNameChange}
              type="text"
              placeholder="Acme Inc."
              className={inputClass}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Slug</label>
            <input
              {...register('slug')}
              type="text"
              placeholder="acme-inc"
              className={inputClass}
            />
            {errors.slug && (
              <p className="mt-1 text-xs text-red-400">{errors.slug.message}</p>
            )}
            <p className="mt-1 text-[11px] text-zinc-600">
              Used in URLs. Only lowercase letters, numbers and hyphens.
            </p>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || createOrg.isPending}
            className="mt-2 w-full rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
          >
            {createOrg.isPending ? 'Creating…' : 'Create Organization'}
          </button>
        </form>
      </Sheet>
    </>
  );
}
