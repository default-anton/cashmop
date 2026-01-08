import React from 'react';

interface FieldMetaProps {
  label: string;
  required: boolean;
  hint?: string;
}

const FieldMeta: React.FC<FieldMetaProps> = ({ label, required, hint }) => {
  return (
    <div className="flex items-center gap-3">
      <div
        className={
          'w-8 h-8 rounded-lg flex items-center justify-center ' +
          (required ? 'bg-canvas-300 text-canvas-600' : 'bg-canvas-200 text-canvas-500')
        }
      >
        <span className="text-xs font-bold select-none">{label[0]}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-canvas-700 select-none">{label}</p>
        <p className="text-xs text-canvas-500 select-none">
          {required ? 'Required' : 'Optional'}
          {hint ? ` • ${hint}` : ''}
        </p>
      </div>
    </div>
  );
};

export default FieldMeta;