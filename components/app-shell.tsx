import { MobileNav } from "./mobile-nav"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-gradient-mesh">
      <main className="pb-24 px-4 pt-6 max-w-lg mx-auto animate-fade-in-up opacity-0">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
