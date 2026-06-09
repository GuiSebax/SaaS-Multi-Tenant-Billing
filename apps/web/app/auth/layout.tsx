export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="select-none">
        <span className="text-white font-semibold text-base tracking-tight">
          SaaS Platform
        </span>
      </div>
      {children}
    </div>
  );
}
