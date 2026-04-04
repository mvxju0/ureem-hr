const supabaseClient = window.createSupabaseClient();
function setAdminNavVisibility(roleName) {
  document.querySelectorAll('[data-admin-only="true"]').forEach((el)=>el.classList.toggle('hidden', roleName !== 'admin'));
}
async function init() {
  try {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data?.user) { location.replace('index.html'); return; }
    const user = data.user;
    const { data: account } = await supabaseClient.from('au_employee_accounts').select('employee_no').eq('auth_user_id', user.id).maybeSingle();
    if (!account?.employee_no) { setAdminNavVisibility('viewer'); return; }
    const { data: employee } = await supabaseClient.from('au_employees').select('system_role_id').eq('employee_no', account.employee_no).maybeSingle();
    const { data: role } = await supabaseClient.from('au_system_roles').select('role_name').eq('id', employee?.system_role_id).maybeSingle();
    setAdminNavVisibility(String(role?.role_name || 'viewer').toLowerCase());
  } catch (err) { console.error(err); }
}
supabaseClient.auth.onAuthStateChange((event)=>{ if (event==='SIGNED_OUT') location.replace('index.html');});
init();
