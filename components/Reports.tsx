
import React, { useState, useMemo } from 'react';
import { 
  ChevronRight, ChevronLeft, TrendingUp, FileSpreadsheet, Wallet, BarChart as BarChartIcon, 
  RotateCcw, Receipt, ShoppingCart, Truck, CreditCard, Gem, DownloadCloud, Award, 
  ZapOff, ChevronUp, ChevronDown, Package, Users, UserCheck, Building2, Filter, AlertTriangle, FileText, ArrowUp, ArrowDown, PieChart
} from 'lucide-react';
import { Invoice, ReturnRecord, Expense, PurchaseRecord, SupplierPayment, User as UserType, Branch } from '../types';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend } from 'recharts';
import * as XLSX from 'xlsx';

interface ReportsProps {
  invoices: Invoice[];
  returns: ReturnRecord[];
  expenses: Expense[];
  purchases: PurchaseRecord[];
  supplierPayments: SupplierPayment[];
  branches?: Branch[];
  user: UserType;
}

const Reports: React.FC<ReportsProps> = ({ invoices, returns, expenses, purchases, supplierPayments, branches = [], user }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const isHQAdmin = useMemo(() => ['admin', 'it_support', 'general_manager'].includes(user.role), [user.role]);
  const [branchFilter, setBranchFilter] = useState(isHQAdmin ? '' : (user.branchId || 'main_branch'));

  const formattedSelectedDate = selectedDate.toLocaleDateString('ar-EG');
  
  const dateDisplayLabel = useMemo(() => {
    if (activeTab === 'daily') return formattedSelectedDate;
    if (activeTab === 'monthly') return selectedDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    return selectedDate.toLocaleDateString('ar-EG', { year: 'numeric' });
  }, [activeTab, selectedDate, formattedSelectedDate]);

  const changePeriod = (delta: number) => {
    const newDate = new Date(selectedDate);
    if (activeTab === 'daily') newDate.setDate(selectedDate.getDate() + delta);
    else if (activeTab === 'monthly') newDate.setMonth(selectedDate.getMonth() + delta);
    else newDate.setFullYear(selectedDate.getFullYear() + delta);
    setSelectedDate(newDate);
  };

  const filteredData = useMemo(() => {
    const timeAndBranchFilter = (data: any[]) => {
      return data.filter(item => {
        const d = new Date(item.timestamp);
        const matchesTime = activeTab === 'daily' ? item.date === formattedSelectedDate :
                          activeTab === 'monthly' ? (d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()) :
                          (d.getFullYear() === selectedDate.getFullYear());
        
        // العزل الصارم حسب الفرع في التقارير
        let matchesBranch = true;
        if (!isHQAdmin) {
          matchesBranch = item.branchId === user.branchId;
        } else if (branchFilter) {
          if (branchFilter === 'hq_unified') matchesBranch = !item.branchId;
          else matchesBranch = item.branchId === branchFilter;
        }
        
        return matchesTime && matchesBranch;
      });
    };

    return {
      invoices: timeAndBranchFilter(invoices.filter(i=>!i.isDeleted)),
      returns: timeAndBranchFilter(returns.filter(r=>!r.isDeleted)),
      expenses: timeAndBranchFilter(expenses),
      purchases: timeAndBranchFilter(purchases.filter(p=>!p.isDeleted))
    };
  }, [invoices, returns, expenses, purchases, activeTab, formattedSelectedDate, selectedDate, branchFilter, isHQAdmin, user.branchId]);

  const stats = useMemo(() => {
    const invs = filteredData.invoices; 
    const rets = filteredData.returns; 
    const exps = filteredData.expenses;

    const totalSales = invs.reduce((a, b) => a + b.netTotal, 0);
    const totalReturns = rets.reduce((a, b) => a + b.totalRefund, 0);
    const totalExpenses = exps.reduce((a, b) => a + b.amount, 0);
    const netRevenue = totalSales - totalReturns;
    
    return { 
      totalSales, totalReturns, netRevenue, totalExpenses, invCount: invs.length
    };
  }, [filteredData]);

  const productAnalytics = useMemo(() => {
    const itemStats: Record<string, { name: string, qty: number, revenue: number }> = {};
    
    filteredData.invoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!itemStats[item.productId]) {
          itemStats[item.productId] = { name: item.name, qty: 0, revenue: 0 };
        }
        itemStats[item.productId].qty += item.quantity;
        itemStats[item.productId].revenue += item.subtotal;
      });
    });

    const sortedItems = Object.values(itemStats).sort((a, b) => b.qty - a.qty);
    const bestSelling = sortedItems.slice(0, 5);
    const leastSelling = sortedItems.filter(i => i.qty > 0).slice(-5).reverse();

    return { bestSelling, leastSelling };
  }, [filteredData.invoices]);

  const chartData = useMemo(() => {
    if (activeTab === 'daily') return []; // Daily charts are flat
    const dataMap: Record<string, { name: string, sales: number, expenses: number }> = {};
    
    // Aggregate for charts (Month view -> Days, Year view -> Months)
    // Simplified logic for visualization
    filteredData.invoices.forEach(i => {
       const key = activeTab === 'monthly' ? new Date(i.timestamp).getDate().toString() : new Date(i.timestamp).getMonth().toString();
       if(!dataMap[key]) dataMap[key] = { name: key, sales: 0, expenses: 0 };
       dataMap[key].sales += i.netTotal;
    });
    
    filteredData.expenses.forEach(e => {
       const key = activeTab === 'monthly' ? new Date(e.timestamp).getDate().toString() : new Date(e.timestamp).getMonth().toString();
       if(!dataMap[key]) dataMap[key] = { name: key, sales: 0, expenses: 0 };
       dataMap[key].expenses += e.amount;
    });

    return Object.values(dataMap).sort((a,b) => Number(a.name) - Number(b.name));
  }, [filteredData, activeTab]);

  const currentBranchName = useMemo(() => {
    if (branchFilter === 'hq_unified') return 'المركز الرئيسي';
    if (branchFilter) return branches.find(b => b.id === branchFilter)?.name || 'فرع مخصص';
    return isHQAdmin ? 'كافة الفروع (الشركة)' : (branches.find(b => b.id === user.branchId)?.name || 'فرعك الحالي');
  }, [branchFilter, branches, user.branchId, isHQAdmin]);

  const handleExportReport = () => {
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summaryData = [
      { "البيان": "الفترة", "القيمة": dateDisplayLabel },
      { "البيان": "نطاق الفرع", "القيمة": currentBranchName },
      { "البيان": "إجمالي المبيعات", "القيمة": stats.totalSales },
      { "البيان": "إجمالي المرتجعات", "القيمة": stats.totalReturns },
      { "البيان": "صافي الإيراد", "القيمة": stats.netRevenue },
      { "البيان": "إجمالي المصروفات", "القيمة": stats.totalExpenses },
      { "البيان": "عدد الفواتير", "القيمة": stats.invCount }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "الملخص المالي");

    // 2. Sales Sheet
    const salesData = filteredData.invoices.map(inv => ({
      "رقم الفاتورة": inv.id.slice(0, 8),
      "التاريخ": inv.date,
      "الوقت": inv.time,
      "العميل": inv.customerName || 'نقدي',
      "الموظف": inv.creatorUsername,
      "الفرع": branches.find(b => b.id === inv.branchId)?.name || 'غير محدد',
      "الإجمالي قبل الخصم": inv.totalBeforeDiscount,
      "الخصم": inv.discountValue,
      "الصافي": inv.netTotal,
      "طريقة الدفع": "نقدي", 
      "ملاحظات": inv.notes || ''
    }));
    const wsSales = XLSX.utils.json_to_sheet(salesData);
    XLSX.utils.book_append_sheet(wb, wsSales, "سجل المبيعات");

    // 3. Returns Sheet
    const returnsData = filteredData.returns.map(ret => ({
      "رقم المرتجع": ret.id.slice(0, 8),
      "مرجع الفاتورة": ret.invoiceId.slice(0, 8),
      "التاريخ": ret.date,
      "الوقت": ret.time,
      "قيمة الاسترداد": ret.totalRefund,
      "الفرع": branches.find(b => b.id === ret.branchId)?.name || 'غير محدد',
      "الموظف": ret.createdBy // Ideal to map to username if available
    }));
    const wsReturns = XLSX.utils.json_to_sheet(returnsData);
    XLSX.utils.book_append_sheet(wb, wsReturns, "سجل المرتجعات");

    // 4. Expenses Sheet
    const expensesData = filteredData.expenses.map(exp => ({
      "الوصف": exp.description,
      "المبلغ": exp.amount,
      "الفئة": exp.category,
      "التاريخ": exp.date,
      "ملاحظات": exp.notes || ''
    }));
    const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(wb, wsExpenses, "سجل المصروفات");

    XLSX.writeFile(wb, `Report_${activeTab}_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      
      {/* 1. Header & Controls */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-6">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl flex-1 overflow-x-auto shrink-0">
            {['daily', 'monthly', 'yearly'].map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab as any); setSelectedDate(new Date()); }} className={`flex-1 min-w-[100px] py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-600'}`}>
                {tab === 'daily' ? 'يومي' : tab === 'monthly' ? 'شهري' : 'سنوي'}
              </button>
            ))}
          </div>

          {isHQAdmin ? (
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100 min-w-[240px]">
               <Building2 size={16} className="text-indigo-600 mr-2"/>
               <select className="bg-transparent border-none outline-none font-black text-[11px] w-full cursor-pointer" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                 <option value="">كافة الفروع (الشركة)</option>
                 <option value="hq_unified">مخزن الإدارة</option>
                 {branches.filter(b=>!b.isDeleted).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
               </select>
            </div>
          ) : (
             <div className="px-6 py-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3 font-black text-[10px] text-indigo-700">
                <Building2 size={14}/> فرع العرض: {currentBranchName}
             </div>
          )}

          <div className="flex items-center justify-between gap-4 bg-indigo-600 px-6 py-2.5 rounded-xl text-white shadow-lg flex-1">
             <button onClick={() => changePeriod(-1)} className="p-1 hover:bg-white/10 rounded-lg transition-all"><ChevronRight size={22}/></button>
             <span className="text-[12px] font-black text-center min-w-[120px]">{dateDisplayLabel}</span>
             <button onClick={() => changePeriod(1)} className="p-1 hover:bg-white/10 rounded-lg transition-all"><ChevronLeft size={22}/></button>
          </div>

          <button 
            onClick={handleExportReport} 
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] shadow-lg hover:bg-emerald-700 flex items-center gap-2 transition-all shrink-0"
          >
            <FileSpreadsheet size={16} /> تصدير تقرير شامل (Excel)
          </button>
        </div>
      </div>

      {/* 2. Main Financials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-indigo-600 transition-all">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit mb-4"><ShoppingCart size={22} /></div>
          <p className="text-slate-400 text-[10px] font-black uppercase mb-1">صافي المبيعات</p>
          <h3 className="text-2xl font-black text-slate-800">{stats.netRevenue.toLocaleString()} ج.م</h3>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-emerald-600 transition-all">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit mb-4"><Wallet size={22} /></div>
          <p className="text-slate-400 text-[10px] font-black uppercase mb-1">إجمالي المصروفات</p>
          <h3 className="text-2xl font-black text-slate-800">{stats.totalExpenses.toLocaleString()} ج.م</h3>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-rose-600 transition-all">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl w-fit mb-4"><RotateCcw size={22} /></div>
          <p className="text-slate-400 text-[10px] font-black uppercase mb-1">إجمالي المرتجعات</p>
          <h3 className="text-2xl font-black text-rose-600">{stats.totalReturns.toLocaleString()} ج.م</h3>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-amber-600 transition-all">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl w-fit mb-4"><Receipt size={22} /></div>
          <p className="text-slate-400 text-[10px] font-black uppercase mb-1">عدد العمليات</p>
          <h3 className="text-2xl font-black text-slate-800">{stats.invCount} فاتورة</h3>
        </div>
      </div>

      {/* 3. Detailed Product Analysis (Best/Least Selling) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600"><TrendingUp size={20}/></div>
               <div>
                  <h4 className="font-black text-sm text-slate-800">الأصناف الأكثر مبيعاً</h4>
                  <p className="text-[10px] text-slate-400">تحليل أفضل 5 منتجات للفترة المحددة</p>
               </div>
            </div>
            <div className="flex-1 space-y-4">
               {productAnalytics.bestSelling.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-4">
                        <span className="w-8 h-8 flex items-center justify-center bg-emerald-500 text-white rounded-lg font-black text-xs shadow-md">{idx + 1}</span>
                        <div>
                           <p className="text-xs font-black text-slate-700">{item.name}</p>
                           <p className="text-[9px] font-bold text-slate-400">{item.revenue.toLocaleString()} ج.م</p>
                        </div>
                     </div>
                     <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">{item.qty} قطعة</span>
                  </div>
               ))}
               {productAnalytics.bestSelling.length === 0 && <div className="text-center py-10 text-slate-300 text-xs font-bold">لا توجد بيانات بيع كافية لهذه الفترة</div>}
            </div>
         </div>

         <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-rose-100 rounded-xl text-rose-600"><AlertTriangle size={20}/></div>
               <div>
                  <h4 className="font-black text-sm text-slate-800">الأصناف الأقل مبيعاً</h4>
                  <p className="text-[10px] text-slate-400">منتجات راكدة أو بطيئة الحركة</p>
               </div>
            </div>
            <div className="flex-1 space-y-4">
               {productAnalytics.leastSelling.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-4">
                        <span className="w-8 h-8 flex items-center justify-center bg-rose-100 text-rose-600 rounded-lg font-black text-xs"><ArrowDown size={14}/></span>
                        <div>
                           <p className="text-xs font-black text-slate-700">{item.name}</p>
                           <p className="text-[9px] font-bold text-slate-400">{item.revenue.toLocaleString()} ج.م</p>
                        </div>
                     </div>
                     <span className="text-xs font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-lg">{item.qty} قطعة</span>
                  </div>
               ))}
               {productAnalytics.leastSelling.length === 0 && <div className="text-center py-10 text-slate-300 text-xs font-bold">البيانات ممتازة، لا توجد أصناف راكدة</div>}
            </div>
         </div>
      </div>

      {/* 4. Chart Visualization (If not Daily) */}
      {activeTab !== 'daily' && (
         <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
               <h4 className="font-black text-sm text-slate-800 flex items-center gap-2"><BarChartIcon size={18} className="text-indigo-600"/> التحليل المالي البياني</h4>
               <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">مقارنة المبيعات والمصاريف</span>
            </div>
            <div className="h-80 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                     <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/><stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e11d48" stopOpacity={0.1}/><stop offset="95%" stopColor="#e11d48" stopOpacity={0}/></linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                     <YAxis hide />
                     <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: 'Cairo'}} />
                     <Legend verticalAlign="top" height={36} iconType="circle" />
                     <Area type="monotone" dataKey="sales" name="المبيعات" stroke="#4f46e5" fillOpacity={1} fill="url(#colorSales)" strokeWidth={3} />
                     <Area type="monotone" dataKey="expenses" name="المصاريف" stroke="#e11d48" fillOpacity={1} fill="url(#colorExp)" strokeWidth={3} />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>
      )}
    </div>
  );
};

export default Reports;
