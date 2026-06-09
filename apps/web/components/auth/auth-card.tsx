'use client';

import { motion } from 'framer-motion';

interface AuthCardProps {
  children: React.ReactNode;
}

export function AuthCard({ children }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full max-w-sm rounded-xl p-8"
      style={{
        background: '#111113',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {children}
    </motion.div>
  );
}
