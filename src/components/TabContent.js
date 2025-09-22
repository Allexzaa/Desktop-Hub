import React from 'react';
import WelcomeTab from './tabs/WelcomeTab';
import { YoutubeAISumTab } from '../services/youtube-ai-summarizer';
import './TabContent.css';

const TabContent = ({ tab, currentTheme }) => {
  if (!tab) return null;

  const renderTabComponent = () => {
    switch (tab.component) {
      case 'Welcome':
        return <WelcomeTab currentTheme={currentTheme} />;
      case 'YoutubeAISum':
        return <YoutubeAISumTab currentTheme={currentTheme} />;
      default:
        return <div className="tab-error">Unknown tab type: {tab.component}</div>;
    }
  };

  return (
    <div className="tab-content" data-theme={currentTheme}>
      {renderTabComponent()}
    </div>
  );
};

export default TabContent;