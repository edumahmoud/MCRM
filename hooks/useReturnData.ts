
import { useState, useEffect, useCallback } from 'react';
import { ReturnRecord } from '../types';
import { supabase } from '../supabaseClient';

export const useReturnData = () => {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReturns = useCallback(async () => {
    const { data, error } = await supabase
      .from('returns')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (!error && data) {
      setReturns(data.map(r => ({
        id: r.id,
        invoiceId: r.invoice_id,
        items: r.items || [],
        totalRefund: Number(r.total_refund || 0),
        date: new Date(r.timestamp).toLocaleDateString('ar-EG'),
        time: new Date(r.timestamp).toLocaleTimeString('ar-EG'),
        timestamp: r.timestamp,
        createdBy: r.created_by,
        branchId: r.branch_id,
        isDeleted: r.is_deleted,
        deletionReason: r.deletion_reason
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReturns();
    const sub = supabase.channel('returns-live').on('postgres_changes', { event: '*', table: 'returns' }, () => fetchReturns()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchReturns]);

  const addReturn = async (record: ReturnRecord) => {
    const { error } = await supabase.from('returns').insert([{
      id: record.id,
      invoice_id: record.invoiceId,
      items: record.items,
      total_refund: record.totalRefund,
      timestamp: record.timestamp,
      created_by: record.createdBy,
      branch_id: record.branchId
    }]);
    if (error) throw error;
    await fetchReturns();
  };

  return { returns, loading, addReturn, refresh: fetchReturns };
};
