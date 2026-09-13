import LogoutButton from "@/components/dashboard/LogoutButton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-ink/10 bg-white/70 px-6 py-4 backdrop-blur">
        <a href="/dashboard" className="text-xl font-black text-ink">
          AMFI
        </a>
        <LogoutButton />
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
