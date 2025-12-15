import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { InboundTab } from '@/components/tabs/InboundTab';
import { ProcessingTab } from '@/components/tabs/ProcessingTab';
import { SalesTab } from '@/components/tabs/SalesTab';
import { OutboundTab } from '@/components/tabs/OutboundTab';
import { MarketplaceTab } from '@/components/tabs/MarketplaceTab';
import { DSVTab } from '@/components/tabs/DSVTab';

const Index = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'inbound':
        return <InboundTab />;
      case 'processing':
        return <ProcessingTab />;
      case 'sales':
        return <SalesTab />;
      case 'outbound':
        return <OutboundTab />;
      case 'marketplace':
        return <MarketplaceTab />;
      case 'dsv':
        return <DSVTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTab()}
    </DashboardLayout>
  );
};

export default Index;
