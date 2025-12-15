import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface GlobalFilters {
  // File-level filters
  selectedFileIds: string[] | null; // null = all files, [] = none, [...ids] = specific
  excludedFileIds: string[];
  fileType: string | undefined;
  fileBusinessDateStart: string | undefined;
  fileBusinessDateEnd: string | undefined;
  fileUploadDateStart: string | undefined;
  fileUploadDateEnd: string | undefined;
  
  // Data-level filters
  wmWeek: number | undefined;
  wmDayOfWeek: number | undefined;
  programName: string | undefined;
  masterProgramName: string | undefined;
  categoryName: string | undefined;
  facility: string | undefined;
  locationId: string | undefined;
  tagClientOwnership: string | undefined;
  marketplaceProfileSoldOn: string | undefined;
}

interface FilterContextType {
  filters: GlobalFilters;
  setFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void;
  setFilters: (updates: Partial<GlobalFilters>) => void;
  resetFilters: () => void;
  excludeFile: (fileId: string) => void;
  includeFile: (fileId: string) => void;
  isFileExcluded: (fileId: string) => boolean;
}

const defaultFilters: GlobalFilters = {
  selectedFileIds: null,
  excludedFileIds: [],
  fileType: undefined,
  fileBusinessDateStart: undefined,
  fileBusinessDateEnd: undefined,
  fileUploadDateStart: undefined,
  fileUploadDateEnd: undefined,
  wmWeek: undefined,
  wmDayOfWeek: undefined,
  programName: undefined,
  masterProgramName: undefined,
  categoryName: undefined,
  facility: undefined,
  locationId: undefined,
  tagClientOwnership: undefined,
  marketplaceProfileSoldOn: undefined,
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<GlobalFilters>(() => {
    // Load excluded files from localStorage
    const saved = localStorage.getItem('wm-excluded-files');
    const excludedFileIds = saved ? JSON.parse(saved) : [];
    return { ...defaultFilters, excludedFileIds };
  });

  const setFilter = useCallback(<K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => {
    setFiltersState(prev => ({ ...prev, [key]: value }));
  }, []);

  const setFilters = useCallback((updates: Partial<GlobalFilters>) => {
    setFiltersState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(prev => ({ ...defaultFilters, excludedFileIds: prev.excludedFileIds }));
  }, []);

  const excludeFile = useCallback((fileId: string) => {
    setFiltersState(prev => {
      const newExcluded = [...prev.excludedFileIds, fileId];
      localStorage.setItem('wm-excluded-files', JSON.stringify(newExcluded));
      return { ...prev, excludedFileIds: newExcluded };
    });
  }, []);

  const includeFile = useCallback((fileId: string) => {
    setFiltersState(prev => {
      const newExcluded = prev.excludedFileIds.filter(id => id !== fileId);
      localStorage.setItem('wm-excluded-files', JSON.stringify(newExcluded));
      return { ...prev, excludedFileIds: newExcluded };
    });
  }, []);

  const isFileExcluded = useCallback((fileId: string) => {
    return filters.excludedFileIds.includes(fileId);
  }, [filters.excludedFileIds]);

  return (
    <FilterContext.Provider value={{ 
      filters, 
      setFilter, 
      setFilters, 
      resetFilters,
      excludeFile,
      includeFile,
      isFileExcluded,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
