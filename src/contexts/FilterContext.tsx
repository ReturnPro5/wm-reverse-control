import { createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode } from 'react';

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

interface FilterContextType {
  // Returns the raw tab filters state (for internal use)
  getTabFiltersRaw: (tab: TabName) => TabFilters;
  setTabFilter: <K extends keyof TabFilters>(tab: TabName, key: K, value: TabFilters[K]) => void;
  setTabFilters: (tab: TabName, updates: Partial<TabFilters>) => void;
  resetTabFilters: (tab: TabName) => void;
  excludeFile: (fileId: string) => void;
  includeFile: (fileId: string) => void;
  isFileExcluded: (fileId: string) => boolean;
  // Global excluded files (persisted)
  globalExcludedFileIds: string[];
  // Version counter per tab - increments when that tab's filters change
  tabVersions: Record<TabName, number>;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  // Global excluded files (persisted across all tabs)
  const [globalExcludedFileIds, setGlobalExcludedFileIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('wm-excluded-files');
    return saved ? JSON.parse(saved) : [];
  });

  // Per-tab filters - stored as a simple state object
  const [tabFilters, setTabFiltersState] = useState<Record<TabName, Omit<TabFilters, 'excludedFileIds'>>>({
    inbound: { ...defaultTabFilters },
    processing: { ...defaultTabFilters },
    sales: { ...defaultTabFilters },
    outbound: { ...defaultTabFilters },
    marketplace: { ...defaultTabFilters },
    dsv: { ...defaultTabFilters },
  });

  // Version counters for each tab - used to trigger re-renders only for affected tabs
  const [tabVersions, setTabVersions] = useState<Record<TabName, number>>({
    inbound: 0,
    processing: 0,
    sales: 0,
    outbound: 0,
    marketplace: 0,
    dsv: 0,
  });

  // Get raw tab filters (combines tab-specific with global excluded files)
  const getTabFiltersRaw = useCallback((tab: TabName): TabFilters => {
    const tabFilter = tabFilters[tab];
    return {
      ...tabFilter,
      excludedFileIds: globalExcludedFileIds,
    };
  }, [tabFilters, globalExcludedFileIds]);

  const setTabFilter = useCallback(<K extends keyof TabFilters>(tab: TabName, key: K, value: TabFilters[K]) => {
    setTabFiltersState(prev => ({
      ...prev,
      [tab]: { ...prev[tab], [key]: value },
    }));
    // Increment version only for this specific tab
    setTabVersions(prev => ({
      ...prev,
      [tab]: prev[tab] + 1,
    }));
  }, []);

  const setTabFilters = useCallback((tab: TabName, updates: Partial<TabFilters>) => {
    setTabFiltersState(prev => ({
      ...prev,
      [tab]: { ...prev[tab], ...updates },
    }));
    // Increment version only for this specific tab
    setTabVersions(prev => ({
      ...prev,
      [tab]: prev[tab] + 1,
    }));
  }, []);

  const resetTabFilters = useCallback((tab: TabName) => {
    setTabFiltersState(prev => ({
      ...prev,
      [tab]: { ...defaultTabFilters },
    }));
    // Increment version only for this specific tab
    setTabVersions(prev => ({
      ...prev,
      [tab]: prev[tab] + 1,
    }));
  }, []);

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

  // Memoize the context value
  const contextValue = useMemo(() => ({ 
    getTabFiltersRaw,
    setTabFilter,
    setTabFilters,
    resetTabFilters,
    excludeFile,
    includeFile,
    isFileExcluded,
    globalExcludedFileIds,
    tabVersions,
  }), [getTabFiltersRaw, setTabFilter, setTabFilters, resetTabFilters, excludeFile, includeFile, isFileExcluded, globalExcludedFileIds, tabVersions]);

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  );
}

// Hook for a specific tab - memoizes filters to ensure stable reference
export function useTabFilters(tab: TabName) {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useTabFilters must be used within a FilterProvider');
  }
  
  // Get the current version for this tab only
  const tabVersion = context.tabVersions[tab];
  const globalExcludedFileIds = context.globalExcludedFileIds;
  
  // Memoize filters based on tab version and global excluded files
  // This ensures the filters object only changes when THIS tab's filters change
  const filters = useMemo(() => {
    return context.getTabFiltersRaw(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tabVersion, globalExcludedFileIds]);
  
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
