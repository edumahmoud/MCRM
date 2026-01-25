
import React, { useState, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Trash2, 
  RefreshCcw, 
  AlertTriangle, 
  Database, 
  Smartphone, 
  ShieldAlert,
  DownloadCloud,
  UploadCloud,
  FileJson,
  Zap
} from 'lucide-react';
import { supabase } from '../supabaseClient';

interface SettingsProps {
  onShowToast: (m: string, t: 'success' | 'error') => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
}

const Settings: React.FC<SettingsProps> = ({ onShowToast, askConfirmation }) => {
  const [resetOptions, setResetOptions] = useState({
    localStorage: false,
    sales: false,
    inventory: false,
    purchases: false,
    fullDatabase: false
  });
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDoubleConfirmed, setIsDoubleConfirmed] = useState(false);
  const [isTripleConfirmed, setIsTripleConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MASTER_ADMIN_ID = '00000000-0000-0000-0000-000000000000';

  const handleBackup = async () => {
    setIsLoading(true);
    try {
      const tables = [
        'system_settings', 'app_roles', 'branches', 'users',
        'products', 'suppliers', 'purchase_records', 'supplier_payments',
        'sales_invoices', 'returns', 'expenses', 'staff_payments',
        'permission_overrides', 'unified_archive', 'treasury_logs',
        'correspondence', 'leave_requests', 'shifts', 'audit_logs'
      ];
      
      const backupData: Record<string, any> = {};
      
      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
          console.error(`Error backing up ${table}:`, error);
          continue;
        }
        backupData[table] = data;
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Meeza_POS_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      onShowToast("تم تصدير النسخة الاحتياطية بنجاح", "success");
    } catch (error) {
      onShowToast("فشل تصدير النسخة الاحتياطية", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    askConfirmation(
      "استعادة البيانات",
      "تحذير سيادي: استعادة البيانات ستقوم بمسح كافة البيانات الحالية واستبدالها بمحتويات ملف النسخة الاحتياطية. هل تود المتابعة؟",
      async () => {
        setIsLoading(true);
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          
          const tablesOrder = [
            'audit_logs', 'unified_archive', 'permission_overrides', 'staff_payments', 
            'expenses', 'returns', 'sales_invoices', 'treasury_logs', 'supplier_payments', 
            'purchase_records', 'suppliers', 'products', 'leave_requests', 'correspondence', 
            'shifts', 'users', 'branches', 'app_roles', 'system_settings'
          ];

          onShowToast("جاري تهيئة النظام للاستعادة...", "success");

          for (const table of tablesOrder) {
             await supabase.from(table).delete().neq('id', MASTER_ADMIN_ID);
          }

          const restoreOrder = [...tablesOrder].reverse();
          for (const table of restoreOrder) {
            if (data[table] && data[table].length > 0) {
              const { error } = await supabase.from(table).insert(data[table]);
              if (error) console.error(`Error restoring ${table}:`, error);
            }
          }

          onShowToast("تمت استعادة كافة البيانات بنجاح. سيتم إعادة تشغيل النظام.", "success");
          setTimeout(() => window.location.reload(), 2500);
        } catch (error) {
          console.error(error);
          onShowToast("فشل استعادة البيانات. الملف قد يكون تالفاً.", "error");
        } finally {
          setIsLoading(false);
        }
      },
      'warning'
    );
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = async () => {
    if (!isTripleConfirmed) return setIsTripleConfirmed(true);
    
    setIsLoading(true);
    try {
      localStorage.clear();

      const transactionalTables = [
        'audit_logs', 'unified_archive', 'treasury_logs', 'staff_payments', 
        'expenses', 'returns', 'sales_invoices', 'supplier_payments', 
        'purchase_records', 'shifts', 'leave_requests', 'correspondence'
      ];
      
      const masterDataTables = [
        'products', 'suppliers', 'permission_overrides'
      ];

      const organizationalTables = [
        'users', 'branches'
      ];

      let tablesToClear: string[] = [];

      if (resetOptions.fullDatabase) {
        tablesToClear = [...transactionalTables, ...masterDataTables, ...organizationalTables];
      } else {
        if (resetOptions.sales) tablesToClear.push('sales_invoices', 'returns', 'treasury_logs', 'expenses');
        if (resetOptions.inventory) tablesToClear.push('products');
        if (resetOptions.purchases) tablesToClear.push('suppliers', 'purchase_records', 'supplier_payments');
      }

      if (tablesToClear.length > 0) {
        onShowToast("جاري التطهير الشامل للسحابة...", "success");
        
        for (const table of tablesToClear) {
          const query = supabase.from(table).delete();
          if (table === 'users') {
            await query.neq('id', MASTER_ADMIN_ID);
          } else if (table === 'system_settings') {
            await supabase.from('system_settings').update({
              app_name: 'Meeza POS',
              global_system_lock: false,
              allow_invoice_suspension: true
            }).eq('id', 1);
          } else {
            await query.neq('id', '00000000-0000-0000-0000-000000000000'); 
          }
        }
      }

      onShowToast("تم تصفير النظام بنجاح. التطبيق الآن جاهز لمؤسسة جديدة.", "success");
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error(error);
      onShowToast("فشل تصفير بعض الأقسام، يرجى مراجعة لوحة تحكم Supabase", "error");
    } finally {
      setIsLoading(false);
      setIsConfirming(false);
      setIsDoubleConfirmed(false);
      setIsTripleConfirmed(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-800 text-white rounded-2xl flex items-center justify-center shadow-lg"><SettingsIcon size={24} /></div>
        <div><h3 className="font-black text-slate-800 text-lg">إدارة السجلات والتهيئة</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">تحكم في أرشيف البيانات وذاكرة النظام</p></div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b bg-indigo-50/30 flex items-center gap-3">
          <Database className="text-indigo-600" size={20} />
          <h4 className="font-black text-sm text-slate-800">النسخ الاحتياطي والاستعادة الشاملة</h4>
        </div>
        <div className="p-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] space-y-4">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                       <DownloadCloud size={24}/>
                    </div>
                    <div>
                       <p className="font-black text-xs text-slate-800">تصدير نسخة احتياطية</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase">Backup To Local File (JSON)</p>
                    </div>
                 </div>
                 <p className="text-[10px] text-slate-500 font-bold leading-relaxed">قم بتحميل ملف يحتوي على كافة بيانات النظام (المنتجات، الفواتير، الموردين، الكوادر) لحفظها خارجياً.</p>
                 <button 
                  onClick={handleBackup}
                  disabled={isLoading}
                  className="w-full py-3.5 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <FileJson size={18}/>}
                    بدء تصدير البيانات
                 </button>
              </div>

              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] space-y-4">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                       <UploadCloud size={24}/>
                    </div>
                    <div>
                       <p className="font-black text-xs text-slate-800">استعادة من ملف</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase">Restore System Data</p>
                    </div>
                 </div>
                 <p className="text-[10px] text-slate-500 font-bold leading-relaxed">اختر ملف نسخة احتياطية سابق (JSON) لاستعادة النظام لحالته السابقة. سيتم حذف البيانات الحالية.</p>
                 <input 
                  type="file" 
                  accept=".json" 
                  ref={fileInputRef} 
                  onChange={handleRestore} 
                  className="hidden" 
                 />
                 <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="w-full py-3.5 bg-emerald-600 text-white font-black rounded-xl shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <RefreshCcw size={18}/>}
                    رفع ملف الاستعادة
                 </button>
              </div>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b bg-rose-50/30 flex items-center gap-3">
          <ShieldAlert className="text-rose-600" size={20} />
          <h4 className="font-black text-sm text-slate-800">إجراءات سيادية: تصفير وتجهيز النظام (Factory Reset)</h4>
        </div>
        <div className="p-8 space-y-8">
          <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
             <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={20} />
             <div className="text-xs font-bold text-amber-800 leading-relaxed uppercase">تنبيه سيادي: العمليات أدناه ستقوم بمسح البيانات نهائياً من السحابة. استخدم "مسح شامل" لإعادة استخدام التطبيق في شركة أخرى.</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => setResetOptions({...resetOptions, localStorage: !resetOptions.localStorage, fullDatabase: false})} className={`p-6 rounded-[2rem] border-2 transition-all flex items-center gap-4 text-right ${resetOptions.localStorage ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}><Smartphone className={resetOptions.localStorage ? 'text-indigo-600' : 'text-slate-400'} size={24} /><div><p className="font-black text-xs text-slate-800">مسح الذاكرة المحلية</p><p className="text-[9px] font-bold text-slate-400 uppercase">Cache & Session Data</p></div></button>
            <button onClick={() => setResetOptions({...resetOptions, fullDatabase: !resetOptions.fullDatabase, localStorage: true})} className={`p-6 rounded-[2rem] border-2 transition-all flex items-center gap-4 text-right ${resetOptions.fullDatabase ? 'border-rose-700 bg-rose-100/50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}><Zap className={resetOptions.fullDatabase ? 'text-rose-700' : 'text-slate-400'} size={24} /><div><p className="font-black text-xs text-rose-800 uppercase tracking-tighter">Nuclear Reset (New Company Setup)</p><p className="text-[9px] font-bold text-rose-400 uppercase">مسح شامل لكافة السجلات (تصفير كامل)</p></div></button>
          </div>
        </div>
        <div className="p-8 bg-slate-50 flex justify-center border-t border-slate-100">
          <button disabled={!Object.values(resetOptions).some(v => v)} onClick={() => setIsConfirming(true)} className={`px-12 py-4 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50 ${resetOptions.fullDatabase ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-800 hover:bg-slate-900'}`}>
            <RefreshCcw size={18} /> {resetOptions.fullDatabase ? 'تصفير شامل وجاهزية لشركة جديدة' : 'تصفير الأقسام المختارة'}
          </button>
        </div>
      </div>

      {isConfirming && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in">
             <div className="p-8 text-center bg-rose-50">
                <AlertTriangle className="mx-auto mb-4 text-rose-600" size={48} />
                <h3 className="text-xl font-black mb-2">{isTripleConfirmed ? 'تحذير نهائي وقاطع!' : isDoubleConfirmed ? 'هل أنت متأكد تماماً؟' : 'تأكيد العملية'}</h3>
                <p className="text-slate-500 text-xs font-bold leading-relaxed uppercase">
                  {isTripleConfirmed 
                    ? 'سيتم مسح (الفروع، الموظفين، المنتجات، الموردين، المبيعات). سيبقى فقط حساب الـ Admin للدخول. اضغط لتنفيذ التدمير الذاتي للبيانات.'
                    : isDoubleConfirmed 
                      ? 'أنت على وشك تدمير قاعدة البيانات السحابية الحالية. هذه العملية غير قابلة للتراجع.' 
                      : 'سيتم مسح البيانات المختارة ولا يمكن استعادتها بعد الضغط على تأكيد.'}
                </p>
             </div>
             <div className="p-6 bg-white border-t flex gap-4">
                <button onClick={() => {setIsConfirming(false); setIsDoubleConfirmed(false); setIsTripleConfirmed(false);}} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl text-xs uppercase">إلغاء</button>
                <button 
                  onClick={() => {
                    if (!isDoubleConfirmed) return setIsDoubleConfirmed(true);
                    if (!isTripleConfirmed) return setIsTripleConfirmed(true);
                    handleReset();
                  }} 
                  disabled={isLoading} 
                  className={`flex-[1.5] py-4 text-white font-black rounded-xl shadow-xl text-xs flex items-center justify-center gap-2 ${isTripleConfirmed ? 'bg-black animate-pulse' : isDoubleConfirmed ? 'bg-rose-800' : 'bg-rose-600'}`}
                >
                  {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (isTripleConfirmed ? "تأكيد نهائي: تصفير شامل" : isDoubleConfirmed ? "نعم، أنا متأكد" : "متابعة")}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
