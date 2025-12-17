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
  if (lines.length < 2) return { units: [], fileType: 'Unknown', businessDate: null };
  
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
  
  // Create header index map
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerIndex[h] = i;
  });
  
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
    
    const getValue = (colName: string): string => {
      const idx = headerIndex[colName];
      return idx !== undefined && idx < values.length ? values[idx] : '';
    };
    
    const trgid = getValue('TRGID');
    if (!trgid) continue;
    
    const upcRetail = parseNumber(getValue('UPCRetail'));
    const categoryAvg = parseNumber(getValue('MR_LMR_UPC_AverageCategoryRetail'));
    const effectiveRetail = calculateEffectiveRetail(upcRetail, categoryAvg);
    
    const salePrice = parseNumber(getValue('Sale Price (Discount applied)'));
    const refundAmount = parseNumber(getValue('RefundedSalePriceCalculated'));
    
    const checkInFee = parseNumber(getValue('CheckInFeeCalculated'));
    const packagingFee = parseNumber(getValue('PackagingFeeCalculated'));
    const pickPackShipFee = parseNumber(getValue('ServicePickPackShipFeeCalculated'));
    const refurbishingFee = parseNumber(getValue('ServiceRefurbishingFeeCalculated'));
    const marketplaceFee = parseNumber(getValue('ServiceThirdPartyMarketplaceFeeCalculated'));
    
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
    };
    
    unit.currentStage = determineCurrentStage(unit);
    units.push(unit);
  }
  
  return { units, fileType, businessDate };
}