import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: any;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "primary" | "secondary" | "gold" | "default";
  onClick?: () => void;
  className?: string;
}

const StatsCard = ({ title, value, icon: Icon, trend, variant = "primary", onClick, className }: StatsCardProps) => {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={cn(
        "stats-card w-full text-right relative overflow-hidden transition-all duration-200", // Basic layout styles
        variant === "gold" && "gold-card text-secondary-foreground",
        variant === "primary" && "gradient-card text-primary-foreground",
        onClick && "cursor-pointer hover:opacity-90 active:scale-[0.98]", // Interactive styles
        className
      )}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-2 flex-1">
          <p className={cn(
            "text-sm font-medium",
            variant === "default" ? "text-muted-foreground" : "text-current opacity-90"
          )}>
            {title}
          </p>
          <p className={cn(
            "text-3xl font-bold",
            variant === "default" && "text-foreground"
          )}>
            {value}
          </p>
          {trend && (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-xs font-semibold",
                  trend.isPositive ? "text-success" : "text-destructive",
                  variant !== "default" && "text-current opacity-75"
                )}
              >
                {trend.isPositive ? "+" : ""}{trend.value}%
              </span>
              <span className={cn(
                "text-xs",
                variant === "default" ? "text-muted-foreground" : "text-current opacity-75"
              )}>
                من الأسبوع الماضي
              </span>
            </div>
          )}
        </div>

        <div className={cn(
          "p-3 rounded-xl",
          variant === "default" && "bg-accent",
          variant === "gold" && "bg-white/20",
          variant === "primary" && "bg-white/20"
        )}>
          <Icon className={cn(
            "w-6 h-6",
            variant === "default" && "text-accent-foreground"
          )} />
        </div>
      </div>
    </Component>
  );
};

export default StatsCard;
