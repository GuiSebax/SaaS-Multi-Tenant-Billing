'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { isAuthenticated } from '@/lib/auth';

type State = 'loading' | 'success' | 'error';

export default function AcceptInvitationPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/auth/login?redirect=/invitations/${token}/accept`);
      return;
    }

    api
      .post(`/invitations/${token}/accept`)
      .then(() => setState('success'))
      .catch((err) => {
        const msg: string =
          err?.response?.data?.message ?? 'This invitation is invalid or has expired.';
        setErrorMessage(msg);
        setState('error');
      });
  }, [token, router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0A0A0B' }}
    >
      <div
        className="w-full max-w-md rounded-xl p-8 text-center"
        style={{
          background: '#111113',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {state === 'loading' && (
          <>
            <Loader2 size={40} className="mx-auto mb-4 animate-spin text-indigo-400" />
            <h1 className="text-lg font-semibold text-white mb-1">Accepting invitation…</h1>
            <p className="text-sm text-zinc-500">Please wait while we process your invite.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle size={40} className="mx-auto mb-4 text-emerald-400" />
            <h1 className="text-lg font-semibold text-white mb-1">You&apos;re in!</h1>
            <p className="text-sm text-zinc-400 mb-6">
              Invitation accepted. Welcome to the team.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
            >
              Go to dashboard
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle size={40} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-lg font-semibold text-white mb-1">Invitation failed</h1>
            <p className="text-sm text-zinc-400 mb-6">{errorMessage}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-white/[0.08] text-zinc-300 hover:text-white text-sm font-medium transition-colors"
            >
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
