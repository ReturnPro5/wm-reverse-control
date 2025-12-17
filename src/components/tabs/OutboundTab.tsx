import { KPICard } from '@/components/dashboard/KPICard';
import { FeeBreakdown } from '@/components/dashboard/FeeBreakdown';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { FileUploadZone } from '@/components/dashboard/FileUploadZone';
import { TabFileManager } from '@/components/dashboard/TabFileManager';
import { Truck, DollarSign, Package, Receipt } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { useFilterOptions, useFilteredFees } from '@/hooks/useFilteredData';

const TAB_NAME = 'outbound' as const;

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export function OutboundTab() {
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: feeData, refetch: refetchData } = useFilteredFees(TAB_NAME);

  const refetch = () => {
    refetchOptions();
    refetchData();
  };

  // Calculate aggregated metrics
  const metrics = {
    totalFees: feeData?.reduce((sum, r) => sum + (Number(r.total_fees) || 0), 0) || 0,
    checkInFees: feeData?.reduce((sum, r) => sum + (Number(r.check_in_fee) || 0), 0) || 0,
    packagingFees: feeData?.reduce((sum, r) => sum + (Number(r.packaging_fee) || 0), 0) || 0,
    pickPackShipFees: feeData?.reduce((sum, r) => sum + (Number(r.pick_pack_ship_fee) || 0), 0) || 0,
    refurbishingFees: feeData?.reduce((sum, r) => sum + (Number(r.refurbishing_fee) || 0), 0) || 0,
    marketplaceFees: feeData?.reduce((sum, r) => sum + (Number(r.marketplace_fee) || 0), 0) || 0,
  };

  const unitsWithFees = feeData?.length || 0;
  const avgFeePerUnit = unitsWithFees > 0 ? metrics.totalFees / unitsWithFees : 0;

  // Chart data for fee breakdown by category
  const feeBreakdownData = [
    { name: 'Check-In', value: metrics.checkInFees },
    { name: 'Packaging', value: metrics.packagingFees },
    { name: 'Pick/Pack/Ship', value: metrics.pickPackShipFees },
    { name: 'Refurbishing', value: metrics.refurbishingFees },
    { name: 'Marketplace', value: metrics.marketplaceFees },
  ].filter(d => d.value > 0);

  const options = filterOptions || {
    programs: [],
    masterPrograms: [],
    categories: [],
    facilities: [],
    locations: [],
    ownerships: [],
    clientSources: [],
    marketplaces: [],
    fileTypes: [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Outbound & Fees</h2>
        <p className="text-muted-foreground">Fee tracking from Outbound files - never netted against sales</p>
      </div>

      {/* Tab-Specific Filters */}
      <TabFilterBar
        tabName={TAB_NAME}
        programs={options.programs}
        masterPrograms={options.masterPrograms}
        categories={options.categories}
        facilities={options.facilities}
        locations={options.locations}
        ownerships={options.ownerships}
        clientSources={options.clientSources}
        marketplaces={options.marketplaces}
        fileTypes={options.fileTypes}
        onRefresh={refetch}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="Total Fees"
          value={formatCurrency(metrics.totalFees)}
          subtitle="All fee categories combined"
          icon={<Receipt className="h-5 w-5" />}
          variant="warning"
        />
        <KPICard
          title="Units with Fees"
          value={unitsWithFees.toLocaleString()}
          subtitle="Units processed through outbound"
          icon={<Package className="h-5 w-5" />}
          variant="default"
        />
        <KPICard
          title="Avg Fee/Unit"
          value={formatCurrency(avgFeePerUnit)}
          subtitle="Average cost per unit"
          icon={<DollarSign className="h-5 w-5" />}
          variant="info"
        />
        <KPICard
          title="Marketplace Fees"
          value={formatCurrency(metrics.marketplaceFees)}
          subtitle="3rd party marketplace costs"
          icon={<Truck className="h-5 w-5" />}
          variant="primary"
        />
      </div>

      {/* Important Notice */}
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
        <h4 className="font-medium text-warning">Fee Separation Policy</h4>
        <p className="text-sm text-muted-foreground mt-1">
          Fees are tracked as a separate cost layer and are never netted against Gross Sales. 
          This maintains operational reporting accuracy and allows for proper cost analysis.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Fee Breakdown Pie */}
        <FeeBreakdown data={metrics} />

        {/* Fee Categories Bar Chart */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-6">Fee Categories</h3>
          
          {feeBreakdownData.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feeBreakdownData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    tickFormatter={formatCurrency}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={100}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                  />
                  <Bar dataKey="value" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No fee data available
            </div>
          )}
        </div>
      </div>

      {/* Fee Detail Table */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Fee Breakdown Detail</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fee Type</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Check-In Fee', value: metrics.checkInFees },
                { name: 'Packaging Fee', value: metrics.packagingFees },
                { name: 'Pick/Pack/Ship Fee', value: metrics.pickPackShipFees },
                { name: 'Refurbishing Fee', value: metrics.refurbishingFees },
                { name: 'Marketplace Fee', value: metrics.marketplaceFees },
              ].map(fee => (
                <tr key={fee.name} className="border-b last:border-0">
                  <td className="py-3 px-4">{fee.name}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(fee.value)}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">
                    {metrics.totalFees > 0 ? ((fee.value / metrics.totalFees) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-medium">
                <td className="py-3 px-4">Total</td>
                <td className="py-3 px-4 text-right font-mono">{formatCurrency(metrics.totalFees)}</td>
                <td className="py-3 px-4 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* File Manager */}
      <TabFileManager fileType="Outbound" onFilesChanged={refetch} />

      {/* Upload Section */}
      <FileUploadZone onUploadComplete={refetch} />
    </div>
  );
}
