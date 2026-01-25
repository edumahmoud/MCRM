
import { useState, useEffect, useCallback } from 'react';
import { User, Branch, StaffPayment, UserRole, StaffPaymentType, LeaveRequest } from '../types';
import { supabase } from '../supabaseClient';

export const useStaffData = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffPayments, setStaffPayments] = useState<StaffPayment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaffData = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, branchRes, paymentRes, leaveRes] = await Promise.all([
        supabase.from('users').select('*').eq('is_deleted', false).order('username'),
        supabase.from('branches').select('*').eq('is_deleted', false).order('name'),
        supabase.from('staff_payments').select('*').order('payment_date', { ascending: false }),
        supabase.from('leave_requests').select('*').order('timestamp', { ascending: false })
      ]);

      if (userRes.data) {
        setUsers(userRes.data.map(u => ({
          id: u.id, username: u.username, 
          password: u.password, 
          fullName: u.full_name,
          phoneNumber: u.phone_number, imageUrl: u.image_url, birthDate: u.birth_date,
          role: u.role as UserRole, salary: Number(u.salary || 0), branchId: u.branch_id,
          hiringDate: u.hiring_date || u.created_at, hasPerformanceTracking: u.has_performance_tracking,
          createdAt: new Date(u.created_at).getTime(), isDeleted: u.is_deleted,
          daysWorkedAccumulated: u.days_worked_accumulated || 0, totalDaysWorked: u.total_days_worked || 0,
          discountsAccumulated: Number(u.discounts_accumulated || 0),
          lastLoginDate: u.last_login_date,
          isPasswordChanged: u.is_password_changed
        })));
      }

      if (branchRes.data) {
        setBranches(branchRes.data.map(b => ({
          id: b.id, name: b.name, location: b.location, phone: b.phone, imageUrl: b.image_url,
          operationalNumber: b.operational_number, 
          taxNumber: b.tax_number,
          commercialRegister: b.commercial_register, 
          status: b.status || 'active',
          createdAt: new Date(b.created_at).getTime(), isDeleted: b.is_deleted
        })));
      }

      if (paymentRes.data) {
        setStaffPayments(paymentRes.data.map(p => ({
          id: p.id, staffId: p.staff_id, amount: Number(p.amount),
          paymentType: p.payment_type as StaffPaymentType, paymentDate: p.payment_date,
          notes: p.notes, createdBy: p.created_by
        })));
      }

      if (leaveRes.data) {
        setLeaveRequests(leaveRes.data.map(l => ({
          id: l.id, userId: l.user_id, userName: l.user_name, userRole: l.user_role,
          target_role: l.target_role,
          startDate: l.start_date, endDate: l.end_date, reason: l.reason,
          type: l.type || 'normal',
          status: l.status, timestamp: Number(l.timestamp),
          isArchived: l.is_archived || false,
          isDeleted: l.is_deleted || false
        })));
      }
    } catch (err) {
      console.error("Error fetching staff data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffData();
    const sub = supabase.channel('staff-sync-global')
      .on('postgres_changes', {event:'*', table:'users'}, () => fetchStaffData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchStaffData]);

  const addUser = async (role: UserRole, fullName: string, phone: string, salary: number, branchId: string, hasPerformance: boolean, birthDate: string) => {
    const rolePrefix = role.slice(0, 2).toUpperCase();
    const uniqueNumber = Math.floor(1000 + Math.random() * 9000);
    const username = `${rolePrefix}-${uniqueNumber}`;
    const password = Math.random().toString(36).slice(-8);
    
    const { data, error } = await supabase.from('users').insert([{
      full_name: fullName, 
      phone_number: phone, 
      salary, 
      branch_id: branchId || null, 
      role, 
      username, 
      password, 
      birth_date: birthDate,
      has_performance_tracking: hasPerformance,
      is_password_changed: false
    }]).select().single();
    
    if (error) throw error;
    await fetchStaffData();
    return { ...data, temporaryPassword: password };
  };

  const updateUser = async (userId: string, updates: any) => {
    const { error } = await supabase.from('users').update(updates).eq('id', userId);
    if (error) throw error;
    await fetchStaffData();
  };

  const resetUserPassword = async (userId: string) => {
    const newPass = Math.random().toString(36).slice(-8);
    const { error } = await supabase.from('users').update({ 
      password: newPass,
      is_password_changed: false
    }).eq('id', userId);
    if (error) throw error;
    await fetchStaffData();
    return newPass;
  };

  const addStaffPayment = async (staffId: string, amount: number, type: StaffPaymentType, notes?: string, creatorId?: string) => {
    const { error } = await supabase.from('staff_payments').insert([{
      staff_id: staffId, amount, payment_type: type, notes, created_by: creatorId, payment_date: new Date().toISOString()
    }]);
    if (error) throw error;
    await fetchStaffData();
  };

  const addLeaveRequest = async (req: Omit<LeaveRequest, 'id' | 'timestamp' | 'status'>) => {
    const { error } = await supabase.from('leave_requests').insert([{
      user_id: req.userId,
      user_name: req.userName,
      user_role: req.userRole,
      target_role: req.targetRole,
      start_date: req.startDate,
      end_date: req.endDate,
      reason: req.reason,
      type: req.type,
      status: 'pending',
      timestamp: Date.now()
    }]);
    if (error) throw error;
    await fetchStaffData();
  };

  const updateLeaveStatus = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id);
    if (error) throw error;
    await fetchStaffData();
  };

  const updateLeaveMeta = async (id: string, updates: { isArchived?: boolean, isDeleted?: boolean }) => {
    const dbUpdates: any = {};
    if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;
    if (updates.isDeleted !== undefined) dbUpdates.is_deleted = updates.isDeleted;
    const { error } = await supabase.from('leave_requests').update(dbUpdates).eq('id', id);
    if (error) throw error;
    await fetchStaffData();
  };

  const deleteLeaveRequestPermanent = async (id: string) => {
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) throw error;
    await fetchStaffData();
  };

  const emptyLeavesTrashPermanent = async (userId: string) => {
    const { error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('user_id', userId)
      .eq('is_deleted', true);
    if (error) throw error;
    await fetchStaffData();
  };

  const clearUserLeaves = async (userId: string) => {
    const { error } = await supabase.from('leave_requests').update({ is_deleted: true }).eq('user_id', userId);
    if (error) throw error;
    await fetchStaffData();
  };

  const addBranch = async (payload: { name: string, location?: string, phone?: string, taxNumber?: string, commercialRegister?: string }) => {
    const opNumber = 'BR-' + Math.floor(100 + Math.random() * 899).toString();
    const { error } = await supabase.from('branches').insert([{
      name: payload.name,
      location: payload.location,
      phone: payload.phone,
      tax_number: payload.taxNumber,
      commercial_register: payload.commercialRegister,
      operational_number: opNumber,
      status: 'active'
    }]);
    if (error) throw error;
    await fetchStaffData();
  };

  const updateBranch = async (id: string, updates: Partial<Branch>) => {
    const { error } = await supabase.from('branches').update(updates).eq('id', id);
    if (error) throw error;
    await fetchStaffData();
  };

  return { 
    users, branches, staffPayments, leaveRequests, loading, 
    addUser, updateUser, addStaffPayment, resetUserPassword,
    addLeaveRequest, updateLeaveStatus, updateLeaveMeta, deleteLeaveRequestPermanent, emptyLeavesTrashPermanent, clearUserLeaves,
    incrementUserDay: async (id: string) => {
       const { data: u } = await supabase.from('users').select('days_worked_accumulated, total_days_worked').eq('id', id).single();
       if (u) {
         await supabase.from('users').update({
           days_worked_accumulated: (u.days_worked_accumulated || 0) + 1,
           total_days_worked: (u.total_days_worked || 0) + 1,
           last_login_date: new Date().toISOString()
         }).eq('id', id);
       }
       await fetchStaffData();
    },
    deleteUser: (id: string, reason: string) => supabase.from('users').update({ is_deleted: true, deletion_reason: reason }).eq('id', id).then(() => fetchStaffData()),
    updateBranch,
    onTransferEmployee: (userId: string, targetBranchId: string | null) => supabase.from('users').update({ branch_id: targetBranchId }).eq('id', userId).then(() => fetchStaffData()),
    updateUserRole: (userId: string, newRole: UserRole) => supabase.from('users').update({ role: newRole }).eq('id', userId).then(() => fetchStaffData()),
    addBranch,
    deleteBranch: (id: string, reason: string) => supabase.from('branches').update({ is_deleted: true, deletion_reason: reason }).eq('id', id).then(() => fetchStaffData()),
    refresh: fetchStaffData 
  };
};
