import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

export interface TabFilters {
  // File-level filters
  selectedFileIds: string[] | null;
  excludedFileIds: string[];
  fileTypes: string[];
  fileBusinessDateStart: string | undefined;
  fileBusinessDateEnd: string | undefined;
  fileUploadDateStart: string | undefined;
  fileUploadDateEnd: string | undefined;
  
  // Data-level filters
  wmWeeks: number[];
  wmDaysOfWeek: number[];
  programNames: string[];
  masterProgramNames: string[];
  categoryNames: string[];
  facilities: string[];
  locationIds: string[];
  tagClientOwnerships: string[];
  tagClientSources: string[];
  marketplacesSoldOn: string[];
}

export type TabName = 'inbound' | 'processing' | 'sales' | 'outbound' | 'marketplace' | 'dsv';

interface FilterContextType {
  getTabFilters: (tab: TabName) => TabFilters;
  setTabFilter: <K extends keyof TabFilters>(tab: TabName, key: K, value: TabFilters[K]) => void;
  setTabFilters: (tab: TabName, updates: Partial<TabFilters>) => void;
  resetTabFilters: (tab: TabName) => void;
  excludeFile: (fileId: string) => void;
  includeFile: (fileId: string) => void;
  isFileExcluded: (fileId: string) => boolean;
  // Global excluded files (persisted)
  globalExcludedFileIds: string[];
}

const defaultTabFilters: TabFilters = {
  selectedFileIds: null,
  excludedFileIds: [],
  fileTypes: [],
  fileBusinessDateStart: undefined,
  fileBusinessDateEnd: undefined,
  fileUploadDateStart: undefined,
  fileUploadDateEnd: undefined,
  wmWeeks: [],
  wmDaysOfWeek: [],
  programNames: [],
  masterProgramNames: [],
  categoryNames: [],
  facilities: [],
  locationIds: [],
  tagClientOwnerships: [],
  tagClientSources: [],
  marketplacesSoldOn: [],
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  // Global excluded files (persisted across all tabs)
  const [globalExcludedFileIds, setGlobalExcludedFileIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('wm-excluded-files');
    return saved ? JSON.parse(saved) : [];
  });

  // Per-tab filters
  const [tabFilters, setTabFiltersState] = useState<Record<TabName, TabFilters>>({
    inbound: { ...defaultTabFilters, excludedFileIds: globalExcludedFileIds },
    processing: { ...defaultTabFilters, excludedFileIds: globalExcludedFileIds },
    sales: { ...defaultTabFilters, excludedFileIds: globalExcludedFileIds },
    outbound: { ...defaultTabFilters, excludedFileIds: globalExcludedFileIds },
    marketplace: { ...defaultTabFilters, excludedFileIds: globalExcludedFileIds },
    dsv: { ...defaultTabFilters, excludedFileIds: globalExcludedFileIds },
  });

  // Memoize per-tab filters to prevent unnecessary re-renders on other tabs
  const getTabFilters = useCallback((tab: TabName): TabFilters => {
    const tabFilter = tabFilters[tab];
    return {
      selectedFileIds: tabFilter.selectedFileIds,
      excludedFileIds: globalExcludedFileIds,
      fileTypes: tabFilter.fileTypes,
      fileBusinessDateStart: tabFilter.fileBusinessDateStart,
      fileBusinessDateEnd: tabFilter.fileBusinessDateEnd,
      fileUploadDateStart: tabFilter.fileUploadDateStart,
      fileUploadDateEnd: tabFilter.fileUploadDateEnd,
      wmWeeks: tabFilter.wmWeeks,
      wmDaysOfWeek: tabFilter.wmDaysOfWeek,
      programNames: tabFilter.programNames,
      masterProgramNames: tabFilter.masterProgramNames,
      categoryNames: tabFilter.categoryNames,
      facilities: tabFilter.facilities,
      locationIds: tabFilter.locationIds,
      tagClientOwnerships: tabFilter.tagClientOwnerships,
      tagClientSources: tabFilter.tagClientSources,
      marketplacesSoldOn: tabFilter.marketplacesSoldOn,
    };
  }, [tabFilters, globalExcludedFileIds]);

  const setTabFilter = useCallback(<K extends keyof TabFilters>(tab: TabName, key: K, value: TabFilters[K]) => {
    setTabFiltersState(prev => ({
      ...prev,
      [tab]: { ...prev[tab], [key]: value },
    }));
  }, []);

  const setTabFilters = useCallback((tab: TabName, updates: Partial<TabFilters>) => {
    setTabFiltersState(prev => ({
      ...prev,
      [tab]: { ...prev[tab], ...updates },
    }));
  }, []);

  const resetTabFilters = useCallback((tab: TabName) => {
    setTabFiltersState(prev => ({
      ...prev,
      [tab]: { ...defaultTabFilters, excludedFileIds: globalExcludedFileIds },
    }));
  }, [globalExcludedFileIds]);

  const excludeFile = useCallback((fileId: string) => {
    setGlobalExcludedFileIds(prev => {
      const newExcluded = [...prev, fileId];
      localStorage.setItem('wm-excluded-files', JSON.stringify(newExcluded));
      return newExcluded;
    });
  }, []);

  const includeFile = useCallback((fileId: string) => {
    setGlobalExcludedFileIds(prev => {
      const newExcluded = prev.filter(id => id !== fileId);
      localStorage.setItem('wm-excluded-files', JSON.stringify(newExcluded));
      return newExcluded;
    });
  }, []);

  const isFileExcluded = useCallback((fileId: string) => {
    return globalExcludedFileIds.includes(fileId);
  }, [globalExcludedFileIds]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ 
    getTabFilters,
    setTabFilter,
    setTabFilters,
    resetTabFilters,
    excludeFile,
    includeFile,
    isFileExcluded,
    globalExcludedFileIds,
  }), [getTabFilters, setTabFilter, setTabFilters, resetTabFilters, excludeFile, includeFile, isFileExcluded, globalExcludedFileIds]);

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  );
}

export function useTabFilters(tab: TabName) {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useTabFilters must be used within a FilterProvider');
  }
  
  // Get the filters for this tab
  const filters = context.getTabFilters(tab);
  
  const setFilter = useCallback(<K extends keyof TabFilters>(key: K, value: TabFilters[K]) => {
    context.setTabFilter(tab, key, value);
  }, [context, tab]);
  
  const setFilters = useCallback((updates: Partial<TabFilters>) => {
    context.setTabFilters(tab, updates);
  }, [context, tab]);
  
  const resetFilters = useCallback(() => {
    context.resetTabFilters(tab);
  }, [context, tab]);

  return {
    filters,
    setFilter,
    setFilters,
    resetFilters,
    excludeFile: context.excludeFile,
    includeFile: context.includeFile,
    isFileExcluded: context.isFileExcluded,
  };
}

// Legacy hook for backwards compatibility - defaults to inbound
export function useFilters() {
  return useTabFilters('inbound');
}
