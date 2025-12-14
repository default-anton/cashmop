import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'mono';
}

const Input: React.FC<InputProps> = ({
  variant = 'default',
  className = '',
  ...props
}) => {
  const baseClasses = 'bg-canvas-50 border border-canvas-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-brand outline-none';
  const variantClasses = variant === 'mono' ? 'font-mono text-sm' : 'text-sm';

  return (
    <input
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    />
  );
};

export default Input;