import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://snlzkgebznshnrgelqot.supabase.co',
  'sb_publishable_Sd2JlHxxkBR5h0tFhR0QpA_ppAgGkok'
)

export { supabase }

// Auth helpers
export async function signInWithGitHub() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  })
  if (error) console.error('Auth error:', error)
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Data helpers
export async function loadData(userId) {
  const { data, error } = await supabase
    .from('backlog_data')
    .select('data, categories')
    .eq('id', userId)
    .single()
  if (error && error.code === 'PGRST116') return null // no row yet
  if (error) { console.error('Load error:', error); return null; }
  return data
}

export async function saveData(userId, progressData, categories) {
  const { error } = await supabase
    .from('backlog_data')
    .upsert({
      id: userId,
      data: progressData,
      categories: categories,
      updated_at: new Date().toISOString(),
    })
  if (error) console.error('Save error:', error)
}