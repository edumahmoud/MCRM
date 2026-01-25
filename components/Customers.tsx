
import React, { useState, useMemo } from 'react';
import { Search, Users, UserPlus, TrendingUp, Star, Receipt, UserCheck, Activity, X, ArrowUpDown, Calendar, Hash, ShoppingBag, UserCircle, ChevronLeft, ChevronRight, LayoutList, RotateCcw, ArrowRight } from 'lucide-react';
import { Invoice, ReturnRecord } from '../types';

interface CustomersProps {
  invoices: Invoice[];
  returns: ReturnRecord[];
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

const Customers: React.FC<CustomersProps> = ({ invoices, returns, onShowToast }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [transSortConfig, setTransSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });

  // معالجة بيانات العملاء مع منطق الزيارات المستقل
  const customerList = useMemo(() => {
    const map = new Map<string, { phone: string, name: string, totalSpending: number, lastVisit: string, invoiceCount: number, visitsCount: number, visitDates: Set<string> }>();
    
    invoices.filter(inv => !inv.isDeleted && inv.customerPhone).forEach(inv => {
      const phone = inv.customerPhone!;
      const current = map.get(phone) || { 
        phone, 
        name: inv.customerName || 'بدون اسم', 
        totalSpending: 0, 
        lastVisit: inv.date, 
        invoiceCount: 0, 
        visitsCount: 0,
        visitDates: new Set<string>() 
      };
      
      current.totalSpending += inv.netTotal;
      current.invoiceCount += 1;
      current.visitDates.add(inv.date); // إضافة التاريخ لمجموعة الأيام الفريدة (زيارات)
      current.visitsCount = current.visitDates.size;
      
      if (new Date(inv.timestamp) > new Date(current.lastVisit)) {
        current.lastVisit = inv.date;
      }
      map.set(phone, current);
    });

    return Array.from(map.values()).filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    ).sort((a,b) => b.totalSpending - a.totalSpending);
  }, [invoices, searchTerm]);

  const stats = useMemo(() => ({
    total: customerList.length,
    frequent: customerList.filter(c => c.invoiceCount >= 2).length,
    totalOps: invoices.filter(i => !i.isDeleted).length
  }), [customerList, invoices]);

  const selectedCustomer = useMemo(() => 
    customerList.find(c => c.phone === selectedCustomerPhone), 
    [customerList, selectedCustomerPhone]
  );

  const customerTransactions = useMemo(() => {
    if (!selectedCustomerPhone) return [];
    let list = invoices.filter(inv => !inv.isDeleted && inv.customerPhone === selectedCustomerPhone);
    
    list.sort((a: any, b: any) => {
      const valA = a[transSortConfig.key];
      const valB = b[transSortConfig.key];
      if (valA < valB) return transSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return transSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return list;
  }, [invoices, selectedCustomerPhone, transSortConfig]);

  // Calculate Returns Statistics
  const customerReturnsStats = useMemo(() => {
    if (!selectedCustomerPhone) return { count: 0, value: 0 };
    // Find all returns linked to invoices of this customer
    // First, identify all invoice IDs for this customer
    const customerInvoiceIds = new Set(invoices.filter(inv => inv.customerPhone === selectedCustomerPhone).map(i => i.id));
    
    const relevantReturns = returns.filter(r => customerInvoiceIds.has(r.invoiceId));
    
    return {
      count: relevantReturns.length,
      value: relevantReturns.reduce((acc, r) => acc + r.totalRefund, 0)
    };
  }, [returns, invoices, selectedCustomerPhone]);

  const toggleSort = (key: string) => {
    setTransSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      {/* الإحصائيات المحدثة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
           <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm"><Users size={28}/></div>
           <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي قاعدة العملاء</p><h3 className="text-2xl font-black text-slate-800">{stats.total} عميل</h3></div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
           <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl shadow-sm"><UserCheck size={28}/></div>
           <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">العملاء المميزين</p><h3 className="text-2xl font-black text-slate-800">{stats.frequent} عميل</h3></div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
           <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm"><Activity size={28}/></div>
           <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي عمليات البيع</p><h3 className="text-2xl font-black text-slate-800">{stats.totalOps} فاتورة</h3></div>
        </div>
      </div>

      {/* البحث */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="relative w-full">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="بحث باسم العميل أو رقم الموبايل..." className="w-full pr-14 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* جدول العملاء */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto"><table className="w-full text-right"><thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase border-b">
              <tr>
                <th className="px-8 py-5">العميل</th>
                <th className="px-8 py-5">رقم الهاتف</th>
                <th className="px-8 py-5 text-center">الزيارات</th>
                <th className="px-8 py-5 text-center">الفواتير</th>
                <th className="px-8 py-5 text-center">إجمالي المشتريات</th>
                <th className="px-8 py-5">آخر زيارة</th>
                <th className="px-8 py-5 text-left">الإجراء</th>
              </tr></thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              {customerList.map((c, i) => (
                <tr key={i} className="hover:bg-indigo-50/30 transition-all group">
                  <td className="px-8 py-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black">{c.name[0]}</div><span className="font-black text-slate-800 text-xs">{c.name}</span></div></td>
                  <td className="px-8 py-5 font-mono text-slate-500 text-xs">{c.phone}</td>
                  <td className="px-8 py-5 text-center"><span className="px-3 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-100">{c.visitsCount} زيارة</span></td>
                  <td className="px-8 py-5 text-center"><span className="px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100">{c.invoiceCount} فاتورة</span></td>
                  <td className="px-8 py-5 text-center font-black text-emerald-600">{c.totalSpending.toLocaleString()} ج.م</td>
                  <td className="px-8 py-5 text-slate-400 text-[10px] font-bold">{c.lastVisit}</td>
                  <td className="px-8 py-5 text-left">
                    <button 
                      onClick={() => setSelectedCustomerPhone(c.phone)}
                      className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                      <ChevronLeft size={16}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
      </div>

      {/* صفحة تفاصيل العميل (Full Page Overlay) */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-50 z-[2000] overflow-y-auto animate-in slide-in-from-bottom-10">
           <div className="max-w-7xl mx-auto p-8 space-y-8">
              {/* Header */}
              <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
                 <div className="flex items-center gap-6">
                    <button onClick={() => setSelectedCustomerPhone(null)} className="p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"><ArrowRight size={24}/></button>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-indigo-200">{selectedCustomer.name[0]}</div>
                        <div>
                           <h1 className="text-3xl font-black text-slate-800">{selectedCustomer.name}</h1>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2"><Hash size={12}/> {selectedCustomer.phone}</p>
                        </div>
                    </div>
                 </div>
                 <div className="px-6 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black text-xs uppercase tracking-widest border border-indigo-100">
                    ملف العميل الموحد
                 </div>
              </div>

              {/* Stats Grid including Returns */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-48">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center"><UserCheck size={24}/></div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase mb-2">عدد الزيارات</p>
                       <h3 className="text-3xl font-black text-slate-800">{selectedCustomer.visitsCount}</h3>
                    </div>
                 </div>
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-48">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Receipt size={24}/></div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase mb-2">إجمالي الفواتير</p>
                       <h3 className="text-3xl font-black text-slate-800">{selectedCustomer.invoiceCount}</h3>
                    </div>
                 </div>
                 <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 flex flex-col justify-between h-48 overflow-hidden relative">
                    <TrendingUp size={100} className="absolute -right-4 -bottom-4 text-white/10 rotate-12"/>
                    <div className="relative z-10 w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm"><ShoppingBag size={24}/></div>
                    <div className="relative z-10">
                       <p className="text-[10px] font-black text-indigo-200 uppercase mb-2">إجمالي المدفوعات</p>
                       <h3 className="text-3xl font-black">{selectedCustomer.totalSpending.toLocaleString()} ج.م</h3>
                    </div>
                 </div>
                 <div className="bg-white p-8 rounded-[2.5rem] border border-rose-100 shadow-sm flex flex-col justify-between h-48">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center"><RotateCcw size={24}/></div>
                    <div>
                       <p className="text-[10px] font-black text-rose-400 uppercase mb-2">المرتجعات ({customerReturnsStats.count})</p>
                       <h3 className="text-3xl font-black text-rose-600">{customerReturnsStats.value.toLocaleString()} ج.م</h3>
                    </div>
                 </div>
              </div>

              {/* Transactions Table */}
              <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                 <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
                    <h4 className="font-black text-lg text-slate-800 flex items-center gap-3"><LayoutList size={24} className="text-indigo-600"/> سجل المعاملات التاريخي</h4>
                    <span className="text-xs font-black text-slate-400 bg-white px-4 py-2 rounded-xl border">عدد العمليات: {customerTransactions.length}</span>
                 </div>
                 <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] border-b">
                       <tr>
                          <th onClick={() => toggleSort('timestamp')} className="px-8 py-6 cursor-pointer hover:text-indigo-600 transition-colors">التاريخ والوقت <ArrowUpDown size={12} className="inline ml-1"/></th>
                          <th onClick={() => toggleSort('id')} className="px-8 py-6 cursor-pointer hover:text-indigo-600 transition-colors">رقم الفاتورة <ArrowUpDown size={12} className="inline ml-1"/></th>
                          <th onClick={() => toggleSort('netTotal')} className="px-8 py-6 text-center cursor-pointer hover:text-indigo-600 transition-colors">قيمة الفاتورة <ArrowUpDown size={12} className="inline ml-1"/></th>
                          <th className="px-8 py-6">الموظف المسؤول</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                       {customerTransactions.map(inv => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="px-8 py-5 text-slate-400 font-mono">{inv.date} | {inv.time}</td>
                             <td className="px-8 py-5 text-indigo-600 font-mono text-sm">#{inv.id.slice(-6)}</td>
                             <td className="px-8 py-5 text-center text-emerald-600 text-sm">{inv.netTotal.toLocaleString()} ج.م</td>
                             <td className="px-8 py-5">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-500">{inv.creatorUsername?.[0] || 'U'}</div>
                                   <span className="text-[11px]">{inv.creatorUsername || 'غير معروف'}</span>
                                </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
