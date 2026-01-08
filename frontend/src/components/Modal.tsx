import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  variant?: 'default' | 'full';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', variant = 'default' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    full: 'max-w-2xl',
  };

  const isFull = variant === 'full';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`w-full ${sizeClasses[size]} ${isFull ? 'bg-gradient-to-br from-canvas-50 to-canvas-100 rounded-3xl' : 'bg-canvas-50 rounded-xl'} shadow-glass animate-snap-in`}>
        {!isFull && (
          <div className="flex items-center justify-between p-4 border-b border-canvas-200">
            <h3 className="text-lg font-semibold text-canvas-800 select-none">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 text-canvas-500 hover:text-canvas-800 rounded-md hover:bg-canvas-100 select-none"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className={isFull ? 'overflow-hidden' : 'p-6'}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;