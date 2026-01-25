
import React, { useState, useMemo } from 'react';
import { 
  Users, Building2, UserPlus, ShieldCheck, CreditCard, Calendar, 
  Trash2, Edit3, Key, ArrowRightLeft, Award, Plus, 
  Search, X, Save, RefreshCw, Briefcase, 
  TrendingUp, TrendingDown, Wallet, CheckCircle2, MapPin, 
  ShieldAlert, Info, Phone, Copy, 
  User as UserIcon, BadgeCheck, Activity, Clock, Receipt, Banknote, Coins, FileText, ArrowUpRight, ArrowRight, UserCheck, Smartphone, Star, Hash, Landmark, PieChart, DollarSign,
  ShoppingBag, AlertTriangle, ArrowLeft, History, ShoppingCart, ToggleRight, ToggleLeft, LayoutGrid, List, Eye, Settings, ChevronLeft, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { User, Branch, StaffPayment, LeaveRequest, Invoice, SystemSettings, UserRole, StaffPaymentType, ProceduralAction, Product } from '../types';
import { AppRole } from '../hooks/useSystemSettings';
import { copyToClipboard } from './Layout';
import Branches from './Branches';
import * as XLSX from 'xlsx';

interface StaffProps {
  currentUser: User;
  users: User[];
  branches: Branch[];
  staffPayments: StaffPayment[];
  leaveRequests: LeaveRequest[];
  invoices: Invoice[];
  products: Product[];
  roles: AppRole[];
  settings: SystemSettings;
  onUpdateSettings: (s: Partial<SystemSettings>) => Promise<void>;
  onAddUser: (role: UserRole, fullName: string, phone: string, salary: number, branchId: string, hasPerformance: boolean, birthDate: string) => Promise<any>;
  onUpdateUser?: (userId: string, updates: any) => Promise<void>;
  onTransferEmployee: (userId: string, targetBranchId: string | null) => Promise<void>;
  onUpdateBranch: (id: string, updates: Partial<Branch>) => Promise<void>;
  onDeleteUser: (id: string, reason: string) => Promise<void>;
  onDeleteBranch: (id: string, reason: string) => Promise<void>;
  onUpdateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  onAddStaffPayment: (staffId: string, amount: number, type: StaffPaymentType, notes?: string, creatorId?: string) => Promise<void>;
  onResetPassword: (userId: string) => Promise<string>;
  onUpdateLeaveStatus: (id: string, status: 'approved' | 'rejected') => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  onAddBranch: (payload: { name: string, location?: string, phone?: string, taxNumber?: string, commercialRegister?: string }) => Promise<any>;
  onAddRole: (key: string, name: string, seniority: number) => Promise<void>;
  onDeleteRole: (key: string) => Promise<void>;
  checkPermission: (user: { role: string, username: string }, action: ProceduralAction) => boolean;
}

const Staff: React.FC<StaffProps> = ({ 
  currentUser, users, branches, staffPayments, leaveRequests, invoices, products, roles, settings,
  onUpdateSettings, onAddUser, onUpdateUser, onTransferEmployee, onUpdateBranch, onDeleteUser, onDeleteBranch, 
  onUpdateUserRole, onAddStaffPayment, onResetPassword, onUpdateLeaveStatus, onShowToast, askConfirmation, 
  onAddBranch, onAddRole, onDeleteRole, checkPermission 
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'branches' | 'payments' | 'roles'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState<{ isOpen: boolean, user: User | null }>({ isOpen: false, user: null });
  
  // State for Sub-Views
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<User | null>(null);
  const [viewingRoleDetails, setViewingRoleDetails] = useState<string | null>(null);
  
  const isHQAdmin = ['admin', 'it_support', 'general_manager'].includes(currentUser.role);

  const filteredUsers = useMemo(() => {
    let list = users.filter(u => !u.isDeleted);
    if (!isHQAdmin) {
      list = list.filter(u => u.branchId === currentUser.branchId);
    }
    if (searchTerm) {
      list = list.filter(u => u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || u.username.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return list;
  }, [users, currentUser.branchId, isHQAdmin, searchTerm]);

  const [paymentForm, setPaymentForm] = useState({ amount: 0, type: 'راتب' as StaffPaymentType, notes: '' });

  const handlePaymentSubmit = async () => {
    if (!isPaymentOpen.user || !paymentForm.amount) return;
    try {
      await onAddStaffPayment(isPaymentOpen.user.id, paymentForm.amount, paymentForm.type, paymentForm.notes, currentUser.id);
      onShowToast("تم تسجيل العملية المالية بنجاح", "success");
      setIsPaymentOpen({ isOpen: false, user: null });
      setPaymentForm({ amount: 0, type: 'راتب', notes: '' });
    } catch (e) {
      onShowToast("فشل تسجيل العملية", "error");
    }
  };

  const handleResetPassword = async (staff: User) => {
    askConfirmation(
      "تصفير كلمة المرور",
      `هل أنت متأكد من تصفير كلمة مرور الموظف ${staff.fullName}؟ سيتم إنشاء كلمة مرور عشوائية جديدة.`,
      async () => {
        try {
          const newPass = await onResetPassword(staff.id);
          onShowToast(`تم التصفير بنجاح. كلمة المرور الجديدة هي: ${newPass}`, "success");
          copyToClipboard(newPass, onShowToast);
        } catch (e) {
          onShowToast("فشل تصفير كلمة المرور", "error");
        }
      }
    );
  };

  const handleTransfer = async (staffId: string, branchId: string | null) => {
    try {
      await onTransferEmployee(staffId, branchId);
      onShowToast("تم نقل الموظف للفرع الجديد بنجاح", "success");
      // Refresh local view if needed
      const updated = users.find(u => u.id === staffId);
      if (updated) setSelectedStaffProfile({...updated, branchId: branchId || undefined});
    } catch (e) {
      onShowToast("فشل نقل الموظف", "error");
    }
  };

  const handleExportStaff = () => {
    const data = filteredUsers.map(u => {
      const userSales = invoices.filter(inv => inv.createdBy === u.id && !inv.isDeleted);
      const totalSales = userSales.reduce((sum, inv) => sum + inv.netTotal, 0);
      const branchName = branches.find(b => b.id === u.branchId)?.name || 'المركز الرئيسي';
      const roleName = roles.find(r => r.role_key === u.role)?.role_name || u.role;

      return {
        "اسم الموظف": u.fullName,
        "كود الموظف": u.username,
        "الرتبة": roleName,
        "الفرع": branchName,
        "تاريخ التعيين": u.hiringDate ? new Date(u.hiringDate).toLocaleDateString('ar-EG') : 'غير مسجل',
        "الراتب الأساسي": u.salary,
        "عدد أيام العمل": u.daysWorkedAccumulated || 0,
        "الأداء (إجمالي المبيعات)": totalSales,
        "الأداء (عدد الفواتير)": userSales.length,
        "رقم الهاتف": u.phoneNumber || '---'
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "الموظفين والأداء");
    XLSX.writeFile(wb, "Staff_Performance_Report.xlsx");
  };

  const handleExportBranches = () => {
    const data = branches.filter(b => !b.isDeleted).map(b => {
      const branchStaff = users.filter(u => u.branchId === b.id && !u.isDeleted).length;
      const branchInvoices = invoices.filter(inv => inv.branchId === b.id && !inv.isDeleted);
      const totalBranchSales = branchInvoices.reduce((sum, inv) => sum + inv.netTotal, 0);

      return {
        "اسم الفرع": b.name,
        "الموقع": b.location,
        "الهاتف": b.phone,
        "الحالة": b.status === 'active' ? 'نشط' : 'متوقف',
        "كود التشغيل": b.operationalNumber,
        "عدد الموظفين": branchStaff,
        "إجمالي المبيعات (الأداء المالي)": totalBranchSales,
        "عدد الفواتير (الأداء التشغيلي)": branchInvoices.length,
        "تاريخ التأسيس": new Date(b.createdAt).toLocaleDateString('ar-EG')
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "سجل الفروع");
    XLSX.writeFile(wb, "Branches_List.xlsx");
  };

  // --- Sub View: Staff Profile ---
  if (selectedStaffProfile) {
    const s = users.find(u => u.id === selectedStaffProfile.id) || selectedStaffProfile;
    const userInvoices = invoices.filter(i => i.createdBy === s.id && !i.isDeleted);
    const totalSalesValue = userInvoices.reduce((a, b) => a + b.netTotal, 0);
    const isSalesStaff = ['cashier', 'sales_manager', 'sales_supervisor', 'branch_manager'].includes(s.role.toLowerCase());
    const payments = staffPayments.filter(p => p.staffId === s.id);

    return (
      <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
        {/* Header Navigation */}
        <div className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <button onClick={() => setSelectedStaffProfile(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all">
                <ArrowRight size={24}/>
              </button>
              <div>
                 <h3 className="text-2xl font-black text-slate-800">{s.fullName}</h3>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">إدارة الملف الشخصي والاداء التشغيلي</p>
              </div>
           </div>
           <div className="flex items-center gap-3">
              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase ${s.isDeleted ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                الحالة: {s.isDeleted ? 'غير نشط' : 'على رأس العمل'}
              </span>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Information & Stats */}
           <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl"><Landmark size={24}/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase">الراتب الحالي</p><h4 className="text-xl font-black text-slate-800">{s.salary.toLocaleString()} ج.م</h4></div>
                 </div>
                 <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><Calendar size={24}/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase">أيام العمل</p><h4 className="text-xl font-black text-slate-800">{s.daysWorkedAccumulated || 0} يوم</h4></div>
                 </div>
                 <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl"><BadgeCheck size={24}/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase">الرتبة</p><h4 className="text-xl font-black text-slate-800 truncate">{roles.find(r=>r.role_key===s.role)?.role_name || s.role}</h4></div>
                 </div>
              </div>

              {/* Performance Section (If applicable) */}
              {isSalesStaff && (
                <div className="bg-slate-900 p-8 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
                   <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent"></div>
                   <div className="relative z-10 space-y-8">
                      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                         <TrendingUp className="text-indigo-400" size={20}/>
                         <h4 className="font-black text-sm uppercase tracking-widest text-indigo-200">الأداء المالي والتشغيلي</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                         <div className="space-y-1">
                            <p className="text-[10px] font-black text-white/40 uppercase">إجمالي حجم المبيعات</p>
                            <h2 className="text-3xl font-black text-white">{totalSalesValue.toLocaleString()} ج.م</h2>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[10px] font-black text-white/40 uppercase">عدد الفواتير المصدرة</p>
                            <h2 className="text-3xl font-black text-white">{userInvoices.length} فاتورة</h2>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[10px] font-black text-white/40 uppercase">متوسط قيمة الفاتورة</p>
                            <h2 className="text-3xl font-black text-white">{userInvoices.length > 0 ? (totalSalesValue / userInvoices.length).toFixed(0) : 0} ج.م</h2>
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {/* Payments History */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
                 <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                    <h4 className="font-black text-sm flex items-center gap-2"><History size={18} className="text-indigo-600"/> السجل المالي الأخير</h4>
                    <span className="text-[10px] font-bold text-slate-400">آخر {payments.length} عمليات</span>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                    {payments.map(p => (
                       <div key={p.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
                          <div>
                             <p className="text-xs font-black text-slate-800">{p.paymentType}</p>
                             <p className="text-[8px] text-slate-400 uppercase font-mono">{new Date(p.paymentDate).toLocaleString('ar-EG')}</p>
                          </div>
                          <p className={`text-sm font-black ${p.paymentType === 'خصم' ? 'text-rose-600' : 'text-emerald-600'}`}>
                             {p.paymentType === 'خصم' ? '-' : '+'}{p.amount.toLocaleString()} ج.م
                          </p>
                       </div>
                    ))}
                    {payments.length === 0 && (
                      <div className="py-20 flex flex-col items-center justify-center opacity-20"><History size={48} className="mb-4"/><p className="text-xs font-black">لا يوجد سجل مالي حالياً</p></div>
                    )}
                 </div>
              </div>
           </div>

           {/* Side Controls */}
           <div className="space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                 <div className="flex items-center gap-3 border-b pb-4"><Settings className="text-indigo-600" size={18}/><h4 className="font-black text-xs">التحكم الإداري</h4></div>
                 <div className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase">التبعية الحالية</label>
                       <select 
                         className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                         value={s.branchId || ''}
                         onChange={(e) => handleTransfer(s.id, e.target.value || null)}
                       >
                          <option value="">مقر الإدارة / المركز الرئيسي</option>
                          {branches.filter(b=>!b.isDeleted).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase">الرتبة الوظيفية</label>
                       <select 
                         className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                         value={s.role}
                         onChange={(e) => onUpdateUserRole(s.id, e.target.value as UserRole)}
                       >
                          {roles.map(r => <option key={r.role_key} value={r.role_key}>{r.role_name}</option>)}
                       </select>
                    </div>
                    <div className="pt-4 space-y-3">
                       <button onClick={() => handleResetPassword(s)} className="w-full py-4 bg-amber-50 text-amber-600 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 hover:bg-amber-600 hover:text-white transition-all border border-amber-100">
                          <Key size={14}/> تصفير الباسوورد
                       </button>
                       <button onClick={() => askConfirmation("حذف الموظف", `هل أنت متأكد من حذف حساب ${s.fullName}؟ سيتم أرشفة كافة سجلاته.`, () => { onDeleteUser(s.id, "طلب إداري"); setSelectedStaffProfile(null); })} className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 hover:bg-rose-600 hover:text-white transition-all border border-rose-100">
                          <Trash2 size={14}/> حذف الحساب نهائياً
                       </button>
                    </div>
                 </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6">
                 <h4 className="font-black text-xs flex items-center gap-2 border-b border-white/10 pb-4"><Info size={16} className="text-indigo-400"/> بيانات السحابة</h4>
                 <div className="space-y-4 text-[10px] font-bold">
                    <div className="flex justify-between p-2 border-b border-white/5"><span>كود المستخدم:</span><span className="text-indigo-400">#{s.username}</span></div>
                    <div className="flex justify-between p-2 border-b border-white/5"><span>تاريخ الميلاد:</span><span>{s.birthDate || '---'}</span></div>
                    <div className="flex justify-between p-2 border-b border-white/5"><span>رقم الموبايل:</span><span>{s.phoneNumber || '---'}</span></div>
                    <div className="flex justify-between p-2"><span>تاريخ التعيين:</span><span>{s.hiringDate ? new Date(s.hiringDate).toLocaleDateString('ar-EG') : '---'}</span></div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  }

  // --- Sub View: Users In Role ---
  if (viewingRoleDetails) {
    const roleObj = roles.find(r => r.role_key === viewingRoleDetails);
    const roleUsers = users.filter(u => u.role === viewingRoleDetails && !u.isDeleted);

    return (
      <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between">
           <div className="flex items-center gap-4">
              <button onClick={() => setViewingRoleDetails(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all">
                <ArrowRight size={24}/>
              </button>
              <div>
                 <h3 className="text-2xl font-black text-slate-800">موظفي رتبة: {roleObj?.role_name}</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">عرض كافة المنتسبين لهذه الوظيفة وعددهم ({roleUsers.length})</p>
              </div>
           </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
           <table className="w-full text-right text-[11px] font-bold">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                 <tr>
                    <th className="px-8 py-5">الموظف</th>
                    <th className="px-8 py-5">الفرع</th>
                    <th className="px-8 py-5 text-center">أيام العمل</th>
                    <th className="px-8 py-5 text-center">الراتب</th>
                    <th className="px-8 py-5 text-left">الملف الشخصي</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {roleUsers.map(u => (
                   <tr key={u.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-8 py-4 flex items-center gap-4">
                         <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">{u.fullName[0]}</div>
                         <div><p className="text-slate-800 text-xs font-black">{u.fullName}</p><p className="text-[9px] text-slate-400 font-mono">#{u.username}</p></div>
                      </td>
                      <td className="px-8 py-4 text-slate-500 font-black">{branches.find(b=>b.id===u.branchId)?.name || 'المركز الرئيسي'}</td>
                      <td className="px-8 py-4 text-center text-indigo-600 font-black">{u.daysWorkedAccumulated || 0} يوم</td>
                      <td className="px-8 py-4 text-center font-black">{u.salary.toLocaleString()} ج.م</td>
                      <td className="px-8 py-4 text-left">
                         <button onClick={() => setSelectedStaffProfile(u)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                           <Eye size={14}/>
                         </button>
                      </td>
                   </tr>
                 ))}
                 {roleUsers.length === 0 && (
                   <tr><td colSpan={5} className="py-20 text-center opacity-20 italic">لا يوجد موظفين حالياً في هذه الرتبة</td></tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>
    );
  }

  // --- Main Tabs ---
  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      {/* Upper Navigation & Stats */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('users')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><Users size={14}/> الموظفين</button>
          <button onClick={() => setActiveTab('branches')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'branches' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><Building2 size={14}/> الفروع</button>
          <button onClick={() => setActiveTab('payments')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'payments' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><Landmark size={14}/> سجل الرواتب</button>
          {isHQAdmin && (
            <button onClick={() => setActiveTab('roles')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'roles' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><ShieldCheck size={14}/> الرتب</button>
          )}
        </div>
        
        <div className="flex gap-3 shrink-0">
           {activeTab === 'users' && isHQAdmin && (
             <>
               <button onClick={handleExportStaff} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-black rounded-xl text-[10px] flex items-center gap-2 shadow-sm hover:border-emerald-600 hover:text-emerald-600"><FileSpreadsheet size={16}/> تقرير الموظفين</button>
               <button onClick={() => setIsAddUserOpen(true)} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-lg"><UserPlus size={16}/> إضافة موظف</button>
             </>
           )}
           {activeTab === 'branches' && isHQAdmin && (
             <>
               <button onClick={handleExportBranches} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-black rounded-xl text-[10px] flex items-center gap-2 shadow-sm hover:border-emerald-600 hover:text-emerald-600"><FileSpreadsheet size={16}/> سجل الفروع</button>
               <button onClick={() => setIsAddBranchOpen(true)} className="px-6 py-3 bg-emerald-600 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-lg"><Plus size={16}/> فرع جديد</button>
             </>
           )}
        </div>
      </div>

      {/* Dynamic Content */}
      <div className="min-h-[500px]">
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="relative w-full">
                   <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input 
                    type="text" 
                    placeholder="بحث في الموظفين..." 
                    className="w-full pr-14 pl-4 py-3 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                   />
                </div>
             </div>

             <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-right text-[11px] font-bold">
                   <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                      <tr>
                         <th className="px-8 py-5">الموظف</th>
                         <th className="px-8 py-5">الرتبة</th>
                         <th className="px-8 py-5 text-center">الفرع</th>
                         <th className="px-8 py-5 text-center">أيام العمل</th>
                         <th className="px-8 py-5 text-left">إدارة</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {filteredUsers.map(u => (
                         <tr key={u.id} className="hover:bg-slate-50/50 transition-all group">
                            <td className="px-8 py-4 flex items-center gap-4">
                               <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">{u.fullName[0]}</div>
                               <div>
                                  <p className="text-slate-800 text-xs font-black">{u.fullName}</p>
                                  <p className="text-[9px] text-slate-400 uppercase font-mono">#{u.username}</p>
                               </div>
                            </td>
                            <td className="px-8 py-4">
                               <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-[10px] font-black text-slate-500">
                                  {roles.find(r => r.role_key === u.role)?.role_name || u.role}
                               </span>
                            </td>
                            <td className="px-8 py-4 text-center text-slate-400">
                               {branches.find(b => b.id === u.branchId)?.name || 'المركز الرئيسي'}
                            </td>
                            <td className="px-8 py-4 text-center">
                               <span className="font-black text-indigo-600">{u.daysWorkedAccumulated || 0} يوم</span>
                            </td>
                            <td className="px-8 py-4 text-left">
                               <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all">
                                  <button onClick={() => setSelectedStaffProfile(u)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white shadow-sm transition-all" title="الملف الشخصي"><Eye size={14}/></button>
                                  <button onClick={() => setIsPaymentOpen({ isOpen: true, user: u })} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white shadow-sm transition-all" title="صرف مالي"><Coins size={14}/></button>
                                  {isHQAdmin && u.username !== 'admin' && (
                                    <button onClick={() => askConfirmation("حذف موظف", `هل أنت متأكد من حذف ${u.fullName}؟`, () => onDeleteUser(u.id, "طلب إداري"))} className="p-2 bg-rose-50 text-rose-400 rounded-lg hover:bg-rose-600 hover:text-white shadow-sm transition-all"><Trash2 size={14}/></button>
                                  )}
                               </div>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {activeTab === 'branches' && (
          <div className="animate-in slide-in-from-bottom-4">
             <Branches 
                user={currentUser} 
                branches={branches} 
                users={users} 
                invoices={invoices}
                products={products}
                onAddBranch={(name, loc) => onAddBranch({ name, location: loc })}
                onUpdateBranch={onUpdateBranch}
                onDeleteBranch={onDeleteBranch}
                askConfirmation={askConfirmation}
                onShowToast={onShowToast}
             />
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
             <div className="p-6 bg-slate-50/50 border-b flex items-center gap-3"><Landmark size={18} className="text-indigo-600"/><h4 className="font-black text-sm">أرشيف العمليات المالية للموظفين</h4></div>
             <table className="w-full text-right text-[11px] font-bold">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                   <tr>
                      <th className="px-8 py-5">الموظف</th>
                      <th className="px-8 py-5">النوع</th>
                      <th className="px-8 py-5 text-center">المبلغ</th>
                      <th className="px-8 py-5">ملاحظات</th>
                      <th className="px-8 py-5 text-left">التاريخ</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {staffPayments.map(p => {
                      const staff = users.find(u => u.id === p.staffId);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                           <td className="px-8 py-4 font-black">{staff?.fullName || 'موظف سابق'}</td>
                           <td className="px-8 py-4">
                              <span className={`px-2 py-1 rounded-lg text-[9px] font-black ${p.paymentType === 'خصم' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{p.paymentType}</span>
                           </td>
                           <td className={`px-8 py-4 text-center font-black ${p.paymentType === 'خصم' ? 'text-rose-600' : 'text-emerald-600'}`}>{p.amount.toLocaleString()} ج.م</td>
                           <td className="px-8 py-4 text-slate-400 text-[10px] italic max-w-xs truncate">{p.notes || '---'}</td>
                           <td className="px-8 py-4 text-left text-slate-400 font-mono text-[10px]">{new Date(p.paymentDate).toLocaleDateString('ar-EG')}</td>
                        </tr>
                      );
                   })}
                </tbody>
             </table>
          </div>
        )}

        {activeTab === 'roles' && isHQAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
             {roles.map(r => {
                const memberCount = users.filter(u => u.role === r.role_key && !u.isDeleted).length;
                return (
                  <div key={r.id} onClick={() => setViewingRoleDetails(r.role_key)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative group cursor-pointer hover:border-indigo-600 transition-all">
                     <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-[1.8rem] flex items-center justify-center mb-5"><ShieldCheck size={28}/></div>
                     <h4 className="text-lg font-black text-slate-800">{r.role_name}</h4>
                     <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">كود الرتبة: {r.role_key}</p>
                     
                     <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-4">
                        <div className="flex items-center gap-2 text-indigo-600">
                           <Users size={14}/>
                           <span className="text-xs font-black">{memberCount} موظف</span>
                        </div>
                        <ChevronLeft size={20} className="text-slate-300 group-hover:text-indigo-600 transition-all"/>
                     </div>
                     
                     {!r.is_system && (
                        <button onClick={(e) => { e.stopPropagation(); askConfirmation("حذف رتبة", "هل تود حذف هذه الرتبة نهائياً؟", () => onDeleteRole(r.role_key)); }} className="absolute top-6 left-6 p-2 text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                     )}
                  </div>
                );
             })}
             <button onClick={() => onShowToast("لإضافة رتبة، يرجى استخدام لوحة IT Control", "error")} className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all group min-h-[220px]">
                <Plus size={32} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase">إدارة الرتب سيادياً</span>
             </button>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {isPaymentOpen.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm">تسجيل عملية مالية للموظف</h3>
                 <button onClick={() => setIsPaymentOpen({ isOpen: false, user: null })}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-5 text-right">
                 <p className="text-xs font-black text-slate-500">اسم الموظف: <span className="text-slate-800">{isPaymentOpen.user?.fullName}</span></p>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase">نوع العملية</label>
                    <select className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs" value={paymentForm.type} onChange={e => setPaymentForm({...paymentForm, type: e.target.value as StaffPaymentType})}>
                       <option value="راتب">صرف راتب</option>
                       <option value="حافز">حافز / مكافأة</option>
                       <option value="سلفة">سلفة مالية</option>
                       <option value="خصم">خصم إداري</option>
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase">المبلغ (ج.م)</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-sm" value={paymentForm.amount || ''} onChange={e => setPaymentForm({...paymentForm, amount: Number(e.target.value)})} placeholder="0.00" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase">ملاحظات</label>
                    <textarea className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-xs h-20 resize-none" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} placeholder="اكتب تفاصيل العملية هنا..." />
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border-t flex gap-3">
                 <button onClick={() => setIsPaymentOpen({ isOpen: false, user: null })} className="flex-1 py-4 bg-white border rounded-xl text-xs font-black">إلغاء</button>
                 <button onClick={handlePaymentSubmit} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-xl shadow-xl text-xs">تأكيد العملية الموحدة</button>
              </div>
           </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm">تعريف موظف جديد في النظام</h3>
                 <button onClick={() => setIsAddUserOpen(false)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-5 text-right">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">الاسم بالكامل</label><input id="new-user-name" type="text" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs" /></div>
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">رقم الهاتف</label><input id="new-user-phone" type="text" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs" /></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase">الرتبة الوظيفية</label>
                       <select id="new-user-role" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs">
                          {roles.map(r => <option key={r.role_key} value={r.role_key}>{r.role_name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase">الفرع التابع له</label>
                       <select id="new-user-branch" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs">
                          <option value="">المركز الرئيسي</option>
                          {branches.filter(b=>!b.isDeleted).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">الراتب الأساسي</label><input id="new-user-salary" type="number" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs" /></div>
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">تاريخ الميلاد</label><input id="new-user-birth" type="date" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs" /></div>
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border-t flex justify-end">
                 <button onClick={async () => {
                   const name = (document.getElementById('new-user-name') as HTMLInputElement).value;
                   const phone = (document.getElementById('new-user-phone') as HTMLInputElement).value;
                   const role = (document.getElementById('new-user-role') as HTMLSelectElement).value;
                   const branch = (document.getElementById('new-user-branch') as HTMLSelectElement).value;
                   const salary = Number((document.getElementById('new-user-salary') as HTMLInputElement).value);
                   const birth = (document.getElementById('new-user-birth') as HTMLInputElement).value;
                   
                   if(!name || !role) return onShowToast("الاسم والرتبة مطلوبان", "error");
                   try {
                     const data = await onAddUser(role as UserRole, name, phone, salary, branch, true, birth);
                     onShowToast(`تم الإنشاء! كود الموظف: ${data.username} ، كلمة المرور: ${data.temporaryPassword}`, "success");
                     setIsAddUserOpen(false);
                   } catch(e) { onShowToast("فشل إنشاء الحساب", "error"); }
                 }} className="px-12 py-4 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-xl">إنشاء الحساب الآن</button>
              </div>
           </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {isAddBranchOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm">تأسيس فرع جديد في المنظومة</h3>
                 <button onClick={() => setIsAddBranchOpen(false)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-5 text-right">
                 <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">اسم الفرع</label><input id="br-name" type="text" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs" placeholder="مثال: فرع القاهرة الجديدة..." /></div>
                 <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">الموقع الجغرافي</label><input id="br-loc" type="text" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs" placeholder="العنوان بالتفصيل..." /></div>
                 <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">رقم هاتف الفرع</label><input id="br-phone" type="text" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs" /></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">الرقم الضريبي</label><input id="br-tax" type="text" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs" /></div>
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">السجل التجاري</label><input id="br-comm" type="text" className="w-full p-4 bg-slate-50 border rounded-xl font-black text-xs" /></div>
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border-t flex justify-end">
                 <button onClick={async () => {
                   const name = (document.getElementById('br-name') as HTMLInputElement).value;
                   const loc = (document.getElementById('br-loc') as HTMLInputElement).value;
                   const phone = (document.getElementById('br-phone') as HTMLInputElement).value;
                   const tax = (document.getElementById('br-tax') as HTMLInputElement).value;
                   const comm = (document.getElementById('br-comm') as HTMLInputElement).value;
                   
                   if(!name) return onShowToast("اسم الفرع مطلوب", "error");
                   try {
                     await onAddBranch({ name, location: loc, phone, taxNumber: tax, commercialRegister: comm });
                     onShowToast("تم تأسيس الفرع بنجاح", "success");
                     setIsAddBranchOpen(false);
                   } catch(e) { onShowToast("فشل التأسيس", "error"); }
                 }} className="px-12 py-4 bg-emerald-600 text-white rounded-xl font-black text-xs shadow-xl">اعتماد الفرع الجديد</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
