import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Settings } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Country Stats', icon: BarChart3 },
    { path: '/status', label: 'Processing Status', icon: Settings }
  ];

  return (
    <nav className="navicat-sidebar">
      <div className="sidebar-header">
        <h3>Address Manager</h3>
      </div>
      <div className="sidebar-menu">
        {navItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`menu-item ${location.pathname === path ? 'active' : ''}`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;