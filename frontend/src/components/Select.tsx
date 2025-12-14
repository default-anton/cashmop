import React from 'react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<SelectOption>;
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
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default Select;