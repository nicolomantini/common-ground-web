// ============================================================
// Supabase connection settings.
// Get these two values from: Supabase dashboard → Project Settings → API
//   - SUPABASE_URL     → "Project URL"
//   - SUPABASE_ANON_KEY → "anon public" key (NOT the service_role key —
//                          that one must never appear in frontend code)
// ============================================================
const SUPABASE_URL = "https://plgilmcclpldcjzkepbp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XZKM9DwvK-XyrgqnOZi8ag_76A94jjC";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
