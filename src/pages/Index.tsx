import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InboundTab } from '@/components/tabs/InboundTab';
import { ProcessingTab } from '@/components/tabs/ProcessingTab';
import { SalesTab } from '@/components/tabs/SalesTab';
import { MonthlyTab } from '@/components/tabs/MonthlyTab';
import { OutboundTab } from '@/components/tabs/OutboundTab';
import { MarketplaceTab } from '@/components/tabs/MarketplaceTab';
import { DSVTab } from '@/components/tabs/DSVTab';
import { QuarterlyReviewTab } from '@/components/tabs/QuarterlyReviewTab';

const Index = () => {
  const [activeTab, setActiveTab] = useState('inbound');

  const renderTab = () => {
    switch (activeTab) {
      case 'inbound':
        return <InboundTab />;
      case 'processing':
        return <ProcessingTab />;
      case 'sales':
        return <SalesTab />;
      case 'monthly':
        return <MonthlyTab />;
      case 'outbound':
        return <OutboundTab />;
      case 'marketplace':
        return <MarketplaceTab />;
      case 'dsv':
        return <DSVTab />;
      case 'quarterly':
        return <QuarterlyReviewTab />;
      default:
        return <InboundTab />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTab()}
    </DashboardLayout>
  );
};

export default Index;
