import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Edit2, Check, X, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
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

type FileType = Database['public']['Enums']['file_type'];

interface TabFileManagerProps {
  fileType: FileType;
  onFilesChanged?: () => void;
}

export function TabFileManager({ fileType, onFilesChanged }: TabFileManagerProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: files, isLoading } = useQuery({
    queryKey: ['file-uploads', fileType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('file_uploads')
        .select('*')
        .eq('file_type', fileType)
        .order('upload_timestamp', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (fileId: string, fileName: string) => {
    setDeletingId(fileId);
    try {
      // Delete associated data first
      await supabase.from('lifecycle_events').delete().eq('file_upload_id', fileId);
      await supabase.from('sales_metrics').delete().eq('file_upload_id', fileId);
      await supabase.from('fee_metrics').delete().eq('file_upload_id', fileId);
      await supabase.from('units_canonical').delete().eq('file_upload_id', fileId);
      
      // Delete the file record
      const { error } = await supabase.from('file_uploads').delete().eq('id', fileId);
      
      if (error) throw error;
      
      toast.success(`Deleted "${fileName}"`);
      queryClient.invalidateQueries({ queryKey: ['file-uploads'] });
      onFilesChanged?.();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (file: { id: string; file_name: string }) => {
    setEditingId(file.id);
    setEditName(file.file_name);
  };

  const handleSaveEdit = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('file_uploads')
        .update({ file_name: editName })
        .eq('id', fileId);
      
      if (error) throw error;
      
      toast.success('File renamed');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['file-uploads'] });
    } catch (error) {
      console.error('Error updating file:', error);
      toast.error('Failed to rename file');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">{fileType} Files</h3>
        <p className="text-muted-foreground">Loading files...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">{fileType} Files ({files?.length || 0})</h3>
      
      {files && files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file) => (
            <div 
              key={file.id} 
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                {editingId === file.id ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                ) : (
                  <div className="min-w-0">
                    <p className="font-medium truncate">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(file.upload_timestamp), 'MMM d, yyyy h:mm a')} • {file.row_count?.toLocaleString()} rows
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                {editingId === file.id ? (
                  <>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleSaveEdit(file.id)}
                    >
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleEdit(file)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          disabled={deletingId === file.id}
                        >
                          {deletingId === file.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete File?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete <strong>{file.file_name}</strong> and all {file.row_count?.toLocaleString()} rows of data associated with it. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(file.id, file.file_name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-4">
          No {fileType.toLowerCase()} files uploaded yet.
        </p>
      )}
    </div>
  );
}
