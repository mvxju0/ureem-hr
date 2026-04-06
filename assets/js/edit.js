const supabaseClient = window.createSupabaseClient();

const editForm = document.getElementById('editForm');
const submitBtn = document.getElementById('submitBtn');
const saveBtnTop = document.getElementById('saveBtnTop');
const cancelBtn = document.getElementById('cancelBtn');
const homeBtn = document.getElementById('homeBtn');
const messageBox = document.getElementById('messageBox');
const historyList = document.getElementById('historyList');

const storeSelect = document.getElementById('current_store_id');
const managerSelect = document.getElementById('current_manager_id');
const teamLeaderSelect = document.getElementById('current_team_leader_id');
const positionSelect = document.getElementById('current_position_id');
const systemRoleSelect = document.getElementById('system_role_id');

let currentUser = null;
let targetEmployeeNo = '';
let loadedEmployee = null;
let loadedAccount = null;

let allStores = [];
let allTeamLeaders = [];
let teamLeaderIdsByManager = new Map();
let storeIdsByTeamLeader = new Map();

function showMessage(type, text) {
  messageBox.className = `msg ${type}`;
  messageBox.textContent = text;
  messageBox.style.display = type ? 'block' : 'none';
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function appendOptions(selectEl, list, labelKey) {
  list.forEach(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item[labelKey];
    selectEl.appendChild(option);
  });
}

function clearSelectOptions(selectEl, placeholder = '선택') {
  selectEl.innerHTML = '';
  const option = document.createElement('option');
  option.value = '';
  option.textContent = placeholder;
  selectEl.appendChild(option);
}

function appendMappedOptions(selectEl, options, labelKey) {
  options.forEach((item) => {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = item[labelKey];
    selectEl.appendChild(option);
  });
}

function normalizeRoleName(roleName) {
  return String(roleName || '').replace(/\s+/g, '').toLowerCase();
}

function getSelectedRoleName() {
  const selectedOption = positionSelect.options[positionSelect.selectedIndex];
  return selectedOption ? selectedOption.textContent.trim() : '';
}

function isHierarchyRequiredRole(roleName) {
  const normalized = normalizeRoleName(roleName);
  return normalized.includes('점장') || normalized.includes('플래너') || normalized === 'sp' || normalized.includes('(sp)') || normalized.includes('sp');
}

function isHierarchyDisabledRole(roleName) {
  const normalized = normalizeRoleName(roleName);
  return normalized.includes('담당') || normalized.includes('팀장');
}

function buildHierarchyMap(teamLeaders, stores) {
  teamLeaderIdsByManager = new Map();
  storeIdsByTeamLeader = new Map();

  (teamLeaders || []).forEach((leader) => {
    const groupId = leader.group_id;
    if (!groupId || !leader.id) return;
    if (!teamLeaderIdsByManager.has(groupId)) {
      teamLeaderIdsByManager.set(groupId, new Set());
    }
    teamLeaderIdsByManager.get(groupId).add(leader.id);
  });

  const leaderNoById = new Map((teamLeaders || []).map((leader) => [leader.id, leader.employee_no]));

  (stores || []).forEach((store) => {
    const leaderEmployeeNo = store.team_leader_employee_no;
    if (!leaderEmployeeNo || !store.id) return;

    (teamLeaders || []).forEach((leader) => {
      if (!leader.id) return;
      if (leaderNoById.get(leader.id) === leaderEmployeeNo) {
        if (!storeIdsByTeamLeader.has(leader.id)) {
          storeIdsByTeamLeader.set(leader.id, new Set());
        }
        storeIdsByTeamLeader.get(leader.id).add(store.id);
      }
    });
  });
}

function getFilteredTeamLeaders(managerId) {
  if (!managerId) return [];
  const allowed = teamLeaderIdsByManager.get(Number(managerId));
  if (!allowed) return [];
  return allTeamLeaders.filter((item) => allowed.has(item.id));
}

function getFilteredStores(teamLeaderId) {
  if (!teamLeaderId) return [];
  const allowed = storeIdsByTeamLeader.get(Number(teamLeaderId));
  if (!allowed) return [];
  return allStores.filter((item) => allowed.has(item.id));
}

function refreshTeamLeaderOptions({ preserveValue = false } = {}) {
  const prevValue = preserveValue ? teamLeaderSelect.value : '';
  const managerId = managerSelect.value;

  if (!managerId) {
    clearSelectOptions(teamLeaderSelect, '담당을 먼저 선택하세요');
    teamLeaderSelect.value = '';
    return;
  }

  const filtered = getFilteredTeamLeaders(managerId);
  clearSelectOptions(teamLeaderSelect, filtered.length ? '선택' : '선택 가능한 팀장 없음');
  appendMappedOptions(teamLeaderSelect, filtered, 'team_leader_name');

  if (preserveValue && filtered.some((item) => String(item.id) === String(prevValue))) {
    teamLeaderSelect.value = prevValue;
  } else {
    teamLeaderSelect.value = '';
  }
}

function refreshStoreOptions({ preserveValue = false } = {}) {
  const prevValue = preserveValue ? storeSelect.value : '';
  const teamLeaderId = teamLeaderSelect.value;

  if (!teamLeaderId) {
    clearSelectOptions(storeSelect, '팀장을 먼저 선택하세요');
    storeSelect.value = '';
    return;
  }

  const filtered = getFilteredStores(teamLeaderId);
  clearSelectOptions(storeSelect, filtered.length ? '선택' : '선택 가능한 매장 없음');
  appendMappedOptions(storeSelect, filtered, 'store_name');

  if (preserveValue && filtered.some((item) => String(item.id) === String(prevValue))) {
    storeSelect.value = prevValue;
  } else {
    storeSelect.value = '';
  }
}

function applyRoleBasedFieldState({ keepCurrentValues = false } = {}) {
  const roleName = getSelectedRoleName();

  if (isHierarchyDisabledRole(roleName)) {
    clearSelectOptions(teamLeaderSelect, '팀장 선택 불필요');
    clearSelectOptions(storeSelect, '매장 선택 불필요');
    teamLeaderSelect.disabled = true;
    storeSelect.disabled = true;
    teamLeaderSelect.value = '';
    storeSelect.value = '';
    return;
  }

  if (!isHierarchyRequiredRole(roleName)) {
    teamLeaderSelect.disabled = false;
    storeSelect.disabled = false;
    clearSelectOptions(teamLeaderSelect, '담당을 먼저 선택하세요');
    clearSelectOptions(storeSelect, '팀장을 먼저 선택하세요');
    teamLeaderSelect.value = '';
    storeSelect.value = '';
    return;
  }

  teamLeaderSelect.disabled = false;
  storeSelect.disabled = false;

  refreshTeamLeaderOptions({ preserveValue: keepCurrentValues });
  refreshStoreOptions({ preserveValue: keepCurrentValues });
}

function bindHierarchyEvents() {
  managerSelect.addEventListener('change', () => {
    refreshTeamLeaderOptions();
    refreshStoreOptions();
  });

  teamLeaderSelect.addEventListener('change', () => {
    refreshStoreOptions();
  });

  positionSelect.addEventListener('change', () => {
    applyRoleBasedFieldState();
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function renderHistory(employee, account) {
  const items = [
    {
      label: '직원 생성일',
      value: formatDateTime(employee?.created_at)
    },
    {
      label: '직원 최근 수정일',
      value: formatDateTime(employee?.updated_at)
    },
    {
      label: '계정 생성일',
      value: formatDateTime(account?.created_at)
    },
    {
      label: '계정 최근 수정일',
      value: formatDateTime(account?.updated_at)
    },
    {
      label: '현재 계정 상태',
      value: account?.account_status || '-'
    },
    {
      label: '현재 로그인 이메일',
      value: account?.login_email || '-'
    }
  ];

  historyList.innerHTML = items.map(item => `
    <div class="history-item">
      <div class="history-label">${item.label}</div>
      <div class="history-value">${item.value}</div>
    </div>
  `).join('');
}

async function ensureLoggedIn() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data?.user) {
    location.href = 'index.html';
    return null;
  }

  currentUser = data.user;
  return data.user;
}

function normalizeAccountStatus(status) {
  return String(status || '').toLowerCase().trim();
}

async function getMyAccount() {
  const { data, error } = await supabaseClient
    .from('au_employee_accounts')
    .select(`
      employee_no,
      auth_user_id,
      signup_approved,
      account_status
    `)
    .eq('auth_user_id', currentUser.id)
    .maybeSingle();

  if (error) {
    console.error('au_employee_accounts 조회 오류:', error);
    throw new Error(`내 계정 정보를 불러오지 못했어. 상세 오류: ${error.message}`);
  }

  if (!data) {
    throw new Error('로그인된 계정의 직원 연결 정보가 없어.');
  }

  return data;
}

function validateAccount(account) {
  const approved = account.signup_approved;
  const status = normalizeAccountStatus(account.account_status);

  if (!approved) {
    throw new Error('아직 승인되지 않은 계정이야.');
  }

  if (status === 'disabled') {
    throw new Error('비활성화된 계정이야.');
  }

  if (status === 'locked') {
    throw new Error('잠긴 계정이야.');
  }
}

async function getMyEmployeeRole(employeeNo) {
  const { data: employeeData, error: employeeError } = await supabaseClient
    .from('au_employees')
    .select('employee_no, system_role_id')
    .eq('employee_no', employeeNo)
    .maybeSingle();

  if (employeeError) {
    console.error('au_employees 조회 오류:', employeeError);
    throw new Error(`직원 정보를 불러오지 못했어. 상세 오류: ${employeeError.message}`);
  }

  if (!employeeData || !employeeData.system_role_id) {
    return 'viewer';
  }

  const { data: roleData, error: roleError } = await supabaseClient
    .from('au_system_roles')
    .select('id, role_name')
    .eq('id', employeeData.system_role_id)
    .maybeSingle();

  if (roleError) {
    console.error('au_system_roles 조회 오류:', roleError);
    throw new Error(`권한 정보를 불러오지 못했어. 상세 오류: ${roleError.message}`);
  }

  return String(roleData?.role_name || 'viewer').toLowerCase();
}

async function ensureAdmin() {
  await ensureLoggedIn();

  const myAccount = await getMyAccount();
  validateAccount(myAccount);

  const myRole = await getMyEmployeeRole(myAccount.employee_no);

  if (myRole !== 'admin') {
    throw new Error('관리자만 접근할 수 있어.');
  }
}

async function loadSelectOptions() {
  const [
    storesRes,
    managersRes,
    teamLeadersRes,
    positionsRes,
    systemRolesRes
  ] = await Promise.all([
    supabaseClient
      .from('au_stores')
      .select('id, store_name, team_leader_employee_no, group_id')
      .eq('is_active', true)
      .order('store_name', { ascending: true }),

    supabaseClient
      .from('au_groups')
      .select('id, group_name')
      .eq('is_active', true)
      .order('group_name', { ascending: true }),

    supabaseClient
      .from('au_team_leaders')
      .select('id, team_leader_name, employee_no, group_id')
      .eq('is_active', true)
      .order('team_leader_name', { ascending: true }),

    supabaseClient
      .from('au_positions')
      .select('id, position_name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),

    supabaseClient
      .from('au_system_roles')
      .select('id, role_name')
      .order('role_name', { ascending: true }),

    supabaseClient
      .from('au_employees')
      .select('current_manager_id, current_team_leader_id, current_store_id')
      .eq('is_active', true)
  ]);

  if (storesRes.error) throw new Error(`매장 불러오기 실패: ${storesRes.error.message}`);
  if (managersRes.error) throw new Error(`담당 불러오기 실패: ${managersRes.error.message}`);
  if (teamLeadersRes.error) throw new Error(`팀장 불러오기 실패: ${teamLeadersRes.error.message}`);
  if (positionsRes.error) throw new Error(`직급 불러오기 실패: ${positionsRes.error.message}`);
  if (systemRolesRes.error) throw new Error(`권한 불러오기 실패: ${systemRolesRes.error.message}`);

  allStores = storesRes.data || [];
  allTeamLeaders = teamLeadersRes.data || [];

  appendOptions(managerSelect, managersRes.data || [], 'group_name');
  appendOptions(positionSelect, positionsRes.data || [], 'position_name');
  appendOptions(systemRoleSelect, systemRolesRes.data || [], 'role_name');

  buildHierarchyMap(teamLeadersRes.data || [], storesRes.data || []);
  clearSelectOptions(teamLeaderSelect, '담당을 먼저 선택하세요');
  clearSelectOptions(storeSelect, '팀장을 먼저 선택하세요');
}

async function loadEmployeeDetail(employeeNo) {
  const { data: employee, error: employeeError } = await supabaseClient
    .from('au_employees')
    .select(`
      employee_no,
      name,
      birth_date,
      phone,
      email,
      address,
      hire_date,
      employment_status,
      is_active,
      current_store_id,
      current_manager_id,
      current_team_leader_id,
      current_position_id,
      system_role_id,
      is_contact_public,
      created_at,
      updated_at
    `)
    .eq('employee_no', employeeNo)
    .maybeSingle();

  if (employeeError) {
    console.error('employee detail error:', employeeError);
    throw new Error(`직원 정보 조회 실패: ${employeeError.message}`);
  }

  if (!employee) {
    throw new Error('해당 직원 정보를 찾을 수 없어.');
  }

  const { data: account, error: accountError } = await supabaseClient
    .from('au_employee_accounts')
    .select(`
      employee_no,
      auth_user_id,
      login_email,
      signup_approved,
      account_status,
      created_at,
      updated_at
    `)
    .eq('employee_no', employeeNo)
    .maybeSingle();

  if (accountError) {
    console.error('employee account detail error:', accountError);
    throw new Error(`직원 계정 정보 조회 실패: ${accountError.message}`);
  }

  loadedEmployee = employee;
  loadedAccount = account || null;

  document.getElementById('employee_no').value = employee.employee_no || '';
  document.getElementById('name').value = employee.name || '';
  document.getElementById('birth_date').value = employee.birth_date || '';
  document.getElementById('hire_date').value = employee.hire_date || '';
  document.getElementById('phone').value = employee.phone || '';
  document.getElementById('email').value = employee.email || '';
  document.getElementById('address').value = employee.address || '';
  document.getElementById('current_manager_id').value = employee.current_manager_id ?? '';

  document.getElementById('current_position_id').value = employee.current_position_id ?? '';
  applyRoleBasedFieldState({ keepCurrentValues: false });

  const leaderValue = employee.current_team_leader_id ?? '';
  if (leaderValue !== '') {
    refreshTeamLeaderOptions({ preserveValue: false });
    teamLeaderSelect.value = String(leaderValue);
  }

  const storeValue = employee.current_store_id ?? '';
  if (storeValue !== '') {
    refreshStoreOptions({ preserveValue: false });
    storeSelect.value = String(storeValue);
  }

  applyRoleBasedFieldState({ keepCurrentValues: true });

  document.getElementById('employment_status').value = employee.employment_status || '재직';
  document.getElementById('system_role_id').value = employee.system_role_id ?? '';
  document.getElementById('is_active').value = String(employee.is_active);
  document.getElementById('is_contact_public').value = String(employee.is_contact_public);

  document.getElementById('login_email').value = account?.login_email || '';
  document.getElementById('signup_approved').value = String(account?.signup_approved ?? true);
  document.getElementById('account_status').value = account?.account_status || 'active';

  renderHistory(employee, account);
}

async function updateEmployee(formData) {
  const employeePayload = {
    name: formData.name.trim(),
    birth_date: formData.birth_date,
    phone: normalizePhone(formData.phone),
    email: formData.email.trim().toLowerCase(),
    address: formData.address.trim(),
    hire_date: formData.hire_date,
    employment_status: formData.employment_status,
    is_active: formData.is_active === 'true',
    current_store_id: toNullableNumber(formData.current_store_id),
    current_manager_id: toNullableNumber(formData.current_manager_id),
    current_team_leader_id: toNullableNumber(formData.current_team_leader_id),
    current_position_id: toNullableNumber(formData.current_position_id),
    system_role_id: toNullableNumber(formData.system_role_id),
    is_contact_public: formData.is_contact_public === 'true'
  };

  const { error } = await supabaseClient
    .from('au_employees')
    .update(employeePayload)
    .eq('employee_no', targetEmployeeNo);

  if (error) {
    console.error('employee update error:', error);
    throw new Error(`직원 정보 수정 실패: ${error.message}`);
  }
}

async function updateEmployeeAccount(formData) {
  if (!loadedAccount) return;

  const accountPayload = {
    login_email: formData.login_email.trim().toLowerCase(),
    signup_approved: formData.signup_approved === 'true',
    account_status: formData.account_status
  };

  const { error } = await supabaseClient
    .from('au_employee_accounts')
    .update(accountPayload)
    .eq('employee_no', targetEmployeeNo);

  if (error) {
    console.error('employee account update error:', error);
    throw new Error(`직원 계정 정보 수정 실패: ${error.message}`);
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  showMessage('', '');

  const formData = Object.fromEntries(new FormData(editForm).entries());
  formData.current_manager_id = managerSelect.value;
  formData.current_team_leader_id = teamLeaderSelect.value;
  formData.current_store_id = storeSelect.value;

  submitBtn.disabled = true;
  saveBtnTop.disabled = true;
  submitBtn.textContent = '처리 중...';
  saveBtnTop.textContent = '처리 중...';

  try {
    await updateEmployee(formData);
    await updateEmployeeAccount(formData);
    await loadEmployeeDetail(targetEmployeeNo);

    showMessage(
      'success',
      loadedAccount
        ? '직원 정보 수정 완료. 로그인 이메일 변경 시 auth.users 동기화는 별도 처리 필요.'
        : '직원 정보 수정 완료.'
    );
  } catch (error) {
    console.error('edit process error:', error);
    showMessage('error', error.message || '수정 중 오류가 발생.');
  } finally {
    submitBtn.disabled = false;
    saveBtnTop.disabled = false;
    submitBtn.textContent = '수정완료';
    saveBtnTop.textContent = '수정완료';
  }
}

saveBtnTop.addEventListener('click', () => {
  editForm.requestSubmit();
});

cancelBtn.addEventListener('click', () => {
  if (loadedEmployee) {
    loadEmployeeDetail(targetEmployeeNo);
    showMessage('', '');
  } else {
    history.back();
  }
});

homeBtn.addEventListener('click', () => {
  location.href = 'front.html';
});

editForm.addEventListener('submit', handleSubmit);

(async function init() {
  try {
    const params = new URLSearchParams(location.search);
    targetEmployeeNo = params.get('employee_no') || '';

    if (!targetEmployeeNo) {
      throw new Error('employee_no 파라미터가 없어.');
    }

    await ensureAdmin();
    await loadSelectOptions();
    bindHierarchyEvents();
    await loadEmployeeDetail(targetEmployeeNo);
  } catch (error) {
    console.error('init error:', error);
    showMessage('error', `초기 데이터 로딩 실패: ${error.message}`);
  }
})();
