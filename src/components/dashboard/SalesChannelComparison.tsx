import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { deriveWalmartChannel, WalmartChannel, WALMART_CHANNEL_OPTIONS } from '@/lib/walmartChannel';
import { mapMarketplace } from '@/lib/marketplaceMapping';
import { SalesRecordWithChannel } from '@/hooks/useFilteredData';

interface SalesChannelComparisonProps {
  salesDataTW: SalesRecordWithChannel[];
  salesDataLW: SalesRecordWithChannel[];
  salesDataTWLY: SalesRecordWithChannel[];
  className?: string;
}

const formatCurrency = (value: number) => {
  if (value < 0) {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) return `($${(absValue / 1000000).toFixed(2)}M)`;
    if (absValue >= 1000) return `($${(absValue / 1000).toFixed(0)}K)`;
    return `($${absValue.toFixed(0)})`;
  }
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatPercent = (value: number) => {
  if (!isFinite(value) || isNaN(value)) return '0%';
  return `${value.toFixed(0)}%`;
};

interface ChannelMetrics {
  units: number;
  grossSales: number;
  netDollars: number;
  effectiveRetail: number;
}

interface MarketplaceMetrics extends ChannelMetrics {
  marketplace: string;
}

interface ChannelData {
  channel: WalmartChannel;
  metrics: ChannelMetrics;
  marketplaces: MarketplaceMetrics[];
}

interface PeriodData {
  channels: ChannelData[];
  total: ChannelMetrics;
}

function calculateMetrics(records: SalesRecordWithChannel[]): ChannelMetrics {
  return records.reduce((acc, r) => ({
    units: acc.units + 1,
    grossSales: acc.grossSales + (Number(r.gross_sale) || 0),
    netDollars: acc.netDollars + 
      (Number(r.gross_sale) || 0) - 
      (Number(r.invoiced_check_in_fee) || 0) -
      (Number(r.invoiced_refurb_fee) || 0) -
      (Number(r.invoiced_overbox_fee) || 0) -
      (Number(r.invoiced_packaging_fee) || 0) -
      (Number(r.invoiced_pps_fee) || 0) -
      (Number(r.invoiced_shipping_fee) || 0) -
      (Number(r.invoiced_merchant_fee) || 0) -
      (Number(r.invoiced_revshare_fee) || 0) -
      (Number(r.invoiced_3pmp_fee) || 0) -
      (Number(r.invoiced_marketing_fee) || 0) -
      (Number(r.invoiced_refund_fee) || 0) -
      (Number(r.refund_amount) || 0),
    effectiveRetail: acc.effectiveRetail + (Number(r.effective_retail) || 0),
  }), { units: 0, grossSales: 0, netDollars: 0, effectiveRetail: 0 });
}

function groupByChannelAndMarketplace(records: SalesRecordWithChannel[]): PeriodData {
  const channelMap = new Map<WalmartChannel, Map<string, SalesRecordWithChannel[]>>();
  
  // Initialize all channels
  WALMART_CHANNEL_OPTIONS.forEach(channel => {
    channelMap.set(channel, new Map());
  });

  // Group records
  records.forEach(record => {
    const channel = record.walmartChannel;
    const marketplace = mapMarketplace(record);
    
    const marketplaceMap = channelMap.get(channel)!;
    if (!marketplaceMap.has(marketplace)) {
      marketplaceMap.set(marketplace, []);
    }
    marketplaceMap.get(marketplace)!.push(record);
  });

  // Calculate metrics for each channel and marketplace
  const channels: ChannelData[] = WALMART_CHANNEL_OPTIONS.map(channel => {
    const marketplaceMap = channelMap.get(channel)!;
    const allRecords: SalesRecordWithChannel[] = [];
    const marketplaces: MarketplaceMetrics[] = [];

    marketplaceMap.forEach((records, marketplace) => {
      allRecords.push(...records);
      marketplaces.push({
        marketplace,
        ...calculateMetrics(records),
      });
    });

    // Sort marketplaces by gross sales descending
    marketplaces.sort((a, b) => b.grossSales - a.grossSales);

    return {
      channel,
      metrics: calculateMetrics(allRecords),
      marketplaces,
    };
  });

  // Calculate total
  const total = calculateMetrics(records);

  return { channels, total };
}

function MetricCell({ value, type }: { value: number; type: 'units' | 'currency' | 'percent' }) {
  const formatted = type === 'units' 
    ? value.toLocaleString() 
    : type === 'currency' 
      ? formatCurrency(value)
      : formatPercent(value);
  
  return (
    <td className={cn(
      "px-2 py-1.5 text-right tabular-nums text-sm",
      value < 0 && "text-destructive"
    )}>
      {formatted}
    </td>
  );
}

function ChannelRow({ 
  channel, 
  tw, 
  lw, 
  twly,
  isExpanded,
  onToggle,
  hasChildren,
}: { 
  channel: string; 
  tw: ChannelMetrics; 
  lw: ChannelMetrics;
  twly: ChannelMetrics;
  isExpanded: boolean;
  onToggle: () => void;
  hasChildren: boolean;
}) {
  const twRecovery = tw.effectiveRetail > 0 ? (tw.grossSales / tw.effectiveRetail) * 100 : 0;
  const lwRecovery = lw.effectiveRetail > 0 ? (lw.grossSales / lw.effectiveRetail) * 100 : 0;
  const twlyRecovery = twly.effectiveRetail > 0 ? (twly.grossSales / twly.effectiveRetail) * 100 : 0;

  return (
    <tr className="bg-muted/30 font-medium hover:bg-muted/50 transition-colors">
      <td className="px-2 py-1.5 text-left">
        <button 
          onClick={onToggle}
          className="flex items-center gap-1 text-left w-full"
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="w-4" />
          )}
          <span className="font-semibold">{channel}</span>
        </button>
      </td>
      {/* TW */}
      <MetricCell value={tw.units} type="units" />
      <MetricCell value={tw.grossSales} type="currency" />
      <MetricCell value={tw.netDollars} type="currency" />
      <MetricCell value={twRecovery} type="percent" />
      {/* LW */}
      <MetricCell value={lw.units} type="units" />
      <MetricCell value={lw.grossSales} type="currency" />
      <MetricCell value={lw.netDollars} type="currency" />
      <MetricCell value={lwRecovery} type="percent" />
      {/* TWLY */}
      <MetricCell value={twly.units} type="units" />
      <MetricCell value={twly.grossSales} type="currency" />
      <MetricCell value={twly.netDollars} type="currency" />
      <MetricCell value={twlyRecovery} type="percent" />
    </tr>
  );
}

function MarketplaceRow({ 
  marketplace, 
  tw, 
  lw, 
  twly,
}: { 
  marketplace: string; 
  tw: ChannelMetrics; 
  lw: ChannelMetrics;
  twly: ChannelMetrics;
}) {
  const twRecovery = tw.effectiveRetail > 0 ? (tw.grossSales / tw.effectiveRetail) * 100 : 0;
  const lwRecovery = lw.effectiveRetail > 0 ? (lw.grossSales / lw.effectiveRetail) * 100 : 0;
  const twlyRecovery = twly.effectiveRetail > 0 ? (twly.grossSales / twly.effectiveRetail) * 100 : 0;

  return (
    <tr className="hover:bg-muted/20 transition-colors text-muted-foreground">
      <td className="px-2 py-1 pl-8 text-left text-sm">{marketplace}</td>
      {/* TW */}
      <MetricCell value={tw.units} type="units" />
      <MetricCell value={tw.grossSales} type="currency" />
      <MetricCell value={tw.netDollars} type="currency" />
      <MetricCell value={twRecovery} type="percent" />
      {/* LW */}
      <MetricCell value={lw.units} type="units" />
      <MetricCell value={lw.grossSales} type="currency" />
      <MetricCell value={lw.netDollars} type="currency" />
      <MetricCell value={lwRecovery} type="percent" />
      {/* TWLY */}
      <MetricCell value={twly.units} type="units" />
      <MetricCell value={twly.grossSales} type="currency" />
      <MetricCell value={twly.netDollars} type="currency" />
      <MetricCell value={twlyRecovery} type="percent" />
    </tr>
  );
}

const emptyMetrics: ChannelMetrics = { units: 0, grossSales: 0, netDollars: 0, effectiveRetail: 0 };

export function SalesChannelComparison({ 
  salesDataTW, 
  salesDataLW, 
  salesDataTWLY,
  className 
}: SalesChannelComparisonProps) {
  const [expandedChannels, setExpandedChannels] = useState<Set<WalmartChannel>>(new Set(WALMART_CHANNEL_OPTIONS));

  const twData = useMemo(() => groupByChannelAndMarketplace(salesDataTW), [salesDataTW]);
  const lwData = useMemo(() => groupByChannelAndMarketplace(salesDataLW), [salesDataLW]);
  const twlyData = useMemo(() => groupByChannelAndMarketplace(salesDataTWLY), [salesDataTWLY]);

  const toggleChannel = (channel: WalmartChannel) => {
    setExpandedChannels(prev => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  };

  // Get all unique marketplaces across all periods for each channel
  const getMarketplacesForChannel = (channel: WalmartChannel): string[] => {
    const marketplaces = new Set<string>();
    [twData, lwData, twlyData].forEach(periodData => {
      const channelData = periodData.channels.find(c => c.channel === channel);
      channelData?.marketplaces.forEach(m => marketplaces.add(m.marketplace));
    });
    return Array.from(marketplaces).sort((a, b) => {
      // Sort by TW gross sales descending
      const twChannel = twData.channels.find(c => c.channel === channel);
      const aSales = twChannel?.marketplaces.find(m => m.marketplace === a)?.grossSales || 0;
      const bSales = twChannel?.marketplaces.find(m => m.marketplace === b)?.grossSales || 0;
      return bSales - aSales;
    });
  };

  const getMarketplaceMetrics = (
    periodData: PeriodData, 
    channel: WalmartChannel, 
    marketplace: string
  ): ChannelMetrics => {
    const channelData = periodData.channels.find(c => c.channel === channel);
    return channelData?.marketplaces.find(m => m.marketplace === marketplace) || emptyMetrics;
  };

  const twTotalRecovery = twData.total.effectiveRetail > 0 
    ? (twData.total.grossSales / twData.total.effectiveRetail) * 100 : 0;
  const lwTotalRecovery = lwData.total.effectiveRetail > 0 
    ? (lwData.total.grossSales / lwData.total.effectiveRetail) * 100 : 0;
  const twlyTotalRecovery = twlyData.total.effectiveRetail > 0 
    ? (twlyData.total.grossSales / twlyData.total.effectiveRetail) * 100 : 0;

  return (
    <div className={cn('bg-card rounded-lg border overflow-hidden', className)}>
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">Sales by Walmart Channel</h3>
        <p className="text-sm text-muted-foreground">
          TW = This Week (selected), LW = Last Week, TWLY = This Week Last Year
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-2 text-left font-semibold" rowSpan={2}>Walmart Channel</th>
              <th className="px-2 py-2 text-center font-semibold border-l" colSpan={4}>A) TW</th>
              <th className="px-2 py-2 text-center font-semibold border-l" colSpan={4}>B) LW</th>
              <th className="px-2 py-2 text-center font-semibold border-l" colSpan={4}>C) TWLY</th>
            </tr>
            <tr className="border-b bg-muted/30 text-xs">
              {/* TW */}
              <th className="px-2 py-1.5 text-right font-medium border-l">Units</th>
              <th className="px-2 py-1.5 text-right font-medium">Gross Sales</th>
              <th className="px-2 py-1.5 text-right font-medium">Net Dollars</th>
              <th className="px-2 py-1.5 text-right font-medium">Net Recovery %</th>
              {/* LW */}
              <th className="px-2 py-1.5 text-right font-medium border-l">Units</th>
              <th className="px-2 py-1.5 text-right font-medium">Gross Sales</th>
              <th className="px-2 py-1.5 text-right font-medium">Net Dollars</th>
              <th className="px-2 py-1.5 text-right font-medium">Net Recovery %</th>
              {/* TWLY */}
              <th className="px-2 py-1.5 text-right font-medium border-l">Units</th>
              <th className="px-2 py-1.5 text-right font-medium">Gross Sales</th>
              <th className="px-2 py-1.5 text-right font-medium">Net Dollars</th>
              <th className="px-2 py-1.5 text-right font-medium">Net Recovery %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {WALMART_CHANNEL_OPTIONS.map(channel => {
              const twChannel = twData.channels.find(c => c.channel === channel);
              const lwChannel = lwData.channels.find(c => c.channel === channel);
              const twlyChannel = twlyData.channels.find(c => c.channel === channel);
              const marketplaces = getMarketplacesForChannel(channel);
              const isExpanded = expandedChannels.has(channel);
              const hasMarketplaces = marketplaces.length > 0;

              return (
                <tbody key={channel}>
                  <ChannelRow
                    channel={channel}
                    tw={twChannel?.metrics || emptyMetrics}
                    lw={lwChannel?.metrics || emptyMetrics}
                    twly={twlyChannel?.metrics || emptyMetrics}
                    isExpanded={isExpanded}
                    onToggle={() => toggleChannel(channel)}
                    hasChildren={hasMarketplaces}
                  />
                  {isExpanded && marketplaces.map(marketplace => (
                    <MarketplaceRow
                      key={`${channel}-${marketplace}`}
                      marketplace={marketplace}
                      tw={getMarketplaceMetrics(twData, channel, marketplace)}
                      lw={getMarketplaceMetrics(lwData, channel, marketplace)}
                      twly={getMarketplaceMetrics(twlyData, channel, marketplace)}
                    />
                  ))}
                </tbody>
              );
            })}
            {/* Total Row */}
            <tr className="bg-primary/10 font-bold border-t-2 border-primary/20">
              <td className="px-2 py-2 text-left">Total</td>
              {/* TW */}
              <td className="px-2 py-2 text-right tabular-nums">{twData.total.units.toLocaleString()}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(twData.total.grossSales)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(twData.total.netDollars)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatPercent(twTotalRecovery)}</td>
              {/* LW */}
              <td className="px-2 py-2 text-right tabular-nums">{lwData.total.units.toLocaleString()}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(lwData.total.grossSales)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(lwData.total.netDollars)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatPercent(lwTotalRecovery)}</td>
              {/* TWLY */}
              <td className="px-2 py-2 text-right tabular-nums">{twlyData.total.units.toLocaleString()}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(twlyData.total.grossSales)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(twlyData.total.netDollars)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatPercent(twlyTotalRecovery)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
