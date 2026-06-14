'use client';

import { motion } from 'framer-motion';
import { BorderBeam } from '@/components/ui/border-beam';

interface AuthCardProps {
  children: React.ReactNode;
}

export function AuthCard({ children }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-sm relative"
    >
      {/* Glow atrás do card */}
      <div
        className="absolute inset-0 rounded-2xl blur-2xl -z-10 animate-glow-pulse"
        style={{ background: 'rgba(99,102,241,0.12)', transform: 'scale(1.1)' }}
      />

      {/* Card principal */}
      <div
        className="relative rounded-2xl p-8 overflow-hidden"
        style={{
          background: 'rgba(14,14,18,0.85)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* BorderBeam rotando ao redor */}
        <BorderBeam
          size={280}
          duration={8}
          colorFrom="#6366f1"
          colorTo="#a5b4fc"
          borderWidth={1.5}
          borderRadius={16}
        />

        {/* Linha de destaque no topo */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6), rgba(165,180,252,0.4), transparent)',
          }}
        />

        {/* Reflexo sutil no canto */}
        <div
          className="absolute -top-16 -right-16 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08), transparent)' }}
        />

        {children}
      </div>
    </motion.div>
  );
}
