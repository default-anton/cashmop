import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

const Select: React.FC<SelectProps> = ({
  options,
  placeholder,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <select
      className={`bg-canvas-50 border border-canvas-300 text-sm rounded-md px-2 py-1 focus:ring-1 focus:ring-brand outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      disabled={disabled}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default Select;