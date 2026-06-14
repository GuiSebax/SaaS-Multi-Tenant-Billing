'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { motion } from 'framer-motion';
import { AuthCard } from '@/components/auth/auth-card';
import api from '@/lib/axios';
import { setTokens } from '@/lib/auth';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

const inputClass =
  'w-full rounded-xl bg-[#0A0A0B]/80 border border-white/[0.08] px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all duration-200';

const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.07 },
  }),
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/login',
        data,
      );
      setTokens(res.data.accessToken, res.data.refreshToken);
      router.push(redirectTo);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        toast.error('Invalid credentials');
      } else {
        toast.error('Something went wrong. Please try again.');
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
        <h1 className="text-xl font-semibold text-white tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-zinc-500">Sign in to continue to your workspace</p>
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
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
              className="mt-1.5 text-xs text-red-400 flex items-center gap-1"
            >
              {errors.email.message}
            </motion.p>
          )}
        </motion.div>

        {/* Password */}
        <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-zinc-400">Password</label>
            <a href="#" className="text-xs text-zinc-600 hover:text-indigo-400 transition-colors duration-150">
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
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
        <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
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
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight size={14} />
              </>
            )}
          </motion.button>
        </motion.div>
      </form>

      {/* Divider */}
      <motion.div
        custom={3}
        variants={fieldVariants}
        initial="hidden"
        animate="visible"
        className="my-5 flex items-center gap-3"
      >
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <span className="text-xs text-zinc-700">or</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </motion.div>

      <motion.p
        custom={4}
        variants={fieldVariants}
        initial="hidden"
        animate="visible"
        className="text-center text-xs text-zinc-500"
      >
        Don&apos;t have an account?{' '}
        <Link
          href="/auth/register"
          className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
        >
          Create one free
        </Link>
      </motion.p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
