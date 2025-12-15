import { startOfWeek, endOfWeek, format, parse, isValid, addDays, differenceInDays } from 'date-fns';

// Walmart week runs Saturday (Day 1) to Friday (Day 7)
export function getWMWeekStart(date: Date): Date {
  // Adjust so Saturday is the start
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  const daysToSubtract = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
  const result = new Date(date);
  result.setDate(result.getDate() - daysToSubtract);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getWMWeekEnd(date: Date): Date {
  const start = getWMWeekStart(date);
  return addDays(start, 6);
}

export function getWMDayOfWeek(date: Date): number {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  // Convert to WM day (Sat=1, Sun=2, Mon=3, Tue=4, Wed=5, Thu=6, Fri=7)
  return dayOfWeek === 6 ? 1 : dayOfWeek + 2;
}

export function getWMFiscalYearStart(date: Date): Date {
  // WM fiscal year starts on the Saturday closest to Feb 1
  // If date is in January, we're still in the previous fiscal year
  const weekStart = getWMWeekStart(date);
  const fiscalStartYear = weekStart.getMonth() === 0 ? weekStart.getFullYear() - 1 : weekStart.getFullYear();
  
  const feb1 = new Date(fiscalStartYear, 1, 1); // Feb 1
  const feb1DayOfWeek = feb1.getDay(); // 0 = Sunday, 6 = Saturday
  
  if (feb1DayOfWeek === 6) {
    // Feb 1 is Saturday
    return feb1;
  }
  
  // Find the Saturday closest to Feb 1
  const daysToPrevSat = feb1DayOfWeek === 0 ? 1 : feb1DayOfWeek + 1;
  const daysToNextSat = 6 - feb1DayOfWeek;
  
  if (daysToPrevSat <= daysToNextSat) {
    return new Date(fiscalStartYear, 1, 1 - daysToPrevSat);
  } else {
    return new Date(fiscalStartYear, 1, 1 + daysToNextSat);
  }
}

export function getWMWeekNumber(date: Date): number {
  // Get the Saturday of the week containing the date
  const weekStart = getWMWeekStart(date);
  
  // Get fiscal year start (Saturday closest to Feb 1)
  const fiscalYearStart = getWMFiscalYearStart(date);
  
  // Calculate weeks from fiscal year start
  const daysDiff = differenceInDays(weekStart, fiscalYearStart);
  const weekNum = Math.floor(daysDiff / 7) + 1;
  
  return weekNum;
}

export function formatWMWeek(date: Date): string {
  const weekNum = getWMWeekNumber(date);
  const year = date.getFullYear();
  return `WK${weekNum.toString().padStart(2, '0')} ${year}`;
}

export function getWMWeekRange(date: Date): { start: Date; end: Date; label: string } {
  const start = getWMWeekStart(date);
  const end = getWMWeekEnd(date);
  return {
    start,
    end,
    label: `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`,
  };
}

export function parseFileBusinessDate(fileName: string): Date | null {
  // Extract date from filename patterns like "Sales 12.15.25.xlsx" or "Sales_12.15.2025.csv"
  const patterns = [
    /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/,  // 12.15.25 or 12.15.2025
    /(\d{1,2})-(\d{1,2})-(\d{2,4})/,    // 12-15-25 or 12-15-2025
    /(\d{1,2})_(\d{1,2})_(\d{2,4})/,    // 12_15_25 or 12_15_2025
  ];

  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match) {
      const month = parseInt(match[1], 10);
      const day = parseInt(match[2], 10);
      let year = parseInt(match[3], 10);
      
      // Handle 2-digit year
      if (year < 100) {
        year = year + 2000;
      }
      
      const date = new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid timezone edge cases
      if (isValid(date)) {
        return date;
      }
    }
  }
  
  return null;
}

export function determineFileType(fileName: string): 'Sales' | 'Inbound' | 'Outbound' | 'Inventory' | 'Unknown' {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.includes('sales')) return 'Sales';
  if (lowerName.includes('inbound')) return 'Inbound';
  if (lowerName.includes('outbound')) return 'Outbound';
  if (lowerName.includes('inventory')) return 'Inventory';
  
  return 'Unknown';
}

export const WM_DAY_NAMES = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

export function getWMDayName(wmDayOfWeek: number): string {
  return WM_DAY_NAMES[wmDayOfWeek - 1] || '';
}