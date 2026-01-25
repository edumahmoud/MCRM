
import { useState, useEffect, useCallback } from 'react';
import { ArchiveRecord } from '../types';
import { supabase } from '../supabaseClient';

export const useArchiveData = () => {
  const [archive, setArchive] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArchive = useCallback(async () => {
    const { data, error } = await supabase
      .from('unified_archive')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (!error && data) {
      setArchive(data.map(a => ({
        id: a.id,
        itemType: a.item_type,
        itemId: a.item_id,
        originalData: a.original_data,
        deletedBy: a.deleted_by,
        deleterName: a.deleter_name,
        reason: a.reason,
        timestamp: a.timestamp
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchArchive();
    const sub = supabase.channel('archive-live').on('postgres_changes', { event: '*', table: 'unified_archive' }, () => fetchArchive()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchArchive]);

  return { archive, loading, refresh: fetchArchive };
};
