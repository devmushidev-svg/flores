import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  description?: string
  className?: string
  highlight?: boolean
}

export function StatCard({ title, value, icon, description, className, highlight }: StatCardProps) {
  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] border-0 shadow-lg",
        "bg-gradient-card backdrop-blur-sm",
        highlight && "ring-2 ring-amber-300/50 bg-gradient-to-br from-amber-50 to-amber-100/80 dark:from-amber-950/30 dark:to-amber-900/20",
        !highlight && "ring-1 ring-white/60",
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-sm text-muted-foreground transition-colors font-medium">{title}</p>
            <p className={cn("text-2xl font-bold tabular-nums transition-colors", highlight ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md",
            highlight ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white" : "bg-gradient-primary text-white"
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
