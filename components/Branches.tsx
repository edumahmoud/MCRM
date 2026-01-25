
import React, { useState, useMemo } from 'react';
import { 
  Building2, Plus, Search, MapPin, Users, Activity, 
  ChevronRight, ArrowLeft, X, TrendingUp, UserCheck, 
  ShieldCheck, MoreHorizontal, Calendar, Hash, Receipt, Wallet, FileText, DownloadCloud, Edit3, Power, Trash2, Save, RefreshCw, Smartphone, ShieldAlert, ShoppingCart, Package, BarChart3
} from 'lucide-react';
import { User as UserType, Branch, Invoice, Product } from '../types';

interface BranchesProps {
  user: UserType;
  branches: Branch[];
  users: UserType[];
  invoices?: Invoice[];
  products?: Product[];
  onAddBranch: (name: string, location?: string) => void;
  onUpdateBranch?: (id: string, updates: Partial<Branch>) => Promise<void>;
  onDeleteBranch?: (id: string, reason: string) => Promise<void>;
  askConfirmation?: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  onShowToast: (m: string, t: 'success' | 'error') => void;
}

const Branches: React.FC<BranchesProps> = ({ user, branches, users, invoices = [], products = [], onAddBranch, onUpdateBranch, onDeleteBranch, askConfirmation, onShowToast }) => {
  const isHQAdmin = ['admin', 'it_support', 'general_manager'].includes(user.role);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingBranchId, setViewingBranchId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<{id: string, reason: string} | null>(null);
  const [editForm, setEditForm] = useState<Partial<Branch>>({});
  const [isSaving, setIsSaving] = useState(false);

  const visibleBranches = useMemo(() => {
    let list = branches.filter(b => !b.isDeleted && b.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!isHQAdmin) {
      list = list.filter(b => b.id === user.branchId);
    }
    return list;
  }, [branches, searchTerm, isHQAdmin, user]);

  const selectedBranch = useMemo(() => 
    branches.find(b => b.id === (viewingBranchId || (isHQAdmin ? null : user.branchId))), 
    [branches, viewingBranchId, isHQAdmin, user]
  );

  const handleStatusToggle = async () => {
    if (!selectedBranch || !onUpdateBranch) return;
    const nextStatus = selectedBranch.status === 'active' ? 'closed_temp' : 'active';
    const label = nextStatus === 'active' ? 'تفعيل' : 'إيقاف مؤقت';
    
    if (askConfirmation) {
      askConfirmation(
        `${label} نشاط الفرع`,
        `هل أنت متأكد من ${label} نشاط ${selectedBranch.name}؟`,
        async () => {
          try {
            await onUpdateBranch(selectedBranch.id, { status: nextStatus });
            onShowToast(`تم ${label} الفرع بنجاح`, "success");
          } catch (e) { onShowToast("فشل التحديث", "error"); }
        },
        nextStatus === 'active' ? 'info' : 'warning'
      );
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedBranch || !onUpdateBranch) return;
    setIsSaving(true);
    try {
      // إصلاح جذري: تنقية البيانات المرسلة لـ Supabase لعدم تحديث ID أو حقول البيانات الأساسية المحمية
      const payload = {
        name: editForm.name,
        location: editForm.location,
        phone: editForm.phone,
        tax_number: editForm.taxNumber,
        commercial_register: editForm.commercialRegister
      };
      
      await onUpdateBranch(selectedBranch.id, payload as any);
      onShowToast("تم تحديث بيانات الفرع بنجاح", "success");
      setIsEditModalOpen(false);
    } catch (e) { 
      console.error("Branch Update Failed:", e);
      onShowToast("فشل حفظ التعديلات في السحابة", "error"); 
    }
    finally { setIsSaving(false); }
  };

  const handleDeleteSubmit = async () => {
    if (!isDeleting || !onDeleteBranch) return;
    try {
      await onDeleteBranch(isDeleting.id, isDeleting.reason);
      onShowToast("تم حذف الفرع نهائياً", "success");
      setIsDeleting(null);
      setViewingBranchId(null);
    } catch (e) { onShowToast("فشل الحذف", "error"); }
  };

  if (viewingBranchId || (!isHQAdmin && user.branchId)) {
    const b = selectedBranch;
    if (!b) return <div className="p-10 text-center font-black">تعذر العثور على بيانات الفرع</div>;
    const branchUsers = users.filter(u => u.branchId === b.id);

    // حساب إحصائيات الفرع الحالية
    const branchInvoices = invoices.filter(i => i.branchId === b.id && !i.isDeleted);
    const todayStr = new Date().toLocaleDateString('ar-EG');
    const todaySales = branchInvoices.filter(i => i.date === todayStr).reduce((a, inv) => a + inv.netTotal, 0);
    
    const now = new Date();
    const monthSales = branchInvoices.filter(i => {
      const d = new Date(i.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((a, inv) => a + inv.netTotal, 0);

    const branchStockCount = products.filter(p => p.branchId === b.id && !p.isDeleted).length;

    return (
      <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
         <div className={`p-8 rounded-[3rem] border shadow-sm relative overflow-hidden transition-all ${b.status === 'active' ? 'bg-white border-slate-200' : 'bg-slate-50 border-rose-100 grayscale-[0.5]'}`}>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex items-center gap-6">
                  {isHQAdmin && <button onClick={() => setViewingBranchId(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"><ArrowLeft size={24}/></button>}
                  <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-lg transition-colors ${b.status === 'active' ? 'bg-indigo-600 text-white' : 'bg-rose-600 text-white'}`}><Building2 size={32}/></div>
                  <div>
                     <h3 className="text-3xl font-black text-slate-800">{b.name} {b.status !== 'active' && <span className="text-rose-600 text-sm">(متوقف)</span>}</h3>
                     <p className="text-slate-400 font-bold flex items-center gap-2 mt-2"><MapPin size={14} className="text-rose-500"/> {b.location || 'غير محدد'}</p>
                  </div>
               </div>
               <div className="flex flex-wrap gap-3">
                  {isHQAdmin && (
                    <>
                      <button onClick={() => { setEditForm(b); setIsEditModalOpen(true); }} className="px-5 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] flex items-center gap-2 hover:bg-indigo-600 hover:text-white transition-all"><Edit3 size={16}/> تعديل البيانات</button>
                      <button onClick={handleStatusToggle} className={`px-5 py-3 rounded-xl font-black text-[10px] flex items-center gap-2 transition-all ${b.status === 'active' ? 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}>
                        <Power size={16}/> {b.status === 'active' ? 'إيقاف النشاط' : 'تنشيط الفرع'}
                      </button>
                      <button onClick={() => setIsDeleting({id: b.id, reason: ''})} className="px-5 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] flex items-center gap-2 hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={16}/> حذف نهائي</button>
                    </>
                  )}
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                     <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Users size={24}/></div>
                     <div><p className="text-[10px] font-black text-slate-400 uppercase">طاقم العمل</p><h4 className="text-xl font-black text-slate-800">{branchUsers.length} موظف</h4></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                     <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center"><Activity size={24}/></div>
                     <div><p className="text-[10px] font-black text-slate-400 uppercase">الأداء المالي</p><h4 className="text-xl font-black text-slate-800">مستقر</h4></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                     <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center"><ShieldCheck size={24}/></div>
                     <div><p className="text-[10px] font-black text-slate-400 uppercase">الرقابة</p><h4 className="text-xl font-black text-rose-600">فعالة</h4></div>
                  </div>
               </div>

               <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-8 space-y-8">
                  <div className="flex items-center justify-between border-b pb-4">
                    <h4 className="font-black text-sm flex items-center gap-2"><FileText size={18} className="text-indigo-600"/> التقارير التشغيلية والبيانات الحية</h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">تحديث تلقائي فوري</span>
                  </div>

                  {/* لوحات رؤية الأداء الحية */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="p-5 bg-indigo-600 rounded-3xl text-white shadow-lg shadow-indigo-100 relative overflow-hidden group">
                        <ShoppingCart className="absolute -bottom-2 -left-2 text-white/10 size-16 rotate-12 transition-transform group-hover:scale-110" />
                        <p className="text-[10px] font-black opacity-60 uppercase mb-1">مبيعات اليوم</p>
                        <h4 className="text-xl font-black">{todaySales.toLocaleString()} <span className="text-[10px] opacity-40">ج.م</span></h4>
                     </div>
                     <div className="p-5 bg-emerald-600 rounded-3xl text-white shadow-lg shadow-emerald-100 relative overflow-hidden group">
                        <TrendingUp className="absolute -bottom-2 -left-2 text-white/10 size-16 rotate-12 transition-transform group-hover:scale-110" />
                        <p className="text-[10px] font-black opacity-60 uppercase mb-1">مبيعات الشهر</p>
                        <h4 className="text-xl font-black">{monthSales.toLocaleString()} <span className="text-[10px] opacity-40">ج.م</span></h4>
                     </div>
                     <div className="p-5 bg-slate-800 rounded-3xl text-white shadow-lg shadow-slate-200 relative overflow-hidden group">
                        <Package className="absolute -bottom-2 -left-2 text-white/10 size-16 rotate-12 transition-transform group-hover:scale-110" />
                        <p className="text-[10px] font-black opacity-60 uppercase mb-1">أصناف المخزن</p>
                        <h4 className="text-xl font-black">{branchStockCount} <span className="text-[10px] opacity-40">صنف</span></h4>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                     <button onClick={()=>onShowToast("جاري تحضير التقرير اليومي...", "success")} className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-600 transition-all group">
                        <DownloadCloud size={24} className="text-slate-400 group-hover:text-indigo-600 mb-2"/>
                        <p className="text-[10px] font-black uppercase">تحميل تقرير يومي (Excel)</p>
                     </button>
                     <button onClick={()=>onShowToast("جاري تحضير التقرير الشهري...", "success")} className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-600 transition-all group">
                        <DownloadCloud size={24} className="text-slate-400 group-hover:text-indigo-600 mb-2"/>
                        <p className="text-[10px] font-black uppercase">تحميل تقرير شهري (Excel)</p>
                     </button>
                     <button onClick={()=>onShowToast("جاري تحضير التقرير السنوي...", "success")} className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-600 transition-all group">
                        <DownloadCloud size={24} className="text-slate-400 group-hover:text-indigo-600 mb-2"/>
                        <p className="text-[10px] font-black uppercase">تحميل تقرير سنوي (Excel)</p>
                     </button>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6 shadow-xl">
               <h4 className="font-black text-sm flex items-center gap-2 border-b border-white/10 pb-4"><Building2 className="text-indigo-400" size={18}/> بيانات التأسيس</h4>
               <div className="space-y-4 text-xs font-bold">
                  <div className="flex justify-between p-2 border-b border-white/5"><span>كود الفرع:</span><span className="text-indigo-400 font-mono">#{b.operationalNumber}</span></div>
                  <div className="flex justify-between p-2 border-b border-white/5"><span>الرقم الضريبي:</span><span>{b.taxNumber || '---'}</span></div>
                  <div className="flex justify-between p-2 border-b border-white/5"><span>السجل التجاري:</span><span>{b.commercialRegister || '---'}</span></div>
                  <div className="flex justify-between p-2 border-b border-white/5"><span>رقم الهاتف:</span><span>{b.phone || '---'}</span></div>
                  <div className="flex justify-between p-2"><span>تاريخ الافتتاح:</span><span>{new Date(b.createdAt).toLocaleDateString('ar-EG')}</span></div>
               </div>
            </div>
         </div>

         {/* Edit Modal */}
         {isEditModalOpen && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in">
                 <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                    <h3 className="font-black text-sm">تعديل بيانات {b.name}</h3>
                    <button onClick={() => setIsEditModalOpen(false)}><X size={24}/></button>
                 </div>
                 <div className="p-8 space-y-4 text-right">
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">اسم الفرع</label><input type="text" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={editForm.name || ''} onChange={e=>setEditForm({...editForm, name: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">الموقع الجغرافي</label><input type="text" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={editForm.location || ''} onChange={e=>setEditForm({...editForm, location: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">رقم هاتف الفرع</label><input type="text" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={editForm.phone || ''} onChange={e=>setEditForm({...editForm, phone: e.target.value})} /></div>
                       <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">السجل التجاري</label><input type="text" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={editForm.commercialRegister || ''} onChange={e=>setEditForm({...editForm, commercialRegister: e.target.value})} /></div>
                    </div>
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">الرقم الضريبي</label><input type="text" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={editForm.taxNumber || ''} onChange={e=>setEditForm({...editForm, taxNumber: e.target.value})} /></div>
                 </div>
                 <div className="p-6 bg-slate-50 border-t flex gap-3">
                    <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 bg-white border rounded-xl text-xs font-black">إلغاء</button>
                    <button onClick={handleEditSubmit} disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-xl shadow-xl text-xs flex items-center justify-center gap-2">
                      {isSaving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>} حفظ التعديلات
                    </button>
                 </div>
              </div>
           </div>
         )}

         {/* Delete Confirmation */}
         {isDeleting && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] w-full max-sm shadow-2xl overflow-hidden p-8 text-center space-y-6 animate-in zoom-in">
                 <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner"><ShieldAlert size={40}/></div>
                 <h3 className="text-xl font-black text-slate-800">حذف الفرع نهائياً؟</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase">هذا الإجراء سيقوم بتعطيل الوصول للفرع وأرشفة كافة سجلاته. لا يمكن التراجع.</p>
                 <textarea className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold focus:ring-2 focus:ring-rose-500/10 outline-none" placeholder="اكتب سبب الحذف (إلزامي)..." value={isDeleting.reason} onChange={e=>setIsDeleting({...isDeleting, reason:e.target.value})} />
                 <div className="flex gap-3">
                    <button onClick={()=>setIsDeleting(null)} className="flex-1 py-4 bg-slate-100 rounded-xl text-xs font-black text-slate-500">تراجع</button>
                    <button onClick={handleDeleteSubmit} disabled={!isDeleting.reason} className="flex-[2] py-4 bg-rose-600 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-200 disabled:opacity-50">تأكيد الحذف السيادي</button>
                 </div>
              </div>
           </div>
         )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><Building2 size={24} /></div>
          <div><h3 className="font-black text-slate-800 text-lg">إدارة الفروع المسموحة</h3></div>
        </div>
        <div className="relative flex-1 md:w-64">
           <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
           <input type="text" placeholder="بحث عن فرع..." className="w-full pr-11 pl-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-[11px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {visibleBranches.map(b => (
          <div key={b.id} onClick={() => setViewingBranchId(b.id)} className={`rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col cursor-pointer transition-all group ${b.status === 'active' ? 'bg-white border-slate-100 hover:border-indigo-600' : 'bg-slate-50 border-rose-100'}`}>
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl shadow-sm flex items-center justify-center border ${b.status === 'active' ? 'bg-white text-indigo-600 border-slate-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}><Building2 size={28} /></div>
                <div>
                  <h4 className="font-black text-slate-800 text-lg">{b.name}</h4>
                  <p className="text-slate-400 font-bold text-[10px] uppercase">كود التشغيل: {b.operationalNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 {b.status !== 'active' && <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[8px] font-black rounded-lg">متوقف</span>}
                 <ChevronRight size={24} className="text-slate-300 group-hover:text-indigo-600 transition-all"/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Branches;
