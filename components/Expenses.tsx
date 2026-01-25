
import React, { useState, useMemo } from 'react';
import { Plus, ChevronRight, ChevronLeft, Wallet, ReceiptText, X, Calendar, Tag, Trash2, AlignRight, AlertCircle, Copy } from 'lucide-react';
import { Expense, User as UserType } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { copyToClipboard } from './Layout';

interface ExpensesProps {
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string, amount: number, description: string, user: UserType) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  user: UserType;
}

const Expenses: React.FC<ExpensesProps> = ({ expenses, onAddExpense, onDeleteExpense, onShowToast, user }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<Expense | null>(null);
  
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const formattedSelectedDate = selectedDate.toLocaleDateString('ar-EG');
  const monthNamesAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  const changePeriod = (delta: number) => {
    const newDate = new Date(selectedDate);
    if (activeTab === 'daily') newDate.setDate(selectedDate.getDate() + delta);
    else if (activeTab === 'monthly') newDate.setMonth(selectedDate.getMonth() + delta);
    else newDate.setFullYear(selectedDate.getFullYear() + delta);
    setSelectedDate(newDate);
  };

  const aggregatedData = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => b.timestamp - a.timestamp);
    if (activeTab === 'daily') return sorted.filter(exp => exp.date === formattedSelectedDate);
    else if (activeTab === 'monthly') {
      const month = selectedDate.getMonth();
      const year = selectedDate.getFullYear();
      const monthExpenses = sorted.filter(exp => {
        const d = new Date(exp.timestamp);
        return d.getMonth() === month && d.getFullYear() === year;
      });
      const dayGroups: Record<string, { total: number, date: string, count: number, day: number }> = {};
      monthExpenses.forEach(exp => {
        const day = new Date(exp.timestamp).getDate();
        if (!dayGroups[exp.date]) dayGroups[exp.date] = { total: 0, date: exp.date, count: 0, day };
        dayGroups[exp.date].total += exp.amount;
        dayGroups[exp.date].count += 1;
      });
      return Object.values(dayGroups).sort((a,b) => b.date.localeCompare(a.date));
    } else {
      const year = selectedDate.getFullYear();
      const yearExpenses = sorted.filter(exp => new Date(exp.timestamp).getFullYear() === year);
      const monthGroups: Record<string, { total: number, month: number, year: number, count: number }> = {};
      yearExpenses.forEach(exp => {
        const d = new Date(exp.timestamp);
        const m = d.getMonth();
        const key = `${m}-${year}`;
        if (!monthGroups[key]) monthGroups[key] = { total: 0, month: m, year, count: 0 };
        monthGroups[key].total += exp.amount;
        monthGroups[key].count += 1;
      });
      return Object.values(monthGroups).sort((a,b) => b.month - a.month);
    }
  }, [expenses, activeTab, formattedSelectedDate, selectedDate]);

  const chartData = useMemo(() => {
    if (activeTab === 'daily') return null;
    return [...aggregatedData].reverse().map((item: any) => ({
      name: activeTab === 'monthly' ? item.day.toString() : monthNamesAr[item.month],
      amount: item.total
    }));
  }, [aggregatedData, activeTab]);

  const totalPeriodExpenses = useMemo(() => {
    if (activeTab === 'daily') return (aggregatedData as Expense[]).reduce((sum, exp) => sum + exp.amount, 0);
    return (aggregatedData as any[]).reduce((sum, group) => sum + group.total, 0);
  }, [aggregatedData, activeTab]);

  const handleDelete = async () => {
    if (!isConfirmingDelete) return;
    try {
      await onDeleteExpense(isConfirmingDelete.id, isConfirmingDelete.amount, isConfirmingDelete.description, user);
      onShowToast("تم حذف المصروف بنجاح", "success");
      setIsConfirmingDelete(null);
    } catch (e) {
      onShowToast("فشل حذف المصروف", "error");
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 md:gap-6 no-print">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl flex-1 w-full overflow-x-auto">
          {['daily', 'monthly', 'yearly'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab as any); setSelectedDate(new Date()); }} className={`flex-1 min-w-[80px] px-2 md:px-8 py-2 md:py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}>
              {tab === 'daily' ? 'يومي' : tab === 'monthly' ? 'شهري' : 'سنوي'}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between lg:justify-center gap-4 bg-slate-50 px-4 md:px-5 py-2 md:py-2.5 rounded-xl border border-slate-100 flex-1">
           <button onClick={() => changePeriod(-1)} className="p-1 hover:bg-white rounded-lg text-indigo-600 transition-colors"><ChevronRight size={20}/></button>
           <span className="text-[11px] md:text-xs font-black text-slate-700 min-w-[100px] md:min-w-[120px] text-center truncate">{activeTab === 'daily' ? formattedSelectedDate : activeTab === 'monthly' ? `${monthNamesAr[selectedDate.getMonth()]} ${selectedDate.getFullYear()}` : selectedDate.getFullYear()}</span>
           <button onClick={() => changePeriod(1)} className="p-1 hover:bg-white rounded-lg text-indigo-600 transition-colors"><ChevronLeft size={20}/></button>
        </div>
        <button onClick={() => setIsOpen(true)} className="flex items-center justify-center gap-3 px-6 md:px-8 py-3 bg-slate-800 text-white font-black rounded-xl hover:bg-slate-900 shadow-md transition-all text-xs shrink-0 cursor-pointer">
          <Plus size={18} />مصروف جديد
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className={`lg:col-span-4 ${activeTab === 'daily' ? 'lg:col-start-5' : ''}`}>
          <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-center shadow-sm h-full">
              <div className="w-16 h-16 bg-rose-600 text-white rounded-[2rem] flex items-center justify-center shadow-lg mb-4"><Wallet size={32} /></div>
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">إجمالي مصروفات الفترة</p>
              <h3 className="text-3xl font-black text-rose-700">{totalPeriodExpenses.toLocaleString()} ج.م</h3>
          </div>
        </div>
        
        {activeTab !== 'daily' && chartData && (
          <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-64">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs><linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e11d48" stopOpacity={0.1}/><stop offset="95%" stopColor="#e11d48" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <YAxis hide />
                  <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: 'Cairo'}} />
                  <Area type="monotone" dataKey="amount" stroke="#e11d48" fillOpacity={1} fill="url(#colorExp)" strokeWidth={3} />
                </AreaChart>
             </ResponsiveContainer>
          </div>
        )}
      </div>

      {activeTab === 'daily' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs min-w-[600px]">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[9px] border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5">البيان الأساسي</th>
                    <th className="px-8 py-5">التفاصيل</th>
                    <th className="px-8 py-5">التوقيت / التاريخ</th>
                    <th className="px-8 py-5 text-center">المبلغ</th>
                    <th className="px-8 py-5 text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-bold">
                  {(aggregatedData as Expense[]).map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/50 group">
                      <td className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => copyToClipboard(exp.id, onShowToast)}>
                        <p className="text-slate-800 text-xs font-black">{exp.description}</p>
                        <p className="text-[8px] text-slate-300 font-mono mt-1">#{exp.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-8 py-5"><p className="text-slate-400 text-[11px] max-w-xs truncate">{exp.notes || '---'}</p></td>
                      <td className="px-8 py-5 text-slate-400">{exp.time}</td>
                      <td className="px-8 py-5 text-center text-rose-600 font-black">{exp.amount.toLocaleString()} ج.م</td>
                      <td className="px-8 py-5 text-left">
                        <button 
                          onClick={() => setIsConfirmingDelete(exp)}
                          className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(aggregatedData as Expense[]).length === 0 && (
                    <tr><td colSpan={5} className="py-20 text-center text-slate-300 italic">لا توجد مصروفات مسجلة لهذا اليوم</td></tr>
                  )}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center shrink-0">
              <h3 className="text-lg font-black">إضافة مصروف جديد</h3>
              <button onClick={() => setIsOpen(false)} className="cursor-pointer hover:bg-white/10 p-1 rounded-lg"><X size={20}/></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">وصف المصروف</label><input type="text" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-xs focus:ring-2 focus:ring-indigo-500/5" value={desc} onChange={e => setDesc(e.target.value)} placeholder="مثال: فاتورة كهرباء، إيجار..." /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">المبلغ المستقطع (ج.م)</label><input type="number" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-black text-sm focus:ring-2 focus:ring-indigo-500/5" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} placeholder="0.00" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1 flex items-center gap-1"><AlignRight size={12}/> تفاصيل إضافية (اختياري)</label><textarea className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-xs focus:ring-2 focus:ring-indigo-500/5 h-24 resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="اكتب هنا تفاصيل المصروف..." /></div>
            </div>
            <div className="p-6 bg-slate-50 border-t flex gap-4">
              <button onClick={() => setIsOpen(false)} className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 font-black rounded-xl text-xs uppercase">إلغاء</button>
              <button onClick={() => {if(!desc.trim() || !amount) return; onAddExpense({ id: `EXP-${Date.now()}`, description: desc, amount: amount, category: 'general', date: formattedSelectedDate, time: new Date().toLocaleTimeString('ar-EG'), timestamp: Date.now(), createdBy: user.id, branchId: user.branchId, notes: notes }); setIsOpen(false); setDesc(''); setAmount(0); setNotes(''); }} className="flex-[1.5] py-4 bg-indigo-600 text-white font-black rounded-xl shadow-lg text-xs hover:bg-indigo-700 active:scale-95 transition-all">تثبيت المصروف</button>
            </div>
          </div>
        </div>
      )}

      {isConfirmingDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[700] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in text-center">
            <div className="p-8 bg-rose-50">
              <div className="w-16 h-16 bg-rose-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-200">
                <Trash2 size={32}/>
              </div>
              <h3 className="text-xl font-black text-rose-900">حذف المصروف؟</h3>
              <p className="text-slate-500 text-[11px] font-bold mt-2 uppercase tracking-tight">سيتم حذف السجل وإعادة مبلغ <span className="text-rose-600">({isConfirmingDelete.amount} ج.م)</span> إلى الخزينة فوراً.</p>
            </div>
            <div className="p-6 flex gap-3">
              <button onClick={() => setIsConfirmingDelete(null)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-xl text-xs">تراجع</button>
              <button onClick={handleDelete} className="flex-[1.5] py-4 bg-rose-600 text-white font-black rounded-xl shadow-xl text-xs hover:bg-rose-700 transition-all">نعم، حذف واسترداد</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
