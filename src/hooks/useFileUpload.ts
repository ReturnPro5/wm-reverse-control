import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseCSV, ParsedUnit } from '@/lib/csvParser';
import { determineFileType, parseFileBusinessDate, getWMWeekNumber, getWMDayOfWeek } from '@/lib/wmWeek';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

// Read file in chunks to handle large files without memory issues
async function readFileInChunks(file: File, onProgress?: (percent: number) => void): Promise<string> {
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
  const fileSize = file.size;
  
  if (fileSize < CHUNK_SIZE) {
    // Small file, read directly
    return await file.text();
  }
  
  // Large file, read in chunks using streaming
  const chunks: string[] = [];
  let offset = 0;
  
  while (offset < fileSize) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const text = await chunk.text();
    chunks.push(text);
    offset += CHUNK_SIZE;
    
    if (onProgress) {
      onProgress(Math.min((offset / fileSize) * 100, 100));
    }
    
    // Yield to prevent UI blocking
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return chunks.join('');
}

// Read Excel file - let browser handle large files natively
async function readExcelFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
  const fileSizeMB = file.size / (1024 * 1024);
  
  if (onProgress) onProgress(10);
  
  try {
    // Let browser handle the file reading - it's optimized for this
    console.log(`Reading Excel file (${fileSizeMB.toFixed(1)} MB)...`);
    const arrayBuffer = await file.arrayBuffer();
    
    if (onProgress) onProgress(40);
    console.log(`File loaded into memory, parsing workbook...`);
    
    // Use memory-efficient options for large files
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      dense: true, // More memory efficient for large sequential data
      cellFormula: false, // Skip formula parsing
      cellHTML: false, // Skip HTML parsing
      cellText: false, // Skip text generation
      cellStyles: false, // Skip style parsing
    });
    
    if (onProgress) onProgress(70);
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file has no sheets');
    }
    
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    if (!worksheet) {
      throw new Error(`Worksheet "${firstSheetName}" is empty`);
    }
    
    console.log(`Converting sheet "${firstSheetName}" to CSV...`);
    if (onProgress) onProgress(85);
    
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    
    if (!csvContent || csvContent.trim().length === 0) {
      throw new Error('Excel sheet converted to empty CSV');
    }
    
    console.log(`CSV conversion complete, ${csvContent.length} characters`);
    if (onProgress) onProgress(95);
    
    return csvContent;
  } catch (error) {
    console.error('Excel parsing error:', error);
    if (error instanceof Error) {
      if (error.message.includes('memory') || error.message.includes('allocation')) {
        throw new Error(`File too large for browser memory (${fileSizeMB.toFixed(0)} MB). Try saving as CSV in Excel first.`);
      }
      throw error;
    }
    throw new Error(`Failed to parse Excel file: ${String(error)}`);
  }
}

export interface UploadProgress {
  stage: 'reading' | 'parsing' | 'uploading' | 'complete' | 'error';
  message: string;
  progress: number;
  estimatedTimeRemaining?: number; // in seconds
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s remaining`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${minutes}m ${secs}s remaining`;
}

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const { toast } = useToast();
  const uploadStartTime = useRef<number>(0);


  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    uploadStartTime.current = Date.now();
    
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    setUploadProgress({ 
      stage: 'reading', 
      message: `Reading file (${fileSizeMB} MB)...`, 
      progress: 5 
    });

    try {
      let content: string;
      
      // Handle Excel files with progress callback
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (isExcel) {
        setUploadProgress({ stage: 'reading', message: `Converting Excel (${fileSizeMB} MB)...`, progress: 10 });
        content = await readExcelFile(file, (percent) => {
          setUploadProgress({ 
            stage: 'reading', 
            message: `Reading Excel: ${Math.round(percent)}%`, 
            progress: 5 + (percent * 0.2) 
          });
        });
      } else {
        // CSV with progress for large files
        content = await readFileInChunks(file, (percent) => {
          setUploadProgress({ 
            stage: 'reading', 
            message: `Reading file: ${Math.round(percent)}%`, 
            progress: 5 + (percent * 0.2) 
          });
        });
      }
      
      setUploadProgress({ stage: 'parsing', message: 'Parsing data...', progress: 30 });
      
      // Log first few lines for debugging
      const previewLines = content.split('\n').slice(0, 3);
      console.log('File preview - first 3 lines:', previewLines);
      
      // Parse CSV
      const { units, fileType, businessDate } = parseCSV(content, file.name);
      
      if (units.length === 0) {
        // Check if it's a header issue
        const firstLine = content.split('\n')[0];
        const hasHeaders = firstLine && firstLine.length > 0;
        const headerPreview = firstLine?.substring(0, 200);
        console.error('No valid data found. Headers preview:', headerPreview);
        throw new Error(`No valid data found. The file must have a TRGID column. Check console for details. First columns: ${headerPreview?.substring(0, 100)}...`);
      }

      // Show info toast if file type was auto-detected from smart fallback
      const detectedType = determineFileType(file.name);
      const isExplicitType = ['sales', 'inbound', 'outbound', 'inventory', 'production', 'processing'].some(
        keyword => file.name.toLowerCase().includes(keyword)
      );
      
      if (!isExplicitType) {
        toast({
          title: 'File Type Auto-Detected',
          description: `File categorized as "${detectedType}" based on filename. For best results, use naming like: Sales_MM.DD.YY, Inbound_MM.DD.YY, Outbound_MM.DD.YY, Production_MM.DD.YY`,
        });
      }

      setUploadProgress({ stage: 'uploading', message: 'Saving to database...', progress: 50 });

      // Create file upload record
      const { data: fileUpload, error: fileError } = await supabase
        .from('file_uploads')
        .insert({
          file_name: file.name,
          file_type: fileType as any,
          file_business_date: businessDate ? format(businessDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
          row_count: units.length,
          processed: false,
        })
        .select()
        .single();

      if (fileError) throw fileError;

      // Process units in batches with time estimation
      const batchSize = 100;
      const totalBatches = Math.ceil(units.length / batchSize);
      let processedBatches = 0;
      
      for (let i = 0; i < units.length; i += batchSize) {
        const batch = units.slice(i, i + batchSize);
        const progress = 60 + ((i / units.length) * 35);
        
        // Calculate estimated time remaining
        const elapsedTime = (Date.now() - uploadStartTime.current) / 1000;
        const progressFraction = (processedBatches + 1) / totalBatches;
        const estimatedTotalTime = elapsedTime / progressFraction;
        const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);
        
        setUploadProgress({ 
          stage: 'uploading', 
          message: `Processing units ${i + 1}-${Math.min(i + batchSize, units.length)}...`, 
          progress,
          estimatedTimeRemaining: processedBatches > 0 ? estimatedTimeRemaining : undefined
        });

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

        // Insert sales metrics for Sales files
        if (fileType === 'Sales') {
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
              // Invoiced fee fields
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
              // Additional fields
              sorting_index: unit.sortingIndex || null,
              b2c_auction: unit.b2cAuction || null,
              tag_ebay_auction_sale: unit.tagEbayAuctionSale,
              order_type_sold_on: unit.orderTypeSoldOn || null,
            }));

          if (salesRecords.length > 0) {
            const { error: salesError } = await supabase
              .from('sales_metrics')
              .upsert(salesRecords, { onConflict: 'trgid' });

            if (salesError) console.error('Sales insert error:', salesError);
          }
        }

        // Insert fee metrics for Outbound files
        if (fileType === 'Outbound') {
          const feeRecords = batch
            .filter(unit => unit.totalFees !== null)
            .map(unit => ({
              trgid: unit.trgid,
              file_upload_id: fileUpload.id,
              check_in_fee: unit.checkInFee || 0,
              packaging_fee: unit.packagingFee || 0,
              pick_pack_ship_fee: unit.pickPackShipFee || 0,
              refurbishing_fee: unit.refurbishingFee || 0,
              marketplace_fee: unit.marketplaceFee || 0,
              total_fees: unit.totalFees || 0,
              program_name: unit.programName,
              facility: unit.facility,
              wm_week: unit.wmWeek,
            }));

          if (feeRecords.length > 0) {
            const { error: feeError } = await supabase
              .from('fee_metrics')
              .upsert(feeRecords, { onConflict: 'trgid' });

            if (feeError) console.error('Fee insert error:', feeError);
          }
        }
        
        processedBatches++;
      }

      // Mark file as processed
      await supabase
        .from('file_uploads')
        .update({ processed: true })
        .eq('id', fileUpload.id);

      setUploadProgress({ stage: 'complete', message: 'Upload complete!', progress: 100 });

      toast({
        title: 'Success',
        description: `Uploaded ${units.length} units from ${file.name}`,
      });

      return { success: true, unitsCount: units.length, fileType };
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

  return {
    uploadFile,
    isUploading,
    uploadProgress,
    formatTimeRemaining,
  };
}