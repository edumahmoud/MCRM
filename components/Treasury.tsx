
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Wallet, Receipt, RotateCcw, Landmark, ArrowUpCircle, ArrowDownCircle, 
  Banknote, History, Search, Filter, ChevronRight, ChevronLeft, Calendar, ArrowUpDown, User, Hash, FileSpreadsheet
} from 'lucide-react';
import { Invoice, Expense, User as UserType, TreasuryLog } from '../types';
import { supabase } from '../supabaseClient';
import { copyToClipboard } from './Layout';
import * as XLSX from 'xlsx';

interface TreasuryProps {
  invoices: Invoice[];
  expenses: Expense[];
  onShowToast: (m: string, t: 'success' | 'error') => void;
  user: UserType;
}

const Treasury: React.FC<TreasuryProps> = ({ invoices, expenses, onShowToast, user }) => {
  const [logs, setLogs] = useState<(TreasuryLog & { creator_username?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  
  const isHQ = useMemo(() => ['admin', 'it_support', 'general_manager'].includes(user.role), [user.role]);

  const fetchTreasuryData = async () => {
    setLoading(true);
    try {
      const { data: logsData, error } = await supabase
        .from('treasury_logs')
        .select(`
          *,
          users:created_by (username)
        `)
        .order('timestamp', { ascending: false });
      
      if (logsData) {
        setLogs(logsData.map(l => ({
          id: l.id,
          branchId: l.branch_id,
          type: l.type,
          source: l.source,
          referenceId: l.reference_id,
          amount: Number(l.amount),
          notes: l.notes,
          createdBy: l.created_by,
          timestamp: l.timestamp,
          creator_username: l.users?.username || '---'
        })));
      }
      
      // حساب الرصيد للفرع المسموح به
      const currentLogs = logsData || [];
      const branchLogs = isHQ ? currentLogs : currentLogs.filter(l => l.branch_id === user.branchId);
      const totalBalance = branchLogs.reduce((acc, l) => l.type === 'in' ? acc + Number(l.amount) : acc - Number(l.amount), 0);
      setBalance(totalBalance);

    } catch (err) {
      console.error("Treasury fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreasuryData();
  }, [user.branchId, isHQ]);

  // States for Filtering
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });

  const formattedSelectedDate = selectedDate.toLocaleDateString('ar-EG');
  const monthNamesAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  const dateDisplayLabel = useMemo(() => {
    if (activeTab === 'daily') return formattedSelectedDate;
    if (activeTab === 'monthly') return `${monthNamesAr[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    return selectedDate.getFullYear().toString();
  }, [activeTab, selectedDate, formattedSelectedDate]);

  const changePeriod = (delta: number) => {
    const newDate = new Date(selectedDate);
    if (activeTab === 'daily') newDate.setDate(selectedDate.getDate() + delta);
    else if (activeTab === 'monthly') newDate.setMonth(selectedDate.getMonth() + delta);
    else newDate.setFullYear(selectedDate.getFullYear() + delta);
    setSelectedDate(newDate);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredLogs = useMemo(() => {
    let list = logs.filter(log => {
      // عزل الفرع
      const matchesBranch = isHQ ? true : (log.branchId === user.branchId);
      if (!matchesBranch) return false;

      const logDate = new Date(log.timestamp);
      const matchesDate = activeTab === 'daily' 
        ? logDate.toLocaleDateString('ar-EG') === selectedDate.toLocaleDateString('ar-EG')
        : activeTab === 'monthly'
          ? (logDate.getMonth() === selectedDate.getMonth() && logDate.getFullYear() === selectedDate.getFullYear())
          : logDate.getFullYear() === selectedDate.getFullYear();

      const matchesSource = sourceFilter === 'all' || log.source === sourceFilter;
      const matchesSearch = log.referenceId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (log.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchesDate && matchesSource && matchesSearch;
    });

    list.sort((a: any, b: any) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [logs, activeTab, selectedDate, sourceFilter, searchTerm, sortConfig, isHQ, user.branchId]);

  const handleExportTreasury = () => {
    const data = filteredLogs.map(log => ({
      "نوع الحركة": log.type === 'in' ? 'وارد (إيداع)' : 'صادر (سحب)',
      "نوع العملية": log.source,
      "كود المرجع": log.referenceId,
      "المبلغ": log.amount,
      "التاريخ": new Date(log.timestamp).toLocaleDateString('ar-EG'),
      "الوقت": new Date(log.timestamp).toLocaleTimeString('ar-EG'),
      "الموظف المسؤول": log.creator_username,
      "ملاحظات": log.notes || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "سجل الخزينة");
    XLSX.writeFile(wb, `Treasury_Report_${activeTab}_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      {/* Treasury Dashboard Header */}
      <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
           <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><Wallet size={14}/> رصيد فرع {isHQ ? 'الإدارة (الشركة)' : 'الحالي'}</p>
           <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
              {balance.toLocaleString()} <span className="text-xl font-bold text-white/30">ج.م</span>
           </h2>
        </div>
      </div>

      {/* باقي الواجهة كما هي مع تطبيق فلتر filteredLogs */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
        <div className="p-6 border-b bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
           <div className="flex items-center gap-3 font-black text-sm text-slate-800"><History size={18} className="text-indigo-600"/> دفتر الخزينة للفرع</div>
           
           <div className="flex gap-3 items-center">
              <div className="flex bg-slate-200 p-1 rounded-xl">
                {['daily', 'monthly', 'yearly'].map(tab => (
                  <button key={tab} onClick={() => { setActiveTab(tab as any); setSelectedDate(new Date()); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}>
                    {tab === 'daily' ? 'يومي' : tab === 'monthly' ? 'شهري' : 'سنوي'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                 <button onClick={() => changePeriod(-1)} className="p-1 hover:bg-slate-100 rounded-lg text-indigo-600 transition-colors"><ChevronRight size={16}/></button>
                 <span className="text-[10px] font-black text-slate-700 min-w-[80px] text-center">{dateDisplayLabel}</span>
                 <button onClick={() => changePeriod(1)} className="p-1 hover:bg-slate-100 rounded-lg text-indigo-600 transition-colors"><ChevronLeft size={16}/></button>
              </div>
              <button onClick={handleExportTreasury} className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-700 transition-all"><FileSpreadsheet size={16}/></button>
           </div>
        </div>
        <div className="overflow-x-auto">
           <table className="w-full text-right text-[11px] font-bold">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                 <tr>
                    <th className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('type')}>الحالة <ArrowUpDown size={10} className="inline"/></th>
                    <th className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('source')}>نوع العملية <ArrowUpDown size={10} className="inline"/></th>
                    <th className="px-8 py-5">كود العملية</th>
                    <th className="px-8 py-5">الموظف</th>
                    <th className="px-8 py-5 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('timestamp')}>التوقيت <ArrowUpDown size={10} className="inline"/></th>
                    <th className="px-8 py-5 text-left cursor-pointer hover:text-indigo-600" onClick={() => handleSort('amount')}>المبلغ <ArrowUpDown size={10} className="inline"/></th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-all">
                       <td className="px-8 py-4">
                          <span className={`px-3 py-1 rounded-lg text-[9px] font-black ${log.type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                             {log.type === 'in' ? 'دخل' : 'صرف'}
                          </span>
                       </td>
                       <td className="px-8 py-4 text-slate-700">{log.source}</td>
                       <td className="px-8 py-4 text-indigo-600 font-black text-[10px] cursor-pointer hover:text-indigo-800 hover:underline" onClick={() => copyToClipboard(log.referenceId, onShowToast)} title="نسخ الكود">الرقم المرجعي</td>
                       <td className="px-8 py-4 text-slate-500">{log.creator_username}</td>
                       <td className="px-8 py-4 text-center text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString('ar-EG')}</td>
                       <td className={`px-8 py-4 text-left text-sm font-black ${log.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {log.type === 'in' ? '+' : '-'}{log.amount.toLocaleString()} ج.م
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};

export default Treasury;
