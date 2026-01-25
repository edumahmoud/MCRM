
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, CheckCircle2, RefreshCw, X, 
  ReceiptText, DollarSign, Percent, History, UserCircle, Smartphone, 
  FileText, StickyNote, Printer, Camera, Package, Wallet, Banknote, ShoppingBag, DownloadCloud, Share2, Star, UserCheck
} from 'lucide-react';
import { Product, Invoice, User as UserType, Shift, SystemSettings, SaleItem, Branch } from '../types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Html5Qrcode } from 'html5-qrcode';
import { copyToClipboard } from './Layout';

interface SalesProps {
  products: Product[];
  invoices: Invoice[];
  activeShift: Shift | null;
  branches: Branch[];
  onOpenShift: (balance: number) => Promise<void>;
  onCloseShift: (balance: number, notes: string) => Promise<void>;
  onSaveInvoice: (invoice: Invoice) => Promise<void>;
  onDeductStock: (id: string, qty: number) => Promise<void>;
  onShowToast: (message: string, type: 'success' | 'error') => void;
  user: UserType;
  settings: SystemSettings;
  canSell: boolean;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
}

const Sales: React.FC<SalesProps> = ({ 
  products, invoices, activeShift, branches, onOpenShift, onCloseShift, onSaveInvoice, onDeductStock, onShowToast, user, settings, canSell, askConfirmation
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const isAdmin = ['admin', 'it_support', 'general_manager'].includes(user.role);

  // إحصائيات الوردية الحالية
  const shiftStats = useMemo(() => {
    if (!activeShift) return { totalSales: 0, count: 0, drawer: 0 };
    
    // الفواتير الخاصة بهذه الوردية فقط
    const shiftInvoices = invoices.filter(inv => 
      inv.shiftId === activeShift.id && !inv.isDeleted
    );

    const totalSales = shiftInvoices.reduce((acc, inv) => acc + (inv.netTotal || 0), 0);
    const count = shiftInvoices.length;
    const drawer = (activeShift.openingBalance || 0) + totalSales;

    return { totalSales, count, drawer };
  }, [invoices, activeShift]);

  // فواتير الوردية الحالية للجدول
  const currentShiftInvoices = useMemo(() => {
    if (!activeShift) return [];
    return invoices
      .filter(inv => inv.shiftId === activeShift.id && !inv.isDeleted)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [invoices, activeShift]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    return products.filter(p => {
      if (p.isDeleted) return false;
      const matchesBranch = isAdmin ? true : (p.branchId === user.branchId);
      const matchesSearch = p.name.toLowerCase().includes(term) || p.code.includes(term);
      return matchesBranch && matchesSearch;
    }).slice(0, 20); // زيادة عدد النتائج المعروضة
  }, [products, searchTerm, user.branchId, isAdmin]);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isScannerOpen) {
      scannerRef.current = new Html5Qrcode("reader");
      scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleBarcodeScanned(decodedText);
          stopScanner();
        },
        () => {}
      );
    }
    return () => { stopScanner(); };
  }, [isScannerOpen]);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null;
        setIsScannerOpen(false);
      }).catch(err => console.error(err));
    }
  };

  const handleBarcodeScanned = (code: string) => {
    const product = products.find(p => {
      const matchesBranch = isAdmin ? true : (p.branchId === user.branchId);
      return p.code === code && !p.isDeleted && matchesBranch;
    });

    if (product) {
      addToCart(product);
      onShowToast(`تمت إضافة: ${product.name}`, "success");
      setSearchTerm('');
    } else {
      onShowToast("المنتج غير موجود في هذا الفرع", "error");
    }
  };

  const addToCart = (product: Product) => {
    if (!canSell) return onShowToast("لا تملك صلاحية البيع", "error");
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      const currentQty = existing ? existing.quantity : 0;

      if (currentQty + 1 > product.stock) {
        onShowToast(`عفواً، الكمية المتاحة هي ${product.stock} فقط`, "error");
        return prev;
      }

      if (existing) {
        return prev.map(item => item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice }
          : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.retailPrice,
        subtotal: product.retailPrice,
        wholesalePriceAtSale: product.wholesalePrice
      }];
    });
    setSearchTerm('');
    setShowSearchResults(false);
    searchInputRef.current?.focus();
  };

  const updateCartQty = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty > product.stock) {
           onShowToast(`الرصيد المتاح ${product.stock} فقط`, "error");
           return item;
        }
        return { ...item, quantity: newQty, subtotal: newQty * item.unitPrice };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const totalBeforeDiscount = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const calculatedDiscount = discountType === 'percentage' 
    ? (totalBeforeDiscount * (discountValue / 100)) 
    : discountValue;
  const netTotal = Math.max(0, totalBeforeDiscount - calculatedDiscount);

  const handleCheckout = async () => {
    if (!activeShift) return onShowToast("يرجى فتح وردية للبدء", "error");
    if (cart.length === 0) return onShowToast("السلة فارغة", "error");

    setIsCheckoutLoading(true);
    const now = new Date();
    
    const invoice: Invoice = {
      id: crypto.randomUUID(),
      items: cart,
      totalBeforeDiscount,
      discountValue: calculatedDiscount,
      discountType: discountType,
      netTotal,
      date: now.toLocaleDateString('ar-EG'),
      time: now.toLocaleTimeString('ar-EG'),
      timestamp: now.getTime(),
      customerName: customerName || 'عميل نقدي',
      customerPhone: customerPhone || '',
      notes: invoiceNotes,
      status: 'completed',
      createdBy: user.id,
      creatorUsername: user.username,
      branchId: user.branchId, 
      shiftId: activeShift.id
    };

    try {
      await onSaveInvoice(invoice);
      onShowToast("تم إتمام المبيعات بنجاح", "success");
      setCart([]);
      setDiscountValue(0);
      setCustomerName('');
      setCustomerPhone('');
      setInvoiceNotes('');
      setSearchTerm('');
      searchInputRef.current?.focus();
    } catch (error: any) {
      onShowToast(error.message || "خطأ في معالجة الطلب", "error");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleWhatsApp = (inv: Invoice) => {
    if (!inv.customerPhone) return onShowToast("لا يوجد رقم مسجل للعميل", "error");
    const itemsList = inv.items.map(it => `🔹 ${it.name} (${it.quantity}x)`).join('\n');
    const msg = `مرحباً ${inv.customerName}،\nشكراً لتسوقك معنا!\n\n🧾 فاتورة رقم: #${inv.id.slice(-6)}\n📅 التاريخ: ${inv.date}\n\n🛍️ المشتريات:\n${itemsList}\n\n💰 الإجمالي: ${inv.netTotal} ج.م`;
    window.open(`https://wa.me/${inv.customerPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Improved PDF Generation using html2canvas for full Arabic/CSS support
  const handlePrintOrDownload = async (action: 'print' | 'download') => {
    if (!invoiceRef.current || !previewInvoice) return;

    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2, // Higher resolution
        backgroundColor: '#ffffff',
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      if (action === 'download') {
        pdf.save(`Invoice_${previewInvoice.id.slice(-6)}.pdf`);
        onShowToast("تم تنزيل الفاتورة بنجاح", "success");
      } else {
        pdf.autoPrint();
        window.open(pdf.output('bloburl'), '_blank');
      }
    } catch (err) {
      console.error(err);
      onShowToast("حدث خطأ أثناء تصدير الفاتورة", "error");
    }
  };

  // Determine Customer Status (New/Returning/VIP) based on previous invoices
  const customerHistoryCount = useMemo(() => {
    if (!customerPhone) return 0;
    return invoices.filter(inv => inv.customerPhone === customerPhone && !inv.isDeleted).length;
  }, [invoices, customerPhone]);

  if (!activeShift) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in">
        <div className="p-12 bg-white rounded-[3.5rem] shadow-2xl text-center space-y-6 max-w-md border border-slate-100">
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><ShoppingCart size={48} className="animate-bounce"/></div>
          <h3 className="text-2xl font-black text-slate-800">نقطة البيع مغلقة</h3>
          <p className="text-sm text-slate-400 font-bold leading-relaxed">لبدء العمليات، يجب فتح وردية جديدة في الفرع.</p>
          <button onClick={() => onOpenShift(0)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">فتح وردية مبيعات</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4 font-['Cairo']" dir="rtl">
      
      {/* 1. Stats Row (Fixed Top) */}
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Banknote size={20}/></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase">مبيعات الوردية</p><h4 className="text-lg font-black text-slate-800">{(shiftStats.totalSales || 0).toLocaleString()}</h4></div>
         </div>
         <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><ReceiptText size={20}/></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase">عدد الفواتير</p><h4 className="text-lg font-black text-slate-800">{shiftStats.count}</h4></div>
         </div>
         <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Wallet size={20}/></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase">الدرج (متوقع)</p><h4 className="text-lg font-black text-slate-800">{(shiftStats.drawer || 0).toLocaleString()}</h4></div>
         </div>
      </div>

      {/* 2. Middle Section (Cart Left | Search Right) */}
      <div className="flex-1 flex flex-col xl:flex-row gap-4 min-h-0">
         
         {/* Cart (Left) - Resized to be wider as requested (w-[40%] on large screens) */}
         <div className="w-full xl:w-[40%] flex flex-col bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden order-2 xl:order-1">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-2">
                  <div className="bg-indigo-600 text-white p-1.5 rounded-lg"><ShoppingCart size={16}/></div>
                  <div><h3 className="font-black text-slate-800 text-xs">سلة المشتريات ({cart.length})</h3></div>
               </div>
               <button onClick={() => setCart([])} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide bg-slate-50/30">
               {cart.map(item => (
                 <div key={item.productId} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="flex-1 min-w-0">
                       <h5 className="text-[11px] font-black text-slate-800 truncate">{item.name}</h5>
                       <p className="text-[9px] font-bold text-slate-400">{(item.unitPrice || 0).toLocaleString()} ج.م</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="flex items-center bg-slate-100 rounded-lg">
                          <button onClick={() => updateCartQty(item.productId, -1)} className="p-2 hover:bg-white rounded-md"><Minus size={12}/></button>
                          <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.productId, 1)} className="p-2 hover:bg-white rounded-md"><Plus size={12}/></button>
                       </div>
                       <span className="text-[11px] font-black text-indigo-600 min-w-[60px] text-left">{(item.subtotal || 0).toLocaleString()}</span>
                    </div>
                 </div>
               ))}
               {cart.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50">
                     <ShoppingBag size={48} className="mb-2 stroke-1"/>
                     <p className="text-[10px] font-black">السلة فارغة</p>
                  </div>
               )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 space-y-3 shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
               <div className="flex gap-2">
                  <div className="flex-1 relative">
                     <DollarSign size={12} className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400"/>
                     <input type="number" className="w-full pl-2 pr-6 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-500" placeholder="قيمة الخصم" value={discountValue || ''} onChange={e => setDiscountValue(Number(e.target.value))}/>
                  </div>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg">
                     <button onClick={()=>setDiscountType('fixed')} className={`px-2 py-1 rounded-md transition-all ${discountType==='fixed' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><DollarSign size={12}/></button>
                     <button onClick={()=>setDiscountType('percentage')} className={`px-2 py-1 rounded-md transition-all ${discountType==='percentage' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><Percent size={12}/></button>
                  </div>
               </div>
               <div className="space-y-1 pt-2 border-t border-dashed">
                  <div className="flex justify-between items-end">
                     <span className="text-xs font-black text-slate-800">الإجمالي النهائي</span>
                     <span className="text-2xl font-black text-indigo-600">{netTotal.toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span></span>
                  </div>
               </div>
               <button onClick={handleCheckout} disabled={isCheckoutLoading || cart.length === 0} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {isCheckoutLoading ? <RefreshCw className="animate-spin" size={14}/> : <CheckCircle2 size={14}/>} إتمام العملية
               </button>
            </div>
         </div>

         {/* Search & Product Selection (Right) - Adjusted width and layout */}
         <div className="w-full xl:w-[60%] flex flex-col gap-4 order-1 xl:order-2 min-h-0">
            {/* Search Bar & Customer Info */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm shrink-0 space-y-4">
               <div className="flex gap-3">
                  <div className="relative flex-1" ref={searchContainerRef}>
                     <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                     <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="ابحث باسم المنتج أو الباركود..." 
                        className="w-full pr-12 pl-4 py-4 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-600 border-2 rounded-2xl outline-none font-bold text-sm transition-all"
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setShowSearchResults(true); }}
                        onFocus={() => setShowSearchResults(true)}
                     />
                     {showSearchResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-80 overflow-y-auto z-[100] divide-y">
                           {searchResults.map(p => (
                              <div key={p.id} onClick={() => addToCart(p)} className="flex items-center justify-between p-4 hover:bg-indigo-50 cursor-pointer transition-colors group">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Package size={18}/></div>
                                    <div><h5 className="text-sm font-black text-slate-800">{p.name}</h5><p className="text-[10px] text-slate-400 font-mono">#{p.code}</p></div>
                                 </div>
                                 <div className="text-left"><p className="text-sm font-black text-indigo-600">{p.retailPrice} ج.م</p><p className={`text-[9px] font-bold ${p.stock <= p.lowStockThreshold ? 'text-rose-500' : 'text-emerald-600'}`}>متاح: {p.stock}</p></div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
                  <button onClick={() => setIsScannerOpen(true)} className="px-5 bg-slate-800 text-white rounded-2xl flex items-center justify-center hover:bg-black transition-all"><Camera size={20}/></button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative"><UserCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="text" placeholder="اسم العميل" className="w-full pr-9 pl-2 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500" value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
                  <div className="relative">
                     <Smartphone size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                     <input type="text" placeholder="رقم الهاتف" className="w-full pr-9 pl-2 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                     {customerPhone.length >= 8 && (
                       <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {customerHistoryCount >= 2 ? (
                             <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-[8px] font-black border border-amber-200 animate-pulse"><Star size={8} fill="currentColor"/> عميل مميز</span>
                          ) : customerHistoryCount >= 1 ? (
                             <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-[8px] font-black border border-indigo-200"><UserCheck size={8}/> عميل متردد</span>
                          ) : null}
                       </div>
                     )}
                  </div>
                  <div className="relative"><StickyNote size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="text" placeholder="ملاحظات" className="w-full pr-9 pl-2 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500" value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} /></div>
               </div>
            </div>

            {/* Empty State / Quick Instructions - Product Cards Removed as requested */}
            {searchResults.length === 0 && !searchTerm && (
                <div className="flex-1 bg-slate-50 rounded-[2rem] border border-slate-100 p-8 flex flex-col items-center justify-center text-center opacity-50 min-h-0">
                   <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm"><Search size={32} className="text-slate-300"/></div>
                   <h3 className="text-lg font-black text-slate-400">ابدأ البحث</h3>
                   <p className="text-xs font-bold text-slate-300 mt-2">ابحث عن المنتجات بالاسم أو الباركود لإضافتها للسلة</p>
                </div>
            )}
         </div>
      </div>

      {/* 3. Bottom Section (Table) - Full Width with Additional Columns */}
      <div className="h-1/3 shrink-0 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
         <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
            <h4 className="font-black text-xs text-slate-800 flex items-center gap-2">
              <History size={14} className="text-emerald-600"/> مبيعات الوردية الحالية
            </h4>
         </div>
         <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-right text-[10px] font-bold">
               <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b sticky top-0 z-10">
                  <tr>
                     <th className="px-6 py-3">رقم الفاتورة</th>
                     <th className="px-6 py-3 text-center">الوقت</th>
                     <th className="px-6 py-3">العميل</th>
                     <th className="px-6 py-3 text-center">الإجمالي</th>
                     <th className="px-6 py-3 text-center">الخصم</th>
                     <th className="px-6 py-3 text-center">نسبة الخصم</th>
                     <th className="px-6 py-3 text-center">الصافي</th>
                     <th className="px-6 py-3 text-left">إجراءات</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {currentShiftInvoices.map(inv => {
                     const total = inv.totalBeforeDiscount || 0;
                     const discount = inv.discountValue || 0;
                     const net = inv.netTotal || 0;
                     const discountPct = total > 0 ? ((discount / total) * 100).toFixed(1) : '0';

                     return (
                     <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 text-indigo-600 font-mono cursor-pointer hover:underline" onClick={() => copyToClipboard(inv.id, onShowToast)}>#{inv.id.slice(-6)}</td>
                        <td className="px-6 py-3 text-center text-slate-400">{inv.time}</td>
                        <td className="px-6 py-3 text-slate-800">{inv.customerName || 'عميل نقدي'}</td>
                        <td className="px-6 py-3 text-center">{total.toLocaleString()}</td>
                        <td className="px-6 py-3 text-center text-rose-500">{discount.toLocaleString()}</td>
                        <td className="px-6 py-3 text-center text-amber-600">%{discountPct}</td>
                        <td className="px-6 py-3 text-center text-emerald-600 font-black text-xs">{net.toLocaleString()}</td>
                        <td className="px-6 py-3 text-left">
                           <div className="flex gap-2 justify-end">
                              <button onClick={() => handleWhatsApp(inv)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm" title="واتساب"><Share2 size={12}/></button>
                              <button 
                                 onClick={() => setPreviewInvoice(inv)}
                                 className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-1 text-[9px]"
                              >
                                 <FileText size={10}/> معاينة
                              </button>
                           </div>
                        </td>
                     </tr>
                  )})}
               </tbody>
            </table>
         </div>
      </div>

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
              <div className="p-5 bg-slate-800 text-white flex justify-between items-center shrink-0">
                 <h3 className="font-black text-sm flex items-center gap-2"><ReceiptText size={18}/> معاينة الفاتورة</h3>
                 <button onClick={() => setPreviewInvoice(null)}><X size={20}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
                 {/* This ref is used for html2canvas to capture the invoice as an image. Cairo font is enforced here via inline style. */}
                 <div ref={invoiceRef} className="bg-white p-8 shadow-sm border border-slate-200 text-center space-y-6 invoice-paper" style={{ direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}>
                    {/* Header */}
                    <div className="border-b border-slate-100 pb-6 space-y-2">
                       <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl mx-auto shadow-lg mb-2">M</div>
                       <h2 className="text-xl font-black text-slate-800" style={{ fontFamily: 'Cairo, sans-serif' }}>{settings.appName}</h2>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest" style={{ fontFamily: 'Cairo, sans-serif' }}>فرع: {branches.find(b=>b.id===previewInvoice.branchId)?.name || 'الرئيسي'}</p>
                    </div>

                    {/* Meta */}
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 border-b border-slate-100 pb-4">
                       <div className="text-right space-y-1">
                          <p><span className="text-slate-300">رقم الفاتورة:</span> #{previewInvoice.id.slice(-6)}</p>
                          <p><span className="text-slate-300">التاريخ:</span> {previewInvoice.date}</p>
                          <p><span className="text-slate-300">الوقت:</span> {previewInvoice.time}</p>
                       </div>
                       <div className="text-left space-y-1">
                          <p><span className="text-slate-300">العميل:</span> {previewInvoice.customerName || 'نقدي'}</p>
                          <p><span className="text-slate-300">الهاتف:</span> {previewInvoice.customerPhone || '---'}</p>
                          <p><span className="text-slate-300">البائع:</span> {previewInvoice.creatorUsername || 'System'}</p>
                       </div>
                    </div>

                    {/* Items */}
                    <table className="w-full text-[10px] font-bold">
                       <thead className="border-b border-slate-100 text-slate-400">
                          <tr><th className="pb-2 text-right">الصنف</th><th className="pb-2 text-center">الكمية</th><th className="pb-2 text-left">السعر</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {previewInvoice.items.map((item, idx) => (
                             <tr key={idx}>
                                <td className="py-2 text-right text-slate-800">{item.name}</td>
                                <td className="py-2 text-center text-slate-500">{item.quantity}</td>
                                <td className="py-2 text-left text-slate-800">{(item.subtotal || 0).toLocaleString()}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>

                    {/* Totals */}
                    <div className="border-t border-slate-100 pt-4 space-y-2">
                       <div className="flex justify-between text-xs font-bold text-slate-500"><span>المجموع</span><span>{(previewInvoice.totalBeforeDiscount || 0).toLocaleString()}</span></div>
                       <div className="flex justify-between text-xs font-bold text-rose-500"><span>الخصم</span><span>-{(previewInvoice.discountValue || 0).toLocaleString()}</span></div>
                       <div className="flex justify-between text-lg font-black text-slate-900 border-t border-dashed border-slate-200 pt-2"><span>الصافي</span><span>{(previewInvoice.netTotal || 0).toLocaleString()} {settings.currency}</span></div>
                    </div>

                    {/* Notes */}
                    {previewInvoice.notes && (
                       <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-[9px] font-bold text-amber-800 text-right">
                          ملاحظات: {previewInvoice.notes}
                       </div>
                    )}
                    
                    <p className="text-[8px] text-slate-300 font-bold uppercase pt-4">شكراً لثقتكم بنا</p>
                 </div>
              </div>

              <div className="p-5 bg-white border-t border-slate-200 flex gap-4 shrink-0">
                 <button onClick={() => handlePrintOrDownload('print')} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
                    <Printer size={16}/> طباعة الفاتورة
                 </button>
                 <button onClick={() => handlePrintOrDownload('download')} className="flex-1 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-black text-xs hover:border-indigo-600 hover:text-indigo-600 flex items-center justify-center gap-2 transition-all">
                    <DownloadCloud size={16}/> تنزيل PDF
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
