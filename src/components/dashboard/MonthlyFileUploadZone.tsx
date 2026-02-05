import { useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';

interface MonthlyFileUploadZoneProps {
  onUploadComplete?: () => void;
  className?: string;
}

export function MonthlyFileUploadZone({ onUploadComplete, className }: MonthlyFileUploadZoneProps) {
  // Reuse the main upload hook with all optimizations (chunked reading, retry, abort, adaptive batching)
  const { uploadFile, cancelUpload, isUploading, uploadProgress, formatTimeRemaining } = useFileUpload('Monthly');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    for (const file of files) {
      await uploadFile(file);
    }
    onUploadComplete?.();
  }, [uploadFile, onUploadComplete]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await uploadFile(file);
    }
    e.target.value = '';
    onUploadComplete?.();
  }, [uploadFile, onUploadComplete]);

  const getStatusIcon = () => {
    if (!uploadProgress) return <Upload className="h-8 w-8 text-muted-foreground" />;
    switch (uploadProgress.stage) {
      case 'complete':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-destructive" />;
      default:
        return <Loader2 className="h-8 w-8 text-primary animate-spin" />;
    }
  };

  return (
    <div className={cn('bg-card rounded-lg border p-6', className)}>
      <h3 className="text-lg font-semibold mb-4">Upload Monthly Files</h3>

      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer',
          isUploading ? 'pointer-events-none opacity-75' : 'border-border hover:border-primary/50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !isUploading && document.getElementById('monthly-file-input')?.click()}
      >
        <input
          id="monthly-file-input"
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls"
          multiple
          onChange={handleFileSelect}
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-3">
          {getStatusIcon()}

          {uploadProgress ? (
            <div className="w-full max-w-xs space-y-2">
              <p className="text-sm font-medium">{uploadProgress.message}</p>
              <Progress value={uploadProgress.progress} className="h-2" />
              {uploadProgress.estimatedTimeRemaining !== undefined && uploadProgress.estimatedTimeRemaining > 0 && (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimeRemaining(uploadProgress.estimatedTimeRemaining)}</span>
                </div>
              )}
              {isUploading && (
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); cancelUpload(); }}>
                  <X className="h-3 w-3 mr-1" /> Cancel Upload
                </Button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">Drop monthly files here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">Supports CSV and Excel files (.csv, .xlsx, .xls)</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        <p className="font-medium mb-1">Suggested Naming:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Monthly_2025-01.csv</li>
          <li>January 2025.xlsx</li>
        </ul>
      </div>
    </div>
  );
}
