
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.45.4';

const supabaseUrl = 'https://oxnkznqozonwbcyjzfly.supabase.co';
const supabaseAnonKey = 'sb_publishable_rTmd7V6rrwWZZZDDzMf4vw_l1u8EeUX';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
