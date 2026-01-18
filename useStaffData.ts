
import { useState, useEffect, useCallback } from 'react';
import { User, Branch } from '../types';
import { supabase } from '../supabaseClient';

export const useStaffData = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaffData = useCallback(async () => {
    setLoading(true);
    const [userRes, branchRes] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('branches').select('*')
    ]);

    if (userRes.data) {
      setUsers(userRes.data.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        phoneNumber: u.phone_number,
        role: u.role,
        branchId: u.branch_id,
        createdAt: new Date(u.created_at).getTime()
      })));
    }

    if (branchRes.data) {
      setBranches(branchRes.data.map(b => ({
        id: b.id,
        name: b.name,
        location: b.location,
        createdAt: new Date(b.created_at).getTime()
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  const generateStaffUsername = (role: 'supervisor' | 'employee' | 'admin') => {
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const prefix = role === 'supervisor' ? 'S-' : role === 'admin' ? 'A-' : 'E-';
    return `${prefix}${randomDigits}`;
  };

  const addUser = async (role: User['role'], fullName: string, phoneNumber: string, branchId?: string) => {
    const payload = {
      username: generateStaffUsername(role),
      full_name: fullName.trim(),
      phone_number: phoneNumber.trim(),
      role: role,
      branch_id: branchId || null,
      password: 'pass'
    };

    const { data, error } = await supabase
      .from('users')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Supabase user insert error:", error);
      throw error;
    }

    await fetchStaffData();
    return data;
  };

  const updateUserRole = async (userId: string, newRole: User['role']) => {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);
    if (error) throw error;
    await fetchStaffData();
  };

  const deleteUser = async (userId: string) => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
    await fetchStaffData();
  };

  const addBranch = async (name: string, location?: string) => {
    const { data, error } = await supabase
      .from('branches')
      .insert([{ name, location }])
      .select()
      .single();
    if (error) throw error;
    await fetchStaffData();
    return data;
  };

  return { users, branches, loading, addUser, updateUserRole, deleteUser, addBranch, refresh: fetchStaffData };
};
