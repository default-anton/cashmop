import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'glass';
}

const Card: React.FC<CardProps> = ({ children, className = '', variant = 'default' }) => {
  const baseClasses = 'bg-canvas-50 border rounded-xl overflow-hidden';
  
  const variantClasses = {
    default: 'border-canvas-200',
    elevated: 'border-canvas-200 shadow-card hover:shadow-card-hover',
    glass: 'border-canvas-200 shadow-glass',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
};

export default Card;