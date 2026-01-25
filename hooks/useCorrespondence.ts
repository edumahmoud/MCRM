
import { useState, useEffect, useCallback } from 'react';
import { Correspondence, User } from '../types';
import { supabase } from '../supabaseClient';

const isUUID = (id: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const SYSTEM_ADMIN_ID = '00000000-0000-0000-0000-000000000000';

export interface CorrespondenceWithCode extends Correspondence {
  senderCode?: string;
}

export const useCorrespondence = (user: User | null) => {
  const [messages, setMessages] = useState<CorrespondenceWithCode[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('correspondence')
        .select('*, sender:sender_id(username)')
        .or(`receiver_id.eq.${user.id},receiver_role.eq.${user.role},receiver_role.eq.all,sender_id.eq.${user.id}`)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      if (data) {
        setMessages(data.map(m => ({
          id: m.id,
          senderId: m.sender_id,
          senderName: m.sender_name,
          senderCode: m.sender?.username || 'SYS',
          senderRole: m.sender_role,
          receiverRole: m.receiver_role,
          receiverId: m.receiver_id,
          subject: m.subject,
          content: m.content,
          isBroadcast: m.receiver_role === 'all' || !!m.is_broadcast,
          isRead: m.is_read,
          timestamp: m.timestamp,
          parentMessageId: m.parent_message_id,
          isArchived: !!m.is_archived,
          isDeleted: !!m.is_deleted
        })));
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMessages();
    const sub = supabase.channel('msgs-live-v18').on('postgres_changes', {event:'*', table:'correspondence'}, () => fetchMessages()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchMessages]);

  const sendMessage = async (msg: Omit<Correspondence, 'id' | 'timestamp' | 'isRead'>, secondaryReceiverId?: string) => {
    const finalSenderId = isUUID(msg.senderId) ? msg.senderId : SYSTEM_ADMIN_ID;
    const finalReceiverId = (msg.receiverId && isUUID(msg.receiverId)) ? msg.receiverId : null;
    
    const payload: any = {
      sender_id: finalSenderId,
      sender_name: msg.senderName || 'مستخدم النظام',
      sender_role: msg.senderRole || 'employee',
      receiver_role: msg.isBroadcast ? 'all' : (msg.receiverRole || 'employee'),
      receiver_id: finalReceiverId,
      subject: msg.subject,
      content: msg.content,
      timestamp: Date.now(),
      is_read: false,
      is_broadcast: !!msg.isBroadcast,
      is_archived: false,
      is_deleted: false,
      parent_message_id: msg.parentMessageId || null
    };

    try {
      const { error } = await supabase.from('correspondence').insert([payload]);
      if (error) throw error;
      if (secondaryReceiverId && isUUID(secondaryReceiverId)) {
        await supabase.from('correspondence').insert([{
          ...payload,
          receiver_id: secondaryReceiverId,
          subject: `[متابعة] ${msg.subject}`
        }]);
      }
      await fetchMessages();
    } catch (err: any) {
      throw err;
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('correspondence').update({ is_read: true }).eq('id', id);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
    } catch (e) {}
  };

  const updateMessageStatus = async (id: string, updates: { isArchived?: boolean, isDeleted?: boolean }) => {
    const dbUpdates: any = {};
    if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;
    if (updates.isDeleted !== undefined) dbUpdates.is_deleted = updates.isDeleted;
    const { error } = await supabase.from('correspondence').update(dbUpdates).eq('id', id);
    if (error) throw error;
    await fetchMessages();
  };

  const deleteMessagePermanent = async (id: string) => {
    const { error } = await supabase.from('correspondence').delete().eq('id', id);
    if (error) throw error;
    await fetchMessages();
  };

  const emptyTrashPermanent = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('correspondence')
      .delete()
      .eq('is_deleted', true)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    if (error) throw error;
    await fetchMessages();
  };

  const clearBox = async (type: 'inbox' | 'sent') => {
    if (!user) return;
    const field = type === 'sent' ? 'sender_id' : 'receiver_id';
    try {
      await supabase.from('correspondence').update({ is_deleted: true }).eq(field, user.id);
    } catch (e) {}
    await fetchMessages();
  };

  return { messages, loading, sendMessage, markAsRead, updateMessageStatus, deleteMessagePermanent, emptyTrashPermanent, clearBox, refresh: fetchMessages };
};
