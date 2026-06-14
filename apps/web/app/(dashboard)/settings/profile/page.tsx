'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useMe, useUpdateProfile, useChangePassword } from '@/hooks/use-auth';
import { setTokens } from '@/lib/auth';

const inputClass =
  'w-full rounded-lg bg-[#0A0A0B] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});
type ProfileData = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
type PasswordData = z.infer<typeof passwordSchema>;

function passwordStrength(pw: string): { width: string; color: string } {
  if (!pw) return { width: '0%', color: '' };
  if (pw.length < 8) return { width: '33%', color: 'bg-red-500' };
  if (pw.length <= 12) return { width: '66%', color: 'bg-yellow-500' };
  return { width: '100%', color: 'bg-green-500' };
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Profile form ──────────────────────────────────────────────────────────
  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    values: { name: me?.name ?? '' },
  });

  const currentName = profileForm.watch('name');
  const nameChanged = !!me && currentName !== me.name && currentName.trim().length >= 2;

  function onProfileSubmit(data: ProfileData) {
    updateProfile.mutate(data, {
      onSuccess: () => toast.success('Profile updated'),
      onError: () => toast.error('Failed to update profile'),
    });
  }

  // ── Password form ─────────────────────────────────────────────────────────
  const passwordForm = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
  });

  const newPassword = passwordForm.watch('newPassword') ?? '';
  const strength = passwordStrength(newPassword);

  function onPasswordSubmit(data: PasswordData) {
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: (tokens) => {
          setTokens(tokens.accessToken, tokens.refreshToken);
          passwordForm.reset();
          toast.success('Password updated. Other sessions have been logged out.');
        },
        onError: (err) => {
          if (axios.isAxiosError(err)) {
            const msg = (err.response?.data as { message?: string })?.message ?? '';
            if (msg === 'Current password is incorrect') {
              passwordForm.setError('currentPassword', { message: 'Incorrect password' });
            } else {
              toast.error('Failed to update password');
            }
          } else {
            toast.error('Failed to update password');
          }
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-xl h-40 animate-pulse"
            style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl space-y-6">
      <div>
        <h1 className="text-base font-semibold text-white">Account Settings</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Manage your profile and security preferences</p>
      </div>

      {/* ── Profile card ── */}
      <Card>
        <h2 className="text-sm font-medium text-white mb-5">Profile</h2>

        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold text-indigo-300 flex-shrink-0"
            style={{ background: 'rgba(55,48,163,0.6)' }}
          >
            {me?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{me?.name}</p>
            <p className="text-xs text-zinc-500">{me?.email}</p>
          </div>
        </div>

        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name</label>
            <input
              {...profileForm.register('name')}
              type="text"
              autoComplete="name"
              className={inputClass}
            />
            {profileForm.formState.errors.name && (
              <p className="mt-1 text-xs text-red-400">
                {profileForm.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
            <input
              type="email"
              value={me?.email ?? ''}
              readOnly
              className={`${inputClass} opacity-50 cursor-not-allowed`}
            />
            <p className="mt-1.5 text-[11px] text-zinc-600">Email cannot be changed.</p>
          </div>

          {nameChanged && (
            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {updateProfile.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {updateProfile.isPending ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </form>
      </Card>

      {/* ── Change password card ── */}
      <Card>
        <h2 className="text-sm font-medium text-white mb-5">Change Password</h2>

        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                {...passwordForm.register('currentPassword')}
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label={showCurrent ? 'Hide password' : 'Show password'}
              >
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {passwordForm.formState.errors.currentPassword && (
              <p className="mt-1 text-xs text-red-400">
                {passwordForm.formState.errors.currentPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">New Password</label>
            <div className="relative">
              <input
                {...passwordForm.register('newPassword')}
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {newPassword.length > 0 && (
              <div className="mt-2 h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                  style={{ width: strength.width }}
                />
              </div>
            )}
            {passwordForm.formState.errors.newPassword && (
              <p className="mt-1 text-xs text-red-400">
                {passwordForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                {...passwordForm.register('confirmPassword')}
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {passwordForm.formState.errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-400">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={changePassword.isPending}
            className="mt-2 w-full rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors flex items-center justify-center gap-2"
          >
            {changePassword.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Updating…
              </>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      </Card>
    </div>
  );
}
