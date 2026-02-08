import type React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "error" | "warning" | "info";
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = "default", className = "" }) => {
  const baseClasses = "inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded select-none";

  const variantClasses = {
    default: "bg-canvas-200 text-canvas-700",
    success: "bg-finance-income/10 text-finance-income border border-finance-income/30",
    error: "bg-finance-expense/10 text-finance-expense border border-finance-expense/30",
    warning: "bg-status-warning-soft text-status-warning-ink border border-status-warning-border",
    info: "bg-status-info-soft text-status-info-ink border border-status-info-border",
  };

  return <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>{children}</span>;
};

export default Badge;
