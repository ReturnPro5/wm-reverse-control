import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseCSV, ParsedUnit } from '@/lib/csvParser';
import { determineFileType, parseFileBusinessDate, getWMWeekNumber, getWMDayOfWeek } from '@/lib/wmWeek';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export interface UploadProgress {
  stage: 'reading' | 'parsing' | 'uploading' | 'complete' | 'error';
  message: string;
  progress: number;
}

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const { toast } = useToast();

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress({ stage: 'reading', message: 'Reading file...', progress: 10 });

    try {
      const content = await file.text();

      setUploadProgress({ stage: 'parsing', message: 'Parsing data...', progress: 30 });

      const { units, fileType, businessDate } = parseCSV(content, file.name);

      if (units.length === 0) {
        throw new Error('No valid data found in file');
      }

      const detectedType = determineFileType(file.name);
      const isExplicitType = ['sales', 'inbound', 'outbound', 'inventory', 'production', 'processing'].some(
        keyword => file.name.toLowerCase().includes(keyword)
      );

      if (!isExplicitType) {
        toast({
          title: 'File Type Auto-Detected',
          description: `File categorized as "${detectedType}" based on filename.`,
        });
      }

      setUploadProgress({ stage: 'uploading', message: 'Saving to database...', progress: 50 });

      const { data: fileUpload, error: fileError } = await supabase
        .from('file_uploads')
        .insert({
          file_name: file.name,
          file_type: fileType as any,
          file_business_date: businessDate
            ? format(businessDate, 'yyyy-MM-dd')
            : format(new Date(), 'yyyy-MM-dd'),
          row_count: units.length,
          processed: false,
        })
        .select()
        .single();

      if (fileError) throw fileError;

      setUploadProgress({ stage: 'uploading', message: 'Processing units...', progress: 60 });

      const batchSize = 100;

      for (let i = 0; i < units.length; i += batchSize) {
        const batch = units.slice(i, i + batchSize);

        // ===============================
        // UNITS CANONICAL
        // ===============================
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

        await supabase.from('units_canonical').upsert(canonicalRecords, { onConflict: 'trgid' });

        // ===============================
        // LIFECYCLE EVENTS
        // ===============================
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
                file_business_date: businessDate
                  ? format(businessDate, 'yyyy-MM-dd')
                  : format(new Date(), 'yyyy-MM-dd'),
                wm_week: getWMWeekNumber(date),
                wm_day_of_week: getWMDayOfWeek(date),
              });
            }
          }
        }

        if (lifecycleEvents.length) {
          await supabase.from('lifecycle_events').insert(lifecycleEvents);
        }

        // ===============================
        // SALES METRICS (FULL FEE SUPPORT)
        // ===============================
        if (fileType === 'Sales') {
          const salesRecords = batch
            .filter(u => u.orderClosedDate)
            .map(u => ({
              trgid: u.trgid,
              file_upload_id: fileUpload.id,
              order_closed_date: format(u.orderClosedDate!, 'yyyy-MM-dd'),
              sale_price: u.salePrice || 0,
              discount_amount: u.discountAmount || 0,
              gross_sale: u.grossSale || 0,
              effective_retail: u.effectiveRetail,
              refund_amount: u.refundAmount || 0,
              is_refunded: u.isRefunded,
              program_name: u.programName,
              master_program_name: u.masterProgramName,
              category_name: u.categoryName,
              marketplace_profile_sold_on: u.marketplaceProfileSoldOn,
              facility: u.facility,
              tag_clientsource: u.tagClientSource || null,
              wm_week: u.wmWeek,
              wm_day_of_week: u.wmDayOfWeek,

              // INVOICED FEES (columns that exist in schema)
              invoiced_check_in_fee: u.invoicedCheckInFee,
              invoiced_refurb_fee: u.invoicedRefurbFee,
              invoiced_overbox_fee: u.invoicedOverboxFee,
              invoiced_packaging_fee: u.invoicedPackagingFee,
              invoiced_pps_fee: u.invoicedPpsFee,
              invoiced_shipping_fee: u.invoicedShippingFee,
              invoiced_merchant_fee: u.invoicedMerchantFee,
              invoiced_3pmp_fee: u.invoiced3pmpFee,
              invoiced_revshare_fee: u.invoicedRevshareFee,
              invoiced_marketing_fee: u.invoicedMarketingFee,
              invoiced_refund_fee: u.invoicedRefundFee,

              // CALCULATED CHECK-IN FEE (only column that exists)
              calculated_check_in_fee: u.checkInFee,

              // Expected fee from CSV
              expected_hv_as_is_refurb_fee: u.refurbishingFee,

              b2c_auction: u.b2cAuction || null,
              sorting_index: u.sortingIndex || null,
              tag_ebay_auction_sale: u.tagEbayAuctionSale,
            }));

          if (salesRecords.length) {
            await supabase.from('sales_metrics').upsert(salesRecords, { onConflict: 'trgid' });
          }
        }
      }

      await supabase.from('file_uploads').update({ processed: true }).eq('id', fileUpload.id);

      setUploadProgress({ stage: 'complete', message: 'Upload complete!', progress: 100 });

      toast({
        title: 'Success',
        description: `Uploaded ${units.length} units from ${file.name}`,
      });

      return { success: true };
    } catch (error) {
      console.error(error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Upload failed',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(null), 3000);
    }
  }, [toast]);

  return { uploadFile, isUploading, uploadProgress };
}
