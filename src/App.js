import React, { useState, useEffect } from 'react';
import TabManager from './components/TabManager';
import './App.css';

function App() {
  const [tabs] = useState([
    {
      id: 1,
      title: 'Dashboard',
      component: 'Welcome',
      icon: '🏠'
    },
    {
      id: 2,
      title: 'Youtube AI-Sum',
      component: 'YoutubeAISum',
      icon: '🎬'
    }
  ]);

  const [activeTabId, setActiveTabId] = useState(1);
  const [currentTheme, setCurrentTheme] = useState('light');

  useEffect(() => {
    // Load theme from localStorage and apply it globally
    const loadTheme = () => {
      const saved = localStorage.getItem('youtube-ai-theme') || 'light';
      setCurrentTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    };
    loadTheme();

    // Listen for theme changes from localStorage (for cross-tab sync)
    const handleStorageChange = (e) => {
      if (e.key === 'youtube-ai-theme') {
        const newTheme = e.newValue || 'light';
        setCurrentTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const switchTab = (tabId) => {
    setActiveTabId(tabId);
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  return (
    <div className="app" data-theme={currentTheme}>
      <TabManager
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitchTab={switchTab}
        activeTab={activeTab}
        currentTheme={currentTheme}
      />
    </div>
  );
}

export default App;