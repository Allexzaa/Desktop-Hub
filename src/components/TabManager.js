import React from 'react';
import TabBar from './TabBar';
import TabContent from './TabContent';
import './TabManager.css';

const TabManager = ({ tabs, activeTabId, onSwitchTab, activeTab, currentTheme }) => {
  return (
    <div className="tab-manager" data-theme={currentTheme}>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitchTab={onSwitchTab}
        currentTheme={currentTheme}
      />
      <div className="tab-content-container">
        <TabContent tab={activeTab} currentTheme={currentTheme} />
      </div>
    </div>
  );
};

export default TabManager;