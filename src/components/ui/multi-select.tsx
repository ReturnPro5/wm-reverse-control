import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  maxDisplayed?: number;
}

export function MultiSelect({
  options,
  selected = [],
  onChange,
  placeholder = 'Select...',
  className,
  maxDisplayed = 2,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  
  // Ensure selected is always an array
  const safeSelected = Array.isArray(selected) ? selected : [];

  const handleSelect = (value: string) => {
    const newSelected = safeSelected.includes(value)
      ? safeSelected.filter((v) => v !== value)
      : [...safeSelected, value];
    onChange(newSelected);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const displayText = React.useMemo(() => {
    if (safeSelected.length === 0) return placeholder;
    if (safeSelected.length <= maxDisplayed) {
      return safeSelected
        .map((v) => options.find((o) => o.value === v)?.label || v)
        .join(', ');
    }
    return `${safeSelected.length} selected`;
  }, [safeSelected, options, placeholder, maxDisplayed]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between font-normal', className)}
        >
          <span className="truncate">{displayText}</span>
          <div className="flex items-center gap-1 ml-2">
            {safeSelected.length > 0 && (
              <X
                className="h-3 w-3 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search...`} className="h-9" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      safeSelected.includes(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}