'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { UserPlus, MoreHorizontal, Users, Mail, Clock } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import {
  useOrgMembers,
  useOrgInvitations,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
} from '@/hooks/use-org-members';
import { useOrganization } from '@/hooks/use-organization';
import { getUser } from '@/lib/auth';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState } from '@/components/empty-state';
import { SkeletonCard } from '@/components/skeleton-card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { OrgMember } from '@/lib/types';

const inputClass =
  'w-full rounded-lg bg-[#0A0A0B] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors';

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  role: z.enum(['admin', 'member']),
});
type InviteData = z.infer<typeof inviteSchema>;

const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25',
  admin: 'bg-zinc-400/10 text-zinc-300 border border-zinc-500/25',
  member: 'bg-zinc-700/10 text-zinc-500 border border-zinc-700/30',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${ROLE_STYLES[role] ?? ROLE_STYLES.member}`}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function MemberAvatar({ name }: { name: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-indigo-300 flex-shrink-0"
      style={{ background: 'rgba(55,48,163,0.6)' }}
    >
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function ActionMenu({
  member,
  viewerRole,
  currentUserEmail,
  onRoleChange,
  onRemove,
}: {
  member: OrgMember;
  viewerRole: string;
  currentUserEmail: string | undefined;
  onRoleChange: (userId: string, role: 'admin' | 'member') => void;
  onRemove: (member: OrgMember) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const canAct =
    (viewerRole === 'owner' || viewerRole === 'admin') &&
    member.role !== 'owner' &&
    member.email !== currentUserEmail;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!canAct) return <div className="w-8 flex-shrink-0" />;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors duration-150"
        aria-label="Member actions"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-40 z-20 rounded-lg overflow-hidden py-1"
          style={{ background: '#1A1A1D', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {member.role !== 'admin' && (
            <button
              onClick={() => {
                onRoleChange(member.userId, 'admin');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04] hover:text-white transition-colors duration-100"
            >
              Make Admin
            </button>
          )}
          {member.role !== 'member' && (
            <button
              onClick={() => {
                onRoleChange(member.userId, 'member');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04] hover:text-white transition-colors duration-100"
            >
              Make Member
            </button>
          )}
          <button
            onClick={() => {
              onRemove(member);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/[0.04] hover:text-red-300 transition-colors duration-100"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MembersPage() {
  const { id: orgId } = useParams<{ id: string }>();
  const { organizations, currentOrgId, switchOrg } = useOrganization();
  const viewedOrg = organizations.find((o) => o.id === orgId);
  const viewerRole = viewedOrg?.role ?? 'member';
  const canManage = viewerRole === 'owner' || viewerRole === 'admin';
  const currentUserEmail = getUser()?.email;

  // Ensure X-Organization-Id header matches the viewed org
  useEffect(() => {
    if (orgId && currentOrgId !== orgId) switchOrg(orgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const { data: members = [], isLoading: membersLoading } = useOrgMembers(orgId);
  const { data: invitations = [] } = useOrgInvitations(orgId, canManage);

  const updateRole = useUpdateMemberRole(orgId);
  const removeMember = useRemoveMember(orgId);
  const inviteMember = useInviteMember(orgId);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'member' },
  });

  function handleRoleChange(userId: string, role: 'admin' | 'member') {
    updateRole.mutate(
      { userId, role },
      {
        onSuccess: () => toast.success('Role updated'),
        onError: (err) => {
          const msg = axios.isAxiosError(err)
            ? ((err.response?.data as { message?: string })?.message ?? 'Failed to update role')
            : 'Failed to update role';
          toast.error(msg);
        },
      },
    );
  }

  function handleRemoveConfirm() {
    if (!removeTarget) return;
    const target = removeTarget;
    removeMember.mutate(target.userId, {
      onSuccess: () => {
        toast.success(`${target.name} removed from organization`);
        setRemoveTarget(null);
      },
      onError: () => toast.error('Failed to remove member'),
    });
  }

  function onInviteSubmit(data: InviteData) {
    inviteMember.mutate(data, {
      onSuccess: () => {
        toast.success(`Invitation sent to ${data.email}`);
        reset();
        setSheetOpen(false);
      },
      onError: (err) => {
        if (axios.isAxiosError(err)) {
          const msg = (err.response?.data as { message?: string })?.message ?? '';
          if (msg === 'User is already a member')
            toast.error('This user is already a member of this organization');
          else if (msg === 'Invitation already pending')
            toast.error('An invitation is already pending for this email');
          else toast.error('Failed to send invitation');
        } else {
          toast.error('Failed to send invitation');
        }
      },
    });
  }

  return (
    <>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Members</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {viewedOrg
                ? `${viewedOrg.name} · ${members.length} member${members.length !== 1 ? 's' : ''}`
                : 'Loading…'}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors duration-150"
            >
              <UserPlus size={14} />
              Invite Member
            </button>
          )}
        </div>

        {/* Members section */}
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Team Members
          </h2>

          {membersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No members yet"
              description="Invite your team to get started."
            />
          ) : (
            <>
              {/* Desktop table */}
              <div
                className="hidden sm:block rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div
                  className="grid text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-4 py-2.5"
                  style={{
                    gridTemplateColumns: '1fr 120px 130px 32px',
                    background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span>Member</span>
                  <span>Role</span>
                  <span>Joined</span>
                  <span />
                </div>

                {members.map((member, i) => (
                  <motion.div
                    key={member.userId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03, duration: 0.18 }}
                    className="grid items-center px-4 py-3 transition-colors duration-100"
                    style={{
                      gridTemplateColumns: '1fr 120px 130px 32px',
                      borderBottom:
                        i < members.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background =
                        'rgba(255,255,255,0.03)')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background = '')
                    }
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <MemberAvatar name={member.name} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{member.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{member.email}</p>
                      </div>
                    </div>
                    <div>
                      <RoleBadge role={member.role} />
                    </div>
                    <span className="text-xs text-zinc-500">
                      {member.joinedAt ? formatDate(member.joinedAt) : '—'}
                    </span>
                    <ActionMenu
                      member={member}
                      viewerRole={viewerRole}
                      currentUserEmail={currentUserEmail}
                      onRoleChange={handleRoleChange}
                      onRemove={setRemoveTarget}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {members.map((member, i) => (
                  <motion.div
                    key={member.userId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.18 }}
                    className="rounded-xl p-4"
                    style={{
                      background: '#111113',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <MemberAvatar name={member.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white truncate">{member.name}</p>
                          <ActionMenu
                            member={member}
                            viewerRole={viewerRole}
                            currentUserEmail={currentUserEmail}
                            onRoleChange={handleRoleChange}
                            onRemove={setRemoveTarget}
                          />
                        </div>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{member.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <RoleBadge role={member.role} />
                          {member.joinedAt && (
                            <span className="text-[11px] text-zinc-600">
                              Joined {formatDate(member.joinedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Pending invitations */}
        {canManage && invitations.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              Pending Invitations ({invitations.length})
            </h2>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {invitations.map((invite, i) => (
                <motion.div
                  key={invite.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03, duration: 0.18 }}
                  className="flex items-center gap-4 px-4 py-3 transition-colors duration-100"
                  style={{
                    borderBottom:
                      i < invitations.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background =
                      'rgba(255,255,255,0.03)')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background = '')
                  }
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <Mail size={14} className="text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{invite.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <RoleBadge role={invite.role} />
                      <span className="text-[11px] text-zinc-600 flex items-center gap-1">
                        <Clock size={9} />
                        Expires {formatDate(invite.expiresAt)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent
          className="border-0"
          style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove member</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Remove{' '}
              <span className="font-medium text-zinc-200">{removeTarget?.name}</span> from this
              organization? They will lose access to all projects immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] hover:text-white mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              disabled={removeMember.isPending}
              className="bg-red-500 hover:bg-red-600 text-white border-0 disabled:opacity-60"
            >
              {removeMember.isPending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite member sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          reset();
        }}
        title="Invite Member"
      >
        <form onSubmit={handleSubmit(onInviteSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="colleague@company.com"
              className={inputClass}
              autoComplete="off"
            />
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Role</label>
            <select
              {...register('role')}
              className={inputClass}
              style={{
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2371717a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem',
                paddingRight: '2.5rem',
              }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            {errors.role && <p className="mt-1 text-xs text-red-400">{errors.role.message}</p>}
            <p className="mt-1.5 text-[11px] text-zinc-600">
              Admins can manage members and invitations.
            </p>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || inviteMember.isPending}
            className="mt-2 w-full rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
          >
            {inviteMember.isPending ? 'Sending…' : 'Send Invitation'}
          </button>
        </form>
      </Sheet>
    </>
  );
}
