
import { useState, useEffect, useCallback } from 'react';
import { AuditLog } from '../types';
import { supabase } from '../supabaseClient';

export const useAuditLogs = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);

      if (data) {
        setAuditLogs(data.map(l => ({
          id: l.id,
          userId: l.user_id,
          username: l.username,
          actionType: l.action_type,
          entityType: l.entity_type,
          entityId: l.entity_id,
          details: l.details,
          oldData: l.old_data,
          newData: l.new_data,
          timestamp: l.timestamp
        })));
      }
    } catch (err) {
      console.error("Audit logs fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const logAction = async (user: {id: string, username: string}, action: string, type: string, id: string, details: string, old?: any, next?: any) => {
    await supabase.rpc('log_system_action', {
      p_user_id: user.id,
      p_username: user.username,
      p_action: action,
      p_entity_type: type,
      p_entity_id: id,
      p_details: details,
      p_old: old,
      p_new: next
    });
    fetchAuditLogs();
  };

  return { auditLogs, loading, logAction, refresh: fetchAuditLogs };
};
