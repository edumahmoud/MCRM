
import React, { useState, useMemo } from 'react';
import { 
  RotateCcw, Search, Calendar, User, Package, Hash, 
  ArrowLeft, X, CheckCircle2, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Invoice, ReturnRecord, User as UserType, ReturnItem } from '../types';
import { supabase } from '../supabaseClient';

interface ReturnsProps {
  invoices: Invoice[];
  returns: ReturnRecord[];
  onAddReturn: (record: ReturnRecord) => Promise<void>;
  onDeleteReturn: (id: string) => void;
  onRestockItem: (id: string, qty: number) => Promise<void>;
  onShowToast: (message: string, type: 'success' | 'error') => void;
  user: UserType;
  canReturn: boolean;
}

const Returns: React.FC<ReturnsProps> = ({ 
  invoices, returns, onAddReturn, onDeleteReturn, onRestockItem, onShowToast, user, canReturn 
}) => {
  const [invoiceId, setInvoiceId] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [returnItems, setReturnItems] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSearch = () => {
    const inv = invoices.find(i => !i.isDeleted && (i.id === invoiceId || i.id.slice(-6) === invoiceId));
    if (inv) {
      setSelectedInvoice(inv);
      const initialQtys: Record<string, number> = {};
      inv.items.forEach(item => initialQtys[item.productId] = 0);
      setReturnItems(initialQtys);
    } else {
      onShowToast("الفاتورة غير موجودة أو ملغاة", "error");
    }
  };

  const updateReturnQty = (productId: string, qty: number) => {
    const originalItem = selectedInvoice?.items.find(i => i.productId === productId);
    if (!originalItem) return;
    
    setReturnItems(prev => ({
      ...prev,
      [productId]: Math.min(originalItem.quantity, Math.max(0, qty))
    }));
  };

  const processReturn = async () => {
    if (!selectedInvoice) return;
    if (!canReturn) return onShowToast("لا تملك صلاحية تنفيذ المرتجعات", "error");
    
    // Fix: Cast Object.entries to [string, number][] to resolve 'unknown' qty type error
    const items: ReturnItem[] = (Object.entries(returnItems) as [string, number][])
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const invItem = selectedInvoice.items.find(i => i.productId === productId)!;
        return { 
          productId, 
          name: invItem.name, 
          quantity: qty, 
          refundAmount: qty * invItem.unitPrice, 
          wholesalePriceAtSale: invItem.wholesalePriceAtSale 
        };
      });

    if (items.length === 0) return onShowToast('حدد كمية صنف واحد على الأقل للمرتجع', "error");
    
    setIsProcessing(true);
    try {
      // تنفيذ المرتجع كـ Transaction عبر RPC لضمان تماسك البيانات
      const { error } = await supabase.rpc('process_return_transaction', {
        p_id: crypto.randomUUID(),
        p_invoice_id: selectedInvoice.id,
        p_items: items,
        p_total_refund: items.reduce((a, b) => a + b.refundAmount, 0),
        p_created_by: user.id,
        p_branch_id: user.branchId,
        p_timestamp: Date.now()
      });

      if (error) throw error;

      onShowToast("تم تسجيل المرتجع وتحديث المخزون بنجاح", "success");
      setSelectedInvoice(null); 
      setInvoiceId('');
      setReturnItems({});
    } catch (err) {
      console.error(err);
      onShowToast("فشل معالجة المرتجع الموحد", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12" dir="rtl">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4 w-full md:w-auto flex-1">
          <div className="relative w-full">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="ابحث برقم السند للإرجاع..." 
              className="w-full pr-12 pl-4 py-3 bg-slate-50 border-none rounded-2xl outline-none font-bold text-sm"
              value={invoiceId}
              onChange={e => setInvoiceId(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button onClick={handleSearch} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shrink-0 shadow-lg">بحث</button>
        </div>
      </div>

      {selectedInvoice ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-6 bg-slate-50 border-b font-black text-sm flex items-center justify-between text-slate-800">
                  <span>الأصناف المتاحة للإرجاع</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">#{selectedInvoice.id.slice(-6)}</span>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50/50 text-slate-400 uppercase text-[9px] border-b">
                      <tr>
                        <th className="px-8 py-4">الصنف</th>
                        <th className="px-8 py-4 text-center">الكمية المباعة</th>
                        <th className="px-8 py-4 text-center">كمية المرتجع</th>
                        <th className="px-8 py-4 text-left">قيمة الرد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold">
                      {selectedInvoice.items.map(item => (
                        <tr key={item.productId} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-8 py-4">{item.name}</td>
                          <td className="px-8 py-4 text-center text-slate-400">{item.quantity}</td>
                          <td className="px-8 py-4">
                            <div className="flex justify-center items-center gap-3">
                              <input 
                                type="number" 
                                className="w-16 p-2 bg-white border border-slate-200 rounded-lg text-center font-black text-xs"
                                value={returnItems[item.productId] || 0}
                                onChange={e => updateReturnQty(item.productId, Number(e.target.value))}
                              />
                            </div>
                          </td>
                          <td className="px-8 py-4 text-left text-rose-600">{(returnItems[item.productId] || 0) * item.unitPrice} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
               <div className="flex items-center gap-3 border-b pb-4"><Calendar className="text-indigo-600" size={20}/><h4 className="font-black text-sm text-slate-800">ملخص المرتجع</h4></div>
               <div className="space-y-4 text-xs font-bold">
                  <div className="flex justify-between text-slate-400"><span>تاريخ الفاتورة:</span><span>{selectedInvoice.date}</span></div>
                  <div className="flex justify-between text-slate-400"><span>العميل:</span><span>{selectedInvoice.customerName || 'نقدي'}</span></div>
                  <div className="pt-4 border-t border-slate-50 flex justify-between text-lg font-black text-rose-600">
                     <span>إجمالي الرد:</span>
                     {/* Fix: Explicitly cast Object.entries to [string, number][] to fix 'unknown' qty inference in arithmetic operations */}
                     <span>{(Object.entries(returnItems) as [string, number][]).reduce((acc, [pid, qty]) => {
                        const item = selectedInvoice.items.find(i => i.productId === pid);
                        return acc + (qty * (item?.unitPrice || 0));
                     }, 0).toLocaleString()} ج.م</span>
                  </div>
               </div>
               <button 
                onClick={processReturn}
                disabled={isProcessing}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-3 hover:bg-rose-700 transition-all disabled:opacity-50"
               >
                  {isProcessing ? <RefreshCw className="animate-spin" size={20}/> : <RotateCcw size={20}/>} تنفيذ عملية الإرجاع
               </button>
               <button onClick={() => setSelectedInvoice(null)} className="w-full py-3 bg-white border border-slate-200 text-slate-400 rounded-xl font-black text-xs">إلغاء</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
           <table className="w-full text-right text-[11px] font-bold">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                 <tr><th className="px-8 py-5">رقم المرتجع</th><th className="px-8 py-5">رقم الفاتورة الأصلية</th><th className="px-8 py-5 text-center">المبلغ المسترد</th><th className="px-8 py-5 text-left">التوقيت</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {returns.map(r => (
                   <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-8 py-4 text-rose-600 font-black">#{r.id.slice(-6)}</td>
                      <td className="px-8 py-4 text-indigo-600">#{r.invoiceId.slice(-6)}</td>
                      <td className="px-8 py-4 text-center font-black">{r.totalRefund.toLocaleString()} ج.م</td>
                      <td className="px-8 py-4 text-left text-slate-400">{r.time}</td>
                   </tr>
                 ))}
                 {returns.length === 0 && (
                   <tr><td colSpan={4} className="py-20 text-center opacity-20 italic">لا يوجد سجلات مرتجعات حالياً</td></tr>
                 )}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
};

export default Returns;
