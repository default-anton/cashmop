import type React from "react";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "mono";
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ variant = "default", className = "", ...props }, ref) => {
  const baseClasses =
    "bg-canvas-50 border border-canvas-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-brand/20 outline-none";
  const variantClasses = variant === "mono" ? "font-mono text-sm" : "text-sm";

  return <input ref={ref} className={`${baseClasses} ${variantClasses} ${className}`} {...props} />;
});

export default Input;
