
import React, { useState, useMemo } from 'react';
import { Trash2, History, Search, Coins, ShoppingCart, DollarSign, Eye, X, Info, Calendar, Hash, User, ShieldAlert, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { ArchiveRecord, User as UserType } from '../types';

interface RecycleBinProps {
  archiveRecords: ArchiveRecord[];
  onShowToast?: (message: string, type: 'success' | 'error') => void;
  user: UserType;
}

const RecycleBin: React.FC<RecycleBinProps> = ({ archiveRecords, onShowToast, user }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<ArchiveRecord | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });

  const filtered = useMemo(() => {
    let list = archiveRecords.filter(r => 
      r.itemId.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.deleterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.itemType.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig !== null) {
      list.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [archiveRecords, searchTerm, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const typeLabels: Record<string, { label: string, color: string }> = {
    'product': { label: 'صنف مخزني', color: 'bg-indigo-100 text-indigo-600' },
    'invoice': { label: 'فاتورة مبيعات', color: 'bg-emerald-100 text-emerald-600' },
    'return': { label: 'سند مرتجع', color: 'bg-orange-100 text-orange-600' },
    'purchase': { label: 'سند توريد', color: 'bg-blue-100 text-blue-600' }
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      {/* Header Info */}
      <div className="bg-rose-900 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
         <ShieldAlert size={220} className="absolute -bottom-20 -left-20 text-white/5 rotate-12 transition-transform group-hover:scale-110" />
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div>
               <h3 className="text-3xl font-black text-white">الأرشيف الرقابي الموحد</h3>
               <p className="text-rose-200/60 font-bold text-xs mt-2 uppercase tracking-widest leading-loose">سجل مركزي غير قابل للتلاعب يوثق كافة عمليات الحذف والإلغاء في النظام.</p>
            </div>
            <div className="px-8 py-4 bg-white/10 backdrop-blur-md rounded-3xl border border-white/10 text-center">
               <p className="text-[10px] font-black text-rose-200 uppercase mb-1">إجمالي المحذوفات</p>
               <p className="text-3xl font-black text-white">{archiveRecords.length}</p>
            </div>
         </div>
      </div>

      {/* Search Controls */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="بحث في سجل الحذف (بالرقم، الموظف، أو النوع)..." 
            className="w-full pr-14 pl-4 py-3 bg-slate-50 border-none rounded-2xl outline-none font-bold text-sm focus:ring-4 focus:ring-rose-500/5 transition-all" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Archive Grid */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px]">
            <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[8px] border-b">
              <tr>
                <th className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('itemType')}>نوع السجل <ArrowUpDown size={10} className="inline ml-1" /></th>
                <th className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('itemId')}>المعرف <ArrowUpDown size={10} className="inline ml-1" /></th>
                <th className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('deleterName')}>بواسطة <ArrowUpDown size={10} className="inline ml-1" /></th>
                <th className="px-8 py-5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('timestamp')}>توقيت الحذف <ArrowUpDown size={10} className="inline ml-1" /></th>
                <th className="px-8 py-5">سبب الحذف</th>
                <th className="px-8 py-5 text-left">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
              {filtered.map(record => (
                <tr key={record.id} className="hover:bg-rose-50/20 transition-all group">
                  <td className="px-8 py-4">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black ${typeLabels[record.itemType]?.color || 'bg-slate-100 text-slate-600'}`}>
                      {typeLabels[record.itemType]?.label || record.itemType}
                    </span>
                  </td>
                  <td className="px-8 py-4 font-black text-indigo-600">#{record.itemId}</td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[9px] font-black">{record.deleterName[0]}</div>
                       <span>{record.deleterName}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-slate-400 text-[10px]">{new Date(record.timestamp).toLocaleString('ar-EG')}</td>
                  <td className="px-8 py-4 max-w-[200px] truncate italic text-rose-600 opacity-80">"{record.reason}"</td>
                  <td className="px-8 py-4 text-left">
                    <button onClick={() => setSelectedRecord(record)} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-800 hover:text-white transition-all shadow-sm">
                      <Eye size={14}/>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-32 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <History size={64}/>
                      <p className="text-xs font-black uppercase tracking-widest">لا يوجد سجلات حذف تطابق البحث</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1500] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-white/10 rounded-xl"><AlertTriangle size={20} className="text-rose-400"/></div>
                    <div>
                      <h3 className="font-black text-sm">تفاصيل السجل الملغى</h3>
                      <p className="text-[10px] font-bold opacity-60 uppercase">{selectedRecord.itemId}</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={24}/></button>
              </div>
              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">الموظف المسؤول</p>
                       <p className="text-sm font-black text-slate-800">{selectedRecord.deleterName}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">توقيت الحذف</p>
                       <p className="text-sm font-black text-slate-800">{new Date(selectedRecord.timestamp).toLocaleTimeString('ar-EG')}</p>
                    </div>
                 </div>
                 <div className="p-6 bg-rose-50 border border-rose-100 rounded-2xl relative overflow-hidden">
                    <History size={60} className="absolute -bottom-4 -left-4 text-rose-200/30 -rotate-12" />
                    <p className="text-[10px] font-black text-rose-600 uppercase mb-2">سبب الحذف الرسمي</p>
                    <p className="text-sm font-black text-rose-900 leading-relaxed italic">"{selectedRecord.reason}"</p>
                 </div>
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Info size={12}/> البيانات المستخرجة (JSON)</p>
                    <div className="bg-slate-900 p-6 rounded-3xl overflow-x-auto">
                       <pre className="text-[10px] font-mono text-emerald-400 leading-relaxed">
                          {JSON.stringify(selectedRecord.originalData, null, 2)}
                       </pre>
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border-t flex justify-end">
                 <button onClick={() => setSelectedRecord(null)} className="px-10 py-3 bg-white border border-slate-200 text-slate-500 font-black rounded-xl text-xs hover:bg-slate-100 transition-all">إغلاق النافذة</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RecycleBin;
