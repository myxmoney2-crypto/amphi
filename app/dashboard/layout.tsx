import LogoutButton from "@/components/dashboard/LogoutButton";
import Logo from "@/components/ui/Logo";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-ink/10 bg-white/70 px-6 py-4 backdrop-blur">
        <a href="/dashboard">
          <Logo size={24} textClassName="text-xl" />
        </a>
        <LogoutButton />
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
