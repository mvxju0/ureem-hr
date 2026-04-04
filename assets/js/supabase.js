window.SUPABASE_URL = 'https://ytnxmnbctujuopbqpurl.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_4oBm89ecivuVF6StOBz7yg_qNBItC4z';
window.createSupabaseClient = function () {
  return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
};
