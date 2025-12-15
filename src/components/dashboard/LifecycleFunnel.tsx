import { cn } from '@/lib/utils';
import { Package, CheckCircle, TestTube, Tag, DollarSign } from 'lucide-react';

interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
}

interface LifecycleFunnelProps {
  data: FunnelStage[];
  className?: string;
}

const stageConfig = {
  Received: { icon: Package, color: 'bg-chart-received', label: 'Received' },
  CheckedIn: { icon: CheckCircle, color: 'bg-chart-checkedin', label: 'Checked In' },
  Tested: { icon: TestTube, color: 'bg-chart-tested', label: 'Tested' },
  Listed: { icon: Tag, color: 'bg-chart-listed', label: 'Listed' },
  Sold: { icon: DollarSign, color: 'bg-chart-sold', label: 'Sold' },
};

export function LifecycleFunnel({ data, className }: LifecycleFunnelProps) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className={cn('bg-card rounded-lg border p-6', className)}>
      <h3 className="text-lg font-semibold mb-6">Lifecycle Funnel</h3>
      
      <div className="space-y-4">
        {data.map((stage, index) => {
          const config = stageConfig[stage.stage as keyof typeof stageConfig];
          if (!config) return null;
          
          const Icon = config.icon;
          const widthPercent = (stage.count / maxCount) * 100;
          
          return (
            <div
              key={stage.stage}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded', config.color.replace('bg-', 'bg-') + '/20')}>
                    <Icon className={cn('h-4 w-4', config.color.replace('bg-', 'text-'))} />
                  </div>
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">{stage.count.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({stage.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500 ease-out', config.color)}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      
      {data.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No data available. Upload files to see lifecycle funnel.
        </div>
      )}
    </div>
  );
}