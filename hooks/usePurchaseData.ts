
import { useState, useEffect, useCallback } from 'react';
import { PurchaseRecord, Supplier, SupplierPayment, User, PurchaseReturnRecord } from '../types';
import { supabase } from '../supabaseClient';

export const usePurchaseData = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, purRes, payRes, retRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('is_deleted', false).order('name'),
        supabase.from('purchase_records').select('*').order('timestamp', { ascending: false }),
        supabase.from('supplier_payments').select('*').order('timestamp', { ascending: false }),
        supabase.from('purchase_returns').select('*').order('timestamp', { ascending: false })
      ]);

      if (supRes.data) setSuppliers(supRes.data.map(s => ({ 
        id: s.id, name: s.name, phone: s.phone, taxNumber: s.tax_number, 
        commercialRegister: s.commercial_register, totalDebt: Number(s.total_debt || 0),
        totalPaid: Number(s.total_paid || 0), totalSupplied: Number(s.total_supplied || 0),
        isDeleted: s.is_deleted
      })));
      
      if (purRes.data) setPurchases(purRes.data.map(p => ({ 
        id: p.id, supplierId: p.supplier_id, supplierName: p.supplier_name,
        supplierInvoiceNo: p.supplier_invoice_no, 
        items: Array.isArray(p.items) ? p.items.map((it: any) => ({
          productId: it.productId || it.product_id,
          name: it.name,
          quantity: Number(it.quantity || 0),
          costPrice: Number(it.costPrice || it.cost_price || 0),
          retailPrice: Number(it.retailPrice || it.retail_price || 0),
          subtotal: Number(it.subtotal || 0)
        })) : [],
        totalAmount: Number(p.total_amount),
        paidAmount: Number(p.paid_amount), remainingAmount: Number(p.remaining_amount),
        paymentStatus: p.payment_status, timestamp: p.timestamp, date: p.date, time: p.time,
        createdBy: p.created_by, branchId: p.branch_id, isDeleted: p.is_deleted, notes: p.notes
      })));

      if (payRes.data) setPayments(payRes.data.map(p => ({ 
        id: p.id, supplierId: p.supplier_id, purchaseId: p.purchase_id,
        amount: Number(p.amount), notes: p.notes, timestamp: p.timestamp, date: p.date, time: p.time
      })));

      if (retRes.data) setPurchaseReturns(retRes.data.map(r => ({
        id: r.id, originalPurchaseId: r.original_purchase_id, supplierId: r.supplier_id,
        items: Array.isArray(r.items) ? r.items.map((it: any) => ({
          productId: it.productId || it.product_id,
          name: it.name,
          quantity: Number(it.quantity || 0),
          costPrice: Number(it.costPrice || 0),
          retailPrice: Number(it.retailPrice || 0),
          subtotal: Number(it.subtotal || 0),
          refundAmount: Number(it.refundAmount || 0)
        })) : [],
        totalRefund: Number(r.total_refund), refundMethod: r.refund_method,
        isMoneyReceived: r.is_money_received, date: r.date, time: r.time, timestamp: r.timestamp,
        createdBy: r.created_by, branchId: r.branch_id, notes: r.notes
      })));

    } catch (err) {
      console.error("Error fetching purchase data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addSupplier = async (name: string, phone?: string, tax?: string, comm?: string) => {
    const { data, error } = await supabase.from('suppliers').insert([{
      name, phone, tax_number: tax, commercial_register: comm,
      total_debt: 0, total_paid: 0, total_supplied: 0
    }]).select().single();
    if (error) throw error;
    await fetchData();
    return data;
  };

  const addPurchase = async (record: PurchaseRecord) => {
    const dbItems = record.items.map(it => ({
      product_id: it.productId,
      name: it.name,
      quantity: Number(it.quantity || 0),
      cost_price: Number(it.costPrice || 0),
      retail_price: Number(it.retailPrice || 0),
      subtotal: Number(it.subtotal || 0)
    }));

    const { error } = await supabase.rpc('process_purchase_transaction', {
      p_id: record.id,
      p_supplier_id: record.supplierId,
      p_supplier_name: record.supplierName,
      p_supplier_invoice_no: record.supplierInvoiceNo || '',
      p_items: dbItems,
      p_total: Number(record.totalAmount || 0),
      p_paid: Number(record.paidAmount || 0),
      p_remaining: Number(record.remainingAmount || 0),
      p_status: record.paymentStatus,
      p_timestamp: Number(record.timestamp || Date.now()),
      p_created_by: record.createdBy,
      p_branch_id: record.branchId,
      p_notes: record.notes || ''
    });

    if (error) {
      console.error("Purchase Transaction Error:", error);
      throw error;
    }
    await fetchData();
  };

  const addPurchaseReturn = async (record: PurchaseReturnRecord, user: User) => {
    // 1. Insert into purchase_returns
    const dbItems = record.items.map(it => ({
        product_id: it.productId,
        name: it.name,
        quantity: Number(it.quantity || 0),
        cost_price: Number(it.costPrice || 0),
        retail_price: Number(it.retailPrice || 0),
        subtotal: Number(it.subtotal || 0),
        refundAmount: Number(it.subtotal || 0)
    }));

    const { error: insertError } = await supabase.from('purchase_returns').insert([{
      id: record.id,
      original_purchase_id: record.originalPurchaseId,
      supplier_id: record.supplierId,
      items: dbItems,
      total_refund: record.totalRefund,
      refund_method: record.refundMethod,
      is_money_received: record.isMoneyReceived,
      date: record.date,
      time: record.time,
      timestamp: record.timestamp,
      created_by: user.id,
      branch_id: user.branchId,
      notes: record.notes || ''
    }]);

    if (insertError) throw insertError;

    // 2. Reduce Stock (لأننا أرجعنا بضاعة للمورد، فالمخزون ينقص)
    for (const item of record.items) {
      const { error: stockError } = await supabase.rpc('deduct_product_stock', {
        p_id: item.productId, // Sent as string, handles UUID/Text on DB side
        p_qty: Number(item.quantity)
      });
      
      if (stockError) {
        console.error(`Stock deduction failed for ${item.name}`, stockError);
        throw new Error(`فشل خصم المخزون للصنف ${item.name}: ${stockError.message}`);
      }
    }

    // 3. Financial Handling
    // If Debt Deduction: Reduce supplier debt
    if (record.refundMethod === 'debt_deduction' || (record.refundMethod === 'cash' && !record.isMoneyReceived)) {
        const { data: supplier } = await supabase.from('suppliers').select('total_debt').eq('id', record.supplierId).single();
        if (supplier) {
             const newDebt = (supplier.total_debt || 0) - record.totalRefund;
             await supabase.from('suppliers').update({ total_debt: newDebt }).eq('id', record.supplierId);
        }
    } 
    
    // If Cash Received: Log entry in treasury as INCOME
    if (record.refundMethod === 'cash' && record.isMoneyReceived) {
        const { error: treasuryError } = await supabase.from('treasury_logs').insert([{
            branch_id: user.branchId,
            type: 'in',
            source: 'purchase_return',
            reference_id: record.id,
            amount: record.totalRefund,
            notes: `استرداد نقدي لمرتجع توريد #${record.originalPurchaseId?.slice(-6) || ''}`,
            created_by: user.id,
            timestamp: Date.now()
        }]);
        if (treasuryError) throw treasuryError;
    }

    await fetchData();
  };

  const addSupplierPayment = async (sId: string, amt: number, pId: string | null, notes?: string) => {
    const purchaseIdToSend = pId && pId.trim() !== '' ? pId : null;

    const { error } = await supabase.from('supplier_payments').insert([{
      supplier_id: sId,
      purchase_id: purchaseIdToSend, 
      amount: amt, 
      notes,
      timestamp: Date.now(), 
      date: new Date().toLocaleDateString('ar-EG'), 
      time: new Date().toLocaleTimeString('ar-EG')
    }]);
    
    if (error) throw error;

    // Update Supplier Stats
    const { data: supplier } = await supabase.from('suppliers').select('total_paid, total_debt').eq('id', sId).single();
    if (supplier) {
        const newPaid = (supplier.total_paid || 0) + amt;
        const newDebt = (supplier.total_debt || 0) - amt;
        
        const { error: updateError } = await supabase.from('suppliers').update({ 
            total_paid: newPaid,
            total_debt: newDebt
        }).eq('id', sId);
        
        if (updateError) throw updateError;
    }

    await fetchData();
  };

  const deleteSupplier = async (id: string, reason: string, user: User) => {
    const supplier = suppliers.find(s => s.id === id);
    if (supplier && supplier.totalDebt !== 0) {
       throw new Error(`لا يمكن حذف المورد لوجود مديونية معلقة (${supplier.totalDebt}). يرجى تصفية الحساب أولاً.`);
    }
    await supabase.from('suppliers').update({ is_deleted: true }).eq('id', id);
    await fetchData();
  };

  return { 
    suppliers, purchases, payments, purchaseReturns, loading, 
    addSupplier, deleteSupplier, addPurchase, addSupplierPayment, addPurchaseReturn, 
    refresh: fetchData 
  };
};
