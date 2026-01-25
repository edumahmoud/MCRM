
import { useState, useEffect, useCallback } from 'react';
import { SystemSettings, PermissionOverride, User } from '../types';
import { supabase } from '../supabaseClient';

export interface AppRole {
  id: string;
  role_key: string;
  role_name: string;
  seniority: number;
  is_system: boolean;
}

export const useSystemSettings = () => {
  // Initialize settings with required inventory_method
  const [settings, setSettings] = useState<SystemSettings>({
    appName: 'Meeza POS',
    logoUrl: '',
    currency: 'ج.م',
    allowInvoiceSuspension: true,
    globalSystemLock: false,
    inventory_method: 'WAC',
    roleHiddenSections: {},
    userHiddenSections: {}
  });
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const [setRes, overRes, rolesRes] = await Promise.all([
        supabase.from('system_settings').select('*').single(),
        supabase.from('permission_overrides').select('*'),
        supabase.from('app_roles').select('*').order('seniority', { ascending: false })
      ]);

      if (setRes.data) {
        setSettings({
          appName: setRes.data.app_name,
          logoUrl: setRes.data.logo_url,
          currency: setRes.data.currency,
          allowInvoiceSuspension: setRes.data.allow_invoice_suspension,
          globalSystemLock: setRes.data.global_system_lock,
          inventory_method: setRes.data.inventory_method || 'WAC',
          roleHiddenSections: setRes.data.role_hidden_sections || {},
          userHiddenSections: setRes.data.user_hidden_sections || {}
        });
        document.title = setRes.data.app_name;
      }

      if (overRes.data) {
        setOverrides(overRes.data.map(o => ({
          id: o.id,
          targetType: o.target_type,
          targetId: o.target_id,
          action: o.action,
          isAllowed: o.is_allowed,
          notes: o.notes
        })));
      }

      if (rolesRes.data) {
        setRoles(rolesRes.data);
      }
    } catch (err) {
      console.error("System Settings Sync Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    const systemChannel = supabase.channel('system-intelligence')
      .on('postgres_changes', { event: '*', table: 'system_settings' }, () => fetchSettings())
      .on('postgres_changes', { event: '*', table: 'permission_overrides' }, () => fetchSettings())
      .on('postgres_changes', { event: '*', table: 'app_roles' }, () => fetchSettings())
      .subscribe();
    
    return () => { supabase.removeChannel(systemChannel); };
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<SystemSettings>) => {
    const payload: any = {};
    if (updates.appName !== undefined) payload.app_name = updates.appName;
    if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl;
    if (updates.currency !== undefined) payload.currency = updates.currency;
    if (updates.allowInvoiceSuspension !== undefined) payload.allow_invoice_suspension = updates.allowInvoiceSuspension;
    if (updates.globalSystemLock !== undefined) payload.global_system_lock = updates.globalSystemLock;
    if (updates.inventory_method !== undefined) payload.inventory_method = updates.inventory_method;
    if (updates.roleHiddenSections !== undefined) payload.role_hidden_sections = updates.roleHiddenSections;
    if (updates.userHiddenSections !== undefined) payload.user_hidden_sections = updates.userHiddenSections;

    // محاولة التحديث مع معالجة الأخطاء في حال غياب العمود مؤقتاً
    const { error } = await supabase.from('system_settings').update(payload).eq('id', 1);
    if (error) {
      console.error("Supabase update error:", error);
      throw new Error("فشل الحفظ: يرجى التأكد من تحديث هيكل قاعدة البيانات عبر IT Control.");
    }
    await fetchSettings();
  };

  const addOverride = async (override: Omit<PermissionOverride, 'id'>) => {
    const { error } = await supabase.from('permission_overrides').insert([{
      target_type: override.targetType,
      target_id: override.targetId,
      action: override.action,
      is_allowed: override.isAllowed,
      notes: override.notes
    }]);
    if (error) throw error;
    await fetchSettings();
  };

  const removeOverride = async (id: string) => {
    const { error } = await supabase.from('permission_overrides').delete().eq('id', id);
    if (error) throw error;
    await fetchSettings();
  };

  const addRole = async (key: string, name: string, seniority: number) => {
    const { error } = await supabase.from('app_roles').insert([{ 
      role_key: key.toLowerCase(), 
      role_name: name, 
      seniority: seniority,
      is_system: false 
    }]);
    if (error) throw error;
    await fetchSettings();
  };

  const deleteRole = async (roleKey: string) => {
    const fallbackRole = roles.find(r => r.role_key === 'worker')?.role_key || 'employee';
    const { error: userUpdateError } = await supabase.from('users').update({ role: fallbackRole }).eq('role', roleKey);
    if (userUpdateError) throw userUpdateError;

    const { error: roleDeleteError } = await supabase.from('app_roles').delete().eq('role_key', roleKey);
    if (roleDeleteError) throw roleDeleteError;

    await fetchSettings();
  };

  const checkPermission = (user: { role: string, username: string }, action: PermissionOverride['action']): boolean => {
    const roleLower = (user.role || '').toLowerCase();
    const userLower = (user.username || '').toLowerCase();

    if (settings.globalSystemLock && roleLower !== 'admin' && roleLower !== 'it_support') return false;
    
    const userOverride = overrides.find(o => o.targetType === 'user' && o.targetId.toLowerCase() === userLower && o.action === action);
    if (userOverride) return userOverride.isAllowed;
    
    const roleOverride = overrides.find(o => o.targetType === 'role' && o.targetId.toLowerCase() === roleLower && o.action === action);
    if (roleOverride) return roleOverride.isAllowed;
    
    return true;
  };

  return { settings, overrides, roles, loading, updateSettings, addOverride, removeOverride, addRole, deleteRole, checkPermission };
};
