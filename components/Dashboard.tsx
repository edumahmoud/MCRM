
import React, { useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Package, Gem, RotateCcw, Landmark, AlertTriangle, ShoppingCart, Users, Award, ZapOff, ChevronUp, ChevronDown, Wallet, AreaChart as ChartIcon, Coins, ArrowUpRight, ArrowDownRight, BarChart3
} from 'lucide-react';
import { Invoice, ReturnRecord, Expense, Product, SupplierPayment, User as UserType, StaffPayment, PurchaseRecord, Supplier } from '../types';
import { SummaryStats } from '../hooks/useSalesData';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';

interface DashboardProps {
  invoices: Invoice[];
  returns: ReturnRecord[];
  expenses: Expense[];
  products: Product[];
  staffPayments: StaffPayment[]; 
  user: UserType;
  summaryStats: SummaryStats | null;
  purchases?: PurchaseRecord[];
  payments?: SupplierPayment[];
  suppliers?: Supplier[];
  onProductClick?: (product: Product) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ invoices, returns, expenses, products, staffPayments, user, summaryStats }) => {
  const isAdmin = ['admin', 'it_support', 'general_manager'].includes(user.role);

  const filteredData = useMemo(() => {
    // تصفية البيانات حسب الصلاحية والفرع (Strict Isolation)
    const filteredInvoices = invoices.filter(i => !i.isDeleted && (isAdmin ? true : i.branchId === user.branchId));
    const filteredExpenses = expenses.filter(e => (isAdmin ? true : e.branchId === user.branchId));
    const filteredReturns = returns.filter(r => !r.isDeleted && (isAdmin ? true : r.branchId === user.branchId));
    const branchProducts = products.filter(p => !p.isDeleted && (isAdmin ? true : p.branchId === user.branchId));
    
    return { filteredInvoices, filteredExpenses, filteredReturns, branchProducts };
  }, [invoices, expenses, returns, products, user.branchId, isAdmin]);

  const displayStats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('ar-EG');
    
    const todayInvoices = filteredData.filteredInvoices.filter(i => i.date === todayStr);
    const todayExpenses = filteredData.filteredExpenses.filter(e => e.date === todayStr);
    const todayReturns = filteredData.filteredReturns.filter(r => r.date === todayStr);
    
    const todayIncome = todayInvoices.reduce((a, b) => a + b.netTotal, 0);
    const todayOutgoings = todayExpenses.reduce((a, b) => a + b.amount, 0) + todayReturns.reduce((a, b) => a + b.totalRefund, 0);
    const todayNetCashflow = todayIncome - todayOutgoings;

    const inventoryValue = filteredData.branchProducts.reduce((a, b) => a + (b.stock * b.wholesalePrice), 0);

    const filteredStaffPayments = (staffPayments || []).filter(p => {
       if (isAdmin) return true;
       return true; 
    });

    return {
      revenue: filteredData.filteredInvoices.reduce((a, b) => a + b.netTotal, 0),
      expenses: filteredData.filteredExpenses.reduce((a, b) => a + b.amount, 0),
      returnsValue: filteredData.filteredReturns.reduce((a, b) => a + b.totalRefund, 0),
      salaries: filteredStaffPayments.filter(p => p.paymentType !== 'خصم').reduce((a, b) => a + b.amount, 0),
      discounts: filteredStaffPayments.filter(p => p.paymentType === 'خصم').reduce((a, b) => a + b.amount, 0),
      inventoryValue,
      todayNetCashflow,
      lowStockCount: filteredData.branchProducts.filter(p => p.stock <= p.lowStockThreshold).length
    };
  }, [filteredData, staffPayments, isAdmin]);

  const productPerformance = useMemo(() => {
    const stats: Record<string, { name: string; count: number; revenue: number }> = {};
    
    // Analyze all filtered invoices (Year/Total scope based on component data)
    filteredData.filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!stats[item.productId]) {
          stats[item.productId] = { name: item.name, count: 0, revenue: 0 };
        }
        stats[item.productId].count += item.quantity;
        stats[item.productId].revenue += item.subtotal;
      });
    });

    const sorted = Object.values(stats).sort((a, b) => b.count - a.count);
    return {
      bestSelling: sorted.slice(0, 5),
      leastSelling: sorted.filter(i => i.count > 0).slice(-5).reverse() // Show items that sold at least once but poorly
    };
  }, [filteredData.filteredInvoices]);

  const netProfit = displayStats.revenue - (displayStats.revenue * 0.7) - displayStats.expenses - displayStats.salaries - displayStats.returnsValue;

  const salesChartData = useMemo(() => {
    const days: Record<string, number> = {};
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('ar-EG');
    }).reverse();

    last7Days.forEach(d => days[d] = 0);
    filteredData.filteredInvoices.forEach(inv => {
      if (days[inv.date] !== undefined) days[inv.date] += inv.netTotal;
    });

    return last7Days.map(d => ({ name: d.split('/')[0] + '/' + d.split('/')[1], sales: days[d] }));
  }, [filteredData.filteredInvoices]);

  return (
    <div className="space-y-8 animate-in font-['Cairo'] select-text pb-10" dir="rtl">
      {/* 1. Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-indigo-600 p-5 rounded-[2rem] shadow-xl shadow-indigo-100 text-white relative overflow-hidden">
          <Coins size={80} className="absolute -bottom-4 -left-4 opacity-10 rotate-12" />
          <div className="p-2 bg-white/20 rounded-xl w-fit mb-3"><ShoppingCart size={20} /></div>
          <p className="text-indigo-100 text-[9px] font-black uppercase mb-1">صافي دخل اليوم ({isAdmin ? 'الشركة' : ''})</p>
          <h3 className="text-xl font-black">{displayStats.todayNetCashflow.toLocaleString()} ج.م</h3>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl w-fit mb-3"><RotateCcw size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">المرتجعات ({isAdmin ? 'الشركة' : ''})</p>
          <h3 className="text-lg font-black text-rose-600">{displayStats.returnsValue.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl w-fit mb-3"><TrendingDown size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">المصاريف ({isAdmin ? 'الشركة' : ''})</p>
          <h3 className="text-lg font-black text-slate-800">{displayStats.expenses.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl w-fit mb-3"><Users size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">إجمالي الرواتب ({isAdmin ? 'الشركة' : ''})</p>
          <h3 className="text-lg font-black text-slate-800">{displayStats.salaries.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl w-fit mb-3"><Package size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">إجمالي المبيعات ({isAdmin ? 'الشركة' : ''})</p>
          <h3 className="text-lg font-black text-slate-800">{displayStats.revenue.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-xl w-fit mb-3"><AlertTriangle size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">النواقص</p>
          <h3 className="text-lg font-black text-rose-600">{displayStats.lowStockCount}</h3>
        </div>
      </div>

      {/* 2. Admin Profit & Chart Section */}
      {isAdmin && (
        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/5">
           <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent"></div>
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
              <div>
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><Gem size={14}/> صافي الربح التقديري (الشركة)</p>
                 <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                    {netProfit.toLocaleString()} <span className="text-xl font-bold text-white/30">ج.م</span>
                 </h2>
                 <p className="text-[11px] text-white/40 font-bold mt-4 border-r-2 border-indigo-500 pr-3 uppercase">قيمة الأصول المخزنية الإجمالية: {displayStats.inventoryValue.toLocaleString()} ج.م</p>
              </div>
              <div className="w-full md:w-64 h-24">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesChartData}>
                       <defs>
                          <linearGradient id="colorSalesChart" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                             <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <Area type="monotone" dataKey="sales" stroke="#6366f1" fill="url(#colorSalesChart)" strokeWidth={3} />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>
      )}

      {/* 3. Product Analytics (Best/Least Selling) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Selling */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
           <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                 <Award size={18} className="text-emerald-500"/> الأصناف الأكثر مبيعاً
              </h4>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">الأعلى طلباً</span>
           </div>
           <div className="flex-1 space-y-3">
              {productPerformance.bestSelling.map((item, idx) => (
                 <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50/30 rounded-2xl border border-emerald-50 hover:bg-emerald-50 transition-colors">
                    <div className="flex items-center gap-3">
                       <span className="w-6 h-6 flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-black">{idx + 1}</span>
                       <p className="text-xs font-black text-slate-700">{item.name}</p>
                    </div>
                    <div className="text-left">
                       <p className="text-xs font-black text-emerald-600">{item.count} <span className="text-[9px]">قطعة</span></p>
                       <p className="text-[8px] font-bold text-slate-400">{item.revenue.toLocaleString()} ج.م</p>
                    </div>
                 </div>
              ))}
              {productPerformance.bestSelling.length === 0 && <p className="text-center text-[10px] text-slate-300 py-10">لا توجد بيانات كافية</p>}
           </div>
        </div>

        {/* Least Selling */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
           <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                 <ZapOff size={18} className="text-rose-500"/> الأصناف الأقل مبيعاً
              </h4>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">تحتاج ترويج</span>
           </div>
           <div className="flex-1 space-y-3">
              {productPerformance.leastSelling.map((item, idx) => (
                 <div key={idx} className="flex items-center justify-between p-3 bg-rose-50/30 rounded-2xl border border-rose-50 hover:bg-rose-50 transition-colors">
                    <div className="flex items-center gap-3">
                       <span className="w-6 h-6 flex items-center justify-center bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black"><ArrowDownRight size={12}/></span>
                       <p className="text-xs font-black text-slate-700">{item.name}</p>
                    </div>
                    <div className="text-left">
                       <p className="text-xs font-black text-rose-600">{item.count} <span className="text-[9px]">قطعة</span></p>
                       <p className="text-[8px] font-bold text-slate-400">{item.revenue.toLocaleString()} ج.م</p>
                    </div>
                 </div>
              ))}
              {productPerformance.leastSelling.length === 0 && <p className="text-center text-[10px] text-slate-300 py-10">لا توجد بيانات كافية</p>}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
