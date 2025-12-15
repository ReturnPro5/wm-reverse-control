import { format } from 'date-fns';
import { FileSpreadsheet, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface FileUpload {
  id: string;
  file_name: string;
  file_type: string;
  file_business_date: string;
  upload_timestamp: string;
  row_count: number;
  processed: boolean;
}

interface RecentUploadsProps {
  uploads: FileUpload[];
  className?: string;
}

const fileTypeColors: Record<string, string> = {
  Sales: 'bg-success/10 text-success border-success/20',
  Inbound: 'bg-info/10 text-info border-info/20',
  Outbound: 'bg-warning/10 text-warning border-warning/20',
  Inventory: 'bg-primary/10 text-primary border-primary/20',
  Unknown: 'bg-muted text-muted-foreground border-border',
};

export function RecentUploads({ uploads, className }: RecentUploadsProps) {
  return (
    <div className={cn('bg-card rounded-lg border p-6', className)}>
      <h3 className="text-lg font-semibold mb-4">Recent Uploads</h3>
      
      {uploads.length > 0 ? (
        <div className="space-y-3">
          {uploads.map((upload, index) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{upload.file_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(upload.upload_timestamp), 'MMM d, h:mm a')}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {upload.row_count.toLocaleString()} rows
                  </span>
                </div>
              </div>
              
              <Badge variant="outline" className={cn('text-xs', fileTypeColors[upload.file_type])}>
                {upload.file_type}
              </Badge>
              
              {upload.processed ? (
                <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
              ) : (
                <Clock className="h-4 w-4 text-warning flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No files uploaded yet</p>
        </div>
      )}
    </div>
  );
}