
import React, { useState, useMemo } from 'react';
import { 
  UserCircle, Phone, TrendingUp, Save, History, Calendar, Settings, Building2, Key, ShoppingBag, CreditCard, ChevronRight, ChevronLeft, Image as ImageIcon, RefreshCw, ShieldCheck, BadgeCheck, DollarSign, Activity, Send, X, Clock
} from 'lucide-react';
import { User, StaffPayment, Invoice, Branch, LeaveRequest } from '../types';
import { supabase } from '../supabaseClient';
import { AppRole } from '../hooks/useSystemSettings';

interface UserProfileProps {
  user: User;
  staffPayments: StaffPayment[];
  invoices: Invoice[];
  branches: Branch[];
  roles: AppRole[];
  onShowToast: (m: string, t: 'success' | 'error') => void;
  onUpdateCurrentUser: (updates: Partial<User>) => void;
  onAddLeaveRequest?: (req: Omit<LeaveRequest, 'id' | 'timestamp' | 'status'>) => Promise<void>;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, staffPayments, invoices, branches, roles, onShowToast, onUpdateCurrentUser, onAddLeaveRequest }) => {
  const [newPhone, setNewPhone] = useState(user.phoneNumber || '');
  const [newImage, setNewImage] = useState(user.imageUrl || '');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState<{ startDate: string; endDate: string; reason: string; type: 'normal' | 'emergency' }>({ 
    startDate: '', 
    endDate: '', 
    reason: '', 
    type: 'normal' 
  });

  const userRoleName = useMemo(() => {
    return roles.find(r => r.role_key === user.role)?.role_name || user.role;
  }, [roles, user.role]);

  const personalStats = useMemo(() => {
    const userInvoices = invoices.filter(i => i.createdBy === user.id && !i.isDeleted);
    const today = new Date().toLocaleDateString('ar-EG');
    const todayInvoices = userInvoices.filter(i => i.date === today);
    
    const totalSales = userInvoices.reduce((a, b) => a + b.netTotal, 0);
    const todaySales = todayInvoices.reduce((a, b) => a + b.netTotal, 0);
    
    return {
      totalCount: userInvoices.length,
      totalSales,
      todaySales,
      avgInvoice: userInvoices.length > 0 ? (totalSales / userInvoices.length) : 0,
      estimatedCommission: totalSales * 0.01
    };
  }, [invoices, user.id]);

  const handleUpdateAccount = async () => {
    setIsUpdating(true);
    try {
      const updates: any = { phone_number: newPhone, image_url: newImage };
      if (newPassword.trim()) {
        updates.password = newPassword;
      }

      const { error } = await supabase.from('users').update(updates).eq('id', user.id);
      if (error) throw error;

      onUpdateCurrentUser({ phoneNumber: newPhone, imageUrl: newImage });
      onShowToast("تم تحديث بيانات الحساب بنجاح، يرجى إعادة الدخول إذا قمت بتغيير كلمة المرور", "success");
      setNewPassword('');
    } catch (err: any) {
      onShowToast("فشل تحديث البيانات", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLeaveSubmit = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      return onShowToast("يرجى إكمال كافة البيانات", "error");
    }

    try {
      if (onAddLeaveRequest) {
        await onAddLeaveRequest({
          userId: user.id,
          userName: user.fullName,
          userRole: user.role,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          reason: leaveForm.reason,
          type: leaveForm.type
        });
        onShowToast("تم إرسال طلب الإجازة للمدير المباشر", "success");
        setIsLeaveModalOpen(false);
        setLeaveForm({ startDate: '', endDate: '', reason: '', type: 'normal' });
      }
    } catch (e) { onShowToast("فشل إرسال الطلب", "error"); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
       <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden relative">
          <div className="h-40 bg-indigo-600 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <UserCircle size={400} className="text-white absolute -bottom-20 -right-20" />
             </div>
          </div>
          <div className="px-10 pb-10 flex flex-col md:flex-row items-end gap-8 -mt-16 relative z-10">
             <div className="w-40 h-40 bg-white rounded-[2.5rem] p-1.5 shadow-2xl overflow-hidden border-4 border-white">
                {user.imageUrl ? (
                  <img src={user.imageUrl} className="w-full h-full object-cover rounded-[2.2rem]" alt="Profile" />
                ) : (
                  <div className="w-full h-full bg-indigo-50 rounded-[2.2rem] flex items-center justify-center text-indigo-600 text-6xl font-black">{user.fullName[0]}</div>
                )}
             </div>
             <div className="flex-1 pb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-3xl font-black text-slate-800">{user.fullName}</h3>
                  <span className="px-4 py-1 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100">{userRoleName}</span>
                </div>
                <div className="flex flex-wrap gap-4 mt-3">
                   <span className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-widest"><ShieldCheck size={14}/> كود المستخدم: {user.username}</span>
                   <span className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-widest"><Building2 size={14}/> الفرع: {branches.find(b => b.id === user.branchId)?.name || 'مقر الإدارة'}</span>
                </div>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
             <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3"><ShoppingBag size={24}/></div>
             <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي فواتيرك</p>
             <h4 className="text-xl font-black text-slate-800">{personalStats.totalCount} فاتورة</h4>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
             <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3"><TrendingUp size={24}/></div>
             <p className="text-[10px] font-black text-slate-400 uppercase">مبيعاتك الإجمالية</p>
             <h4 className="text-xl font-black text-slate-800">{personalStats.totalSales.toLocaleString()} ج.م</h4>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
             <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3"><BadgeCheck size={24}/></div>
             <p className="text-[10px] font-black text-slate-400 uppercase">مبيعاتك اليوم</p>
             <h4 className="text-xl font-black text-slate-800">{personalStats.todaySales.toLocaleString()} ج.م</h4>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
             <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3"><DollarSign size={24}/></div>
             <p className="text-[10px] font-black text-slate-400 uppercase">العمولات المقدرة (1%)</p>
             <h4 className="text-xl font-black text-rose-600">{personalStats.estimatedCommission.toLocaleString()} ج.م</h4>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
             <div className="flex items-center gap-3 border-b pb-4"><Settings className="text-indigo-600" size={20} /><h4 className="font-black text-sm text-slate-800">إعدادات الحساب</h4></div>
             <div className="space-y-4">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">رابط الصورة الشخصية</label><div className="relative"><ImageIcon size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" /><input type="text" className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/10" value={newImage} onChange={e => setNewImage(e.target.value)} placeholder="https://..." /></div></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">رقم الهاتف</label><div className="relative"><Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" /><input type="text" className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/10" value={newPhone} onChange={e => setNewPhone(e.target.value)} /></div></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">تغيير كلمة السر</label><div className="relative"><Key size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" /><input type="password" placeholder="اتركه فارغاً للحفاظ على القديمة..." className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/10" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div></div>
                <button onClick={handleUpdateAccount} disabled={isUpdating} className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-xs">{isUpdating ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18} />}حفظ التعديلات</button>
             </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
             <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl flex justify-between items-center overflow-hidden relative">
                <CreditCard size={150} className="absolute -bottom-10 -left-10 text-white/5 rotate-12 transition-transform hover:scale-110" />
                <div><p className="text-[10px] font-black text-indigo-300 uppercase mb-2">الراتب الشهري</p><h4 className="text-3xl font-black">{user.salary.toLocaleString()} <span className="text-sm opacity-50">ج.م</span></h4></div>
                <div className="text-left"><p className="text-[10px] font-black text-indigo-300 uppercase mb-2">أيام العمل</p><h4 className="text-3xl font-black">{user.daysWorkedAccumulated || 0} يوم</h4></div>
             </div>
             <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
                <div className="p-6 border-b bg-slate-50/50 flex items-center gap-3"><History size={18} className="text-indigo-600"/><h4 className="font-black text-sm text-slate-800">آخر العمليات المالية الشخصية</h4></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                   {staffPayments.filter(p => p.staffId === user.id).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl hover:bg-white border border-transparent hover:border-slate-100 transition-all group">
                         <div><p className="text-xs font-black text-slate-800">{p.paymentType} {p.notes ? `- ${p.notes}` : ''}</p><p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(p.paymentDate).toLocaleString('ar-EG')}</p></div>
                         <p className={`text-sm font-black ${p.paymentType === 'خصم' ? 'text-rose-600' : 'text-emerald-600'}`}>{p.paymentType === 'خصم' ? '-' : '+'}{p.amount.toLocaleString()} ج.م</p>
                      </div>
                   ))}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default UserProfile;
