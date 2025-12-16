import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { FileSpreadsheet, CheckCircle, XCircle, Eye, EyeOff, Trash2, RefreshCw, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFilters } from '@/contexts/FilterContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFileUpload } from '@/hooks/useFileUpload';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface FileUpload {
  id: string;
  file_name: string;
  file_type: string;
  file_business_date: string;
  upload_timestamp: string;
  row_count: number;
  processed: boolean;
}

interface FileManagerProps {
  uploads: FileUpload[];
  onRefresh: () => void;
  className?: string;
}

const fileTypeColors: Record<string, string> = {
  Sales: 'bg-success/10 text-success border-success/20',
  Inbound: 'bg-info/10 text-info border-info/20',
  Outbound: 'bg-warning/10 text-warning border-warning/20',
  Inventory: 'bg-primary/10 text-primary border-primary/20',
  Unknown: 'bg-muted text-muted-foreground border-border',
};

export function FileManager({ uploads, onRefresh, className }: FileManagerProps) {
  const { excludeFile, includeFile, isFileExcluded } = useFilters();
  const { toast } = useToast();
  const { uploadFile, isUploading, uploadProgress } = useFileUpload();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = async (fileId: string, fileName: string) => {
    setDeletingId(fileId);
    try {
      // Delete from all related tables
      await supabase.from('lifecycle_events').delete().eq('file_upload_id', fileId);
      await supabase.from('sales_metrics').delete().eq('file_upload_id', fileId);
      await supabase.from('fee_metrics').delete().eq('file_upload_id', fileId);
      await supabase.from('units_canonical').delete().eq('file_upload_id', fileId);
      
      const { error } = await supabase.from('file_uploads').delete().eq('id', fileId);
      if (error) throw error;

      toast({
        title: 'File Deleted',
        description: `${fileName} and all its data have been removed.`,
      });
      onRefresh();
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete the file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleReplace = async (fileId: string, fileName: string) => {
    setReplacingId(fileId);
    // Trigger file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingId) {
      setReplacingId(null);
      return;
    }

    const fileToReplace = uploads.find(u => u.id === replacingId);
    
    try {
      // First delete the old file's data
      await supabase.from('lifecycle_events').delete().eq('file_upload_id', replacingId);
      await supabase.from('sales_metrics').delete().eq('file_upload_id', replacingId);
      await supabase.from('fee_metrics').delete().eq('file_upload_id', replacingId);
      await supabase.from('units_canonical').delete().eq('file_upload_id', replacingId);
      await supabase.from('file_uploads').delete().eq('id', replacingId);

      // Upload the new file
      const result = await uploadFile(file);
      
      if (result.success) {
        toast({
          title: 'File Replaced',
          description: `${fileToReplace?.file_name} has been replaced with ${file.name}`,
        });
        onRefresh();
      }
    } catch (error) {
      toast({
        title: 'Replace Failed',
        description: 'Could not replace the file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setReplacingId(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleFileExclusion = (fileId: string, fileName: string) => {
    if (isFileExcluded(fileId)) {
      includeFile(fileId);
      toast({
        title: 'File Included',
        description: `${fileName} is now included in calculations.`,
      });
    } else {
      excludeFile(fileId);
      toast({
        title: 'File Excluded',
        description: `${fileName} is now excluded from calculations.`,
      });
    }
    onRefresh();
  };

  const excludedCount = uploads.filter(u => isFileExcluded(u.id)).length;

  return (
    <div className={cn('bg-card rounded-lg border p-6', className)}>
      {/* Hidden file input for replace functionality */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".csv"
        onChange={handleFileSelected}
      />
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">File Management</h3>
          <p className="text-sm text-muted-foreground">
            {uploads.length} files • {excludedCount > 0 && <span className="text-warning">{excludedCount} excluded</span>}
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && uploadProgress && (
        <div className="mb-4 p-3 bg-primary/10 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium">{uploadProgress.message}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress.progress}%` }}
            />
          </div>
        </div>
      )}
      
      {uploads.length > 0 ? (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {uploads.map((upload) => {
            const excluded = isFileExcluded(upload.id);
            const isDeleting = deletingId === upload.id;
            const isReplacing = replacingId === upload.id;
            
            return (
              <div
                key={upload.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-all',
                  excluded ? 'bg-muted/30 opacity-60' : 'bg-muted/50',
                  (isDeleting || isReplacing) && 'opacity-50 pointer-events-none'
                )}
              >
                <FileSpreadsheet className={cn('h-5 w-5 flex-shrink-0', excluded ? 'text-muted-foreground' : 'text-foreground')} />
                
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', excluded && 'line-through')}>{upload.file_name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      Business: {format(new Date(upload.file_business_date), 'MMM d, yyyy')}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      Uploaded: {format(new Date(upload.upload_timestamp), 'MMM d, h:mm a')}
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

                {excluded ? (
                  <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                    Excluded
                  </Badge>
                ) : (
                  <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                )}
                
                {/* Toggle Exclude/Include */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleFileExclusion(upload.id, upload.file_name)}
                  title={excluded ? 'Include file' : 'Exclude file'}
                >
                  {excluded ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>

                {/* Replace File */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-info hover:text-info"
                  onClick={() => handleReplace(upload.id, upload.file_name)}
                  disabled={isReplacing || isUploading}
                  title="Replace with new file"
                >
                  <RefreshCw className={cn('h-4 w-4', isReplacing && 'animate-spin')} />
                </Button>

                {/* Delete File */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={isDeleting}
                      title="Delete file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete File?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete <strong>{upload.file_name}</strong> and all {upload.row_count.toLocaleString()} rows of data associated with it. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(upload.id, upload.file_name)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No files uploaded yet</p>
        </div>
      )}

      {/* File Management Info */}
      <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
        <p><Eye className="h-3 w-3 inline mr-1" /><strong>Exclude/Include:</strong> Temporarily hide file from calculations (reversible)</p>
        <p><RefreshCw className="h-3 w-3 inline mr-1" /><strong>Replace:</strong> Delete old data and upload corrected file</p>
        <p><Trash2 className="h-3 w-3 inline mr-1" /><strong>Delete:</strong> Permanently remove file and all associated data</p>
      </div>
    </div>
  );
}
