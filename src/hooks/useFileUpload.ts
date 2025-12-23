import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseCSV } from '@/lib/csvParser';
import { determineFileType, getWMWeekNumber, getWMDayOfWeek } from '@/lib/wmWeek';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<any>(null);
  const { toast } = useToast();

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);

    try {
      const content = await file.text();
      const { units, fileType, businessDate } = parseCSV(content, file.name);

      if (!units.length) throw new Error('No valid rows found');

      const { data: fileUpload, error } = await supabase
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

      if (error) throw error;

      // ================================
      // SALES FILES
      // ================================
      if (fileType === 'Sales') {
        const salesRows = units.map(u => ({
          trgid: u.trgid,
          file_upload_id: fileUpload.id,
          order_closed_date: u.orderClosedDate ? format(u.orderClosedDate, 'yyyy-MM-dd') : null,
          sale_price: u.salePrice || 0,
          gross_sale: u.grossSale || 0,
          effective_retail: u.effectiveRetail,
          refund_amount: u.refundAmount,
          is_refunded: u.isRefunded,
          program_name: u.programName,
          master_program_name: u.masterProgramName,
          category_name: u.categoryName,
          marketplace_profile_sold_on: u.marketplaceProfileSoldOn,
          facility: u.facility,
          tag_clientsource: u.tagClientSource,
          wm_week: u.wmWeek,
          wm_day_of_week: u.wmDayOfWeek,

          // INVOICED FEES
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

          // CALCULATED FEES
          calculated_check_in_fee: u.checkInFee,
          calculated_refurb_fee: u.refurbishingFee,
          calculated_overbox_fee: u.overboxFee,
          calculated_packaging_fee: u.packagingFee,
          calculated_pps_fee: u.pickPackShipFee,
          calculated_shipping_fee: u.shippingFee,
          calculated_merchant_fee: u.merchantFee,
          calculated_revshare_fee: u.revshareFee,
          calculated_marketing_fee: u.marketingFee,
          calculated_refund_fee: u.refundFee,

          b2c_auction: u.b2cAuction,
        }));

        await supabase
          .from('sales_metrics')
          .upsert(salesRows, { onConflict: 'trgid' });
      }

      await supabase
        .from('file_uploads')
        .update({ processed: true })
        .eq('id', fileUpload.id);

      toast({ title: 'Upload complete', description: `${units.length} rows processed` });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  return { uploadFile, isUploading };
}
