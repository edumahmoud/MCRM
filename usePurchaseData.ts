
import { useState, useEffect, useCallback } from 'react';
import { PurchaseRecord, Supplier, SupplierPayment } from '../types';
import { supabase } from '../supabaseClient';

export const usePurchaseData = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, purRes] = await Promise.all([
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('purchase_records').select('*').order('timestamp', { ascending: false })
      ]);

      if (supRes.data) {
        setSuppliers(supRes.data.map(s => ({
          id: s.id,
          name: s.name,
          phone: s.phone || '',
          taxNumber: s.tax_number || '',
          totalDebt: Number(s.total_debt || 0),
          totalPaid: Number(s.total_paid || 0),
          totalSupplied: Number(s.total_supplied || 0),
          isDeleted: s.is_deleted
        })));
      }

      if (purRes.data) {
        setPurchases(purRes.data.map(p => ({
          id: p.id,
          supplierId: p.supplier_id,
          supplierName: p.supplier_name,
          items: p.items || [],
          totalAmount: Number(p.total_amount || 0),
          paidAmount: Number(p.paid_amount || 0),
          remainingAmount: Number(p.remaining_amount || 0),
          paymentStatus: p.payment_status,
          date: new Date(p.timestamp).toLocaleDateString('ar-EG'),
          time: new Date(p.timestamp).toLocaleTimeString('ar-EG'),
          timestamp: p.timestamp,
          createdBy: p.created_by,
          isDeleted: p.is_deleted
        })));
      }
    } catch (err) {
      console.error("Critical Purchase Data Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
    const supSub = supabase.channel('suppliers-changes').on('postgres_changes', { event: '*', table: 'suppliers' }, () => fetchPurchases()).subscribe();
    const purSub = supabase.channel('pur-changes').on('postgres_changes', { event: '*', table: 'purchase_records' }, () => fetchPurchases()).subscribe();
    return () => {
      supabase.removeChannel(supSub);
      supabase.removeChannel(purSub);
    };
  }, [fetchPurchases]);

  const addSupplier = async (name: string, phone?: string, taxNumber?: string) => {
    const payload = { 
      name: name.trim(), 
      phone: phone?.trim() || null, 
      tax_number: taxNumber?.trim() || null,
      total_debt: 0,
      total_paid: 0,
      total_supplied: 0
    };

    const { data, error } = await supabase
      .from('suppliers')
      .insert([payload])
      .select()
      .single();
    
    if (error) {
      console.error("Supabase Supplier Insert Fail:", error);
      throw error;
    }

    const mappedSupplier: Supplier = {
      id: data.id,
      name: data.name,
      phone: data.phone || '',
      taxNumber: data.tax_number || '',
      totalDebt: 0,
      totalPaid: 0,
      totalSupplied: 0,
      isDeleted: false
    };

    setSuppliers(prev => [...prev, mappedSupplier]);
    await fetchPurchases();
    return mappedSupplier;
  };

  const addPurchase = async (record: PurchaseRecord) => {
    const { error } = await supabase.rpc('handle_new_purchase', {
      p_record: record,
      p_supplier_id: record.supplierId,
      p_items: record.items
    });
    if (error) throw error;
    await fetchPurchases();
  };

  const addSupplierPayment = async (supplierId: string, amount: number, purchaseId: string, notes?: string) => {
    const numAmount = Number(amount);
    if (isNaN(numAmount)) throw new Error("مبلغ غير صحيح");

    const { error: payError } = await supabase.from('supplier_payments').insert([{
      supplier_id: supplierId,
      purchase_id: purchaseId,
      amount: numAmount,
      notes: notes || '',
      timestamp: Date.now()
    }]);

    if (payError) throw payError;

    const { error: supError } = await supabase.rpc('increment_supplier_payment', {
      p_supplier_id: supplierId,
      p_amount: numAmount
    });
    
    if (supError) throw supError;
    await fetchPurchases();
  };

  return { suppliers, purchases, loading, addSupplier, addPurchase, addSupplierPayment, refresh: fetchPurchases };
};
