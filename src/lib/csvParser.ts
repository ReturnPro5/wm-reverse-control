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
  // Invoiced fee fields from sales files
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
  // Additional sales fields
  sortingIndex: string;
  b2cAuction: string;
  tagEbayAuctionSale: boolean;
  orderTypeSoldOn: string;
}

function parseDate(value: string): Date | null {
  if (!value || value.trim() === '') return null;
  
  // Try MM/DD/YYYY HH:MM:SS AM/PM format
  const dateTimeMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/i);
  if (dateTimeMatch) {
    const [, month, day, year, hours, minutes, seconds, ampm] = dateTimeMatch;
    let hour = parseInt(hours, 10);
    if (ampm?.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ampm?.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour, parseInt(minutes), parseInt(seconds));
  }
  
  // Try MM/DD/YYYY format - use noon to avoid timezone edge cases
  const dateMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    const [, month, day, year] = dateMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
  }
  
  return null;
}

function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const cleaned = value.replace(/[,$]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseBoolean(value: string): boolean {
  if (!value || value.trim() === '') return false;
  const lower = value.toLowerCase().trim();
  return lower === 'true' || lower === 'yes' || lower === '1';
}

function calculateEffectiveRetail(upcRetail: number | null, categoryAvg: number | null): number | null {
  if (upcRetail === null && categoryAvg === null) return null;
  if (upcRetail === null) return categoryAvg;
  if (categoryAvg === null) return upcRetail;
  return Math.min(upcRetail, categoryAvg);
}

function determineCurrentStage(unit: Partial<ParsedUnit>): 'Received' | 'CheckedIn' | 'Tested' | 'Listed' | 'Sold' | null {
  if (unit.orderClosedDate) return 'Sold';
  if (unit.firstListedDate) return 'Listed';
  if (unit.testedOn) return 'Tested';
  if (unit.checkedInOn) return 'CheckedIn';
  if (unit.receivedOn) return 'Received';
  return null;
}

export function parseCSV(content: string, fileName: string): { units: ParsedUnit[]; fileType: string; businessDate: Date | null } {
  const lines = content.split('\n');
  if (lines.length < 2) {
    console.error('CSV Parser: File has fewer than 2 lines');
    return { units: [], fileType: 'Unknown', businessDate: null };
  }
  
  const fileType = determineFileType(fileName);
  const businessDate = parseFileBusinessDate(fileName);
  
  // Parse header row
  const headerLine = lines[0];
  const headers: string[] = [];
  let inQuotes = false;
  let currentHeader = '';
  
  for (const char of headerLine) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      headers.push(currentHeader.trim());
      currentHeader = '';
    } else {
      currentHeader += char;
    }
  }
  headers.push(currentHeader.trim());
  
  // Log headers for debugging
  console.log('CSV Parser: Found', headers.length, 'columns');
  console.log('CSV Parser: First 10 headers:', headers.slice(0, 10));
  
  // Create header index map (case-insensitive and with space/underscore normalization)
  const headerIndex: Record<string, number> = {};
  const normalizedHeaderIndex: Record<string, number> = {};
  
  headers.forEach((h, i) => {
    headerIndex[h] = i;
    // Also create normalized versions (lowercase, no spaces/underscores)
    const normalized = h.toLowerCase().replace(/[\s_-]/g, '');
    normalizedHeaderIndex[normalized] = i;
  });
  
  // Helper to find column with flexible matching
  const findColumnIndex = (...possibleNames: string[]): number => {
    for (const name of possibleNames) {
      // Try exact match first
      if (headerIndex[name] !== undefined) return headerIndex[name];
      // Try normalized match
      const normalized = name.toLowerCase().replace(/[\s_-]/g, '');
      if (normalizedHeaderIndex[normalized] !== undefined) return normalizedHeaderIndex[normalized];
    }
    return -1;
  };
  
  // Find TRGID column with flexible matching
  const trgidColIndex = findColumnIndex('TRGID', 'trgid', 'TrgId', 'Trgid', 'TRG ID', 'TRG_ID');
  
  if (trgidColIndex === -1) {
    console.error('CSV Parser: TRGID column not found. Available headers:', headers.join(', '));
    return { units: [], fileType, businessDate };
  }
  
  console.log('CSV Parser: TRGID column found at index', trgidColIndex);
  
  const units: ParsedUnit[] = [];
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line respecting quotes
    const values: string[] = [];
    let inQuote = false;
    let currentValue = '';
    
    for (const char of line) {
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());
    
    // More flexible getValue that tries multiple column name variants
    const getValue = (colName: string): string => {
      const idx = headerIndex[colName];
      if (idx !== undefined && idx < values.length) return values[idx];
      
      // Try normalized lookup
      const normalized = colName.toLowerCase().replace(/[\s_-]/g, '');
      const normalizedIdx = normalizedHeaderIndex[normalized];
      if (normalizedIdx !== undefined && normalizedIdx < values.length) return values[normalizedIdx];
      
      return '';
    };
    
    const trgid = values[trgidColIndex]?.trim();
    if (!trgid) continue;
    
    const upcRetail = parseNumber(getValue('UPCRetail'));
    const categoryAvg = parseNumber(getValue('MR_LMR_UPC_AverageCategoryRetail'));
    const effectiveRetail = calculateEffectiveRetail(upcRetail, categoryAvg);
    
    const salePrice = parseNumber(getValue('Sale Price (Discount applied)'));
    const refundAmount = parseNumber(getValue('RefundedSalePriceCalculated'));
    
    // Calculated fees (from Outbound files)
    const checkInFee = parseNumber(getValue('CheckInFeeCalculated'));
    const packagingFee = parseNumber(getValue('PackagingFeeCalculated'));
    const pickPackShipFee = parseNumber(getValue('ServicePickPackShipFeeCalculated'));
    const refurbishingFee = parseNumber(getValue('ServiceRefurbishingFeeCalculated'));
    const marketplaceFee = parseNumber(getValue('ServiceThirdPartyMarketplaceFeeCalculated'));
    
    // Invoiced fees (from Sales files) - try multiple column name variants
    const invoicedCheckInFee = parseNumber(getValue('Invoiced_CheckInFee')) ?? parseNumber(getValue('InvoicedCheckInFee')) ?? parseNumber(getValue('Invoiced Check In Fee'));
    const invoicedRefurbFee = parseNumber(getValue('Invoiced_RefurbFee')) ?? parseNumber(getValue('InvoicedRefurbFee')) ?? parseNumber(getValue('Invoiced Refurb Fee'));
    const invoicedOverboxFee = parseNumber(getValue('Invoiced_OverboxFee')) ?? parseNumber(getValue('InvoicedOverboxFee')) ?? parseNumber(getValue('Invoiced Overbox Fee'));
    const invoicedPackagingFee = parseNumber(getValue('Invoiced_PackagingFee')) ?? parseNumber(getValue('InvoicedPackagingFee')) ?? parseNumber(getValue('Invoiced Packaging Fee'));
    const invoicedPpsFee = parseNumber(getValue('Invoiced_PPSFee')) ?? parseNumber(getValue('InvoicedPPSFee')) ?? parseNumber(getValue('Invoiced PPS Fee'));
    const invoicedShippingFee = parseNumber(getValue('Invoiced_ShippingFee')) ?? parseNumber(getValue('InvoicedShippingFee')) ?? parseNumber(getValue('Invoiced Shipping Fee'));
    const invoicedMerchantFee = parseNumber(getValue('Invoiced_MerchantFee')) ?? parseNumber(getValue('InvoicedMerchantFee')) ?? parseNumber(getValue('Invoiced Merchant Fee'));
    const invoiced3pmpFee = parseNumber(getValue('Invoiced_3PMPFee')) ?? parseNumber(getValue('Invoiced3PMPFee')) ?? parseNumber(getValue('Invoiced 3PMP Fee'));
    const invoicedRevshareFee = parseNumber(getValue('Invoiced_RevshareFee')) ?? parseNumber(getValue('InvoicedRevshareFee')) ?? parseNumber(getValue('Invoiced Revshare Fee'));
    const invoicedMarketingFee = parseNumber(getValue('Invoiced_MarketingFee')) ?? parseNumber(getValue('InvoicedMarketingFee')) ?? parseNumber(getValue('Invoiced Marketing Fee'));
    const invoicedRefundFee = parseNumber(getValue('Invoiced_RefundFee')) ?? parseNumber(getValue('InvoicedRefundFee')) ?? parseNumber(getValue('Invoiced Refund Fee'));
    
    // Invoice totals
    const serviceInvoiceTotal = parseNumber(getValue('ServiceInvoiceTotal')) ?? parseNumber(getValue('Service Invoice Total'));
    const vendorInvoiceTotal = parseNumber(getValue('VendorInvoiceTotal')) ?? parseNumber(getValue('Vendor Invoice Total'));
    
    // Expected HV AS-IS refurb fee
    const expectedHvAsIsRefurbFee = parseNumber(getValue('Expected_HV_AS_IS_RefurbFee')) ?? parseNumber(getValue('ExpectedHVASISRefurbFee')) ?? parseNumber(getValue('Expected HV AS-IS Refurb Fee'));
    
    // Sorting and auction fields
    const sortingIndex = getValue('SortingIndex') || getValue('Sorting Index') || getValue('sorting_index') || '';
    const b2cAuction = getValue('B2C_Auction') || getValue('B2CAuction') || getValue('B2C Auction') || '';
    const tagEbayAuctionSale = parseBoolean(getValue('Tag_EbayAuctionSale') || getValue('TagEbayAuctionSale') || getValue('Tag Ebay Auction Sale'));
    const orderTypeSoldOn = getValue('Order Type Sold On') || getValue('OrderTypeSoldOn') || getValue('Order_Type_Sold_On') || '';
    
    const orderClosedDate = parseDate(getValue('OrderClosedDate'));
    
    const unit: ParsedUnit = {
      trgid,
      programName: getValue('ProgramName'),
      masterProgramName: getValue('Master Program Name'),
      upc: getValue('UPC').replace(/^'/, ''),
      categoryName: getValue('CategoryName'),
      title: getValue('Title'),
      productStatus: getValue('ProductStatus'),
      upcRetail,
      mrLmrUpcAverageCategoryRetail: categoryAvg,
      effectiveRetail,
      checkedInOn: parseDate(getValue('CheckedInOn')),
      testedOn: parseDate(getValue('TestedOn')),
      receivedOn: parseDate(getValue('ReceivedOn')),
      firstListedDate: parseDate(getValue('FirstListedOnMarketplaceOn')),
      orderClosedDate,
      salePrice,
      discountAmount: null,
      grossSale: salePrice,
      refundAmount,
      isRefunded: !!refundAmount && refundAmount > 0,
      checkInFee,
      packagingFee,
      pickPackShipFee,
      refurbishingFee,
      marketplaceFee,
      totalFees: [checkInFee, packagingFee, pickPackShipFee, refurbishingFee, marketplaceFee]
        .filter(f => f !== null)
        .reduce((sum, f) => sum + (f || 0), 0) || null,
      marketplaceProfileSoldOn: getValue('Marketplace Profile Sold On'),
      facility: getValue('Tag_Facility'),
      locationId: getValue('LocationID'),
      tagClientOwnership: getValue('Tag_Ownership'),
      tagClientSource: getValue('Tag_ClientSource') || getValue('ClientSource_Tag') || getValue('Tag_Client_Source'),
      wmWeek: orderClosedDate ? getWMWeekNumber(orderClosedDate) : null,
      wmDayOfWeek: orderClosedDate ? getWMDayOfWeek(orderClosedDate) : null,
      currentStage: null,
      // Invoiced fees
      invoicedCheckInFee,
      invoicedRefurbFee,
      invoicedOverboxFee,
      invoicedPackagingFee,
      invoicedPpsFee,
      invoicedShippingFee,
      invoicedMerchantFee,
      invoiced3pmpFee,
      invoicedRevshareFee,
      invoicedMarketingFee,
      invoicedRefundFee,
      serviceInvoiceTotal,
      vendorInvoiceTotal,
      expectedHvAsIsRefurbFee,
      // Additional fields
      sortingIndex,
      b2cAuction,
      tagEbayAuctionSale,
      orderTypeSoldOn,
    };
    
    unit.currentStage = determineCurrentStage(unit);
    units.push(unit);
  }
  
  return { units, fileType, businessDate };
}