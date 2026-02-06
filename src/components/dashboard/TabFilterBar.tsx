import { Button } from '@/components/ui/button';
import { RefreshCw, RotateCcw, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTabFilters, TabName, TabFilters } from '@/contexts/FilterContext';
import { getWMWeekNumber, WM_DAY_NAMES } from '@/lib/wmWeek';
import { WALMART_CHANNEL_OPTIONS } from '@/lib/walmartChannel';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MultiSelect } from '@/components/ui/multi-select';

interface TabFilterBarProps {
  tabName: TabName;
  programs: string[];
  masterPrograms: string[];
  categories: string[];
  facilities: string[];
  locations: string[];
  ownerships: string[];
  clientSources: string[];
  marketplaces: string[];
  fileTypes: string[];
  orderTypes?: string[];
  showWalmartChannel?: boolean;
  onRefresh: () => void;
  className?: string;
}

export function TabFilterBar({
  tabName,
  programs,
  masterPrograms,
  categories,
  facilities,
  locations,
  ownerships,
  clientSources,
  marketplaces,
  fileTypes,
  orderTypes = [],
  showWalmartChannel = false,
  onRefresh,
  className,
}: TabFilterBarProps) {
  const { filters, setFilter, resetFilters } = useTabFilters(tabName);
  const [isExpanded, setIsExpanded] = useState(false);
  const currentWeek = getWMWeekNumber(new Date());
  // Week options: current week at top, descending order, with Select All
  const weekOptions = [
    { value: 'all', label: 'Select All' },
    ...Array.from({ length: 52 }, (_, i) => {
      const weekNum = currentWeek - i;
      const adjustedWeek = weekNum <= 0 ? weekNum + 52 : weekNum;
      return {
        value: adjustedWeek.toString(),
        label: `WK${adjustedWeek.toString().padStart(2, '0')}${adjustedWeek === currentWeek ? ' (Current)' : ''}`,
      };
    }),
  ];

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'excludedFileIds' || key === 'selectedFileIds') return false;
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null;
  });

  return (
    <div className={cn('bg-card rounded-lg border', className)}>
      {/* Primary Filters Row */}
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>

        {/* WM Week */}
        <MultiSelect
          options={weekOptions}
          selected={filters.wmWeeks.map(String)}
          onChange={(values) => {
            // Handle "Select All" option
            if (values.includes('all')) {
              const allWeeks = Array.from({ length: 52 }, (_, i) => i + 1);
              setFilter('wmWeeks', allWeeks);
            } else {
              setFilter('wmWeeks', values.map(Number));
            }
          }}
          placeholder="WM Week"
          className="w-[140px]"
        />

        {/* Program Name */}
        <MultiSelect
          options={programs.map(p => ({ value: p, label: p.length > 25 ? p.slice(0, 25) + '...' : p }))}
          selected={filters.programNames}
          onChange={(values) => setFilter('programNames', values)}
          placeholder="Program"
          className="w-[180px]"
        />

        {/* Facility */}
        <MultiSelect
          options={facilities.map(f => ({ value: f, label: f }))}
          selected={filters.facilities}
          onChange={(values) => setFilter('facilities', values)}
          placeholder="Facility"
          className="w-[140px]"
        />

        {/* Walmart Channel - Sales tabs only */}
        {showWalmartChannel && (
          <MultiSelect
            options={WALMART_CHANNEL_OPTIONS.map(c => ({ value: c, label: c }))}
            selected={filters.walmartChannels}
            onChange={(values) => setFilter('walmartChannels', values as typeof filters.walmartChannels)}
            placeholder="Walmart Channel"
            className="w-[160px]"
          />
        )}

        <div className="ml-auto flex items-center gap-2">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                {isExpanded ? 'Less' : 'More'}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          )}
          
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Expanded Filters */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="border-t px-4 py-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* File Type */}
            <MultiSelect
              options={fileTypes.map(t => ({ value: t, label: t }))}
              selected={filters.fileTypes}
              onChange={(values) => setFilter('fileTypes', values)}
              placeholder="File Type"
              className="w-full"
            />

            {/* WM Day of Week */}
            <MultiSelect
              options={WM_DAY_NAMES.map((day, i) => ({
                value: (i + 1).toString(),
                label: `${day} (Day ${i + 1})`,
              }))}
              selected={filters.wmDaysOfWeek.map(String)}
              onChange={(values) => setFilter('wmDaysOfWeek', values.map(Number))}
              placeholder="WM Day"
              className="w-full"
            />

            {/* Master Program */}
            <MultiSelect
              options={masterPrograms.map(p => ({
                value: p,
                label: p.length > 20 ? p.slice(0, 20) + '...' : p,
              }))}
              selected={filters.masterProgramNames}
              onChange={(values) => setFilter('masterProgramNames', values)}
              placeholder="Master Program"
              className="w-full"
            />

            {/* Category */}
            <MultiSelect
              options={categories.map(c => ({
                value: c,
                label: c.length > 20 ? c.slice(0, 20) + '...' : c,
              }))}
              selected={filters.categoryNames}
              onChange={(values) => setFilter('categoryNames', values)}
              placeholder="Category"
              className="w-full"
            />

            {/* Location ID */}
            <MultiSelect
              options={locations.map(l => ({ value: l, label: l }))}
              selected={filters.locationIds}
              onChange={(values) => setFilter('locationIds', values)}
              placeholder="Location ID"
              className="w-full"
            />

            {/* Client Ownership */}
            <MultiSelect
              options={ownerships.map(o => ({ value: o, label: o }))}
              selected={filters.tagClientOwnerships}
              onChange={(values) => setFilter('tagClientOwnerships', values)}
              placeholder="Ownership"
              className="w-full"
            />

            {/* Marketplace */}
            <MultiSelect
              options={marketplaces.map(m => ({ value: m, label: m }))}
              selected={filters.marketplacesSoldOn}
              onChange={(values) => setFilter('marketplacesSoldOn', values)}
              placeholder="Marketplace"
              className="w-full"
            />

            {/* Order Type */}
            {orderTypes.length > 0 && (
              <MultiSelect
                options={orderTypes.map(t => ({ value: t, label: t }))}
                selected={filters.orderTypesSoldOn}
                onChange={(values) => setFilter('orderTypesSoldOn', values)}
                placeholder="Order Type"
                className="w-full"
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
