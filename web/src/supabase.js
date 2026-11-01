import { createClient } from '@supabase/supabase-js'

// Vite replaces import.meta.env.VITE_* with the values from .env.local at build time,
// so both values end up in the JavaScript every visitor downloads. That's expected:
// the publishable key only identifies the project. Grants + RLS decide what it can do.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY: copy web/.env.example to web/.env.local')
}

// One shared client for the whole site.
export const supabase = createClient(url, key)
