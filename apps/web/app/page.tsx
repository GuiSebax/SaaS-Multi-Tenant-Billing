'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import {
  Boxes,
  Shield,
  Users,
  CreditCard,
  Lock,
  BarChart3,
  Code,
  Menu,
  X,
  ArrowRight,
  ExternalLink,
  Check,
} from 'lucide-react';
import { BorderBeam } from '@/components/ui/border-beam';

// ─── Navbar ────────────────────────────────────────────────────────────────

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md"
      style={{
        background: 'rgba(10,10,11,0.85)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: '#6366F1' }}
          >
            <Boxes size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white">SaaS Platform</span>
        </Link>

        {/* Center links */}
        <nav className="hidden md:flex items-center gap-7">
          {[
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Docs', href: '#features' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-150"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="hidden md:inline-flex items-center px-4 py-2 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors duration-150"
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors duration-150"
          >
            Get started
            <ArrowRight size={14} />
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden ml-1 text-zinc-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden px-6 py-4 space-y-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {[
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Docs', href: '#features' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className="block text-sm text-zinc-400 hover:text-white transition-colors py-2"
            >
              {label}
            </a>
          ))}
          <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Link
              href="/auth/login"
              className="block text-sm text-zinc-400 hover:text-white py-2 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
});

function Hero() {
  return (
    <section className="relative flex items-center justify-center px-6 pt-28 pb-20 overflow-hidden">
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 65%)',
        }}
      />

      {/* Floating orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-72 h-72 rounded-full blur-3xl animate-float opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)', top: '8%', left: '12%', animationDelay: '0s' }}
        />
        <div
          className="absolute w-56 h-56 rounded-full blur-3xl animate-float-slow opacity-15"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent)', top: '20%', right: '8%', animationDelay: '-3s' }}
        />
        <div
          className="absolute w-40 h-40 rounded-full blur-2xl animate-float opacity-10"
          style={{ background: 'radial-gradient(circle, #a5b4fc, transparent)', bottom: '30%', left: '30%', animationDelay: '-5s' }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Badge */}
        <motion.div {...fadeUp(0)} className="mb-8">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm text-indigo-400 cursor-default"
            style={{
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
            Built for modern teams
          </div>
        </motion.div>

        {/* Heading */}
        <motion.h1
          {...fadeUp(0.1)}
          className="text-5xl md:text-7xl font-bold text-white mb-6"
          style={{ lineHeight: 1.06, letterSpacing: '-0.03em' }}
        >
          Ship faster,
          <br />
          <span style={{ color: '#818cf8' }}>scale smarter.</span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          {...fadeUp(0.2)}
          className="text-lg md:text-xl text-zinc-400 max-w-lg mx-auto mb-10 leading-relaxed"
        >
          The project management platform built for teams that move fast.
          Multi-tenant, real-time, and ready for scale.
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...fadeUp(0.3)}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5"
        >
          <Link
            href="/auth/register"
            className="relative flex items-center gap-2 px-7 py-3.5 rounded-xl text-white text-base font-semibold overflow-hidden group"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #6366f1 100%)',
              backgroundSize: '200% auto',
              animation: 'shimmer 3s linear infinite',
              boxShadow: '0 0 24px rgba(99,102,241,0.35)',
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Start for free
              <motion.span
                animate={{ x: [0, 3, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              >
                <ArrowRight size={16} />
              </motion.span>
            </span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </Link>
          <a
            href="#hero-preview"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-base font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            View demo
          </a>
        </motion.div>

        {/* Fine print */}
        <motion.p {...fadeUp(0.4)} className="text-xs text-zinc-600 font-mono tracking-wide">
          No credit card required · Free forever plan
        </motion.p>

        {/* App preview mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-16 mx-auto max-w-4xl"
        >
          {/* Glow under preview */}
          <div
            className="absolute inset-x-12 bottom-0 h-24 blur-3xl -z-10 pointer-events-none"
            style={{ background: 'rgba(99,102,241,0.25)' }}
          />

          {/* Browser chrome */}
          <div
            id="hero-preview"
            className="rounded-2xl overflow-hidden relative"
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            <BorderBeam size={300} duration={10} colorFrom="#6366f1" colorTo="#a5b4fc" borderWidth={1.5} borderRadius={16} />
            {/* Browser toolbar */}
            <div
              className="flex items-center gap-3 px-5 py-3.5"
              style={{ background: '#1A1A1D', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,95,87,0.6)' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,189,46,0.6)' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(40,201,64,0.6)' }} />
              </div>
              <div
                className="flex-1 max-w-xs mx-auto flex items-center gap-2 px-3 py-1 rounded text-[11px] text-zinc-600"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#6366F1' }} />
                app.saasplatform.io/projects/marketing
              </div>
            </div>

            {/* App layout */}
            <div className="flex" style={{ background: '#0A0A0B', height: 280 }}>
              {/* Sidebar */}
              <div
                className="w-44 flex flex-col flex-shrink-0 py-3 hidden sm:flex"
                style={{ background: '#111113', borderRight: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-2 px-4 pb-3 mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-4 h-4 rounded flex-shrink-0" style={{ background: '#6366F1' }} />
                  <span className="text-[11px] font-semibold text-white">SaaS Platform</span>
                </div>
                {[
                  { label: 'Dashboard', active: false },
                  { label: 'Projects', active: true },
                  { label: 'Organizations', active: false },
                ].map(({ label, active }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 mx-2 px-2.5 py-1.5 rounded-md mb-0.5"
                    style={{
                      background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                      borderLeft: active ? '2px solid #6366F1' : '2px solid transparent',
                    }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: active ? '#6366F1' : 'rgba(255,255,255,0.1)' }}
                    />
                    <span className="text-[10px]" style={{ color: active ? '#fff' : '#71717a' }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Kanban */}
              <div className="flex-1 p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[11px] font-semibold text-white">Marketing Website</p>
                  <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
                    Active
                  </span>
                </div>
                <div className="flex gap-3 h-[210px]">
                  {[
                    { label: 'Todo', color: '#71717a', tasks: ['Write landing copy', 'SEO audit'] },
                    { label: 'In Progress', color: '#f59e0b', tasks: ['API integration', 'Auth flow'] },
                    { label: 'Done', color: '#10b981', tasks: ['Project setup', 'Design system'] },
                  ].map(({ label, color, tasks }) => (
                    <div
                      key={label}
                      className="flex-1 rounded-lg p-2.5 flex flex-col"
                      style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                        <span className="text-[9px] font-semibold text-white">{label}</span>
                        <span
                          className="ml-auto text-[8px] font-mono text-zinc-600 rounded px-1"
                          style={{ background: 'rgba(255,255,255,0.06)' }}
                        >
                          {tasks.length}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {tasks.map((task) => (
                          <div
                            key={task}
                            className="rounded px-2 py-1.5"
                            style={{ background: '#1C1C1F', border: '1px solid rgba(255,255,255,0.06)' }}
                          >
                            <p className="text-[9px] text-white leading-tight">{task}</p>
                            <div className="flex items-center justify-between mt-1">
                              <div className="w-1 h-1 rounded-full" style={{ background: color }} />
                              <div
                                className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
                                style={{ background: 'rgba(55,48,163,0.5)' }}
                              >
                                <span style={{ fontSize: 6, color: '#a5b4fc' }}>A</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Logos ──────────────────────────────────────────────────────────────────

const COMPANIES = ['Acme Corp', 'Startup X', 'Dev Agency', 'Scale Labs', 'Pixel Works', 'Build Co'];

function Logos() {
  return (
    <section className="py-16 overflow-hidden" style={{ background: 'rgb(9,9,11)' }}>
      <div className="max-w-4xl mx-auto px-6 text-center">
        <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-mono mb-8">
          Trusted by teams at
        </p>
        <div
          className="flex items-center justify-center flex-wrap gap-y-2"
          style={{
            WebkitMaskImage:
              'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
            maskImage:
              'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
          }}
        >
          {COMPANIES.map((company, i) => (
            <span key={company} className="text-zinc-600 font-mono text-sm whitespace-nowrap">
              {company}
              {i < COMPANIES.length - 1 && (
                <span className="mx-4 text-zinc-800">·</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ───────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Shield,
    title: 'Multi-tenant isolation',
    description:
      'Row-level security at the database layer. Your data stays yours — always isolated, never leaked.',
  },
  {
    icon: Users,
    title: 'Real-time collaboration',
    description:
      'Invite your team and work together. Role-based access control built in from day one.',
  },
  {
    icon: CreditCard,
    title: 'Billing & plans',
    description:
      'Stripe-powered subscriptions with a 14-day trial. Upgrade, downgrade, or cancel anytime.',
  },
  {
    icon: Lock,
    title: 'Role-based access',
    description:
      'Owner, admin, and member roles. Fine-grained permissions so everyone sees what they need to.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & metrics',
    description:
      'Prometheus-compatible metrics, structured JSON logs, and health checks out of the box.',
  },
  {
    icon: Code,
    title: 'Developer-first API',
    description:
      'Clean REST API with JWT auth, refresh token rotation, and consistent error shapes.',
  },
];

const featureGridVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const featureItemVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, type: 'tween' } },
};

function Features() {
  return (
    <section id="features" className="py-28 px-6" style={{ background: '#0A0A0B' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2
            className="text-3xl md:text-4xl font-bold text-white mb-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            Everything your team needs
          </h2>
          <p className="text-zinc-400 max-w-md mx-auto">
            Built with the stack you trust, designed for teams that ship.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={featureGridVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <motion.div
              key={title}
              variants={featureItemVariants}
              className="group rounded-xl p-6 transition-all duration-200 cursor-default relative overflow-hidden"
              style={{
                background: 'rgba(24,24,27,0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'rgba(99,102,241,0.25)';
                el.style.background = 'rgb(20,20,24)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'rgba(255,255,255,0.06)';
                el.style.background = 'rgba(24,24,27,0.6)';
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-5"
                style={{ background: 'rgba(99,102,241,0.12)' }}
              >
                <Icon size={20} className="text-indigo-400" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
              {/* Subtle hover glow */}
              <div
                className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)' }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Pricing ────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for individuals and small teams getting started.',
    features: ['3 team members', '3 projects', 'Basic analytics', 'Community support'],
    cta: 'Get started free',
    href: '/auth/register',
    highlight: false,
    badge: undefined,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For growing teams that need more power and flexibility.',
    features: [
      '25 team members',
      'Unlimited projects',
      'Priority support',
      'Advanced analytics',
      '14-day free trial',
    ],
    cta: 'Start free trial',
    href: '/auth/register',
    highlight: true,
    badge: 'Most popular',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations with advanced requirements.',
    features: [
      'Unlimited members',
      'Unlimited projects',
      'SLA guarantee',
      'Dedicated support',
      'Custom integrations',
    ],
    cta: 'Contact us',
    href: '/auth/register',
    highlight: false,
    badge: undefined,
  },
] as const;

function Pricing() {
  return (
    <section id="pricing" className="py-28 px-6" style={{ background: 'rgb(9,9,11)' }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2
            className="text-3xl md:text-4xl font-bold text-white mb-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            Simple, transparent pricing
          </h2>
          <p className="text-zinc-400">No hidden fees. Upgrade or cancel anytime.</p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {PLANS.map(({ name, price, period, description, features, cta, href, highlight, badge }) => (
            <motion.div
              key={name}
              variants={{ hidden: { opacity: 0, y: 28, scale: 0.95 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, type: 'tween' } } } as Variants}
              whileHover={highlight ? { scale: 1.02 } : { scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="relative rounded-2xl p-8 flex flex-col"
              style={
                highlight
                  ? { background: '#6366F1', border: '1px solid rgba(99,102,241,0.5)', boxShadow: '0 0 40px rgba(99,102,241,0.25)' }
                  : { background: 'rgb(24,24,27)', border: '1px solid rgba(255,255,255,0.06)' }
              }
            >
              {badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-white text-indigo-600 whitespace-nowrap shadow-lg">
                    {badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${highlight ? 'text-indigo-200' : 'text-zinc-400'}`}>
                  {name}
                </p>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-4xl font-bold text-white">{price}</span>
                  {period && (
                    <span className={`text-sm ${highlight ? 'text-indigo-200' : 'text-zinc-500'}`}>
                      {period}
                    </span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed ${highlight ? 'text-indigo-100' : 'text-zinc-500'}`}>
                  {description}
                </p>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm">
                    <Check
                      size={13}
                      className={`flex-shrink-0 ${highlight ? 'text-indigo-100' : 'text-indigo-400'}`}
                    />
                    <span className={highlight ? 'text-indigo-50' : 'text-zinc-300'}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={href}
                className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150 ${
                  highlight
                    ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                }`}
              >
                {cta}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── CTA final ──────────────────────────────────────────────────────────────

function CTAFinal() {
  return (
    <section className="py-36 px-6 relative overflow-hidden" style={{ background: '#0A0A0B' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 55% 55% at 50% 50%, rgba(99,102,241,0.1) 0%, transparent 70%)',
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55 }}
        className="relative max-w-2xl mx-auto text-center"
      >
        <h2
          className="text-4xl md:text-5xl font-bold text-white mb-4"
          style={{ letterSpacing: '-0.025em' }}
        >
          Ready to ship faster?
        </h2>
        <p className="text-zinc-400 text-lg mb-10">
          Join thousands of teams already using SaaS Platform.
        </p>
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="inline-block"
        >
          <Link
            href="/auth/register"
            className="relative inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white text-base font-semibold overflow-hidden group"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #6366f1 100%)',
              backgroundSize: '200% auto',
              animation: 'shimmer 3s linear infinite',
              boxShadow: '0 0 32px rgba(99,102,241,0.4)',
            }}
          >
            Get started for free
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            >
              <ArrowRight size={16} />
            </motion.span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="py-10 px-6"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0A0A0B' }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded flex items-center justify-center"
            style={{ background: '#6366F1' }}
          >
            <Boxes size={10} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-white">SaaS Platform</span>
          <span className="text-xs text-zinc-700 ml-1">© 2026</span>
        </div>

        <div className="flex items-center gap-6">
          {['Privacy', 'Terms', 'Docs'].map((label) => (
            <a
              key={label}
              href="#"
              className="text-xs text-zinc-500 hover:text-white transition-colors duration-150"
            >
              {label}
            </a>
          ))}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition-colors duration-150"
            aria-label="GitHub"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ background: '#0A0A0B', minHeight: '100vh' }}>
      <Navbar />
      <Hero />
      <Logos />
      <Features />
      <Pricing />
      <CTAFinal />
      <Footer />
    </div>
  );
}
