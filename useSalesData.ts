
import { useState, useEffect, useCallback } from 'react';
import { Invoice, ReturnRecord, Expense } from '../types';
import { supabase } from '../supabaseClient';

export const useSalesData = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, expRes] = await Promise.all([
        supabase.from('sales_invoices').select('*').order('timestamp', { ascending: false }),
        supabase.from('expenses').select('*').order('timestamp', { ascending: false })
      ]);

      if (invRes.data) {
        setInvoices(invRes.data.map(inv => ({
          id: inv.id,
          items: inv.items || [],
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
          isDeleted: inv.is_deleted
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
          createdBy: exp.created_by
        })));
      }
    } catch (err) {
      console.error("Critical Sales Data Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const invSub = supabase.channel('sales-changes').on('postgres_changes', { event: '*', table: 'sales_invoices' }, () => fetchData()).subscribe();
    const expSub = supabase.channel('exp-changes').on('postgres_changes', { event: '*', table: 'expenses' }, () => fetchData()).subscribe();
    return () => {
      supabase.removeChannel(invSub);
      supabase.removeChannel(expSub);
    };
  }, [fetchData]);

  const saveInvoice = async (invoice: Invoice) => {
    const payload = {
      id: invoice.id,
      items: invoice.items,
      total_before_discount: Number(invoice.totalBeforeDiscount),
      discount_value: Number(invoice.discountValue),
      discount_type: invoice.discountType,
      net_total: Number(invoice.netTotal),
      customer_name: invoice.customerName || null,
      customer_phone: invoice.customerPhone || null,
      notes: invoice.notes || null,
      status: invoice.status,
      created_by: invoice.createdBy,
      branch_id: invoice.branchId || null,
      timestamp: invoice.timestamp,
      creator_username: invoice.creatorUsername || null
    };

    const { error } = await supabase.from('sales_invoices').insert([payload]);
    if (error) throw error;
    await fetchData();
  };

  const addExpense = async (expense: Expense) => {
    const { error } = await supabase.from('expenses').insert([{
      description: expense.description,
      amount: Number(expense.amount),
      category: expense.category,
      timestamp: expense.timestamp,
      created_by: expense.createdBy,
      branch_id: expense.branchId || null
    }]);
    if (error) throw error;
    await fetchData();
  };

  return { invoices, expenses, loading, saveInvoice, addExpense, refresh: fetchData };
};
