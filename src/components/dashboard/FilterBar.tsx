import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWMWeekNumber, formatWMWeek, getWMWeekRange } from '@/lib/wmWeek';

interface FilterBarProps {
  wmWeek?: number;
  onWmWeekChange: (week: number | undefined) => void;
  programName?: string;
  onProgramNameChange: (program: string | undefined) => void;
  facility?: string;
  onFacilityChange: (facility: string | undefined) => void;
  programs: string[];
  facilities: string[];
  onRefresh: () => void;
  className?: string;
}

export function FilterBar({
  wmWeek,
  onWmWeekChange,
  programName,
  onProgramNameChange,
  facility,
  onFacilityChange,
  programs,
  facilities,
  onRefresh,
  className,
}: FilterBarProps) {
  const currentWeek = getWMWeekNumber(new Date());
  const weekOptions = Array.from({ length: 12 }, (_, i) => currentWeek - i).filter(w => w > 0);

  return (
    <div className={cn('flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border', className)}>
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters:</span>
      </div>

      <Select 
        value={wmWeek?.toString() || 'all'} 
        onValueChange={(v) => onWmWeekChange(v === 'all' ? undefined : parseInt(v))}
      >
        <SelectTrigger className="w-[140px]">
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

      <Select 
        value={programName || 'all'} 
        onValueChange={(v) => onProgramNameChange(v === 'all' ? undefined : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Program" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Programs</SelectItem>
          {programs.map(program => (
            <SelectItem key={program} value={program}>
              {program.length > 25 ? program.slice(0, 25) + '...' : program}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select 
        value={facility || 'all'} 
        onValueChange={(v) => onFacilityChange(v === 'all' ? undefined : v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Facility" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Facilities</SelectItem>
          {facilities.map(fac => (
            <SelectItem key={fac} value={fac}>{fac}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={onRefresh} className="ml-auto">
        <RefreshCw className="h-4 w-4 mr-1" />
        Refresh
      </Button>
    </div>
  );
}