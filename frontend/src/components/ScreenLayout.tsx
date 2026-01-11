import React from 'react';

interface ScreenLayoutProps {
  children: React.ReactNode;
  size?: 'medium' | 'wide';
  centerContent?: boolean;
}

const sizeClasses = {
  medium: 'max-w-4xl',
  wide: 'max-w-6xl',
};

const ScreenLayout: React.FC<ScreenLayoutProps> = ({
  children,
  size = 'wide',
  centerContent = false,
}) => {
  return (
    <div className="min-h-screen pt-24 pb-12 px-8 bg-canvas-100">
      <div className={`${sizeClasses[size]} mx-auto ${centerContent ? 'flex flex-col items-center' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default ScreenLayout;
