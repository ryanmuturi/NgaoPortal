import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = (import.meta.env as any).VITE_SUPABASE_ANON_KEY || (import.meta.env as any).VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = createClient(url, key)