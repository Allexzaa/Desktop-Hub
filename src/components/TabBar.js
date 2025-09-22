import React, { useState, useRef, useEffect } from 'react';
import './TabBar.css';

const TabBar = ({ tabs, activeTabId, onSwitchTab, currentTheme }) => {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width');
    return saved ? parseInt(saved) : 280;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);
  const resizeRef = useRef(null);

  const MIN_WIDTH = 60;
  const MAX_WIDTH = 500;

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      const newWidth = e.clientX;

      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
        document.body.style.cursor = 'col-resize';
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Save the width to localStorage when resizing ends
      localStorage.setItem('sidebar-width', sidebarWidth.toString());
    };

    if (isResizing) {
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const isCollapsed = sidebarWidth < 120;

  return (
    <div
      ref={sidebarRef}
      className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
      style={{ width: `${sidebarWidth}px` }}
      data-theme={currentTheme}
    >
      <div className="sidebar-header">
        <div className="app-logo">
          <span className="logo-icon">🏠</span>
          {!isCollapsed && <span className="app-title">Desktop Hub</span>}
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          {!isCollapsed && <div className="nav-section-title">Navigation</div>}
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${tab.id === activeTabId ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`}
              onClick={() => onSwitchTab(tab.id)}
              title={tab.title}
            >
              <span className="nav-icon">{tab.icon}</span>
              {!isCollapsed && <span className="nav-label">{tab.title}</span>}
            </button>
          ))}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">👤</div>
          {!isCollapsed && (
            <div className="user-details">
              <div className="user-name">User</div>
              <div className="user-status">Online</div>
            </div>
          )}
        </div>
      </div>

      <div
        ref={resizeRef}
        className="resize-handle"
        onMouseDown={handleResizeStart}
        title="Drag to resize sidebar"
      >
        <div className="resize-line"></div>
      </div>
    </div>
  );
};

export default TabBar;