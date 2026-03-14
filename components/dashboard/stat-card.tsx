import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  description?: string
  className?: string
}

export function StatCard({ title, value, icon, description, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
