const supabaseClient = window.createSupabaseClient();

const signupForm = document.getElementById('signupForm');
const submitBtn = document.getElementById('submitBtn');
const messageBox = document.getElementById('messageBox');

const storeSelect = document.getElementById('requested_store_id');
const managerSelect = document.getElementById('requested_manager_id');
const teamLeaderSelect = document.getElementById('requested_team_leader_id');
const positionSelect = document.getElementById('requested_position_id');

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

function setSelectDisabled(selectEl, disabled, placeholderWhenDisabled) {
  selectEl.disabled = disabled;
  if (disabled) {
    clearSelectOptions(selectEl, placeholderWhenDisabled);
  }
}

function buildHierarchyMap(rows) {
  teamLeaderIdsByManager = new Map();
  storeIdsByTeamLeader = new Map();

  (rows || []).forEach((row) => {
    const managerId = row.current_manager_id;
    const teamLeaderId = row.current_team_leader_id;
    const storeId = row.current_store_id;

    if (managerId && teamLeaderId) {
      if (!teamLeaderIdsByManager.has(managerId)) {
        teamLeaderIdsByManager.set(managerId, new Set());
      }
      teamLeaderIdsByManager.get(managerId).add(teamLeaderId);
    }

    if (teamLeaderId && storeId) {
      if (!storeIdsByTeamLeader.has(teamLeaderId)) {
        storeIdsByTeamLeader.set(teamLeaderId, new Set());
      }
      storeIdsByTeamLeader.get(teamLeaderId).add(storeId);
    }
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
    setSelectDisabled(teamLeaderSelect, true, roleName.includes('담당') ? '팀장 선택 불필요' : '팀장 선택 불필요');
    setSelectDisabled(storeSelect, true, '매장 선택 불필요');
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

async function loadSelectOptions() {
  const [
    storesRes,
    managersRes,
    teamLeadersRes,
    positionsRes,
    hierarchyRes
  ] = await Promise.all([
    supabaseClient
      .from('au_stores')
      .select('id, store_name')
      .eq('is_active', true)
      .order('store_name', { ascending: true }),

    supabaseClient
      .from('au_managers')
      .select('id, manager_name')
      .eq('is_active', true)
      .order('manager_name', { ascending: true }),

    supabaseClient
      .from('au_team_leaders')
      .select('id, team_leader_name')
      .eq('is_active', true)
      .order('team_leader_name', { ascending: true }),

    supabaseClient
      .from('au_positions')
      .select('id, position_name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),

    supabaseClient
      .from('au_employees')
      .select('current_manager_id, current_team_leader_id, current_store_id')
      .eq('is_active', true)
  ]);

  console.log('storesRes:', storesRes);
  console.log('managersRes:', managersRes);
  console.log('teamLeadersRes:', teamLeadersRes);
  console.log('positionsRes:', positionsRes);

  if (storesRes.error) throw new Error(`매장 불러오기 실패: ${storesRes.error.message}`);
  if (managersRes.error) throw new Error(`담당 불러오기 실패: ${managersRes.error.message}`);
  if (teamLeadersRes.error) throw new Error(`팀장 불러오기 실패: ${teamLeadersRes.error.message}`);
  if (positionsRes.error) throw new Error(`직급 불러오기 실패: ${positionsRes.error.message}`);
  if (hierarchyRes.error) throw new Error(`계층 매핑 불러오기 실패: ${hierarchyRes.error.message}`);

  allStores = storesRes.data || [];
  allTeamLeaders = teamLeadersRes.data || [];

  appendOptions(managerSelect, managersRes.data || [], 'manager_name');
  appendOptions(positionSelect, positionsRes.data || [], 'position_name');

  buildHierarchyMap(hierarchyRes.data || []);

  clearSelectOptions(teamLeaderSelect, '담당을 먼저 선택하세요');
  clearSelectOptions(storeSelect, '팀장을 먼저 선택하세요');
}

async function createSignupRequest(formData, authUserId) {
  const payload = {
    auth_user_id: authUserId,
    employee_no: formData.employee_no.trim(),
    name: formData.name.trim(),
    birth_date: formData.birth_date,
    phone: normalizePhone(formData.phone),
    email: formData.email.trim().toLowerCase(),
    address: formData.address.trim(),
    hire_date: formData.hire_date,
    requested_store_id: toNullableNumber(formData.requested_store_id),
    requested_manager_id: toNullableNumber(formData.requested_manager_id),
    requested_team_leader_id: toNullableNumber(formData.requested_team_leader_id),
    requested_position_id: toNullableNumber(formData.requested_position_id),
    request_status: 'pending'
  };

  console.log('signup request payload:', payload);

  const { error } = await supabaseClient
    .from('au_signup_requests')
    .insert(payload);

  if (error) {
    console.error('signup request error:', error);
    throw new Error(error.message);
  }
}

async function signUpAuth(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  console.log('signUp data:', data);
  console.log('signUp error:', error);
  console.log('user:', data?.user);
  console.log('session:', data?.session);

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.user?.id) {
    throw new Error('회원가입 처리 중 auth user 생성에 실패.');
  }

  return data.user.id;
}

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMessage('', '');

  const formData = Object.fromEntries(new FormData(signupForm).entries());
  formData.requested_manager_id = managerSelect.value;
  formData.requested_team_leader_id = teamLeaderSelect.value;
  formData.requested_store_id = storeSelect.value;

  if (formData.password !== formData.password_confirm) {
    showMessage('error', '비밀번호 확인 불일치.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '처리 중...';

  try {
    const authUserId = await signUpAuth(
      formData.email.trim().toLowerCase(),
      formData.password
    );

    await createSignupRequest(formData, authUserId);

    signupForm.reset();
    clearSelectOptions(teamLeaderSelect, '담당을 먼저 선택하세요');
    clearSelectOptions(storeSelect, '팀장을 먼저 선택하세요');

    showMessage('success', '가입 신청 완료.');
  } catch (error) {
    console.error('signup process error:', error);
    showMessage('error', error.message || '가입 신청 중 오류가 발생.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '가입 신청하기';
  }
});

(async function init() {
  try {
    await loadSelectOptions();
    bindHierarchyEvents();
    applyRoleBasedFieldState();
  } catch (error) {
    console.error('init error:', error);
    showMessage('error', `초기 데이터 로딩 실패: ${error.message}`);
  }
})();
