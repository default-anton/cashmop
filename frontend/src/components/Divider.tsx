import type React from "react";

interface DividerProps {
  className?: string;
  vertical?: boolean;
}

const Divider: React.FC<DividerProps> = ({ className = "", vertical = false }) => {
  if (vertical) {
    return <div className={`h-4 w-px bg-canvas-300 mx-2 ${className}`} />;
  }

  return <div className={`h-px bg-canvas-200 ${className}`} />;
};

export default Divider;
