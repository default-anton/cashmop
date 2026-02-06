import type React from "react";

interface ScreenLayoutProps {
  children: React.ReactNode;
  size?: "medium" | "wide";
  centerContent?: boolean;
}

const sizeClasses = {
  medium: "max-w-4xl",
  wide: "max-w-6xl",
};

const ScreenLayout: React.FC<ScreenLayoutProps> = ({ children, size = "wide", centerContent = false }) => {
  return (
    <div className="min-h-screen pt-28 pb-14 px-6 md:px-10 bg-transparent">
      <div className={`${sizeClasses[size]} mx-auto ${centerContent ? "flex flex-col items-center" : ""}`}>
        {children}
      </div>
    </div>
  );
};

export default ScreenLayout;
