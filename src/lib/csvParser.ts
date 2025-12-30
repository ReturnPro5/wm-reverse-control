import { getWMWeekNumber, getWMDayOfWeek, determineFileType, parseFileBusinessDate } from './wmWeek';

export interface ParsedUnit {
  trgid: string;
  programName: string;
  masterProgramName: string;
  upc: string;
  categoryName: string;
  title: string;
  productStatus: string;
  upcRetail: number | null;
  mrLmrUpcAverageCategoryRetail: number | null;
  effectiveRetail: number | null;
  checkedInOn: Date | null;
  testedOn: Date | null;
  receivedOn: Date | null;
  firstListedDate: Date | null;
  orderClosedDate: Date | null;
  salePrice: number | null;
  discountAmount: number | null;
  grossSale: number | null;
  refundAmount: number | null;
  isRefunded: boolean;
  checkInFee: number | null;
  packagingFee: number | null;
  pickPackShipFee: number | null;
  refurbishingFee: number | null;
  marketplaceFee: number | null;
  totalFees: number | null;
  marketplaceProfileSoldOn: string;
  facility: string;
  locationId: string;
  tagClientOwnership: string;
  tagClientSource: string;
  wmWeek: number | null;
  wmDayOfWeek: number | null;
  currentStage: 'Received' | 'CheckedIn' | 'Tested' | 'Listed' | 'Sold' | null;

  invoicedCheckInFee: number | null;
  invoicedRefurbFee: number | null;
  invoicedOverboxFee: number | null;
  invoicedPackagingFee: number | null;
  invoicedPpsFee: number | null;
  invoicedShippingFee: number | null;
  invoicedMerchantFee: number | null;
  invoiced3pmpFee: number | null;
  invoicedRevshareFee: number | null;
  invoicedMarketingFee: number | null;
  invoicedRefundFee: number | null;

  serviceInvoiceTotal: number | null;
  vendorInvoiceTotal: number | null;
  expectedHvAsIsRefurbFee: number | null;

  sortingIndex: string;
  b2cAuction: string;
  tagEbayAuctionSale: boolean;
  tagPricingCondition: string;
}

// Parse a number safely with bounds checking
function parseNumber(value: string, min = -1000000, max = 1000000): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[,$]/g, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  // Bounds checking to prevent unreasonable values
  if (num < min || num > max) return null;
  return num;
}

// Parse CSV line properly handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Sanitize text fields to prevent injection and limit size
function sanitizeText(text: string | null, maxLength = 500): string {
  if (!text) return '';
  return text.trim().slice(0, maxLength);
}

// Parse date safely
function parseDate(value: string): Date | null {
  if (!value || value.trim() === '') return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  // Basic sanity check for reasonable dates (1990-2100)
  const year = date.getFullYear();
  if (year < 1990 || year > 2100) return null;
  return date;
}

export function parseCSV(content: string, fileName: string) {
  const lines = content.split('\n');
  if (lines.length < 2) return { units: [], fileType: 'Unknown', businessDate: null };

  const fileType = determineFileType(fileName);
  const businessDate = parseFileBusinessDate(fileName);

  // Parse headers properly
  const headers = parseCSVLine(lines[0]);
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => (headerIndex[h] = i));

  const getValue = (row: string[], col: string) =>
    headerIndex[col] !== undefined ? row[headerIndex[col]] : '';

  const units: ParsedUnit[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const row = parseCSVLine(line);
    const trgid = sanitizeText(getValue(row, 'TRGID'), 50);
    
    // Validate TRGID format (should be numeric)
    if (!trgid || !/^\d+$/.test(trgid)) continue;

    const salePrice = parseNumber(getValue(row, 'Sale Price (Discount applied)'), 0, 1000000);
    const refundAmount = parseNumber(getValue(row, 'RefundedSalePriceCalculated'), 0, 1000000);

    const invoicedCheckInFee =
      parseNumber(getValue(row, 'CheckInFeeInvoiced')) ??
      parseNumber(getValue(row, 'Invoiced_CheckInFee')) ??
      parseNumber(getValue(row, 'InvoicedCheckInFee')) ??
      parseNumber(getValue(row, 'Invoiced Check In Fee'));

    // Try multiple column names for order closed date
    const orderClosedDateStr = getValue(row, 'OrderClosedDate') || 
      getValue(row, 'Order Closed Date') || 
      getValue(row, 'Marketplace Profile Sold On');
    const orderClosedDate = parseDate(orderClosedDateStr);
    
    const receivedOnStr = getValue(row, 'ReceivedOn') || getValue(row, 'Received On');
    const checkedInOnStr = getValue(row, 'CheckedInOn') || getValue(row, 'Checked In On');
    const testedOnStr = getValue(row, 'TestedOn') || getValue(row, 'Tested On');
    const firstListedDateStr = getValue(row, 'FirstListedDate') || getValue(row, 'First Listed Date');

    const unit: ParsedUnit = {
      trgid,
      programName: sanitizeText(getValue(row, 'ProgramName'), 200),
      masterProgramName: sanitizeText(getValue(row, 'Master Program Name'), 200),
      upc: sanitizeText(getValue(row, 'UPC'), 50),
      categoryName: sanitizeText(getValue(row, 'CategoryName'), 200),
      title: sanitizeText(getValue(row, 'Title'), 500),
      productStatus: sanitizeText(getValue(row, 'ProductStatus'), 100),
      upcRetail: parseNumber(getValue(row, 'UPCRetail'), 0, 100000),
      mrLmrUpcAverageCategoryRetail: parseNumber(getValue(row, 'MR_LMR_UPC_AverageCategoryRetail'), 0, 100000),
      effectiveRetail: parseNumber(getValue(row, 'EffectiveRetail') || getValue(row, 'Effective Retail'), 0, 100000),
      checkedInOn: parseDate(checkedInOnStr),
      testedOn: parseDate(testedOnStr),
      receivedOn: parseDate(receivedOnStr),
      firstListedDate: parseDate(firstListedDateStr),
      orderClosedDate,
      salePrice,
      discountAmount: parseNumber(getValue(row, 'Discount Amount') || getValue(row, 'DiscountAmount'), 0, 100000),
      grossSale: parseNumber(getValue(row, 'Gross Sale') || getValue(row, 'GrossSale'), 0, 1000000) ?? salePrice,
      refundAmount,
      isRefunded: !!refundAmount && refundAmount > 0,
      checkInFee: null,
      packagingFee: null,
      pickPackShipFee: null,
      refurbishingFee: null,
      marketplaceFee: null,
      totalFees: null,
      marketplaceProfileSoldOn: sanitizeText(getValue(row, 'MarketplaceProfileSoldOn') || getValue(row, 'Marketplace'), 200),
      facility: sanitizeText(getValue(row, 'Tag_Facility'), 100),
      locationId: sanitizeText(getValue(row, 'LocationID'), 100),
      tagClientOwnership: sanitizeText(getValue(row, 'Tag_Ownership'), 100),
      tagClientSource: sanitizeText(getValue(row, 'Tag_ClientSource'), 100),
      wmWeek: orderClosedDate ? getWMWeekNumber(orderClosedDate) : null,
      wmDayOfWeek: orderClosedDate ? getWMDayOfWeek(orderClosedDate) : null,
      currentStage: orderClosedDate ? 'Sold' : null,

      invoicedCheckInFee,
      invoicedRefurbFee: parseNumber(getValue(row, 'RefurbFeeInvoiced') || getValue(row, 'Invoiced_RefurbFee')),
      invoicedOverboxFee: parseNumber(getValue(row, 'OverboxFeeInvoiced') || getValue(row, 'Invoiced_OverboxFee')),
      invoicedPackagingFee: parseNumber(getValue(row, 'PackagingFeeInvoiced') || getValue(row, 'Invoiced_PackagingFee')),
      invoicedPpsFee: parseNumber(getValue(row, 'PPSFeeInvoiced') || getValue(row, 'Invoiced_PPSFee')),
      invoicedShippingFee: parseNumber(getValue(row, 'ShippingFeeInvoiced') || getValue(row, 'Invoiced_ShippingFee')),
      invoicedMerchantFee: parseNumber(getValue(row, 'MerchantFeeInvoiced') || getValue(row, 'Invoiced_MerchantFee')),
      invoiced3pmpFee: parseNumber(getValue(row, '3PMPFeeInvoiced') || getValue(row, 'Invoiced_3PMPFee')),
      invoicedRevshareFee: parseNumber(getValue(row, 'RevshareFeeInvoiced') || getValue(row, 'Invoiced_RevshareFee')),
      invoicedMarketingFee: parseNumber(getValue(row, 'MarketingFeeInvoiced') || getValue(row, 'Invoiced_MarketingFee')),
      invoicedRefundFee: parseNumber(getValue(row, 'RefundFeeInvoiced') || getValue(row, 'Invoiced_RefundFee')),

      serviceInvoiceTotal: parseNumber(getValue(row, 'ServiceInvoiceTotal') || getValue(row, 'Service Invoice Total')),
      vendorInvoiceTotal: parseNumber(getValue(row, 'VendorInvoiceTotal') || getValue(row, 'Vendor Invoice Total')),
      expectedHvAsIsRefurbFee: parseNumber(getValue(row, 'ExpectedHVAsIsRefurbFee') || getValue(row, 'Expected HV As-Is Refurb Fee')),

      sortingIndex: sanitizeText(getValue(row, 'SortingIndex'), 100),
      b2cAuction: sanitizeText(getValue(row, 'B2CAuction') || getValue(row, 'B2C Auction'), 100),
      tagEbayAuctionSale: getValue(row, 'Tag_EbayAuctionSale')?.toLowerCase() === 'true',
      tagPricingCondition: sanitizeText(getValue(row, 'Tag_PricingCondition'), 100),
    };

    units.push(unit);
  }

  return { units, fileType, businessDate };
}
