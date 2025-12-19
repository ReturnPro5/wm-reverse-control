import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { calculateFeesForSale, SaleRecord } from '@/lib/feeCalculator';
import expectedFeesCsv from '@/data/fee_data_expected.csv?raw';

interface ExpectedFee {
  trgid: string;
  thirdPartyMPFee: number;
  checkInFee: number;
  marketingFee: number;
  merchantFee: number;
  overboxFee: number;
  packagingFee: number;
  ppsFee: number;
  refundFee: number;
  refurbFee: number;
  revshareFee: number;
  shippingFee: number;
}

// Parse the expected fees CSV
const parseExpectedFees = (csv: string): Record<string, ExpectedFee> => {
  const lines = csv.split('\n').slice(1);
  const lookup: Record<string, ExpectedFee> = {};
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = line.split(',');
    if (fields.length < 12) continue;
    
    const trgid = fields[0];
    const parseValue = (v: string) => {
      const cleaned = v.replace(/[$,%]/g, '').trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };
    
    lookup[trgid] = {
      trgid,
      thirdPartyMPFee: parseValue(fields[1]),
      checkInFee: parseValue(fields[2]),
      marketingFee: parseValue(fields[3]),
      merchantFee: parseValue(fields[4]),
      overboxFee: parseValue(fields[5]),
      packagingFee: parseValue(fields[6]),
      ppsFee: parseValue(fields[7]),
      refundFee: parseValue(fields[8]),
      refurbFee: parseValue(fields[9]),
      revshareFee: parseValue(fields[10]),
      shippingFee: parseValue(fields[11]),
    };
  }
  return lookup;
};

interface FeeComparison {
  trgid: string;
  feeType: string;
  expected: number;
  calculated: number;
  difference: number;
  percentDiff: number;
  status: 'match' | 'close' | 'mismatch' | 'missing_expected' | 'missing_calculated';
}

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

export function FeeComparisonTable() {
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const pageSize = 50;

  // Parse expected fees
  const expectedFeesLookup = useMemo(() => parseExpectedFees(expectedFeesCsv), []);

  // Fetch sales data from Supabase
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales-for-comparison'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_metrics')
        .select('*')
        .limit(10000);
      if (error) throw error;
      return data;
    },
  });

  // Build comparison data
  const comparisons = useMemo(() => {
    if (!salesData) return [];
    
    const allComparisons: FeeComparison[] = [];
    const feeTypes = [
      'checkInFee', 'refurbFee', 'overboxFee', 'packagingFee', 'ppsFee',
      'shippingFee', 'merchantFee', 'revshareFee', 'thirdPartyMPFee', 'marketingFee', 'refundFee'
    ];
    
    for (const sale of salesData) {
      const trgid = sale.trgid;
      const expected = expectedFeesLookup[trgid];
      
      // Build sale record for calculation
      const saleRecord: SaleRecord = {
        sale_price: Number(sale.sale_price) || 0,
        category_name: sale.category_name,
        program_name: sale.program_name,
        marketplace_profile_sold_on: sale.marketplace_profile_sold_on,
        facility: sale.facility,
        effective_retail: Number(sale.effective_retail) || 0,
        tag_clientsource: sale.tag_clientsource,
        tag_pricing_condition: sale.tag_pricing_condition,
        sorting_index: sale.sorting_index,
        refund_amount: Number(sale.refund_amount) || 0,
        invoiced_check_in_fee: Number(sale.invoiced_check_in_fee) || null,
        invoiced_refurb_fee: Number(sale.invoiced_refurb_fee) || null,
        invoiced_overbox_fee: Number(sale.invoiced_overbox_fee) || null,
        invoiced_packaging_fee: Number(sale.invoiced_packaging_fee) || null,
        invoiced_pps_fee: Number(sale.invoiced_pps_fee) || null,
        invoiced_shipping_fee: Number(sale.invoiced_shipping_fee) || null,
        invoiced_merchant_fee: Number(sale.invoiced_merchant_fee) || null,
        invoiced_revshare_fee: Number(sale.invoiced_revshare_fee) || null,
        invoiced_3pmp_fee: Number(sale.invoiced_3pmp_fee) || null,
        invoiced_marketing_fee: Number(sale.invoiced_marketing_fee) || null,
        invoiced_refund_fee: Number(sale.invoiced_refund_fee) || null,
        expected_hv_as_is_refurb_fee: Number(sale.expected_hv_as_is_refurb_fee) || null,
        vendor_invoice_total: Number(sale.vendor_invoice_total) || null,
        service_invoice_total: Number(sale.service_invoice_total) || null,
      };
      
      const calculated = calculateFeesForSale(saleRecord);
      
      // Compare each fee type
      for (const feeType of feeTypes) {
        const expectedVal = expected ? (expected as any)[feeType] || 0 : 0;
        const calculatedVal = (calculated as any)[feeType] || 0;
        const diff = calculatedVal - expectedVal;
        const percentDiff = expectedVal !== 0 ? (diff / expectedVal) * 100 : (calculatedVal !== 0 ? 100 : 0);
        
        let status: FeeComparison['status'] = 'match';
        if (!expected) {
          status = 'missing_expected';
        } else if (expectedVal === 0 && calculatedVal === 0) {
          status = 'match';
        } else if (Math.abs(diff) < 0.01) {
          status = 'match';
        } else if (Math.abs(percentDiff) <= 5) {
          status = 'close';
        } else {
          status = 'mismatch';
        }
        
        allComparisons.push({
          trgid,
          feeType,
          expected: expectedVal,
          calculated: calculatedVal,
          difference: diff,
          percentDiff,
          status,
        });
      }
    }
    
    return allComparisons;
  }, [salesData, expectedFeesLookup]);

  // Filter and search
  const filteredComparisons = useMemo(() => {
    let result = comparisons;
    
    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(c => c.status === filterStatus);
    }
    
    // Search by TRGID
    if (searchTerm) {
      result = result.filter(c => c.trgid.includes(searchTerm));
    }
    
    return result;
  }, [comparisons, filterStatus, searchTerm]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const stats = {
      total: comparisons.length,
      matches: comparisons.filter(c => c.status === 'match').length,
      close: comparisons.filter(c => c.status === 'close').length,
      mismatches: comparisons.filter(c => c.status === 'mismatch').length,
      missingExpected: comparisons.filter(c => c.status === 'missing_expected').length,
      byFeeType: {} as Record<string, { matches: number; mismatches: number; totalDiff: number }>,
    };
    
    const feeTypes = [
      'checkInFee', 'refurbFee', 'overboxFee', 'packagingFee', 'ppsFee',
      'shippingFee', 'merchantFee', 'revshareFee', 'thirdPartyMPFee', 'marketingFee', 'refundFee'
    ];
    
    for (const ft of feeTypes) {
      const items = comparisons.filter(c => c.feeType === ft);
      stats.byFeeType[ft] = {
        matches: items.filter(c => c.status === 'match').length,
        mismatches: items.filter(c => c.status === 'mismatch').length,
        totalDiff: items.reduce((sum, c) => sum + c.difference, 0),
      };
    }
    
    return stats;
  }, [comparisons]);

  // Paginate
  const paginatedData = filteredComparisons.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredComparisons.length / pageSize);

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading comparison data...</div>;
  }

  const getStatusBadge = (status: FeeComparison['status']) => {
    switch (status) {
      case 'match':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Match</Badge>;
      case 'close':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">~Close</Badge>;
      case 'mismatch':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Mismatch</Badge>;
      case 'missing_expected':
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">No Expected</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const feeTypeLabels: Record<string, string> = {
    checkInFee: 'Check In',
    refurbFee: 'Refurb',
    overboxFee: 'Overbox',
    packagingFee: 'Packaging',
    ppsFee: 'PPS',
    shippingFee: 'Shipping',
    merchantFee: 'Merchant',
    revshareFee: 'Revshare',
    thirdPartyMPFee: '3PMP',
    marketingFee: 'Marketing',
    refundFee: 'Refund',
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-500">{summary.matches.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Matches</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-500">{summary.close.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Close (~5%)</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-red-500">{summary.mismatches.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Mismatches</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-500">{summary.missingExpected.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">No Expected Data</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{summary.total.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Total Comparisons</div>
        </div>
      </div>

      {/* Fee Type Breakdown */}
      <div className="bg-card border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Variance by Fee Type</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(summary.byFeeType).map(([feeType, stats]) => (
            <div key={feeType} className="border rounded p-3">
              <div className="text-sm font-medium">{feeTypeLabels[feeType] || feeType}</div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-green-500">{stats.matches} ✓</span>
                <span className="text-red-500">{stats.mismatches} ✗</span>
              </div>
              <div className={`text-sm font-semibold mt-1 ${stats.totalDiff >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                {stats.totalDiff >= 0 ? '+' : ''}{formatCurrency(stats.totalDiff)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search TRGID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'mismatch', 'close', 'match', 'missing_expected'].map(status => (
            <Button
              key={status}
              variant={filterStatus === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setFilterStatus(status); setPage(0); }}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Button>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>TRGID</TableHead>
              <TableHead>Fee Type</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Calculated</TableHead>
              <TableHead className="text-right">Difference</TableHead>
              <TableHead className="text-right">% Diff</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, idx) => (
              <TableRow key={`${row.trgid}-${row.feeType}-${idx}`}>
                <TableCell className="font-mono text-xs">{row.trgid}</TableCell>
                <TableCell>{feeTypeLabels[row.feeType] || row.feeType}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.expected)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.calculated)}</TableCell>
                <TableCell className={`text-right ${row.difference > 0 ? 'text-red-500' : row.difference < 0 ? 'text-green-500' : ''}`}>
                  {row.difference > 0 ? '+' : ''}{formatCurrency(row.difference)}
                </TableCell>
                <TableCell className={`text-right ${Math.abs(row.percentDiff) > 5 ? 'text-red-500' : ''}`}>
                  {row.expected !== 0 ? `${row.percentDiff.toFixed(1)}%` : '-'}
                </TableCell>
                <TableCell>{getStatusBadge(row.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredComparisons.length)} of {filteredComparisons.length}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
