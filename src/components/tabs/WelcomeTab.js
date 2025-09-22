import React, { useState, useEffect } from 'react';
import './WelcomeTab.css';

const WelcomeTab = ({ currentTheme: propTheme }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [systemStats, setSystemStats] = useState({
    sessionTime: 0
  });
  const [currentTheme, setCurrentTheme] = useState(propTheme || 'light');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateStats = () => {
      const sessionStart = localStorage.getItem('session-start') || Date.now();

      if (!localStorage.getItem('session-start')) {
        localStorage.setItem('session-start', Date.now().toString());
      }

      setSystemStats({
        sessionTime: Math.floor((Date.now() - parseInt(sessionStart)) / 1000)
      });
    };

    // Update immediately
    updateStats();

    // Update every 5 seconds to keep stats fresh
    const statsInterval = setInterval(updateStats, 5000);

    return () => {
      clearInterval(statsInterval);
    };
  }, []);

  useEffect(() => {
    // Sync with prop theme
    if (propTheme) {
      setCurrentTheme(propTheme);
    }
  }, [propTheme]);

  const setTheme = (theme) => {
    setCurrentTheme(theme);
    localStorage.setItem('youtube-ai-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  };


  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatSessionTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <div className="dashboard-tab" data-theme={currentTheme}>
      <div className="dashboard-header">
        <div className="time-widget">
          <div className="current-time">{formatTime(currentTime)}</div>
          <div className="current-date">{formatDate(currentTime)}</div>
        </div>
        <div className="welcome-message">
          <h1>🏠 Desktop Hub Dashboard</h1>
          <p>Welcome back! Here's your productivity overview</p>
        </div>
        <div className="dashboard-controls">
          <div className="theme-toggle">
            {['light', 'dark'].map(theme => (
              <button
                key={theme}
                className={`theme-btn ${currentTheme === theme ? 'active' : ''}`}
                onClick={() => setTheme(theme)}
                title={`${theme} Theme`}
              >
                {theme === 'light' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="5"/>
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="widget stats-widget">
          <h3>📊 Session Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{formatSessionTime(systemStats.sessionTime)}</div>
              <div className="stat-label">Session Time</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">1</div>
              <div className="stat-label">Dashboard</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">Active</div>
              <div className="stat-label">Status</div>
            </div>
          </div>
        </div>

        <div className="widget navigation-widget">
          <h3>🧭 Dashboard Overview</h3>
          <div className="navigation-grid">
            <div className="nav-card" data-section="dashboard">
              <span className="nav-card-icon">🎯</span>
              <div className="nav-card-content">
                <h4>Centralized Hub</h4>
                <p>All your productivity tools in one place</p>
              </div>
            </div>
          </div>
        </div>

        <div className="widget recent-activity-widget">
          <h3>📋 Getting Started</h3>
          <div className="activity-list">
            <div className="activity-item">
              <span className="activity-icon">🧭</span>
              <span className="activity-text">Use the sidebar to navigate between sections</span>
            </div>
            <div className="activity-item">
              <span className="activity-icon">💾</span>
              <span className="activity-text">Your work is automatically saved</span>
            </div>
            <div className="activity-item">
              <span className="activity-icon">📱</span>
              <span className="activity-text">Interface adapts to your screen size</span>
            </div>
            <div className="activity-item">
              <span className="activity-icon">⚡</span>
              <span className="activity-text">All features work offline</span>
            </div>
          </div>
        </div>

        <div className="widget system-info-widget">
          <h3>💻 System Info</h3>
          <div className="system-info">
            <div className="info-item">
              <span className="info-label">Platform:</span>
              <span className="info-value">Desktop Hub</span>
            </div>
            <div className="info-item">
              <span className="info-label">Version:</span>
              <span className="info-value">v1.0.0</span>
            </div>
            <div className="info-item">
              <span className="info-label">Storage:</span>
              <span className="info-value">LocalStorage</span>
            </div>
            <div className="info-item">
              <span className="info-label">Status:</span>
              <span className="info-value status-online">🟢 Online</span>
            </div>
          </div>
        </div>

        <div className="widget tips-widget">
          <h3>💡 Pro Tips</h3>
          <div className="tips-list">
            <div className="tip-item">
              <strong>Sidebar Navigation:</strong> Click any item in the left sidebar to switch sections
            </div>
            <div className="tip-item">
              <strong>Responsive Design:</strong> Interface adapts to mobile and desktop screens
            </div>
            <div className="tip-item">
              <strong>Data Safety:</strong> Session data is preserved across restarts
            </div>
          </div>
        </div>

        <div className="widget">
          <h3>🎯 Focus</h3>
          <div className="weather-preview">
            <div className="weather-icon">🚀</div>
            <div className="weather-temp">Ready</div>
            <div className="weather-desc">Productive</div>
            <div className="weather-note">
              Everything you need in one place
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeTab;