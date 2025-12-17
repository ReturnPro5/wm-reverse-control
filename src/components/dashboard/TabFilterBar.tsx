import { Button } from '@/components/ui/button';
import { RefreshCw, RotateCcw, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTabFilters, TabName, TabFilters } from '@/contexts/FilterContext';
import { getWMWeekNumber, WM_DAY_NAMES } from '@/lib/wmWeek';
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
  onRefresh,
  className,
}: TabFilterBarProps) {
  const { filters, setFilter, resetFilters } = useTabFilters(tabName);
  const [isExpanded, setIsExpanded] = useState(false);
  const currentWeek = getWMWeekNumber(new Date());
  const weekOptions = Array.from({ length: 52 }, (_, i) => ({
    value: (i + 1).toString(),
    label: `WK${(i + 1).toString().padStart(2, '0')}${i + 1 === currentWeek ? ' (Current)' : ''}`,
  }));

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
          onChange={(values) => setFilter('wmWeeks', values.map(Number))}
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

        {/* Client Source - WMUS/SAMS */}
        <MultiSelect
          options={clientSources.map(c => ({ value: c, label: c }))}
          selected={filters.tagClientSources}
          onChange={(values) => setFilter('tagClientSources', values)}
          placeholder="Client Source"
          className="w-[150px]"
        />

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
              options={marketplaces.map(m => ({
                value: m,
                label: m.length > 18 ? m.slice(0, 18) + '...' : m,
              }))}
              selected={filters.marketplacesSoldOn}
              onChange={(values) => setFilter('marketplacesSoldOn', values)}
              placeholder="Marketplace"
              className="w-full"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
