import React from 'react';

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ title, children, className = '' }) => {
  return (
    <div className={`bg-canvas-100 p-4 border-b border-canvas-200 flex justify-between items-center ${className}`}>
      <div className="flex items-center gap-3">
        <h2 className="font-bold text-canvas-800 select-none">{title}</h2>
        <div className="h-4 w-px bg-canvas-300 mx-2" />
      </div>
      {children}
    </div>
  );
};

export default Header;