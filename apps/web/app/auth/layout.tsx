'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Boxes } from 'lucide-react';

function FloatingOrb({
  size,
  x,
  y,
  color,
  duration,
  delay,
  blur,
}: {
  size: number;
  x: string;
  y: string;
  color: string;
  duration: number;
  delay: number;
  blur: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: color,
        filter: `blur(${blur}px)`,
        opacity: 0.25,
      }}
      animate={{
        y: [0, -30, 0],
        x: [0, 15, 0],
        scale: [1, 1.08, 1],
        opacity: [0.2, 0.35, 0.2],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

function Particle({ x, y, delay }: { x: string; y: string; delay: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-indigo-400 pointer-events-none"
      style={{ left: x, top: y }}
      animate={{
        opacity: [0, 0.8, 0],
        scale: [0, 1.5, 0],
        y: [0, -40],
      }}
      transition={{
        duration: 3,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 py-12 relative overflow-hidden"
      style={{ background: '#060608' }}
    >
      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        }}
      />

      {/* Radial center glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(99,102,241,0.10) 0%, transparent 65%)',
        }}
      />

      {/* Floating orbs */}
      <FloatingOrb size={380} x="-8%" y="5%"  color="radial-gradient(circle, #6366f1, transparent)" duration={9}  delay={0}    blur={80} />
      <FloatingOrb size={260} x="70%" y="60%" color="radial-gradient(circle, #818cf8, transparent)" duration={12} delay={-4}   blur={70} />
      <FloatingOrb size={200} x="15%" y="65%" color="radial-gradient(circle, #4f46e5, transparent)" duration={11} delay={-7}   blur={60} />
      <FloatingOrb size={140} x="80%" y="10%" color="radial-gradient(circle, #a5b4fc, transparent)" duration={8}  delay={-2}   blur={50} />

      {/* Floating particles */}
      <Particle x="20%"  y="80%" delay={0} />
      <Particle x="50%"  y="70%" delay={1.2} />
      <Particle x="75%"  y="85%" delay={2.4} />
      <Particle x="35%"  y="90%" delay={0.6} />
      <Particle x="65%"  y="75%" delay={1.8} />
      <Particle x="88%"  y="60%" delay={3.0} />

      {/* Animated horizontal lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[15, 40, 62, 82].map((pct) => (
          <motion.div
            key={pct}
            className="absolute left-0 right-0 h-px"
            style={{
              top: `${pct}%`,
              background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.15), transparent)',
            }}
            animate={{ opacity: [0, 1, 0], scaleX: [0.3, 1, 0.3] }}
            transition={{ duration: 5 + pct / 20, delay: pct / 30, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative z-10"
      >
        <Link href="/" className="flex items-center gap-2.5 select-none group">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              boxShadow: '0 0 20px rgba(99,102,241,0.4)',
            }}
          >
            <Boxes size={15} className="text-white" />
          </motion.div>
          <span className="text-sm font-semibold text-white group-hover:text-indigo-200 transition-colors duration-200">
            SaaS Platform
          </span>
        </Link>
      </motion.div>

      {/* Card */}
      <div className="relative z-10 w-full flex justify-center">
        {children}
      </div>

      {/* Bottom fine print */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="relative z-10 text-[11px] text-zinc-700 font-mono"
      >
        Protected by enterprise-grade encryption
      </motion.p>
    </div>
  );
}
