
import React, { useState, useMemo } from 'react';
import { 
  History, Search, ArrowUpCircle, ArrowDownCircle, Banknote, RefreshCw, 
  ShoppingBag, Receipt, RotateCcw, Clock, Calendar, ArrowUpDown, Tag, Percent, Filter, ShieldAlert, Eye, User, Fingerprint, X, FileSpreadsheet
} from 'lucide-react';
import { ActivityLog, Invoice, User as UserType, AuditLog } from '../types';
import * as XLSX from 'xlsx';
import { copyToClipboard } from './Layout';

interface DailyLogsProps {
  logs: ActivityLog[];
  invoices: Invoice[];
  auditLogs: AuditLog[];
  onRefresh: () => void;
  user: UserType;
}

const DailyLogs: React.FC<DailyLogsProps> = ({ logs, invoices, auditLogs, onRefresh, user }) => {
  const [activeTab, setActiveTab] = useState<'activity' | 'sales' | 'security'>('activity');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(''); // فلتر التاريخ الجديد
  const [selectedAudit, setSelectedAudit] = useState<AuditLog | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });

  const isAdmin = ['admin', 'it_support', 'general_manager'].includes(user.role);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const filteredLogs = useMemo(() => {
    let list = logs.filter(l => {
      const matchesSearch = (l.details.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             l.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             l.id.toLowerCase().includes(searchTerm.toLowerCase())); // تم إضافة البحث بكود العملية
      const matchesType = (typeFilter === 'all' || l.type === typeFilter);
      
      // منطق فلترة التاريخ: تحويل تاريخ السجل لتنسيق YYYY-MM-DD للمقارنة
      const logDateObj = new Date(l.timestamp);
      const logDateStr = logDateObj.toISOString().split('T')[0];
      const matchesDate = !dateFilter || logDateStr === dateFilter;

      return matchesSearch && matchesType && matchesDate;
    });

    if (sortConfig) {
      list.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [logs, searchTerm, sortConfig, typeFilter, dateFilter]);

  const filteredAudit = useMemo(() => {
    return auditLogs.filter(a => {
      const matchesSearch = a.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            a.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            a.actionType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            a.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            a.entityId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const logDateObj = new Date(a.timestamp);
      const logDateStr = logDateObj.toISOString().split('T')[0];
      const matchesDate = !dateFilter || logDateStr === dateFilter;

      return matchesSearch && matchesDate;
    });
  }, [auditLogs, searchTerm, dateFilter]);

  const filteredSales = useMemo(() => {
    let list = invoices.filter(i => {
      if (i.isDeleted) return false;
      const matchesSearch = i.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            i.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const logDateObj = new Date(i.timestamp);
      const logDateStr = logDateObj.toISOString().split('T')[0];
      const matchesDate = !dateFilter || logDateStr === dateFilter;

      return matchesSearch && matchesDate;
    });

    if (sortConfig) {
      list.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [invoices, searchTerm, sortConfig, dateFilter]);

  const typeConfig: Record<string, { icon: any, color: string, label: string }> = {
    'sale': { icon: <ShoppingBag size={14}/>, color: 'text-emerald-600 bg-emerald-50', label: 'مبيعات' },
    'expense': { icon: <Receipt size={14}/>, color: 'text-rose-600 bg-rose-50', label: 'مصروفات' },
    'return': { icon: <RotateCcw size={14}/>, color: 'text-orange-600 bg-orange-50', label: 'مرتجع' },
    'payment': { icon: <Banknote size={14}/>, color: 'text-indigo-600 bg-indigo-50', label: 'رواتب' },
    'purchase': { icon: <ArrowUpCircle size={14}/>, color: 'text-blue-600 bg-blue-50', label: 'توريد' }
  };

  const handleExportLogs = () => {
    const wb = XLSX.utils.book_new();

    if (activeTab === 'activity') {
      const data = filteredLogs.map(l => ({
        "كود العملية": l.id,
        "النوع": typeConfig[l.type]?.label || l.type,
        "تفاصيل العملية": l.details,
        "المسؤول": l.user,
        "التاريخ": l.date,
        "الوقت": l.time,
        "القيمة": l.amount
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "النشاط العام");
    } else if (activeTab === 'sales') {
      const data = filteredSales.map(inv => ({
        "رقم الفاتورة": inv.id.slice(0, 8),
        "الوقت": inv.time,
        "التاريخ": inv.date,
        "العميل": inv.customerName || 'نقدي',
        "الموظف": inv.creatorUsername,
        "الإجمالي": inv.totalBeforeDiscount,
        "الخصم": inv.discountValue,
        "الصافي": inv.netTotal
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "المبيعات");
    } else if (activeTab === 'security') {
      const data = filteredAudit.map(a => ({
        "كود السجل": a.id,
        "نوع الإجراء": a.actionType,
        "الموظف": a.username,
        "التفاصيل": a.details,
        "الكيان المتأثر": a.entityType,
        "التاريخ والوقت": new Date(a.timestamp).toLocaleString('ar-EG')
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "الرقابة الأمنية");
    }

    XLSX.writeFile(wb, `DailyLogs_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full xl:w-auto overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('activity')} className={`flex-1 min-w-[120px] py-3 px-6 rounded-xl text-[10px] font-black transition-all ${activeTab === 'activity' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-600'}`}>سجل النشاط العام</button>
          <button onClick={() => setActiveTab('sales')} className={`flex-1 min-w-[120px] py-3 px-6 rounded-xl text-[10px] font-black transition-all ${activeTab === 'sales' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-600'}`}>جدول المبيعات</button>
          {isAdmin && (
            <button onClick={() => setActiveTab('security')} className={`flex-1 min-w-[120px] py-3 px-6 rounded-xl text-[10px] font-black transition-all ${activeTab === 'security' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-rose-600'}`}>الرقابة الأمنية</button>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end">
           {/* فلتر التاريخ الجديد */}
           <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 shadow-inner group">
              <Calendar size={14} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input 
                type="date" 
                className="bg-transparent border-none outline-none font-black text-[10px] text-slate-600 cursor-pointer"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              {dateFilter && (
                <button onClick={() => setDateFilter('')} className="text-slate-300 hover:text-rose-500"><X size={12}/></button>
              )}
           </div>

           {activeTab === 'activity' && (
             <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 shadow-inner">
                <Filter size={14} className="text-slate-400" />
                <select 
                  className="bg-transparent border-none outline-none font-black text-[10px] text-slate-600 cursor-pointer"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">كل العمليات</option>
                  <option value="sale">المبيعات</option>
                  <option value="expense">المصروفات</option>
                  <option value="return">المرتجعات</option>
                  <option value="payment">الرواتب</option>
                  <option value="purchase">التوريدات</option>
                </select>
             </div>
           )}

           <div className="relative min-w-[200px] flex-1 xl:flex-none">
             <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
             <input type="text" placeholder="بحث بكود العملية، الموظف، التفاصيل..." className="w-full pr-10 pl-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold outline-none shadow-inner focus:ring-2 focus:ring-indigo-600/5 transition-all" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
           </div>
           <button onClick={handleExportLogs} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm" title="تنزيل سجل عمليات اليوم">
              <FileSpreadsheet size={18}/>
           </button>
           <button onClick={onRefresh} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><RefreshCw size={18}/></button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[450px]">
        <div className="overflow-x-auto">
           {activeTab === 'security' ? (
             <table className="w-full text-right text-[11px] font-bold">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                   <tr>
                      <th className="px-8 py-5">الإجراء</th>
                      <th className="px-8 py-5">الموظف</th>
                      <th className="px-8 py-5">البيان</th>
                      <th className="px-8 py-5 text-center">التوقيت</th>
                      <th className="px-8 py-5 text-left">التفاصيل</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {filteredAudit.map(a => (
                      <tr key={a.id} className="hover:bg-rose-50/20 transition-all group">
                         <td className="px-8 py-4">
                            <span className={`px-2 py-1 rounded-lg text-[8px] font-black border ${
                              a.actionType === 'DELETE' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                              a.actionType === 'UPDATE' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                              'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                               {a.actionType}
                            </span>
                         </td>
                         <td className="px-8 py-4 flex items-center gap-2">
                            <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-[9px] text-slate-500 shadow-inner"><User size={12}/></div>
                            <span>{a.username}</span>
                         </td>
                         <td className="px-8 py-4 text-slate-700 max-w-xs truncate">{a.details}</td>
                         <td className="px-8 py-4 text-center text-slate-400 font-mono text-[9px]">{new Date(a.timestamp).toLocaleString('ar-EG')}</td>
                         <td className="px-8 py-4 text-left">
                            <button onClick={() => setSelectedAudit(a)} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-800 hover:text-white transition-all"><Eye size={14}/></button>
                         </td>
                      </tr>
                   ))}
                   {filteredAudit.length === 0 && (
                     <tr><td colSpan={5} className="py-20 text-center text-slate-300 italic">لا توجد سجلات مطابقة للمعايير المختارة</td></tr>
                   )}
                </tbody>
             </table>
           ) : activeTab === 'activity' ? (
             <table className="w-full text-right text-[11px] font-bold">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                   <tr>
                      <th className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('type')}>النوع <ArrowUpDown size={10} className="inline ml-1"/></th>
                      <th className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('details')}>العملية <ArrowUpDown size={10} className="inline ml-1"/></th>
                      <th className="px-8 py-5">المسؤول</th>
                      <th className="px-8 py-5 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('timestamp')}>التوقيت <ArrowUpDown size={10} className="inline ml-1"/></th>
                      <th className="px-8 py-5 text-left cursor-pointer hover:text-indigo-600" onClick={() => handleSort('amount')}>المبلغ <ArrowUpDown size={10} className="inline ml-1"/></th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {filteredLogs.map(log => (
                      <tr key={`${log.type}-${log.id}`} className="hover:bg-slate-50/50 transition-all">
                         <td className="px-8 py-4"><div className={`flex items-center gap-2 px-3 py-1 rounded-lg w-fit ${typeConfig[log.type]?.color || 'bg-slate-50 text-slate-500'} shadow-sm border border-black/5 font-black uppercase text-[9px]`}>{typeConfig[log.type]?.label || log.type}</div></td>
                         <td className="px-8 py-4"><p className="text-slate-800 text-xs">{log.details}</p><span className="text-[8px] text-slate-300 font-bold font-mono cursor-pointer hover:text-indigo-600" onClick={() => copyToClipboard(log.id)}>#{log.id}</span></td>
                         <td className="px-8 py-4 text-slate-500 cursor-pointer hover:text-indigo-600 font-bold transition-colors" onClick={() => copyToClipboard(log.user)}>
                            {log.user}
                         </td>
                         <td className="px-8 py-4 text-center text-[10px] text-slate-400 font-mono">{log.time}</td>
                         <td className="px-8 py-4 text-left font-black text-slate-900">{(log.amount || 0).toLocaleString()} ج.م</td>
                      </tr>
                   ))}
                   {filteredLogs.length === 0 && (
                     <tr><td colSpan={5} className="py-20 text-center text-slate-300 italic">لا توجد عمليات مسجلة تطابق التصفية المختارة</td></tr>
                   )}
                </tbody>
             </table>
           ) : (
             <table className="w-full text-right text-[11px] font-bold">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                   <tr>
                      <th className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('id')}>رقم الفاتورة <ArrowUpDown size={10} className="inline ml-1"/></th>
                      <th className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('timestamp')}>التوقيت <ArrowUpDown size={10} className="inline ml-1"/></th>
                      <th className="px-8 py-5 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('totalBeforeDiscount')}>إجمالي المبلغ <ArrowUpDown size={10} className="inline ml-1"/></th>
                      <th className="px-8 py-5 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSort('discountValue')}>قيمة الخصم <ArrowUpDown size={10} className="inline ml-1"/></th>
                      <th className="px-8 py-5 text-center font-black">% الخصم</th>
                      <th className="px-8 py-5 text-left cursor-pointer hover:text-indigo-600" onClick={() => handleSort('netTotal')}>الصافي <ArrowUpDown size={10} className="inline ml-1"/></th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {filteredSales.map(inv => {
                      const discountPct = inv.totalBeforeDiscount > 0 ? (inv.discountValue / inv.totalBeforeDiscount) * 100 : 0;
                      return (
                        <tr key={inv.id} className="hover:bg-emerald-50/20 transition-all group">
                           <td className="px-8 py-4 font-black text-indigo-600">#{inv.id.slice(-6)}</td>
                           <td className="px-8 py-4 text-slate-400 font-mono">{inv.time}</td>
                           <td className="px-8 py-4 text-center text-slate-800">{(inv.totalBeforeDiscount || 0).toLocaleString()}</td>
                           <td className="px-8 py-4 text-center text-rose-500 font-bold">-{(inv.discountValue || 0).toLocaleString()}</td>
                           <td className="px-8 py-4 text-center"><span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black border border-rose-100">{discountPct.toFixed(1)}%</span></td>
                           <td className="px-8 py-4 text-left font-black text-emerald-600 text-sm group-hover:scale-105 transition-transform">{(inv.netTotal || 0).toLocaleString()} ج.م</td>
                        </tr>
                      );
                   })}
                   {filteredSales.length === 0 && (
                     <tr><td colSpan={6} className="py-20 text-center text-slate-300 italic">لا توجد مبيعات نشطة في هذا النطاق</td></tr>
                   )}
                </tbody>
             </table>
           )}
        </div>
      </div>

      {selectedAudit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in flex flex-col">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <Fingerprint className="text-rose-400" size={24}/>
                    <div><h3 className="font-black text-sm">البصمة الرقمية للعملية</h3><p className="text-[9px] opacity-60">AUDIT_REF: {selectedAudit.id}</p></div>
                 </div>
                 <button onClick={() => setSelectedAudit(null)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">الموظف المسؤول</p><p className="text-sm font-black text-slate-800">{selectedAudit.username}</p></div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">نوع الكيان</p><p className="text-sm font-black text-slate-800">{selectedAudit.entityType}</p></div>
                 </div>
                 <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl text-sm font-bold text-indigo-900 leading-relaxed italic">"{selectedAudit.details}"</div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase">البيانات السابقة</p>
                       <div className="bg-slate-900 p-4 rounded-xl text-[10px] font-mono text-emerald-400 overflow-x-auto">
                          {selectedAudit.oldData ? JSON.stringify(selectedAudit.oldData, null, 2) : 'لا توجد بيانات سابقة'}
                       </div>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase">البيانات الجديدة</p>
                       <div className="bg-slate-900 p-4 rounded-xl text-[10px] font-mono text-indigo-400 overflow-x-auto">
                          {selectedAudit.newData ? JSON.stringify(selectedAudit.newData, null, 2) : 'لا توجد بيانات جديدة'}
                       </div>
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border-t flex justify-end">
                 <button onClick={() => setSelectedAudit(null)} className="px-8 py-3 bg-white border border-slate-200 text-slate-500 font-black rounded-xl text-xs">إغلاق التقرير</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DailyLogs;
