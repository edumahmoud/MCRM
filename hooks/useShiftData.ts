
import { useState, useEffect, useCallback } from 'react';
import { Shift, User } from '../types';
import { supabase } from '../supabaseClient';

export const useShiftData = (user: User | null) => {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);

  const checkActiveShift = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .maybeSingle();
    
    if (data) {
      setActiveShift({
        id: data.id,
        userId: data.user_id,
        branchId: data.branch_id,
        startTimestamp: data.start_timestamp,
        openingBalance: Number(data.opening_balance),
        expectedClosingBalance: Number(data.expected_closing_balance),
        actualClosingBalance: Number(data.actual_closing_balance),
        difference: Number(data.difference),
        status: data.status,
      });
    } else {
      setActiveShift(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    checkActiveShift();
  }, [checkActiveShift]);

  const openShift = async (balance: number) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('shifts')
      .insert([{
        user_id: user.id,
        branch_id: user.branchId,
        opening_balance: balance,
        status: 'open'
      }])
      .select()
      .single();
    
    if (error) throw error;
    await checkActiveShift();
    return data;
  };

  const closeShift = async (actualBalance: number, notes: string) => {
    if (!activeShift) return;
    
    // حساب الرصيد المتوقع (افتتاحي + مبيعات الوردية - مرتجعات الوردية)
    const { data: salesSum } = await supabase
      .from('sales_invoices')
      .select('net_total')
      .eq('shift_id', activeShift.id)
      .eq('is_deleted', false);
    
    const totalSales = (salesSum || []).reduce((a, b) => a + Number(b.net_total), 0);
    const expected = activeShift.openingBalance + totalSales;
    const diff = actualBalance - expected;

    const { error } = await supabase
      .from('shifts')
      .update({
        status: 'closed',
        end_timestamp: new Date().toISOString(),
        expected_closing_balance: expected,
        actual_closing_balance: actualBalance,
        difference: diff,
        notes: notes
      })
      .eq('id', activeShift.id);
    
    if (error) throw error;
    setActiveShift(null);
  };

  return { activeShift, loading, openShift, closeShift, refresh: checkActiveShift };
};
