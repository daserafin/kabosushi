import { supabase } from './supabase.js'

// After a login, supabase-js keeps the session (access token + refresh token) in
// localStorage and restores it on every page load, refreshing the token before it expires.
// Every later request from this browser carries that token, which is how auth.uid() in
// our RLS policies knows who is asking.

// Calls `callback(session)` now and again whenever someone logs in or out (also from
// another tab). session is null when logged out.
// This only decides what the page SHOWS. Real access control is grants + RLS in the
// database: anyone can edit JavaScript in their own browser.
export function onSessionChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    // Supabase's docs warn against awaiting other supabase calls inside this listener
    // (it can deadlock), so run the callback right after it instead.
    setTimeout(() => callback(session), 0)
  })
}

export async function displayName(user) {
  // RLS would return only our own profile even without .eq(), but filtering explicitly
  // is clearer and lets Postgres use the primary key index directly.
  const { data } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  return data?.display_name ?? user.email
}
