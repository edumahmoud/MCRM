
import React, { useState, useMemo, useRef } from 'react';
import { Search, Eye, X, Trash2, FileText, Receipt, ArrowUpDown, Tag, Percent, Star, Printer, Smartphone, DownloadCloud, Share2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Invoice, User as UserType, Branch, SystemSettings, ReturnRecord } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { copyToClipboard } from './Layout';

interface ArchiveProps {
  invoices: Invoice[];
  returns?: ReturnRecord[]; // Added returns prop
  branches: Branch[];
  settings: SystemSettings;
  onDeleteInvoice: (id: string, reason: string, user: UserType) => Promise<void>;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
  user: UserType;
  canDelete: boolean;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
}

const Archive: React.FC<ArchiveProps> = ({ invoices, returns = [], branches, settings, onDeleteInvoice, onShowToast, user, canDelete, askConfirmation }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{id: string, reason: string} | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });
  const invoiceRef = useRef<HTMLDivElement>(null);

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

  const filtered = useMemo(() => {
    let list = invoices.filter(inv => {
      if (inv.isDeleted) return false;
      
      // Date Filter
      const d = new Date(inv.timestamp);
      const matchesTime = activeTab === 'daily' ? inv.date === formattedSelectedDate :
                          activeTab === 'monthly' ? (d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()) :
                          (d.getFullYear() === selectedDate.getFullYear());
      return matchesTime;
    });

    const isHQ = ['admin', 'general_manager', 'it_support'].includes(user.role);
    
    if (!isHQ) {
      list = list.filter(inv => inv.branchId === user.branchId);
    }
    
    if (search.trim()) {
      list = list.filter(inv => 
        inv.id.toLowerCase().includes(search.toLowerCase()) || 
        inv.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        inv.customerPhone?.includes(search)
      );
    }
    
    if (sortConfig) {
      list.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [invoices, search, sortConfig, user.role, user.branchId, activeTab, formattedSelectedDate, selectedDate]);

  const handlePrintOrDownload = async (action: 'print' | 'download', inv: Invoice) => {
    if (!selectedInvoice || selectedInvoice.id !== inv.id) {
       setSelectedInvoice(inv);
       setTimeout(() => captureAndProcess(action), 500);
    } else {
       captureAndProcess(action);
    }
  };

  const captureAndProcess = async (action: 'print' | 'download') => {
     if (!invoiceRef.current) return;
     try {
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      if (action === 'download') {
        pdf.save(`Invoice_${selectedInvoice?.id.slice(-6)}.pdf`);
        onShowToast?.("تم تنزيل الفاتورة بنجاح", "success");
      } else {
        pdf.autoPrint();
        window.open(pdf.output('bloburl'), '_blank');
      }
    } catch (err) {
      onShowToast?.("حدث خطأ أثناء المعالجة", "error");
    }
  };

  const handleWhatsAppShare = (inv: Invoice) => {
    if (!inv.customerPhone) return onShowToast?.("لا يوجد رقم مسجل للعميل", "error");
    const itemsList = inv.items.map(it => `🔹 ${it.name} (x${it.quantity})`).join('\n');
    const msg = `🧾 *فاتورة مبيعات رقم: ${inv.id.slice(-6)}*\n\n👤 *العميل:* ${inv.customerName || 'نقدي'}\n📅 *التاريخ:* ${inv.date} ${inv.time}\n📍 *الفرع:* ${branches.find(b=>b.id===inv.branchId)?.name || 'الرئيسي'}\n\n🛍️ *الأصناف:*\n${itemsList}\n\n------------------------\n💰 *الإجمالي:* ${inv.totalBeforeDiscount} ج.م\n📉 *الخصم:* ${inv.discountValue} ج.م\n✨ *الصافي:* *${inv.netTotal} ج.م*\n------------------------\n🙏 شكراً لتعاملكم معنا! ✨`;
    window.open(`https://wa.me/${inv.customerPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] select-text" dir="rtl">
      
      {/* Time Segmentation & Search */}
      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 md:gap-6">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl flex-1 w-full xl:max-w-md overflow-x-auto">
          {['daily', 'monthly', 'yearly'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab as any); setSelectedDate(new Date()); }} className={`flex-1 min-w-[80px] px-2 md:px-8 py-2 md:py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}>
              {tab === 'daily' ? 'يومي' : tab === 'monthly' ? 'شهري' : 'سنوي'}
            </button>
          ))}
        </div>
        
        <div className="flex items-center justify-between lg:justify-center gap-4 bg-slate-50 px-4 md:px-5 py-2 md:py-2.5 rounded-xl border border-slate-100 flex-1">
           <button onClick={() => changePeriod(-1)} className="p-1 hover:bg-white rounded-lg text-indigo-600 transition-colors"><ChevronRight size={20}/></button>
           <span className="text-[11px] md:text-xs font-black text-slate-700 min-w-[100px] md:min-w-[120px] text-center truncate">{dateDisplayLabel}</span>
           <button onClick={() => changePeriod(1)} className="p-1 hover:bg-white rounded-lg text-indigo-600 transition-colors"><ChevronLeft size={20}/></button>
        </div>

        <div className="relative flex-1 w-full xl:max-w-md">
           <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
           <input type="text" placeholder="ابحث في فواتير الفترة..." className="w-full pr-14 pl-4 py-3.5 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm shadow-inner" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[10px] min-w-[1200px]">
            <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[8px] border-b">
              <tr>
                <th className="px-6 py-5">رقم السند</th>
                <th className="px-6 py-5">العميل</th>
                <th className="px-6 py-5">ملخص الأصناف</th>
                <th className="px-6 py-5 text-center">الإجمالي قبل</th>
                <th className="px-6 py-5 text-center">الخصم (%)</th>
                <th className="px-6 py-5 text-center font-black">الصافي النهائي</th>
                <th className="px-6 py-5 text-left">إدارة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              {filtered.map(inv => {
                const discountPct = inv.totalBeforeDiscount > 0 ? ((inv.discountValue / inv.totalBeforeDiscount) * 100).toFixed(1) : "0";
                const summary = inv.items.map(it => `${it.name} (x${it.quantity})`).join('، ');
                const hasReturn = returns.some(r => r.invoiceId === inv.id); // Check for returns
                
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 py-4 font-black text-indigo-600 cursor-pointer hover:underline" onClick={() => copyToClipboard(inv.id, onShowToast)}>
                      #{inv.id.slice(-6)}
                      {hasReturn && <span className="mr-2 inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[8px] border border-orange-200"><RotateCcw size={8}/> مرتجع</span>}
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2 text-slate-800">
                          {inv.customerName || 'عميل نقدي'}
                       </div>
                       <p className="text-[8px] text-slate-400 mt-1">{inv.customerPhone || '---'}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-400 max-w-xs truncate" title={summary}>{summary}</td>
                    <td className="px-6 py-4 text-center text-slate-500">{(inv.totalBeforeDiscount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-center"><span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[8px] font-black border border-amber-100">%{discountPct}</span></td>
                    <td className="px-6 py-4 text-center font-black text-emerald-600 text-xs">{(inv.netTotal || 0).toLocaleString()} {settings.currency}</td>
                    <td className="px-6 py-4 text-left">
                       <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => handleWhatsAppShare(inv)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"><Share2 size={14} /></button>
                          <button onClick={() => setSelectedInvoice(inv)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><Eye size={14} /></button>
                          {canDelete && (
                            <button onClick={() => setConfirmDelete({id: inv.id, reason: ''})} className="p-2 bg-rose-50 text-rose-400 rounded-lg hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={14} /></button>
                          )}
                       </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-20 text-center text-slate-300 italic">لا توجد فواتير مؤرشفة في هذه الفترة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
              <div className="p-5 bg-slate-800 text-white flex justify-between items-center shrink-0">
                 <h3 className="font-black text-sm flex items-center gap-2"><Receipt size={18}/> تفاصيل الفاتورة</h3>
                 <button onClick={() => setSelectedInvoice(null)}><X size={20}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
                 {/* Enforced Cairo Font for PDF Generation via inline styles */}
                 <div ref={invoiceRef} className="bg-white p-8 shadow-sm border border-slate-200 text-center space-y-6 invoice-paper" style={{ direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}>
                    <div className="border-b border-slate-100 pb-6 space-y-2">
                       <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl mx-auto shadow-lg mb-2">M</div>
                       <h2 className="text-xl font-black text-slate-800" style={{ fontFamily: 'Cairo, sans-serif' }}>{settings.appName}</h2>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest" style={{ fontFamily: 'Cairo, sans-serif' }}>فرع: {branches.find(b=>b.id===selectedInvoice.branchId)?.name || 'الرئيسي'}</p>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 border-b border-slate-100 pb-4">
                       <div className="text-right space-y-1">
                          <p>رقم الفاتورة: #{selectedInvoice.id.slice(-6)}</p>
                          <p>التاريخ: {selectedInvoice.date}</p>
                          <p>الوقت: {selectedInvoice.time}</p>
                       </div>
                       <div className="text-left space-y-1">
                          <p>العميل: {selectedInvoice.customerName || 'نقدي'}</p>
                          <p>الهاتف: {selectedInvoice.customerPhone || '---'}</p>
                          <p>البائع: {selectedInvoice.creatorUsername || 'System'}</p>
                       </div>
                    </div>
                    <table className="w-full text-[10px] font-bold">
                       <thead className="border-b border-slate-100 text-slate-400">
                          <tr><th className="pb-2 text-right">الصنف</th><th className="pb-2 text-center">الكمية</th><th className="pb-2 text-left">السعر</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {selectedInvoice.items.map((item, idx) => (
                             <tr key={idx}>
                                <td className="py-2 text-right text-slate-800">{item.name}</td>
                                <td className="py-2 text-center text-slate-500">{item.quantity}</td>
                                <td className="py-2 text-left text-slate-800">{(item.subtotal || 0).toLocaleString()}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                    <div className="border-t border-slate-100 pt-4 space-y-2">
                       <div className="flex justify-between text-xs font-bold text-slate-500"><span>المجموع</span><span>{(selectedInvoice.totalBeforeDiscount || 0).toLocaleString()}</span></div>
                       <div className="flex justify-between text-xs font-bold text-rose-500"><span>الخصم</span><span>-{(selectedInvoice.discountValue || 0).toLocaleString()}</span></div>
                       <div className="flex justify-between text-lg font-black text-slate-900 border-t border-dashed border-slate-200 pt-2"><span>الصافي</span><span>{(selectedInvoice.netTotal || 0).toLocaleString()} {settings.currency}</span></div>
                    </div>
                    {selectedInvoice.notes && <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-[9px] font-bold text-amber-800 text-right">ملاحظات: {selectedInvoice.notes}</div>}
                    <p className="text-[8px] text-slate-300 font-bold uppercase pt-4">شكراً لثقتكم بنا</p>
                 </div>
              </div>

              <div className="p-5 bg-white border-t border-slate-200 flex gap-4 shrink-0">
                 <button onClick={() => captureAndProcess('print')} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2"><Printer size={16}/> طباعة</button>
                 <button onClick={() => captureAndProcess('download')} className="flex-1 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-black text-xs hover:border-indigo-600 hover:text-indigo-600 flex items-center justify-center gap-2 transition-all"><DownloadCloud size={16}/> تنزيل PDF</button>
              </div>
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal - maintained */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden p-8 text-center space-y-6 animate-in zoom-in border border-rose-100">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2.2rem] flex items-center justify-center mx-auto shadow-inner mb-2"><Trash2 size={40}/></div>
              <div><h3 className="text-xl font-black text-slate-800 mb-1">إلغاء الفاتورة؟</h3><p className="text-[10px] text-slate-400 font-bold uppercase">سيتم أرشفة الفاتورة وإعادة الكميات للمخزن.</p></div>
              <textarea className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-bold outline-none resize-none h-24" placeholder="سبب الإلغاء (إلزامي)..." value={confirmDelete.reason} onChange={e=>setConfirmDelete({...confirmDelete, reason:e.target.value})} />
              <div className="flex gap-3 pt-2">
                 <button onClick={()=>setConfirmDelete(null)} className="flex-1 py-4 bg-slate-50 rounded-xl text-xs font-black text-slate-500">تراجع</button>
                 <button onClick={async () => { await onDeleteInvoice(confirmDelete.id, confirmDelete.reason, user); setConfirmDelete(null); onShowToast?.("تم الإلغاء بنجاح", "success"); }} disabled={!confirmDelete.reason} className="flex-[1.5] py-4 bg-rose-600 text-white rounded-xl text-xs font-black shadow-xl hover:bg-rose-700 disabled:opacity-50">تأكيد الإلغاء</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Archive;
