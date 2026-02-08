import type React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  className = "",
  disabled,
  ...props
}) => {
  const baseClasses =
    "flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-200 select-none";

  const variantClasses = {
    primary: disabled
      ? "bg-canvas-200 text-canvas-500 cursor-not-allowed"
      : "bg-gradient-to-r from-brand to-brand-alt hover:from-brand-hover hover:to-brand text-white shadow-brand-glow",
    secondary: disabled
      ? "bg-canvas-100 text-canvas-500 cursor-not-allowed"
      : "bg-canvas-50 border border-canvas-300 text-canvas-700 hover:border-canvas-400 hover:bg-canvas-100",
    ghost: disabled
      ? "text-canvas-500 cursor-not-allowed"
      : "text-canvas-700 hover:text-canvas-900 hover:bg-canvas-100",
  };

  const sizeClasses = {
    sm: "text-sm px-3 py-2",
    md: "text-sm px-4 py-2.5",
    lg: "text-base px-6 py-3.5",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
