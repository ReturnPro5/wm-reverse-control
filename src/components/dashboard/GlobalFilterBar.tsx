import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw, RotateCcw, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFilters } from '@/contexts/FilterContext';
import { getWMWeekNumber, WM_DAY_NAMES } from '@/lib/wmWeek';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface GlobalFilterBarProps {
  programs: string[];
  masterPrograms: string[];
  categories: string[];
  facilities: string[];
  locations: string[];
  ownerships: string[];
  marketplaces: string[];
  fileTypes: string[];
  onRefresh: () => void;
  className?: string;
}

export function GlobalFilterBar({
  programs,
  masterPrograms,
  categories,
  facilities,
  locations,
  ownerships,
  marketplaces,
  fileTypes,
  onRefresh,
  className,
}: GlobalFilterBarProps) {
  const { filters, setFilter, resetFilters } = useFilters();
  const [isExpanded, setIsExpanded] = useState(false);
  const currentWeek = getWMWeekNumber(new Date());
  const weekOptions = Array.from({ length: 52 }, (_, i) => i + 1);

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'excludedFileIds' || key === 'selectedFileIds') return false;
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
        <Select 
          value={filters.wmWeek?.toString() || 'all'} 
          onValueChange={(v) => setFilter('wmWeek', v === 'all' ? undefined : parseInt(v))}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="WM Week" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Weeks</SelectItem>
            {weekOptions.map(week => (
              <SelectItem key={week} value={week.toString()}>
                WK{week.toString().padStart(2, '0')}
                {week === currentWeek && ' (Current)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Program Name */}
        <Select 
          value={filters.programName || 'all'} 
          onValueChange={(v) => setFilter('programName', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Program" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {programs.map(p => (
              <SelectItem key={p} value={p}>
                {p.length > 25 ? p.slice(0, 25) + '...' : p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Facility */}
        <Select 
          value={filters.facility || 'all'} 
          onValueChange={(v) => setFilter('facility', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Facility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Facilities</SelectItem>
            {facilities.map(f => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* File Type */}
        <Select 
          value={filters.fileType || 'all'} 
          onValueChange={(v) => setFilter('fileType', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="File Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {fileTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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
            {/* WM Day of Week */}
            <Select 
              value={filters.wmDayOfWeek?.toString() || 'all'} 
              onValueChange={(v) => setFilter('wmDayOfWeek', v === 'all' ? undefined : parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="WM Day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Days</SelectItem>
                {WM_DAY_NAMES.map((day, i) => (
                  <SelectItem key={i} value={(i + 1).toString()}>
                    {day} (Day {i + 1})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Master Program */}
            <Select 
              value={filters.masterProgramName || 'all'} 
              onValueChange={(v) => setFilter('masterProgramName', v === 'all' ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Master Program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Master Programs</SelectItem>
                {masterPrograms.map(p => (
                  <SelectItem key={p} value={p}>
                    {p.length > 20 ? p.slice(0, 20) + '...' : p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category */}
            <Select 
              value={filters.categoryName || 'all'} 
              onValueChange={(v) => setFilter('categoryName', v === 'all' ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>
                    {c.length > 20 ? c.slice(0, 20) + '...' : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location ID */}
            <Select 
              value={filters.locationId || 'all'} 
              onValueChange={(v) => setFilter('locationId', v === 'all' ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Location ID" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(l => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Client Source */}
            <Select 
              value={filters.tagClientOwnership || 'all'} 
              onValueChange={(v) => setFilter('tagClientOwnership', v === 'all' ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Client Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Client Sources</SelectItem>
                {ownerships.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Marketplace */}
            <Select 
              value={filters.marketplaceProfileSoldOn || 'all'} 
              onValueChange={(v) => setFilter('marketplaceProfileSoldOn', v === 'all' ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Marketplace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Marketplaces</SelectItem>
                {marketplaces.map(m => (
                  <SelectItem key={m} value={m}>
                    {m.length > 18 ? m.slice(0, 18) + '...' : m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
