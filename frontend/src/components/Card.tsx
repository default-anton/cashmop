import type React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "elevated" | "glass";
}

const Card: React.FC<CardProps> = ({ children, className = "", variant = "default", ...props }) => {
  const baseClasses = "bg-canvas-50/90 backdrop-blur-md border rounded-3xl overflow-hidden";

  const variantClasses = {
    default: "border-canvas-200/80",
    elevated: "border-canvas-200/80 shadow-card hover:shadow-card-hover transition-shadow duration-300",
    glass: "border-canvas-200/70 shadow-glass",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card;
