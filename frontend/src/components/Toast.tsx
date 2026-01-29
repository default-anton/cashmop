import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";
import type React from "react";
import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "warning" | "info";
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = "info", duration = 5000, onClose }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const typeConfig = {
    success: {
      icon: CheckCircle2,
      bg: "bg-finance-income/10",
      border: "border-finance-income/30",
      text: "text-finance-income",
    },
    error: {
      icon: XCircle,
      bg: "bg-finance-expense/10",
      border: "border-finance-expense/30",
      text: "text-finance-expense",
    },
    warning: {
      icon: AlertCircle,
      bg: "bg-yellow-100",
      border: "border-yellow-300",
      text: "text-yellow-800",
    },
    info: {
      icon: Info,
      bg: "bg-blue-100",
      border: "border-blue-300",
      text: "text-blue-800",
    },
  };

  const { icon: Icon, bg, border, text } = typeConfig[type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bg} ${border} ${text} shadow-glass animate-in slide-in-from-right-2`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium select-none">{message}</span>
      <button onClick={onClose} className="ml-2 p-1 hover:opacity-70" aria-label="Close">
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;
