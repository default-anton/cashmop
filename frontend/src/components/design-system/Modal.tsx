import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full ${sizeClasses[size]} bg-canvas-50 rounded-xl shadow-glass animate-snap-in`}>
        <div className="flex items-center justify-between p-4 border-b border-canvas-200">
          <h3 className="text-lg font-semibold text-canvas-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-canvas-500 hover:text-canvas-800 rounded-md hover:bg-canvas-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;