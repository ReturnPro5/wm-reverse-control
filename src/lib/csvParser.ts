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

  // Invoiced fees
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
}

function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const cleaned = value.replace(/[,$]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function parseCSV(content: string, fileName: string) {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => (headerIndex[h] = i));

  const getValue = (row: string[], name: string) =>
    headerIndex[name] !== undefined ? row[headerIndex[name]] : '';

  const units: ParsedUnit[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(v => v.trim());
    const trgid = getValue(row, 'TRGID');
    if (!trgid) continue;

    const invoicedCheckInFee =
      parseNumber(getValue(row, 'CheckInFeeInvoiced')) ??
      parseNumber(getValue(row, 'Invoiced_CheckInFee')) ??
      parseNumber(getValue(row, 'InvoicedCheckInFee')) ??
      parseNumber(getValue(row, 'Invoiced Check In Fee'));

    const orderClosedDate = getValue(row, 'OrderClosedDate')
      ? new Date(getValue(row, 'OrderClosedDate'))
      : null;

    units.push({
      trgid,
      programName: getValue(row, 'ProgramName'),
      masterProgramName: getValue(row, 'Master Program Name'),
      upc: getValue(row, 'UPC'),
      categoryName: getValue(row, 'CategoryName'),
      title: getValue(row, 'Title'),
      productStatus: getValue(row, 'ProductStatus'),
      upcRetail: parseNumber(getValue(row, 'UPCRetail')),
      mrLmrUpcAverageCategoryRetail: parseNumber(getValue(row, 'MR_LMR_UPC_AverageCategoryRetail')),
      effectiveRetail: null,
      checkedInOn: null,
      testedOn: null,
      receivedOn: null,
      firstListedDate: null,
      orderClosedDate,
      salePrice: parseNumber(getValue(row, 'Sale Price (Discount applied)')),
      discountAmount: null,
      grossSale: parseNumber(getValue(row, 'Sale Price (Discount applied)')),
      refundAmount: parseNumber(getValue(row, 'RefundedSalePriceCalculated')),
      isRefunded: false,
      checkInFee: null,
      packagingFee: null,
      pickPackShipFee: null,
      refurbishingFee: null,
      marketplaceFee: null,
      totalFees: null,
      marketplaceProfileSoldOn: getValue(row, 'Marketplace Profile Sold On'),
      facility: getValue(row, 'Tag_Facility'),
      locationId: getValue(row, 'LocationID'),
      tagClientOwnership: getValue(row, 'Tag_Ownership'),
      tagClientSource: getValue(row, 'Tag_ClientSource'),
      wmWeek: orderClosedDate ? getWMWeekNumber(orderClosedDate) : null,
      wmDayOfWeek: orderClosedDate ? getWMDayOfWeek(orderClosedDate) : null,
      currentStage: null,

      invoicedCheckInFee,
      invoicedRefurbFee: null,
      invoicedOverboxFee: null,
      invoicedPackagingFee: null,
      invoicedPpsFee: null,
      invoicedShippingFee: null,
      invoicedMerchantFee: null,
      invoiced3pmpFee: null,
      invoicedRevshareFee: null,
      invoicedMarketingFee: null,
      invoicedRefundFee: null,
      serviceInvoiceTotal: null,
      vendorInvoiceTotal: null,
      expectedHvAsIsRefurbFee: null,
      sortingIndex: '',
      b2cAuction: '',
      tagEbayAuctionSale: false,
    });
  }

  return {
    units,
    fileType: determineFileType(fileName),
    businessDate: parseFileBusinessDate(fileName),
  };
}
