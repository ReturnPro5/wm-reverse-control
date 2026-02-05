import { cn } from '@/lib/utils';
import { 
  Download, 
  Settings, 
  Package, 
  DollarSign,
  Truck,
  Store,
  ShoppingCart,
  CalendarRange,
  Calendar
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ThemeToggle';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'inbound', label: 'Inbound', icon: Download },
  { id: 'processing', label: 'Processing', icon: Settings },
  { id: 'sales', label: 'Sales', icon: DollarSign },
  { id: 'monthly', label: 'Monthly', icon: Calendar },
  { id: 'outbound', label: 'Outbound/Fees', icon: Truck },
  { id: 'marketplace', label: 'WM Marketplace', icon: Store },
  { id: 'dsv', label: 'WM DSV', icon: ShoppingCart },
  { id: 'quarterly', label: 'Quarterly Review', icon: CalendarRange },
];

export function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">WM Reverse Logistics</h1>
              <p className="text-xs text-muted-foreground">Control Tower</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Sat-Fri Week Cycle
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="sticky top-16 z-40 w-full border-b bg-background/95 backdrop-blur">
        <div className="container px-4">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="h-12 w-full justify-start gap-1 rounded-none bg-transparent p-0">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={cn(
                      'h-12 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent',
                      'flex items-center gap-2 text-sm font-medium'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <main className="container px-4 py-6">
        {children}
      </main>
    </div>
  );
}