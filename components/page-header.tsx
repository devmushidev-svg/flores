import Image from "next/image"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  showLogo?: boolean
}

export function PageHeader({ title, description, action, className, showLogo }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}>
      <div className="flex items-center gap-3">
        {showLogo && (
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-primary opacity-20 blur-xl" />
            <Image
              src="/logo.png"
              alt="Multiplanet Floristería"
              width={48}
              height={48}
              className="relative object-contain rounded-xl transition-transform duration-300 hover:scale-105 ring-2 ring-white/50 shadow-lg"
            />
          </div>
        )}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0 max-w-full">{action}</div>}
    </div>
  )
}
