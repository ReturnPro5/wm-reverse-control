import { useCallback, useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface FileUploadZoneProps {
  onUploadComplete?: () => void;
  className?: string;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s remaining`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${minutes}m ${secs}s remaining`;
}

export function FileUploadZone({ onUploadComplete, className }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { uploadFile, cancelUpload, isUploading, uploadProgress } = useFileUpload();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const supportedFiles = files.filter(f => 
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    
    for (const file of supportedFiles) {
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
        return <CheckCircle className="h-8 w-8 text-success" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-destructive" />;
      default:
        return <Loader2 className="h-8 w-8 text-primary animate-spin" />;
    }
  };

  return (
    <div className={cn('bg-card rounded-lg border p-6', className)}>
      <h3 className="text-lg font-semibold mb-4">Upload Files</h3>
      
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          isUploading && 'pointer-events-none opacity-75'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
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
              {isUploading && uploadProgress.stage !== 'complete' && uploadProgress.stage !== 'error' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelUpload();
                  }}
                  className="mt-2 pointer-events-auto"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel Upload
                </Button>
              )}
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium">Drop files here or click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports CSV and Excel files (.csv, .xlsx, .xls)
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="mt-4 text-xs text-muted-foreground">
        <p className="font-medium mb-1">Naming Convention:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Sales MM.DD.YY.xlsx</li>
          <li>Inbound MM.DD.YY.xlsx</li>
          <li>Outbound MM.DD.YY.xlsx</li>
          <li>Inventory MM.DD.YY.xlsx</li>
        </ul>
      </div>
    </div>
  );
}