
import React from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, title, message, onConfirm, onCancel, 
  confirmText = "تأكيد الإجراء", cancelText = "إلغاء", variant = 'danger' 
}) => {
  if (!isOpen) return null;

  const colors = {
    danger: { bg: 'bg-rose-50', icon: 'text-rose-600', btn: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' },
    warning: { bg: 'bg-amber-50', icon: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' },
    info: { bg: 'bg-indigo-50', icon: 'text-indigo-600', btn: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' }
  };

  const selectedColor = colors[variant];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
        <div className={`p-8 text-center ${selectedColor.bg}`}>
          <div className={`w-20 h-20 ${selectedColor.bg} rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-inner border border-white/50`}>
            <AlertTriangle size={40} className={selectedColor.icon} />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
          <p className="text-slate-500 text-xs font-bold leading-relaxed">{message}</p>
        </div>
        
        <div className="p-6 bg-white flex gap-3">
          <button 
            onClick={onCancel} 
            className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-2xl text-xs hover:bg-slate-100 transition-all"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => { onConfirm(); onCancel(); }} 
            className={`flex-[1.5] py-4 text-white font-black rounded-2xl shadow-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${selectedColor.btn}`}
          >
            <CheckCircle2 size={16} />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
