import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || "https://wolmodjvztjiizrwvjmp.supabase.co";
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_qvJ5gr71J5CaJBp3pU6_VQ_NDN7-olE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('notes').select('id').limit(1);
    if (error) {
      console.warn("Supabase check warning: ", error);
      // Even if notes table doesn't exist yet, we connected to Supabase
      if (error.code === '42P01') {
        // Table doesn't exist
        return true;
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase connection failed:", err);
    return false;
  }
}
