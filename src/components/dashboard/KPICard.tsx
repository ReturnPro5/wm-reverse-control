import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info';
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon,
  variant = 'default',
  className,
}: KPICardProps) {
  const variantStyles = {
    default: 'bg-card border-border',
    primary: 'bg-primary/5 border-primary/20',
    success: 'bg-success/5 border-success/20',
    warning: 'bg-warning/5 border-warning/20',
    info: 'bg-info/5 border-info/20',
  };

  const iconStyles = {
    default: 'text-muted-foreground bg-muted',
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    info: 'text-info bg-info/10',
  };

  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus;
  const trendColor = trend && trend > 0 ? 'text-success' : trend && trend < 0 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all duration-200 hover:shadow-md animate-fade-in',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={cn('rounded-lg p-2', iconStyles[variant])}>
            {icon}
          </div>
        )}
      </div>
      
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1">
          <TrendIcon className={cn('h-4 w-4', trendColor)} />
          <span className={cn('text-sm font-medium', trendColor)}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
          {trendLabel && (
            <span className="text-xs text-muted-foreground ml-1">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}