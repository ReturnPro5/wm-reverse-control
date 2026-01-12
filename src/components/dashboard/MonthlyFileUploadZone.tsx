import { useCallback, useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { parseCSV } from '@/lib/csvParser';
import { parseFileBusinessDate, getWMWeekNumber, getWMDayOfWeek } from '@/lib/wmWeek';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface UploadProgress {
  stage: 'reading' | 'parsing' | 'uploading' | 'complete' | 'error';
  message: string;
  progress: number;
}

interface MonthlyFileUploadZoneProps {
  onUploadComplete?: () => void;
  className?: string;
}

export function MonthlyFileUploadZone({ onUploadComplete, className }: MonthlyFileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const { toast } = useToast();

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress({ stage: 'reading', message: 'Reading file...', progress: 10 });

    try {
      const content = await file.text();
      
      setUploadProgress({ stage: 'parsing', message: 'Parsing data...', progress: 30 });
      
      const { units, businessDate } = parseCSV(content, file.name);
      
      if (units.length === 0) {
        throw new Error('No valid data found in file');
      }

      setUploadProgress({ stage: 'uploading', message: 'Saving to database...', progress: 50 });

      // Create file upload record with FORCED Monthly type
      const { data: fileUpload, error: fileError } = await supabase
        .from('file_uploads')
        .insert({
          file_name: file.name,
          file_type: 'Monthly' as const,
          file_business_date: businessDate ? format(businessDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
          row_count: units.length,
          processed: false,
        })
        .select()
        .single();

      if (fileError) throw fileError;

      setUploadProgress({ stage: 'uploading', message: 'Processing units...', progress: 60 });

      // Process units in batches
      const batchSize = 100;
      for (let i = 0; i < units.length; i += batchSize) {
        const batch = units.slice(i, i + batchSize);
        const progress = 60 + ((i / units.length) * 35);
        setUploadProgress({ stage: 'uploading', message: `Processing units ${i + 1}-${Math.min(i + batchSize, units.length)}...`, progress });

        // Upsert to units_canonical
        const canonicalRecords = batch.map(unit => ({
          trgid: unit.trgid,
          file_upload_id: fileUpload.id,
          received_on: unit.receivedOn ? format(unit.receivedOn, 'yyyy-MM-dd') : null,
          checked_in_on: unit.checkedInOn ? format(unit.checkedInOn, 'yyyy-MM-dd') : null,
          tested_on: unit.testedOn ? format(unit.testedOn, 'yyyy-MM-dd') : null,
          first_listed_date: unit.firstListedDate ? format(unit.firstListedDate, 'yyyy-MM-dd') : null,
          order_closed_date: unit.orderClosedDate ? format(unit.orderClosedDate, 'yyyy-MM-dd') : null,
          current_stage: unit.currentStage as any,
          upc_retail: unit.upcRetail,
          mr_lmr_upc_average_category_retail: unit.mrLmrUpcAverageCategoryRetail,
          effective_retail: unit.effectiveRetail,
          sale_price: unit.salePrice,
          discount_amount: unit.discountAmount,
          program_name: unit.programName,
          master_program_name: unit.masterProgramName,
          category_name: unit.categoryName,
          marketplace_profile_sold_on: unit.marketplaceProfileSoldOn,
          facility: unit.facility,
          location_id: unit.locationId,
          tag_client_ownership: unit.tagClientOwnership,
          tag_clientsource: unit.tagClientSource || null,
          wm_week: unit.wmWeek,
          wm_day_of_week: unit.wmDayOfWeek,
        }));

        const { error: canonicalError } = await supabase
          .from('units_canonical')
          .upsert(canonicalRecords, { onConflict: 'trgid' });

        if (canonicalError) throw canonicalError;

        // Insert lifecycle events
        const lifecycleEvents: any[] = [];
        for (const unit of batch) {
          const stages = [
            { stage: 'Received', date: unit.receivedOn },
            { stage: 'CheckedIn', date: unit.checkedInOn },
            { stage: 'Tested', date: unit.testedOn },
            { stage: 'Listed', date: unit.firstListedDate },
            { stage: 'Sold', date: unit.orderClosedDate },
          ];

          for (const { stage, date } of stages) {
            if (date) {
              lifecycleEvents.push({
                trgid: unit.trgid,
                file_upload_id: fileUpload.id,
                stage: stage as any,
                event_date: format(date, 'yyyy-MM-dd'),
                file_business_date: businessDate ? format(businessDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                wm_week: getWMWeekNumber(date),
                wm_day_of_week: getWMDayOfWeek(date),
              });
            }
          }
        }

        if (lifecycleEvents.length > 0) {
          const { error: lifecycleError } = await supabase
            .from('lifecycle_events')
            .insert(lifecycleEvents);

          if (lifecycleError) console.error('Lifecycle insert error:', lifecycleError);
        }

        // Insert sales metrics for Monthly files (same structure as Sales)
        const salesRecords = batch
          .filter(unit => unit.orderClosedDate)
          .map(unit => ({
            trgid: unit.trgid,
            file_upload_id: fileUpload.id,
            order_closed_date: format(unit.orderClosedDate!, 'yyyy-MM-dd'),
            sale_price: unit.salePrice || 0,
            discount_amount: unit.discountAmount || 0,
            gross_sale: unit.grossSale || 0,
            effective_retail: unit.effectiveRetail,
            refund_amount: unit.refundAmount || 0,
            is_refunded: unit.isRefunded,
            program_name: unit.programName,
            master_program_name: unit.masterProgramName,
            category_name: unit.categoryName,
            marketplace_profile_sold_on: unit.marketplaceProfileSoldOn,
            facility: unit.facility,
            tag_clientsource: unit.tagClientSource || null,
            wm_week: unit.wmWeek,
            wm_day_of_week: unit.wmDayOfWeek,
            invoiced_check_in_fee: unit.invoicedCheckInFee,
            invoiced_refurb_fee: unit.invoicedRefurbFee,
            invoiced_overbox_fee: unit.invoicedOverboxFee,
            invoiced_packaging_fee: unit.invoicedPackagingFee,
            invoiced_pps_fee: unit.invoicedPpsFee,
            invoiced_shipping_fee: unit.invoicedShippingFee,
            invoiced_merchant_fee: unit.invoicedMerchantFee,
            invoiced_3pmp_fee: unit.invoiced3pmpFee,
            invoiced_revshare_fee: unit.invoicedRevshareFee,
            invoiced_marketing_fee: unit.invoicedMarketingFee,
            invoiced_refund_fee: unit.invoicedRefundFee,
            service_invoice_total: unit.serviceInvoiceTotal,
            vendor_invoice_total: unit.vendorInvoiceTotal,
            expected_hv_as_is_refurb_fee: unit.expectedHvAsIsRefurbFee,
            sorting_index: unit.sortingIndex || null,
            b2c_auction: unit.b2cAuction || null,
            tag_ebay_auction_sale: unit.tagEbayAuctionSale,
          }));

        if (salesRecords.length > 0) {
          const { error: salesError } = await supabase
            .from('sales_metrics')
            .upsert(salesRecords, { onConflict: 'trgid' });

          if (salesError) console.error('Sales insert error:', salesError);
        }
      }

      // Mark file as processed
      await supabase
        .from('file_uploads')
        .update({ processed: true })
        .eq('id', fileUpload.id);

      setUploadProgress({ stage: 'complete', message: 'Upload complete!', progress: 100 });

      toast({
        title: 'Success',
        description: `Uploaded ${units.length} units from ${file.name} as Monthly data`,
      });

      return { success: true, unitsCount: units.length };
    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress({ stage: 'error', message: error instanceof Error ? error.message : 'Upload failed', progress: 0 });
      
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'An error occurred during upload',
        variant: 'destructive',
      });

      return { success: false, error };
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(null), 3000);
    }
  }, [toast]);

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
    const csvOrExcel = files.filter(f => 
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    
    for (const file of csvOrExcel) {
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
      <h3 className="text-lg font-semibold mb-4">Upload Monthly Files</h3>
      
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          isUploading && 'pointer-events-none opacity-75'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
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
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium">Drop monthly files here or click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Files will be stored as Monthly data for quarterly review
                </p>
              </div>
            </>
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
