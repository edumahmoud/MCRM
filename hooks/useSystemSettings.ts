
import { useState, useEffect, useCallback } from 'react';
import { SystemSettings, PermissionOverride, User, ProceduralAction } from '../types';
import { supabase } from '../supabaseClient';

export interface AppRole {
  id: string;
  role_key: string;
  role_name: string;
  seniority: number;
  is_system: boolean;
}

export const useSystemSettings = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    appName: 'Meeza POS',
    logoUrl: '',
    currency: 'ج.م',
    allowInvoiceSuspension: true,
    globalSystemLock: false,
    inventory_method: 'WAC',
    roleHiddenSections: {},
    userHiddenSections: {},
    roleHiddenActions: {},
    userHiddenActions: {}
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
          userHiddenSections: setRes.data.user_hidden_sections || {},
          roleHiddenActions: setRes.data.role_hidden_actions || {},
          userHiddenActions: setRes.data.user_hidden_actions || {}
        });
        document.title = setRes.data.app_name;
      }

      if (overRes.data) {
        setOverrides(overRes.data.map(o => ({
          id: o.id,
          targetType: o.target_type,
          targetId: o.target_id, 
          action: o.action as ProceduralAction,
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
    const systemChannel = supabase.channel('system-settings-channel')
      .on('postgres_changes', { event: '*', table: 'system_settings' }, () => fetchSettings())
      .on('postgres_changes', { event: '*', table: 'permission_overrides' }, () => fetchSettings())
      .on('postgres_changes', { event: '*', table: 'app_roles' }, () => fetchSettings())
      .subscribe();
    
    return () => { supabase.removeChannel(systemChannel); };
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<SystemSettings>) => {
    const { error } = await supabase.from('system_settings').update({
        app_name: updates.appName,
        logo_url: updates.logoUrl,
        currency: updates.currency,
        allow_invoice_suspension: updates.allowInvoiceSuspension,
        global_system_lock: updates.globalSystemLock,
        inventory_method: updates.inventory_method,
        role_hidden_sections: updates.roleHiddenSections,
        user_hidden_sections: updates.userHiddenSections,
        role_hidden_actions: updates.roleHiddenActions,
        user_hidden_actions: updates.userHiddenActions
    }).eq('id', 1);
    if (error) throw error;
    await fetchSettings();
  };

  const addRole = async (key: string, name: string, seniority: number) => {
    const cleanKey = key.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    if (!cleanKey) throw new Error("كود الوظيفة غير صالح");

    const { error } = await supabase.from('app_roles').insert([{ 
      role_key: cleanKey, 
      role_name: name.trim(), 
      seniority: seniority,
      is_system: false 
    }]);
    
    if (error) throw error;
    await fetchSettings();
  };

  const deleteRole = async (roleKey: string) => {
    if (!roleKey) return;
    
    if (roleKey === 'admin') throw new Error("لا يمكن حذف رتبة مدير النظام (admin)");
    if (roleKey === 'employee') throw new Error("لا يمكن حذف رتبة موظف عام (employee) لأنها المرجع الافتراضي");

    try {
      await supabase.from('users').update({ role: 'employee' }).eq('role', roleKey);
      await supabase.from('correspondence').update({ sender_role: 'employee' }).eq('sender_role', roleKey);
      await supabase.from('correspondence').update({ receiver_role: 'employee' }).eq('receiver_role', roleKey);
      await supabase.from('leave_requests').update({ user_role: 'employee' }).eq('user_role', roleKey);
      await supabase.from('leave_requests').update({ target_role: 'employee' }).eq('target_role', roleKey);

      const { error: delError } = await supabase
        .from('app_roles')
        .delete()
        .eq('role_key', roleKey);
      
      if (delError) throw delError;
      
      await fetchSettings();
    } catch (e: any) {
      console.error("Critical Deletion Failure:", e);
      throw new Error(`فشل الحذف: الرتبة مرتبطة بسجلات تاريخية لا يمكن تعديلها حالياً. (${e.message})`);
    }
  };

  const checkPermission = useCallback((user: { role: string, username: string }, action: ProceduralAction): boolean => {
    const userLower = (user.username || '').toLowerCase().trim();
    if (userLower === 'admin') return true;
    if (settings.globalSystemLock) return false;
    
    const roleLower = (user.role || '').toLowerCase().trim();
    
    // Check if explicitly hidden/blocked in settings matrix
    if (settings.roleHiddenActions?.[roleLower]?.includes(action)) return false;
    if (settings.userHiddenActions?.[user.username]?.includes(action)) return false;

    // Check individual overrides (can grant permission back if blocked, or block specifically)
    const userOverride = overrides.find(o => o.targetType === 'user' && o.targetId === user.username && o.action === action);
    if (userOverride) return userOverride.isAllowed;
    
    const roleOverride = overrides.find(o => o.targetType === 'role' && o.targetId === user.role && o.action === action);
    if (roleOverride) return roleOverride.isAllowed;
    
    // Default is allowed for everyone unless restricted above.
    return true;
  }, [settings, overrides]);

  return { 
    settings, overrides, roles, loading, updateSettings, checkPermission, 
    addRole, 
    deleteRole,
    addOverride: async (o: any) => { await supabase.from('permission_overrides').insert([o]); await fetchSettings(); }, 
    removeOverride: async (id: string) => { await supabase.from('permission_overrides').delete().eq('id', id); await fetchSettings(); } 
  };
};
