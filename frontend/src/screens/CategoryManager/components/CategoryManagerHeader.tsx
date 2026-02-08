import { Tag } from "lucide-react";
import type React from "react";

const CategoryManagerHeader: React.FC = () => (
  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div className="flex items-start gap-4">
      <div className="rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/20 to-brand-alt/20 p-3.5 text-brand shadow-brand-glow">
        <Tag className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-4xl font-black tracking-tight text-canvas-900 select-none">Categories</h1>
        <p className="mt-1 text-base font-semibold text-canvas-600 select-none">
          Keep categories tidy, searchable, and rule-powered in one command center.
        </p>
      </div>
    </div>
  </div>
);

export default CategoryManagerHeader;
