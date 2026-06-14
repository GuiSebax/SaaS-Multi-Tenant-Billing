'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { motion } from 'framer-motion';
import { AuthCard } from '@/components/auth/auth-card';
import api from '@/lib/axios';
import { setTokens, setUser } from '@/lib/auth';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

const inputClass =
  'w-full rounded-xl bg-[#0A0A0B]/80 border border-white/[0.08] px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all duration-200';

function passwordStrength(pw: string): { width: string; color: string; label: string } {
  if (!pw) return { width: '0%', color: '', label: '' };
  if (pw.length < 8) return { width: '33%', color: 'bg-red-500', label: 'Weak' };
  if (pw.length <= 12) return { width: '66%', color: 'bg-amber-500', label: 'Fair' };
  return { width: '100%', color: 'bg-emerald-500', label: 'Strong' };
}

const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.07 },
  }),
};

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const password = watch('password') ?? '';
  const strength = passwordStrength(password);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/register',
        data,
      );
      setTokens(res.data.accessToken, res.data.refreshToken);
      setUser({ name: data.name, email: data.email });
      router.push('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          toast.error('Email already in use');
        } else {
          toast.error('Something went wrong. Please try again.');
        }
      }
    }
  };

  return (
    <AuthCard>
      {/* Header */}
      <motion.div
        className="mb-7"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-indigo-300"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <Sparkles size={10} />
            14-day free trial
          </span>
        </div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-zinc-500">Start building with your team today</p>
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Full name</label>
          <input
            {...register('name')}
            type="text"
            autoComplete="name"
            placeholder="Jane Smith"
            className={inputClass}
          />
          {errors.name && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1.5 text-xs text-red-400"
            >
              {errors.name.message}
            </motion.p>
          )}
        </motion.div>

        {/* Email */}
        <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass}
          />
          {errors.email && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1.5 text-xs text-red-400"
            >
              {errors.email.message}
            </motion.p>
          )}
        </motion.div>

        {/* Password */}
        <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="min. 8 characters"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {password.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2"
            >
              <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  className={`h-full rounded-full ${strength.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: strength.width }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
              {strength.label && (
                <p className={`mt-1 text-[10px] font-medium ${
                  strength.label === 'Weak' ? 'text-red-400' :
                  strength.label === 'Fair' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {strength.label} password
                </p>
              )}
            </motion.div>
          )}

          {errors.password && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1.5 text-xs text-red-400"
            >
              {errors.password.message}
            </motion.p>
          )}
        </motion.div>

        {/* Submit */}
        <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={{ scale: isSubmitting ? 1 : 1.01 }}
            whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="mt-1 w-full rounded-xl disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 flex items-center justify-center gap-2 relative overflow-hidden cursor-pointer"
            style={{
              background: isSubmitting
                ? '#6366f1'
                : 'linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #6366f1 100%)',
              backgroundSize: '200% auto',
              animation: isSubmitting ? 'none' : 'shimmer 3s linear infinite',
              boxShadow: '0 0 20px rgba(99,102,241,0.3)',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                Create account
                <ArrowRight size={14} />
              </>
            )}
          </motion.button>
        </motion.div>
      </form>

      {/* Divider */}
      <motion.div
        custom={4}
        variants={fieldVariants}
        initial="hidden"
        animate="visible"
        className="my-5 flex items-center gap-3"
      >
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <span className="text-xs text-zinc-700">no credit card required</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </motion.div>

      <motion.p
        custom={5}
        variants={fieldVariants}
        initial="hidden"
        animate="visible"
        className="text-center text-xs text-zinc-500"
      >
        Already have an account?{' '}
        <Link
          href="/auth/login"
          className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
        >
          Sign in
        </Link>
      </motion.p>
    </AuthCard>
  );
}
