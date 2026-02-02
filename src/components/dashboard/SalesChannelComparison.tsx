import { useMemo, useState, Fragment } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { WalmartChannel, WALMART_CHANNEL_OPTIONS } from '@/lib/walmartChannel';
import { mapMarketplace } from '@/lib/marketplaceMapping';
import { SalesRecordWithChannel } from '@/hooks/useFilteredData';

interface SalesChannelComparisonProps {
  salesDataTW: SalesRecordWithChannel[];
  salesDataLW: SalesRecordWithChannel[];
  salesDataTWLY: SalesRecordWithChannel[];
  selectedWeek?: number | null;
  lastWeek?: number | null;
  className?: string;
}

const formatCurrency = (value: number) => {
  if (value < 0) {
    return `($${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`;
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

interface BaseMetrics {
  units: number;
  grossSales: number;
}

interface CategoryMetrics extends BaseMetrics {
  category: string;
}

interface MarketplaceData extends BaseMetrics {
  marketplace: string;
  categories: CategoryMetrics[];
}

interface ChannelData {
  channel: WalmartChannel;
  metrics: BaseMetrics;
  marketplaces: MarketplaceData[];
}

interface PeriodData {
  channels: ChannelData[];
  total: BaseMetrics;
}

function calculateMetrics(records: SalesRecordWithChannel[]): BaseMetrics {
  return records.reduce((acc, r) => ({
    units: acc.units + 1,
    grossSales: acc.grossSales + (Number(r.gross_sale) || 0),
  }), { units: 0, grossSales: 0 });
}

function groupByChannelMarketplaceCategory(records: SalesRecordWithChannel[]): PeriodData {
  // Channel → Marketplace → Category → Records
  const channelMap = new Map<WalmartChannel, Map<string, Map<string, SalesRecordWithChannel[]>>>();
  
  // Initialize all channels
  WALMART_CHANNEL_OPTIONS.forEach(channel => {
    channelMap.set(channel, new Map());
  });

  // Group records
  records.forEach(record => {
    const channel = record.walmartChannel;
    const marketplace = mapMarketplace(record);
    const category = record.category_name || 'Unknown';
    
    const marketplaceMap = channelMap.get(channel)!;
    if (!marketplaceMap.has(marketplace)) {
      marketplaceMap.set(marketplace, new Map());
    }
    const categoryMap = marketplaceMap.get(marketplace)!;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(record);
  });

  // Calculate metrics for each level
  const channels: ChannelData[] = WALMART_CHANNEL_OPTIONS.map(channel => {
    const marketplaceMap = channelMap.get(channel)!;
    const allChannelRecords: SalesRecordWithChannel[] = [];
    const marketplaces: MarketplaceData[] = [];

    marketplaceMap.forEach((categoryMap, marketplace) => {
      const allMarketplaceRecords: SalesRecordWithChannel[] = [];
      const categories: CategoryMetrics[] = [];

      categoryMap.forEach((records, category) => {
        allMarketplaceRecords.push(...records);
        categories.push({
          category,
          ...calculateMetrics(records),
        });
      });

      // Sort categories by gross sales descending
      categories.sort((a, b) => b.grossSales - a.grossSales);

      allChannelRecords.push(...allMarketplaceRecords);
      marketplaces.push({
        marketplace,
        ...calculateMetrics(allMarketplaceRecords),
        categories,
      });
    });

    // Sort marketplaces by gross sales descending
    marketplaces.sort((a, b) => b.grossSales - a.grossSales);

    return {
      channel,
      metrics: calculateMetrics(allChannelRecords),
      marketplaces,
    };
  });

  // Calculate total
  const total = calculateMetrics(records);

  return { channels, total };
}

const emptyMetrics: BaseMetrics = { units: 0, grossSales: 0 };

export function SalesChannelComparison({ 
  salesDataTW, 
  salesDataLW, 
  salesDataTWLY,
  selectedWeek,
  lastWeek,
  className 
}: SalesChannelComparisonProps) {
  const [expandedChannels, setExpandedChannels] = useState<Set<WalmartChannel>>(new Set(WALMART_CHANNEL_OPTIONS));
  const [expandedMarketplaces, setExpandedMarketplaces] = useState<Set<string>>(new Set());

  const twData = useMemo(() => groupByChannelMarketplaceCategory(salesDataTW), [salesDataTW]);
  const lwData = useMemo(() => groupByChannelMarketplaceCategory(salesDataLW), [salesDataLW]);
  const twlyData = useMemo(() => groupByChannelMarketplaceCategory(salesDataTWLY), [salesDataTWLY]);

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

  const toggleMarketplace = (channel: WalmartChannel, marketplace: string) => {
    const key = `${channel}:${marketplace}`;
    setExpandedMarketplaces(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isMarketplaceExpanded = (channel: WalmartChannel, marketplace: string) => {
    return expandedMarketplaces.has(`${channel}:${marketplace}`);
  };

  // Get all unique marketplaces across all periods for each channel
  const getMarketplacesForChannel = (channel: WalmartChannel): string[] => {
    const marketplaces = new Set<string>();
    [twData, lwData, twlyData].forEach(periodData => {
      const channelData = periodData.channels.find(c => c.channel === channel);
      channelData?.marketplaces.forEach(m => marketplaces.add(m.marketplace));
    });
    return Array.from(marketplaces).sort((a, b) => {
      const twChannel = twData.channels.find(c => c.channel === channel);
      const aSales = twChannel?.marketplaces.find(m => m.marketplace === a)?.grossSales || 0;
      const bSales = twChannel?.marketplaces.find(m => m.marketplace === b)?.grossSales || 0;
      return bSales - aSales;
    });
  };

  // Get all unique categories across all periods for a channel/marketplace combo
  // Only include categories that have at least 1 unit in at least one period
  const getCategoriesForMarketplace = (channel: WalmartChannel, marketplace: string): string[] => {
    const categoryUnits = new Map<string, number>();
    
    [twData, lwData, twlyData].forEach(periodData => {
      const channelData = periodData.channels.find(c => c.channel === channel);
      const mpData = channelData?.marketplaces.find(m => m.marketplace === marketplace);
      mpData?.categories.forEach(c => {
        categoryUnits.set(c.category, (categoryUnits.get(c.category) || 0) + c.units);
      });
    });
    
    // Filter out categories with 0 total units across all periods
    const categoriesWithSales = Array.from(categoryUnits.entries())
      .filter(([_, units]) => units > 0)
      .map(([category]) => category);
    
    return categoriesWithSales.sort((a, b) => {
      const twChannel = twData.channels.find(c => c.channel === channel);
      const twMp = twChannel?.marketplaces.find(m => m.marketplace === marketplace);
      const aSales = twMp?.categories.find(c => c.category === a)?.grossSales || 0;
      const bSales = twMp?.categories.find(c => c.category === b)?.grossSales || 0;
      return bSales - aSales;
    });
  };

  const getMarketplaceMetrics = (
    periodData: PeriodData, 
    channel: WalmartChannel, 
    marketplace: string
  ): BaseMetrics => {
    const channelData = periodData.channels.find(c => c.channel === channel);
    const mp = channelData?.marketplaces.find(m => m.marketplace === marketplace);
    return mp || emptyMetrics;
  };

  const getCategoryMetrics = (
    periodData: PeriodData, 
    channel: WalmartChannel, 
    marketplace: string,
    category: string
  ): BaseMetrics => {
    const channelData = periodData.channels.find(c => c.channel === channel);
    const mp = channelData?.marketplaces.find(m => m.marketplace === marketplace);
    const cat = mp?.categories.find(c => c.category === category);
    return cat || emptyMetrics;
  };

  // Build column headers with week numbers
  const twLabel = 'A) TW';
  const lwLabel = lastWeek ? `B) LW (Wk ${lastWeek})` : 'B) LW';
  const twlyLabel = selectedWeek ? `C) TWLY (Wk ${selectedWeek} LY)` : 'C) TWLY';

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
              <th className="px-3 py-2 text-left font-semibold min-w-[180px]" rowSpan={2}>Walmart Channel</th>
              <th className="px-2 py-2 text-center font-semibold border-l bg-primary/5" colSpan={4}>{twLabel}</th>
              <th className="px-2 py-2 text-center font-semibold border-l" colSpan={4}>{lwLabel}</th>
              <th className="px-2 py-2 text-center font-semibold border-l" colSpan={4}>{twlyLabel}</th>
            </tr>
            <tr className="border-b bg-muted/30 text-xs">
              {/* TW */}
              <th className="px-2 py-1.5 text-right font-medium border-l bg-primary/5">Units</th>
              <th className="px-2 py-1.5 text-right font-medium bg-primary/5">Gross Sales</th>
              <th className="px-2 py-1.5 text-right font-medium bg-primary/5">Net Dollars</th>
              <th className="px-2 py-1.5 text-right font-medium bg-primary/5">Net Recovery %</th>
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
              const isChannelExpanded = expandedChannels.has(channel);
              const hasMarketplaces = marketplaces.length > 0;

              const twMetrics = twChannel?.metrics || emptyMetrics;
              const lwMetrics = lwChannel?.metrics || emptyMetrics;
              const twlyMetrics = twlyChannel?.metrics || emptyMetrics;

              return (
                <Fragment key={channel}>
                  {/* Channel Row */}
                  <tr className="bg-muted/30 font-medium hover:bg-muted/50 transition-colors">
                    <td className="px-3 py-2 text-left">
                      <button 
                        onClick={() => toggleChannel(channel)}
                        className="flex items-center gap-1 text-left w-full"
                        disabled={!hasMarketplaces}
                      >
                        {hasMarketplaces ? (
                          isChannelExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                        ) : (
                          <span className="w-4" />
                        )}
                        <span className="font-semibold">{channel}</span>
                      </button>
                    </td>
                    {/* TW */}
                    <td className="px-2 py-2 text-right tabular-nums bg-primary/5">{twMetrics.units.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right tabular-nums bg-primary/5">{formatCurrency(twMetrics.grossSales)}</td>
                    <td className="px-2 py-2 text-right tabular-nums bg-primary/5 text-muted-foreground">-</td>
                    <td className="px-2 py-2 text-right tabular-nums bg-primary/5 text-muted-foreground">-</td>
                    {/* LW */}
                    <td className="px-2 py-2 text-right tabular-nums border-l">{lwMetrics.units.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(lwMetrics.grossSales)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">-</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">-</td>
                    {/* TWLY */}
                    <td className="px-2 py-2 text-right tabular-nums border-l">{twlyMetrics.units.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(twlyMetrics.grossSales)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">-</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">-</td>
                  </tr>

                  {/* Marketplace Rows */}
                  {isChannelExpanded && marketplaces.map(marketplace => {
                    const twMp = getMarketplaceMetrics(twData, channel, marketplace);
                    const lwMp = getMarketplaceMetrics(lwData, channel, marketplace);
                    const twlyMp = getMarketplaceMetrics(twlyData, channel, marketplace);
                    const categories = getCategoriesForMarketplace(channel, marketplace);
                    const isMpExpanded = isMarketplaceExpanded(channel, marketplace);
                    const hasCategories = categories.length > 0;

                    return (
                      <Fragment key={`${channel}-${marketplace}`}>
                        <tr className="hover:bg-muted/20 transition-colors text-muted-foreground">
                          <td className="px-3 py-1.5 pl-8 text-left text-sm">
                            <button 
                              onClick={() => toggleMarketplace(channel, marketplace)}
                              className="flex items-center gap-1 text-left w-full"
                              disabled={!hasCategories}
                            >
                              {hasCategories ? (
                                isMpExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                              ) : (
                                <span className="w-3" />
                              )}
                              <span>{marketplace}</span>
                            </button>
                          </td>
                          {/* TW */}
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm bg-primary/5">{twMp.units.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm bg-primary/5">{formatCurrency(twMp.grossSales)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm bg-primary/5">-</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm bg-primary/5">-</td>
                          {/* LW */}
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm border-l">{lwMp.units.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm">{formatCurrency(lwMp.grossSales)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm">-</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm">-</td>
                          {/* TWLY */}
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm border-l">{twlyMp.units.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm">{formatCurrency(twlyMp.grossSales)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm">-</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-sm">-</td>
                        </tr>

                        {/* Category Rows */}
                        {isMpExpanded && categories.map(category => {
                          const twCat = getCategoryMetrics(twData, channel, marketplace, category);
                          const lwCat = getCategoryMetrics(lwData, channel, marketplace, category);
                          const twlyCat = getCategoryMetrics(twlyData, channel, marketplace, category);

                          return (
                            <tr key={`${channel}-${marketplace}-${category}`} className="hover:bg-muted/10 transition-colors text-muted-foreground/70">
                              <td className="px-3 py-1 pl-14 text-left text-xs truncate max-w-[180px]" title={category}>
                                {category}
                              </td>
                              {/* TW */}
                              <td className="px-2 py-1 text-right tabular-nums text-xs bg-primary/5">{twCat.units.toLocaleString()}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-xs bg-primary/5">{formatCurrency(twCat.grossSales)}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-xs bg-primary/5">-</td>
                              <td className="px-2 py-1 text-right tabular-nums text-xs bg-primary/5">-</td>
                              {/* LW */}
                              <td className="px-2 py-1 text-right tabular-nums text-xs border-l">{lwCat.units.toLocaleString()}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-xs">{formatCurrency(lwCat.grossSales)}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-xs">-</td>
                              <td className="px-2 py-1 text-right tabular-nums text-xs">-</td>
                              {/* TWLY */}
                              <td className="px-2 py-1 text-right tabular-nums text-xs border-l">{twlyCat.units.toLocaleString()}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-xs">{formatCurrency(twlyCat.grossSales)}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-xs">-</td>
                              <td className="px-2 py-1 text-right tabular-nums text-xs">-</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}

            {/* Total Row */}
            <tr className="bg-primary/10 font-bold border-t-2 border-primary/20">
              <td className="px-3 py-2 text-left">Total</td>
              {/* TW */}
              <td className="px-2 py-2 text-right tabular-nums bg-primary/10">{twData.total.units.toLocaleString()}</td>
              <td className="px-2 py-2 text-right tabular-nums bg-primary/10">{formatCurrency(twData.total.grossSales)}</td>
              <td className="px-2 py-2 text-right tabular-nums bg-primary/10 text-muted-foreground">-</td>
              <td className="px-2 py-2 text-right tabular-nums bg-primary/10 text-muted-foreground">-</td>
              {/* LW */}
              <td className="px-2 py-2 text-right tabular-nums border-l">{lwData.total.units.toLocaleString()}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(lwData.total.grossSales)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">-</td>
              <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">-</td>
              {/* TWLY */}
              <td className="px-2 py-2 text-right tabular-nums border-l">{twlyData.total.units.toLocaleString()}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(twlyData.total.grossSales)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">-</td>
              <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
