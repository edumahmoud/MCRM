
import React, { useState, useEffect } from 'react';
import { 
  Terminal, ShieldAlert, Globe, Save, RefreshCw, Eye, EyeOff, Layout,
  Trash2, AlertTriangle, Database, Plus, Settings2, Activity,
  Lock, ShieldX, Key, Check, Zap, Coins, Image as ImageIcon, Briefcase, 
  UserCog, User, Eraser, Info, Palette, Type, Smartphone, Loader2
} from 'lucide-react';
import { SystemSettings, PermissionOverride, User as UserType, ProceduralAction, ViewType } from '../types';
import { AppRole } from '../hooks/useSystemSettings';
import { supabase } from '../supabaseClient';

interface ITControlProps {
  settings: SystemSettings;
  overrides: PermissionOverride[];
  roles: AppRole[];
  onUpdateSettings: (s: Partial<SystemSettings>) => Promise<void>;
  onAddOverride: (o: Omit<PermissionOverride, 'id'>) => Promise<void>;
  onAddRole: (key: string, name: string, seniority: number) => Promise<void>;
  onDeleteRole: (key: string) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  user: UserType;
  onRemoveOverride: (id: string) => Promise<void>;
}

const ITControl: React.FC<ITControlProps> = ({ 
  settings, overrides, roles, onUpdateSettings, onAddOverride, onRemoveOverride, onAddRole, onDeleteRole, onShowToast, user 
}) => {
  const [formData, setFormData] = useState<SystemSettings>({...settings});
  const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'sovereignty'>('general');
  const [restrictionType, setRestrictionType] = useState<'role' | 'user'>('role');
  const [targetId, setTargetId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [isTripleConfirmed, setIsTripleConfirmed] = useState(false);
  const [isLoadingReset, setIsLoadingReset] = useState(false);
  const [resetProgress, setResetProgress] = useState(0);
  const [resetStatus, setResetStatus] = useState('');

  const isMasterAccount = user.username.toLowerCase().trim() === 'admin';

  useEffect(() => {
    setFormData({...settings});
  }, [settings]);

  const handleClearCache = () => {
    localStorage.clear();
    onShowToast("تم تطهير ذاكرة المتصفح بنجاح.", "success");
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleResetSystem = async () => {
    if (!isMasterAccount) return;
    setIsLoadingReset(true);
    setResetProgress(0);

    const NULL_UUID = '00000000-0000-0000-0000-000000000000';

    try {
      setResetStatus("المرحلة 1: تصفير مراجع المراسلات...");
      setResetProgress(5);
      await supabase.from('correspondence').update({ parent_message_id: null, sender_id: null, receiver_id: null }).neq('id', NULL_UUID);
      setResetStatus("المرحلة 1: تصفير مراجع العمليات المالية...");
      setResetProgress(15);
      await supabase.from('sales_invoices').update({ created_by: null, branch_id: null, shift_id: null }).neq('id', NULL_UUID);
      await supabase.from('shifts').update({ user_id: null, branch_id: null }).neq('id', NULL_UUID);
      await supabase.from('audit_logs').update({ user_id: null }).neq('id', NULL_UUID);
      setResetStatus("المرحلة 1: فك ارتباط الموظفين بالفروع...");
      setResetProgress(25);
      await supabase.from('users').update({ branch_id: null }).neq('username', 'admin');

      const deletionSequence = [
        { table: 'correspondence', label: 'حذف المراسلات' },
        { table: 'audit_logs', label: 'حذف سجلات الرقابة' },
        { table: 'unified_archive', label: 'تصفير الأرشيف' },
        { table: 'treasury_logs', label: 'تصفير الخزنة' },
        { table: 'staff_payments', label: 'حذف سجلات الرواتب' },
        { table: 'returns', label: 'تطهير المرتجعات' },
        { table: 'sales_invoices', label: 'مسح المبيعات' },
        { table: 'supplier_payments', label: 'سداد الموردين' },
        { table: 'purchase_records', label: 'مسح التوريدات' },
        { table: 'shifts', label: 'إغلاق الورديات' },
        { table: 'permission_overrides', label: 'مسح الاستثناءات' },
        { table: 'products', label: 'مسح المخزن' },
        { table: 'suppliers', label: 'مسح الموردين' },
        { table: 'users', label: 'حذف الموظفين (المرحلة القبل أخيرة)' },
        { table: 'branches', label: 'حذف الفروع (المرحلة النهائية)' }
      ];

      let currentStep = 0;
      for (const step of deletionSequence) {
        currentStep++;
        const progress = 30 + Math.round((currentStep / deletionSequence.length) * 70);
        setResetStatus(`المرحلة 2: ${step.label}...`);
        setResetProgress(progress);
        let query = supabase.from(step.table).delete();
        if (step.table === 'users') query = query.neq('username', 'admin');
        else query = query.neq('id', NULL_UUID);
        const { error } = await query;
        if (error && error.message.includes('foreign key')) throw new Error(`تعذر حذف ${step.label}: سجلات مرتبطة.`);
        await new Promise(r => setTimeout(r, 100));
      }
      setResetStatus("اكتمل التطهير بنجاح!");
      setResetProgress(100);
      onShowToast("تم تصفير السحابة بنجاح.", "success");
      setTimeout(() => handleClearCache(), 2000);
    } catch (e: any) {
      onShowToast(e.message || "حدث خطأ أثناء التطهير", "error");
      setIsLoadingReset(false);
      setIsTripleConfirmed(false);
    }
  };

  const handleToggleMatrix = (matrixKey: keyof SystemSettings, itemId: string) => {
    if (!targetId) {
      onShowToast("يرجى اختيار رتبة أو إدخال كود موظف أولاً", "error");
      return;
    }
    const currentMatrix = { ...(formData[matrixKey] as Record<string, string[]>) || {} };
    const currentList = [...(currentMatrix[targetId] || [])];
    if (currentList.includes(itemId)) {
      currentMatrix[targetId] = currentList.filter(id => id !== itemId);
    } else {
      currentMatrix[targetId] = [...currentList, itemId];
    }
    setFormData({ ...formData, [matrixKey]: currentMatrix });
  };

  const sectionOptions: { id: ViewType; label: string }[] = [
    { id: 'dashboard', label: 'الرئيسية' },
    { id: 'sales', label: 'نقطة البيع' },
    { id: 'inventory', label: 'المخزن' },
    { id: 'purchases', label: 'التوريدات' },
    { id: 'returns', label: 'المرتجعات' },
    { id: 'archive', label: 'الأرشيف' },
    { id: 'customers', label: 'العملاء' },
    { id: 'staff', label: 'الموظفين والفروع' },
    { id: 'expenses', label: 'المصاريف' },
    { id: 'treasury', label: 'الخزنة' },
    { id: 'reports', label: 'التقارير' },
    { id: 'itControl', label: 'لوحة IT' }
  ];

  const actionOptions: { id: string; label: string }[] = [
    { id: 'sell', label: 'إتمام عمليات البيع' },
    { id: 'delete_product', label: 'حذف/أرشفة الأصناف' },
    { id: 'delete_invoice', label: 'إلغاء فواتير البيع' },
    { id: 'process_return', label: 'تنفيذ المرتجعات' },
    { id: 'manage_staff', label: 'إدارة الكادر العام' },
    { id: 'staff_transfer', label: 'نقل موظف لفرع آخر (سيادي)' },
    { id: 'staff_promote', label: 'ترقية وتعديل رتبة (سيادي)' },
    { id: 'staff_reset_pass', label: 'تصفير كلمة السر (سيادي)' },
    { id: 'staff_delete', label: 'حذف موظف نهائياً (سيادي)' },
    { id: 'staff_finance_adjust', label: 'صرف حوافز/خصومات/سلف' },
    { id: 'manage_suppliers', label: 'إدارة الموردين' },
    { id: 'view_reports', label: 'عرض التقارير المالية' }
  ];

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <Terminal className="absolute -bottom-10 -left-10 text-white/5 size-48 rotate-12" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
             <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg border-2 border-indigo-500"><Terminal size={32}/></div>
             <div>
                <h3 className="text-2xl font-black mb-1">لوحة التحكم السيادي (IT Admin)</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase flex items-center gap-2">المتحكم: {user.fullName} <Check size={12} className="text-emerald-500"/></p>
             </div>
          </div>
          <div className="flex bg-white/5 p-1.5 rounded-2xl backdrop-blur-md overflow-x-auto">
             <button onClick={() => setActiveTab('general')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'general' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>الإعدادات العامة</button>
             <button onClick={() => setActiveTab('permissions')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'permissions' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>مصفوفة الوصول</button>
             <button onClick={() => setActiveTab('sovereignty')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${activeTab === 'sovereignty' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>السيادة والتطهير</button>
          </div>
        </div>
      </div>

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b pb-4"><Settings2 className="text-indigo-600" size={20}/><h4 className="font-black text-sm">هوية النظام</h4></div>
              <div className="space-y-4">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">اسم التطبيق</label><input type="text" className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-bold text-xs" value={formData.appName} onChange={e=>setFormData({...formData, appName: e.target.value})} /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">العملة الافتراضية</label><input type="text" className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-bold text-xs" value={formData.currency} onChange={e=>setFormData({...formData, currency: e.target.value})} /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">رابط شعار النظام</label><input type="text" className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-bold text-xs" value={formData.logoUrl} onChange={e=>setFormData({...formData, logoUrl: e.target.value})} /></div>
              </div>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b pb-4"><Activity className="text-indigo-600" size={20}/><h4 className="font-black text-sm">سلوكيات التشغيل</h4></div>
              <div className="space-y-4">
                 <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                    <div><p className="text-xs font-black">تقييم المخزون</p><p className="text-[9px] text-slate-400">حساب تكلفة المبيعات</p></div>
                    <select className="bg-white px-4 py-2 rounded-lg border text-[10px] font-black" value={formData.inventory_method} onChange={e=>setFormData({...formData, inventory_method: e.target.value as any})}>
                       <option value="WAC">المتوسط المرجح (WAC)</option>
                       <option value="FIFO">الوارد أولاً (FIFO)</option>
                    </select>
                 </div>
                 <button onClick={() => setFormData({...formData, globalSystemLock: !formData.globalSystemLock})} className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${formData.globalSystemLock ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-transparent text-slate-600'}`}>
                    <div className="flex items-center gap-3"><Lock size={18}/> <span className="text-xs font-black">إغلاق النظام بالكامل</span></div>
                    <div className={`w-10 h-5 rounded-full relative transition-all ${formData.globalSystemLock ? 'bg-rose-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.globalSystemLock ? 'left-1' : 'right-1'}`}></div></div>
                 </button>
                 <button onClick={async () => {setIsSaving(true); await onUpdateSettings(formData); setIsSaving(false); onShowToast("تم حفظ الإعدادات", "success");}} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl flex items-center justify-center gap-2 hover:bg-indigo-700">
                    {isSaving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>} حفظ التعديلات
                 </button>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
           <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-center">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0">
                 <button onClick={() => {setRestrictionType('role'); setTargetId('');}} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${restrictionType === 'role' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>بالرتبة</button>
                 <button onClick={() => {setRestrictionType('user'); setTargetId('');}} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${restrictionType === 'user' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>بالموظف</button>
              </div>
              <div className="flex-1 w-full">
                 {restrictionType === 'role' ? (
                   <select className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none" value={targetId} onChange={e=>setTargetId(e.target.value)}>
                      <option value="">اختر الوظيفة...</option>
                      {roles.map(r => <option key={r.role_key} value={r.role_key}>{r.role_name}</option>)}
                   </select>
                 ) : (
                   <input type="text" placeholder="كود الموظف..." className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none" value={targetId} onChange={e=>setTargetId(e.target.value)} />
                 )}
              </div>
              <button onClick={() => onUpdateSettings(formData).then(()=>onShowToast("تم تثبيت المصفوفة", "success"))} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl flex items-center gap-2 shrink-0"><Save size={16}/> حفظ المصفوفة</button>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                 <div className="flex items-center gap-3 border-b pb-4"><Layout className="text-indigo-600" size={20}/><h4 className="font-black text-sm">حجب الأقسام</h4></div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto scrollbar-hide p-1">
                    {sectionOptions.map(opt => {
                       const matrixKey: keyof SystemSettings = restrictionType === 'role' ? 'roleHiddenSections' : 'userHiddenSections';
                       const isHidden = targetId && (formData[matrixKey] as any)?.[targetId]?.includes(opt.id);
                       return (
                         <button key={opt.id} onClick={() => handleToggleMatrix(matrixKey, opt.id)} className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between text-[10px] font-black ${isHidden ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-transparent text-slate-500 hover:border-indigo-100'}`}>
                            {opt.label} {isHidden ? <EyeOff size={14}/> : <Eye size={14}/>}
                         </button>
                       );
                    })}
                 </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                 <div className="flex items-center gap-3 border-b pb-4"><ShieldX className="text-rose-600" size={20}/><h4 className="font-black text-sm">حظر الإجراءات</h4></div>
                 <div className="grid grid-cols-1 gap-2">
                    {actionOptions.map(opt => {
                       const matrixKey: keyof SystemSettings = restrictionType === 'role' ? 'roleHiddenActions' : 'userHiddenActions';
                       const isLocked = targetId && (formData[matrixKey] as any)?.[targetId]?.includes(opt.id);
                       return (
                         <button key={opt.id} onClick={() => handleToggleMatrix(matrixKey, opt.id)} className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between text-[10px] font-black ${isLocked ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-transparent text-slate-500 hover:border-indigo-100'}`}>
                            {opt.label} {isLocked ? <Lock size={14}/> : <Check size={14}/>}
                         </button>
                       );
                    })}
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'sovereignty' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
           <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm text-center">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2.2rem] flex items-center justify-center mx-auto mb-6 shadow-inner"><RefreshCw size={40}/></div>
              <h4 className="text-xl font-black text-slate-800 mb-2">إدارة الذاكرة المؤقتة (Cache)</h4>
              <button onClick={handleClearCache} className="px-12 py-4 bg-slate-800 text-white rounded-2xl font-black text-xs hover:bg-black transition-all shadow-xl">تطهير ذاكرة المتصفح (Logout)</button>
           </div>
           {isMasterAccount && (
             <div className="bg-white p-12 rounded-[3.5rem] border border-rose-100 shadow-sm text-center space-y-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-rose-600"></div>
                <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner"><Zap size={48} className="animate-pulse"/></div>
                <button onClick={() => setIsTripleConfirmed(true)} className={`w-full py-5 rounded-2xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-3 ${isTripleConfirmed ? 'bg-black text-white animate-bounce' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                   <ShieldAlert size={20}/> {isTripleConfirmed ? 'تأكيد التدمير النهائي الصارم' : 'بدء التصفير الشامل للسحابة'}
                </button>
             </div>
           )}
           {(isTripleConfirmed || isLoadingReset) && (
             <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[3000] flex items-center justify-center p-4">
                {isLoadingReset ? (
                  <div className="bg-white rounded-[3rem] w-full max-w-md p-12 text-center space-y-8 shadow-[0_0_100px_rgba(79,70,229,0.2)] animate-in zoom-in-95">
                     <div className="relative w-40 h-40 mx-auto">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                           <circle className="text-slate-100" strokeWidth="6" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50"/>
                           <circle className="text-indigo-600 transition-all duration-1000 ease-out" strokeWidth="6" strokeDasharray={2 * Math.PI * 45} strokeDashoffset={2 * Math.PI * 45 * (1 - resetProgress / 100)} strokeLinecap="round" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50"/>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-black text-slate-800">{resetProgress}%</span></div>
                     </div>
                     <div><h3 className="text-xl font-black text-slate-900 mb-2">جاري تصفير السحابة...</h3><div className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100"><Loader2 className="animate-spin text-indigo-600" size={14}/><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{resetStatus}</p></div></div>
                  </div>
                ) : (
                  <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 text-center space-y-6 shadow-[0_0_100px_rgba(225,29,72,0.3)] animate-in zoom-in-95">
                     <AlertTriangle size={80} className="text-rose-600 mx-auto animate-pulse"/>
                     <div className="flex gap-4 pt-4">
                        <button onClick={() => setIsTripleConfirmed(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl text-xs">تراجع</button>
                        <button onClick={handleResetSystem} className="flex-[2] py-4 bg-rose-600 text-white font-black rounded-xl shadow-xl text-xs flex items-center justify-center gap-2"><Trash2 size={16}/> نعم، تطهير شامل</button>
                     </div>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default ITControl;
