import type React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "elevated" | "glass";
}

const Card: React.FC<CardProps> = ({ children, className = "", variant = "default", ...props }) => {
  const baseClasses = "bg-canvas-50 border rounded-2xl overflow-hidden";

  const variantClasses = {
    default: "border-canvas-200",
    elevated: "border-canvas-200 shadow-card hover:shadow-card-hover",
    glass: "border-canvas-200 shadow-glass",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card;
