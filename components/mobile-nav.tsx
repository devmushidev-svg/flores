"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Flower2, BookOpen, ShoppingBag, Calendar, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/flores", label: "Flores", icon: Flower2 },
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/calendario", label: "Entregas", icon: Calendar },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-t border-white/20 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.08)] animate-slide-up">
      <div className="flex items-center justify-around py-3 px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href))
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-2xl min-w-[64px] transition-all duration-300 ease-out active:scale-95",
                isActive 
                  ? "text-white bg-gradient-primary shadow-lg shadow-primary/25 scale-105" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/10"
              )}
            >
              <Icon className={cn("h-5 w-5 transition-transform duration-300", isActive && "scale-110")} />
              <span className="text-xs font-semibold">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
