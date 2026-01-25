
import { useState, useEffect, useCallback } from 'react';
import { Invoice, Expense, User } from '../types';
import { supabase } from '../supabaseClient';

export interface SummaryStats {
  revenue: number;
  expenses: number;
  returnsValue: number;
  salaries: number;
  discounts: number;
  inventoryValue: number;
}

export const useSalesData = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data: statsData } = await supabase.rpc('get_system_summary_stats');
      if (statsData) {
        setSummaryStats({
          revenue: Number(statsData.revenue || 0),
          expenses: Number(statsData.expenses || 0),
          returnsValue: Number(statsData.returnsValue || 0),
          salaries: Number(statsData.salaries || 0),
          discounts: Number(statsData.discounts || 0),
          inventoryValue: Number(statsData.inventoryValue || 0)
        });
      }

      const [invRes, expRes] = await Promise.all([
        supabase.from('sales_invoices')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(1000),
        supabase.from('expenses')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(1000)
      ]);

      if (invRes.data) {
        setInvoices(invRes.data.map(inv => ({
          id: inv.id,
          items: Array.isArray(inv.items) ? inv.items.map((it: any) => ({
            productId: it.productId || it.product_id,
            name: it.name || 'Unknown Item',
            quantity: Number(it.quantity || 0),
            unitPrice: Number(it.unitPrice || it.unit_price || 0),
            subtotal: Number(it.subtotal || 0),
            wholesalePriceAtSale: Number(it.wholesalePriceAtSale || it.wholesale_price_at_sale || 0)
          })) : [],
          totalBeforeDiscount: Number(inv.total_before_discount || 0),
          discountValue: Number(inv.discount_value || 0),
          discountType: inv.discount_type || 'percentage',
          netTotal: Number(inv.net_total || 0),
          date: new Date(inv.timestamp).toLocaleDateString('ar-EG'),
          time: new Date(inv.timestamp).toLocaleTimeString('ar-EG'),
          timestamp: inv.timestamp,
          customerName: inv.customer_name || '',
          customerPhone: inv.customer_phone || '',
          notes: inv.notes || '',
          status: inv.status,
          createdBy: inv.created_by,
          creatorUsername: inv.creator_username || '---',
          branchId: inv.branch_id,
          shiftId: inv.shift_id,
          isDeleted: inv.is_deleted,
          deletionReason: inv.deletion_reason,
          deletionTimestamp: inv.deletion_timestamp,
          deletedBy: inv.deleted_by
        })));
      }

      if (expRes.data) {
        setExpenses(expRes.data.map(exp => ({
          id: exp.id,
          description: exp.description,
          amount: Number(exp.amount || 0),
          category: exp.category,
          date: new Date(exp.timestamp).toLocaleDateString('ar-EG'),
          time: new Date(exp.timestamp).toLocaleTimeString('ar-EG'),
          timestamp: exp.timestamp,
          createdBy: exp.created_by,
          branchId: exp.branch_id,
          notes: exp.notes
        })));
      }
    } catch (err) {
      console.error("Sales Data Sync Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('sales-global-sync-realtime')
      .on('postgres_changes', { event: '*', table: 'sales_invoices' }, () => fetchData())
      .on('postgres_changes', { event: '*', table: 'expenses' }, () => fetchData())
      .on('postgres_changes', { event: '*', table: 'treasury_logs' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchData]);

  const saveInvoice = async (invoice: Invoice) => {
    const dbItems = invoice.items.map(it => ({
      product_id: String(it.productId),
      name: String(it.name),
      quantity: Number(it.quantity),
      unit_price: Number(it.unitPrice),
      subtotal: Number(it.subtotal),
      wholesale_price_at_sale: Number(it.wholesalePriceAtSale)
    }));

    const { error } = await supabase.rpc('process_sale_transaction', {
        p_id: String(invoice.id),
        p_items: dbItems,
        p_total_before: Number(invoice.totalBeforeDiscount),
        p_discount: Number(invoice.discountValue),
        p_net_total: Number(invoice.netTotal),
        p_customer_name: invoice.customerName || 'عميل نقدي',
        p_customer_phone: invoice.customerPhone || null,
        p_created_by: String(invoice.createdBy),
        p_creator_username: invoice.creatorUsername || null,
        p_branch_id: invoice.branchId ? String(invoice.branchId) : null,
        p_shift_id: invoice.shiftId ? String(invoice.shiftId) : null,
        p_timestamp: Number(invoice.timestamp)
    });

    if (error) {
        console.error("Supabase RPC Error:", error);
        throw new Error(error.message || "فشل إتمام عملية البيع الموحدة");
    }
    await fetchData();
  };

  const deleteInvoice = async (id: string, reason: string, user: User) => {
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) return;
    const { error: updateError } = await supabase.from('sales_invoices').update({ is_deleted: true, deletion_reason: reason, deletion_timestamp: Date.now(), deleted_by: user.id }).eq('id', id);
    if (updateError) throw updateError;
    await supabase.from('unified_archive').insert([{ item_type: 'invoice', item_id: id, original_data: invoice, deleted_by: user.id, deleter_name: user.fullName, reason: reason, timestamp: Date.now() }]);
    await fetchData();
  };

  const addExpense = async (expense: Expense) => {
    const { error } = await supabase.from('expenses').insert([{
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      branch_id: expense.branchId,
      created_by: expense.createdBy,
      notes: expense.notes,
      timestamp: expense.timestamp
    }]);

    if (error) throw error;
    await fetchData();
  };

  const deleteExpense = async (id: string, amount: number, description: string, user: User) => {
    // 1. تسجيل استرداد المبلغ في الخزينة
    // نستخدم معرف نصي مع بادئة DEL لتفادي قيود الربط، ونضمن إرسال branch_id بشكل صحيح
    const { error: logError } = await supabase.from('treasury_logs').insert([{
      branch_id: user.branchId || null, 
      type: 'in',
      source: 'manual', 
      reference_id: `DEL:${id.slice(0, 8)}`,
      amount: Number(amount),
      notes: `استرداد مصروف ملغي: ${description} (Ref: ${id.slice(0,6)})`,
      created_by: user.id,
      timestamp: Date.now()
    }]);

    if (logError) {
      console.error("Treasury Log Insert Error:", logError);
      throw new Error(`فشل تسجيل استرداد المبلغ: ${logError.message}`);
    }

    // 2. حذف المصروف فعلياً
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
      console.error("Expense Delete Error:", error);
      // محاولة تراجع عن تسجيل الخزينة إذا فشل الحذف لتجنب عدم الاتساق (اختياري، لكن هنا نكتفي برمي الخطأ)
      throw new Error(`فشل حذف سجل المصروف من قاعدة البيانات: ${error.message}`);
    }
    await fetchData();
  };

  return { invoices, expenses, summaryStats, loading, saveInvoice, deleteInvoice, addExpense, deleteExpense, refresh: fetchData };
};
