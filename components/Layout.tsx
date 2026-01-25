
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Package, RotateCcw, Wallet, 
  BarChart3, Archive, Bell, ShieldCheck, AlertCircle, Mail,
  Trash2, Menu, LogOut, UserCog, Landmark, Terminal, Truck, Clock, X, UserCircle, History, Users, ChevronLeft, BellRing, Inbox, ClipboardCheck, Building2, Printer
} from 'lucide-react';
import { ViewType, Product, User as UserType, SystemSettings, LeaveRequest, Correspondence } from '../types';

// @ts-ignore
declare var JsBarcode: any;

export const copyToClipboard = (text: string, onShowToast?: (message: string, type: 'success' | 'error') => void) => {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    onShowToast?.(`تم نسخ الكود: ${text}`, "success");
  }).catch(() => {
    onShowToast?.("فشل في نسخ الكود", "error");
  });
};

interface LayoutProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  products: Product[];
  leaveRequests?: LeaveRequest[];
  messages?: Correspondence[];
  onReset: () => void;
  onRestore: (data: any) => void;
  children: React.ReactNode;
  toast: { message: string; type: 'success' | 'error' } | null;
  onCloseToast: () => void;
  user: UserType;
  onLogout: () => void;
  settings: SystemSettings;
  users?: UserType[]; 
  roles?: any[]; 
  branches?: any[];
}

const Layout: React.FC<LayoutProps> = ({ 
  currentView, setView, products, leaveRequests = [], messages = [], children, toast, onCloseToast, 
  user, onLogout, settings, users = [], roles = [], branches = []
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  // State for global product modal (triggered by notifications)
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  const lowStockItems = useMemo(() => 
    products.filter(p => !p.isDeleted && p.stock <= p.lowStockThreshold),
    [products]
  );

  const unreadMessagesCount = useMemo(() => {
    if (!messages) return 0;
    return messages.filter(m => 
      !m.isRead && m.senderId !== user.id && !m.isDeleted && !m.isArchived &&
      (m.receiverId === user.id || m.receiverRole === user.role || m.isBroadcast)
    ).length;
  }, [messages, user]);

  const isMaster = useMemo(() => user?.username?.toLowerCase()?.trim() === 'admin', [user.username]);

  const userSeniority = useMemo(() => roles?.find(r => r.role_key === user.role)?.seniority || 0, [roles, user.role]);

  const pendingLeavesCount = useMemo(() => {
    if (!leaveRequests || (!isMaster && !['admin', 'branch_manager', 'supervisor'].includes(user.role))) return 0;
    return leaveRequests.filter(l => {
      const requester = users?.find(u => u.id === l.userId);
      const requesterRoleObj = roles?.find(r => r.role_key === l.userRole);
      const requesterSeniority = requesterRoleObj?.seniority || 0;
      
      const isPending = l.status === 'pending' && !l.isArchived && !l.isDeleted && l.userId !== user.id;
      if (!isPending) return false;
      
      if (l.targetRole && l.targetRole !== user.role && !isMaster) return false;
      if (['branch_manager', 'supervisor'].includes(user.role) && !isMaster) {
        return requester?.branchId === user.branchId && userSeniority > requesterSeniority;
      }
      return isMaster || userSeniority > requesterSeniority;
    }).length;
  }, [leaveRequests, user, roles, isMaster, userSeniority, users]);

  const correspondenceCount = unreadMessagesCount + pendingLeavesCount;
  const totalAlerts = lowStockItems.length;

  const displayBranchName = useMemo(() => {
    const roleLower = (user.role || '').toLowerCase();
    const isAdminBoss = ['admin', 'it_support', 'general_manager'].includes(roleLower);

    if (!user.branchId || user.branchId === '00000000-0000-0000-0000-000000000000') {
      return isAdminBoss ? 'الإدارة العامة' : 'المركز الرئيسي';
    }

    const branch = (branches || []).find(b => b.id === user.branchId);
    if (branch) return branch.name;

    if (!branches || branches.length === 0) return 'جاري المزامنة...';

    return isAdminBoss ? 'الإدارة العامة' : 'المركز الرئيسي';
  }, [user, branches]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => onCloseToast(), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, onCloseToast]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // For Global Product Modal Barcode
  useEffect(() => {
    if (viewingProduct) {
      setTimeout(() => {
        const svg = document.getElementById('global-barcode-svg');
        if (svg && typeof JsBarcode !== 'undefined') {
          JsBarcode(svg, viewingProduct.code, {
            format: "CODE128",
            width: 2,
            height: 60,
            displayValue: true,
            fontSize: 14,
            font: "Cairo",
            margin: 10
          });
        }
      }, 100);
    }
  }, [viewingProduct]);

  const navItems: Array<{ id: ViewType; label: string; icon: any }> = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'sales', label: 'نقطة البيع', icon: ShoppingCart },
    { id: 'correspondence', label: 'المراسلات والطلبات', icon: Mail },
    { id: 'dailyLogs', label: 'سجل العمليات', icon: History },
    { id: 'archive', label: 'أرشيف الفواتير', icon: Archive },
    { id: 'returns', label: 'المرتجعات', icon: RotateCcw },
    { id: 'inventory', label: 'المخزن', icon: Package },
    { id: 'purchases', label: 'التوريدات', icon: Truck }, 
    { id: 'customers', label: 'العملاء', icon: Users },
    { id: 'expenses', label: 'المصاريف', icon: Wallet },
    { id: 'treasury', label: 'الخزنة', icon: Landmark },
    { id: 'staff', label: 'الوظائف والفروع', icon: UserCog },
    { id: 'reports', label: 'التقارير الإحصائية', icon: BarChart3 },
    { id: 'userProfile', label: 'صفحتي الشخصية', icon: UserCircle },
    { id: 'itControl', label: 'لوحة IT والضبط', icon: Terminal },
    { id: 'recycleBin', label: 'المحذوفات', icon: Trash2 },
  ];

  const filteredNav = navItems.filter(item => {
    if (isMaster) return true;
    const roleLower = (user.role || '').toLowerCase().trim();
    if (settings.roleHiddenSections?.[user.role]?.includes(item.id)) return false;
    if (settings.userHiddenSections?.[user.username]?.includes(item.id)) return false;
    const systemProtected = ['itControl', 'recycleBin', 'staff'];
    const isAdminBoss = ['admin', 'it_support', 'general_manager'].includes(roleLower);
    if (systemProtected.includes(item.id) && !isAdminBoss) return false;
    return true;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-['Cairo']" dir="rtl">
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[5000] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border animate-in ${
          toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white'
        }`}>
          {toast.type === 'success' ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
          <span className="font-black text-xs">{toast.message}</span>
        </div>
      )}

      <aside className={`fixed lg:static inset-y-0 right-0 h-screen bg-white border-l border-slate-200 flex flex-col z-[60] transform transition-all duration-300 w-64 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b flex items-center gap-3">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="App Logo" className="w-10 h-10 rounded-xl object-cover shadow-lg border border-slate-100" />
          ) : (
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">M</div>
          )}
          <div><h1 className="font-black text-slate-800 text-sm">{settings.appName}</h1><p className="text-[8px] font-bold text-slate-400">نظام ميزة المحترف</p></div>
        </div>

        <nav className="flex-1 px-4 py-4 overflow-y-auto scrollbar-hide space-y-1">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const badgeCount = item.id === 'correspondence' ? correspondenceCount : 0;
            return (
              <button key={item.id} onClick={() => { setView(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all justify-between ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
                <div className="flex items-center gap-3"><Icon size={18} /><span className="font-bold text-[11px] whitespace-nowrap">{item.label}</span></div>
                {badgeCount > 0 && <span className="w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black border-2 border-white animate-pulse">{badgeCount}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t"><button onClick={onLogout} className="flex items-center justify-center gap-2 w-full py-3 text-rose-600 font-black text-[10px] border border-slate-200 rounded-xl hover:bg-rose-50 transition-all"><LogOut size={14} /><span>تسجيل الخروج</span></button></div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-40 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2.5 bg-slate-100 rounded-xl"><Menu size={20} /></button>
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
               <h2 className="text-lg md:text-xl font-black text-slate-800">
                  {navItems.find(i => i.id === currentView)?.label}
               </h2>
               <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm w-fit">
                  <Building2 size={12} className="text-indigo-600"/>
                  <span className="text-indigo-700 text-[10px] md:text-[11px] font-black whitespace-nowrap">
                    فرع: {displayBranchName}
                  </span>
               </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100"><Clock size={16} /><p className="text-xs font-black">{currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p></div>
            
            <div className="relative" ref={notificationRef}>
              <button onClick={() => setShowNotifications(!showNotifications)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-100 shadow-sm relative">
                <Bell size={18} className={totalAlerts > 0 ? 'text-rose-500 animate-bounce' : 'text-slate-400'} />
                {totalAlerts > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-600 rounded-full border-2 border-white"></span>}
              </button>

              {showNotifications && (
                <div className="absolute top-full left-0 mt-3 w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in">
                  <div className="p-5 border-b bg-slate-50 flex justify-between items-center"><h4 className="text-xs font-black text-slate-800">تنبيهات المخزن</h4><span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[8px] font-black rounded-full">{totalAlerts} صنف</span></div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {lowStockItems.map(p => (
                      <div key={p.id} onClick={() => { setViewingProduct(p); setShowNotifications(false); }} className="p-3 hover:bg-rose-50 rounded-xl flex items-center justify-between mb-1 cursor-pointer transition-colors group">
                        <div className="flex items-center gap-3">
                           <AlertCircle size={14} className="text-rose-500"/>
                           <div>
                              <p className="text-[10px] font-black text-slate-700">{p.name}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">#{p.code}</p>
                           </div>
                        </div>
                        <span className="text-[8px] font-black text-rose-600">رصيد: {p.stock}</span>
                      </div>
                    ))}
                    {totalAlerts === 0 && <p className="p-10 text-center text-[10px] font-bold text-slate-300 italic">المخزن في حالة ممتازة</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">{children}</div>
      </main>

      {/* Global Product Detail Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[6000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm">تفاصيل الصنف (عرض سريع)</h3>
                 <button onClick={() => setViewingProduct(null)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-slate-800">{viewingProduct.name}</h2>
                    <p className="text-xs text-slate-400 font-bold cursor-pointer hover:text-indigo-600" onClick={() => copyToClipboard(viewingProduct.code)}>#{viewingProduct.code}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl text-center shadow-inner"><p className="text-[9px] font-black text-slate-400 uppercase">الرصيد الكلي</p><p className={`text-xl font-black ${viewingProduct.stock <= viewingProduct.lowStockThreshold ? 'text-rose-600' : 'text-slate-800'}`}>{viewingProduct.stock}</p></div>
                    <div className="p-4 bg-slate-50 rounded-2xl text-center shadow-inner"><p className="text-[9px] font-black text-slate-400 uppercase">سعر البيع</p><p className="text-xl font-black">{viewingProduct.retailPrice} ج.م</p></div>
                 </div>
                 <div className="text-center bg-white p-6 border rounded-3xl shadow-lg border-dashed">
                    <svg id="global-barcode-svg" className="mx-auto"></svg>
                 </div>
                 <button onClick={() => setViewingProduct(null)} className="w-full py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black text-xs hover:bg-slate-50">إغلاق</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
