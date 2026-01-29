import type React from "react";
import { useState } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = "top" }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
    left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
    right: "left-full top-1/2 transform -translate-y-1/2 ml-2",
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div
          className={`absolute z-50 px-2 py-1 text-xs font-medium text-canvas-800 bg-canvas-100 border border-canvas-300 rounded shadow-glass whitespace-nowrap select-none ${positionClasses[position]}`}
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-canvas-100 border border-canvas-300 transform rotate-45 ${
              position === "top"
                ? "top-full left-1/2 -translate-x-1/2 -mt-1 border-t-0 border-l-0"
                : position === "bottom"
                  ? "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-0 border-r-0"
                  : position === "left"
                    ? "left-full top-1/2 -translate-y-1/2 -ml-1 border-l-0 border-b-0"
                    : "right-full top-1/2 -translate-y-1/2 -mr-1 border-r-0 border-t-0"
            }`}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
