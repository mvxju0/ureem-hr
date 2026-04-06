    const supabaseClient = window.createSupabaseClient();

    const COLUMN_MAP = {
      account: {
        employeeNo: 'employee_no',
        authUserId: 'auth_user_id',
        signupApproved: 'signup_approved',
        accountStatus: 'account_status'
      },
      employee: {
        employeeNo: 'employee_no',
        systemRoleId: 'system_role_id'
      },
      role: {
        id: 'id',
        roleName: 'role_name'
      },
      store: {
        id: 'id',
        name: 'store_name',
        isActive: 'is_active'
      }
    };

    const appRoot = document.getElementById('appRoot');
    const blockedBox = document.getElementById('blockedBox');
    const goFrontBtn = document.getElementById('goFrontBtn');

    const homeBtn = document.getElementById('homeBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const createBtn = document.getElementById('createBtn');
    const resetBtn = document.getElementById('resetBtn');

    const totalBadge = document.getElementById('totalBadge');
    const activeBadge = document.getElementById('activeBadge');
    const roleText = document.getElementById('roleText');
    const statusText = document.getElementById('statusText');

    const searchInput = document.getElementById('searchInput');
    const activeFilter = document.getElementById('activeFilter');
    const managerFilter = document.getElementById('managerFilter');
    const teamLeaderFilter = document.getElementById('teamLeaderFilter');
    const storeFilter = document.getElementById('storeFilter');

    const feedbackBox = document.getElementById('feedbackBox');

    const loadingBox = document.getElementById('loadingBox');
    const errorBox = document.getElementById('errorBox');
    const errorMessage = document.getElementById('errorMessage');
    const emptyBox = document.getElementById('emptyBox');
    const storeList = document.getElementById('storeList');

    const editorTitle = document.getElementById('editorTitle');
    const editorForm = document.getElementById('editorForm');
    const storeNameInput = document.getElementById('storeNameInput');
    const storeActiveInput = document.getElementById('storeActiveInput');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    let currentUser = null;
    let currentRole = 'viewer';
    let allStores = [];
    let allManagers = [];
    let allTeamLeaders = [];
    let selectedStoreId = null;
    let isSaving = false;

    let teamLeaderIdsByManager = new Map();
    let storeIdsByTeamLeader = new Map();

    function setAdminNavVisibility(roleName) {
      document.querySelectorAll('[data-admin-only="true"]').forEach((el)=>el.classList.toggle('hidden', roleName !== 'admin'));
    }

    function normalizeText(value) {
      return String(value ?? '').trim();
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function toBoolean(value) {
      return value === true || value === 'true';
    }

    function normalizeAccountStatus(status) {
      return String(status || '').toLowerCase().trim();
    }


    function clearSelectOptions(selectEl, placeholder) {
      selectEl.innerHTML = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = placeholder;
      selectEl.appendChild(option);
    }

    function appendSelectOptions(selectEl, items, labelKey) {
      items.forEach((item) => {
        const option = document.createElement('option');
        option.value = String(item.id);
        option.textContent = item[labelKey];
        selectEl.appendChild(option);
      });
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

    function refreshManagerFilter() {
      clearSelectOptions(managerFilter, '전체 담당');
      appendSelectOptions(managerFilter, allManagers, 'manager_name');
      managerFilter.value = '';
    }

    function refreshTeamLeaderFilter({ preserveValue = false } = {}) {
      const prev = preserveValue ? teamLeaderFilter.value : '';
      const managerId = managerFilter.value;

      if (!managerId) {
        clearSelectOptions(teamLeaderFilter, '담당을 먼저 선택하세요');
        teamLeaderFilter.disabled = true;
        teamLeaderFilter.value = '';
        return;
      }

      const allowedIds = teamLeaderIdsByManager.get(Number(managerId));
      const filtered = allowedIds
        ? allTeamLeaders.filter((leader) => allowedIds.has(leader.id))
        : [];

      clearSelectOptions(teamLeaderFilter, filtered.length ? '전체 팀장' : '선택 가능한 팀장 없음');
      appendSelectOptions(teamLeaderFilter, filtered, 'team_leader_name');
      teamLeaderFilter.disabled = false;

      if (preserveValue && filtered.some((leader) => String(leader.id) === String(prev))) {
        teamLeaderFilter.value = prev;
      } else {
        teamLeaderFilter.value = '';
      }
    }

    function refreshStoreFilter({ preserveValue = false } = {}) {
      const prev = preserveValue ? storeFilter.value : '';
      const teamLeaderId = teamLeaderFilter.value;

      if (!teamLeaderId) {
        clearSelectOptions(storeFilter, '팀장을 먼저 선택하세요');
        storeFilter.disabled = true;
        storeFilter.value = '';
        return;
      }

      const allowedIds = storeIdsByTeamLeader.get(Number(teamLeaderId));
      const filtered = allowedIds
        ? allStores.filter((store) => allowedIds.has(store.id))
        : [];

      clearSelectOptions(storeFilter, filtered.length ? '전체 매장' : '선택 가능한 매장 없음');
      appendSelectOptions(storeFilter, filtered, 'store_name');
      storeFilter.disabled = false;

      if (preserveValue && filtered.some((store) => String(store.id) === String(prev))) {
        storeFilter.value = prev;
      } else {
        storeFilter.value = '';
      }
    }

    function setLoading(isLoading) {
      loadingBox.classList.toggle('hidden', !isLoading);
      if (isLoading) {
        errorBox.classList.add('hidden');
        emptyBox.classList.add('hidden');
        storeList.classList.add('hidden');
      }
    }

    function showError(message) {
      loadingBox.classList.add('hidden');
      storeList.classList.add('hidden');
      emptyBox.classList.add('hidden');
      errorBox.classList.remove('hidden');
      errorMessage.textContent = message;
      statusText.textContent = '오류 발생';
    }

    function showFeedback(type, message) {
      feedbackBox.className = `feedback ${type}`;
      feedbackBox.textContent = message;
      feedbackBox.classList.remove('hidden');
    }

    function clearFeedback() {
      feedbackBox.className = 'feedback hidden';
      feedbackBox.textContent = '';
    }

    function updateSavingState(saving) {
      isSaving = saving;
      saveBtn.disabled = saving;
      cancelBtn.disabled = saving;
      deleteBtn.disabled = saving || selectedStoreId === null;
      createBtn.disabled = saving;
      refreshBtn.disabled = saving;
    }

    function setEditorMode(mode, store = null) {
      if (mode === 'create') {
        selectedStoreId = null;
        editorTitle.textContent = '신규 매장 추가';
        storeNameInput.value = '';
        storeActiveInput.value = 'true';
      } else {
        selectedStoreId = store.id;
        editorTitle.textContent = `매장 수정 · ${store.store_name}`;
        storeNameInput.value = store.store_name;
        storeActiveInput.value = String(Boolean(store.is_active));
      }
      deleteBtn.disabled = selectedStoreId === null || isSaving;
    }

    function buildStoreCard(store) {
      const isActive = toBoolean(store.is_active);
      const activeBadgeClass = isActive ? 'chip-active' : 'chip-inactive';
      const activeBadgeText = isActive ? '활성' : '비활성';
      const selectedClass = selectedStoreId === store.id ? ' style="border-color:#111827; box-shadow:0 0 0 2px rgba(17,24,39,0.15);"' : '';

      return `
        <article class="store-card" ${selectedClass}>
          <div class="store-card-header">
            <div>
              <h3 class="store-title">${escapeHtml(store.store_name)}</h3>
              <span class="chip ${activeBadgeClass}">${activeBadgeText}</span>
            </div>
          </div>
          <div class="store-meta">
            <div><strong>ID</strong>${escapeHtml(store.id)}</div>
            <div><strong>대분류</strong>구조 확장 필요</div>
            <div><strong>소속 팀장</strong>구조 확장 필요</div>
            <div><strong>노출 순서</strong>구조 확장 필요</div>
          </div>
          <div class="card-actions">
            <button type="button" class="btn-secondary" onclick="selectStoreForEdit('${String(store.id).replaceAll("'", "\\'")}')">수정</button>
          </div>
        </article>
      `;
    }

    function filterStores() {
      const keyword = normalizeText(searchInput.value).toLowerCase();
      const activeValue = activeFilter.value;
      const selectedStoreFilter = storeFilter.value;

      return allStores.filter((store) => {
        const name = normalizeText(store.store_name).toLowerCase();
        const isActive = toBoolean(store.is_active);

        const matchKeyword = !keyword || name.includes(keyword);
        const matchActive = !activeValue || (activeValue === 'active' ? isActive : !isActive);
        const matchStore = !selectedStoreFilter || String(store.id) === String(selectedStoreFilter);
        return matchKeyword && matchActive && matchStore;
      });
    }

    function sortStores(stores) {
      return [...stores].sort((a, b) => {
        const nameCompare = normalizeText(a.store_name).localeCompare(normalizeText(b.store_name), 'ko');
        if (nameCompare !== 0) return nameCompare;
        return String(a.id).localeCompare(String(b.id), 'ko');
      });
    }

    function renderStoreList() {
      const filtered = sortStores(filterStores());
      const activeCount = allStores.filter((store) => toBoolean(store.is_active)).length;

      totalBadge.textContent = `전체 ${allStores.length}개`;
      activeBadge.textContent = `활성 ${activeCount}개`;

      loadingBox.classList.add('hidden');
      errorBox.classList.add('hidden');

      if (!filtered.length) {
        storeList.classList.add('hidden');
        emptyBox.classList.remove('hidden');
        statusText.textContent = '검색 결과 없음';
        storeList.innerHTML = '';
        return;
      }

      emptyBox.classList.add('hidden');
      storeList.classList.remove('hidden');
      storeList.innerHTML = filtered.map(buildStoreCard).join('');
      statusText.textContent = '매장 목록 조회 완료';
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

    async function getMyAccount() {
      const a = COLUMN_MAP.account;
      const { data, error } = await supabaseClient
        .from('au_employee_accounts')
        .select(`${a.employeeNo}, ${a.authUserId}, ${a.signupApproved}, ${a.accountStatus}`)
        .eq(a.authUserId, currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('au_employee_accounts 조회 오류:', error);
        throw new Error(`내 계정 정보를 불러오지 못했어. 상세 오류: ${error.message}`);
      }

      if (!data) throw new Error('로그인 계정의 직원 연결 정보가 없어.');
      return data;
    }

    function validateAccount(account) {
      if (!account.signup_approved) throw new Error('아직 승인되지 않은 계정이야.');

      const status = normalizeAccountStatus(account.account_status);
      if (status === 'disabled') throw new Error('비활성화된 계정이야.');
      if (status === 'locked') throw new Error('잠긴 계정이야.');
    }

    async function getMyEmployeeRole(employeeNo) {
      const e = COLUMN_MAP.employee;
      const r = COLUMN_MAP.role;

      const { data: employeeData, error: employeeError } = await supabaseClient
        .from('au_employees')
        .select(`${e.employeeNo}, ${e.systemRoleId}`)
        .eq(e.employeeNo, employeeNo)
        .maybeSingle();

      if (employeeError) {
        console.error('au_employees 조회 오류:', employeeError);
        throw new Error(`직원 정보를 불러오지 못했어. 상세 오류: ${employeeError.message}`);
      }

      if (!employeeData || !employeeData[e.systemRoleId]) return 'viewer';

      const { data: roleData, error: roleError } = await supabaseClient
        .from('au_system_roles')
        .select(`${r.id}, ${r.roleName}`)
        .eq(r.id, employeeData[e.systemRoleId])
        .maybeSingle();

      if (roleError) {
        console.error('au_system_roles 조회 오류:', roleError);
        throw new Error(`권한 정보를 불러오지 못했어. 상세 오류: ${roleError.message}`);
      }

      return String(roleData?.[r.roleName] || 'viewer').toLowerCase();
    }

    async function loadStores() {
      setLoading(true);
      const s = COLUMN_MAP.store;

      const hierarchyPromise = supabaseClient
        .from('au_employees')
        .select('current_manager_id, current_team_leader_id, current_store_id');

      const managersPromise = supabaseClient
        .from('au_managers')
        .select('id, manager_name')
        .eq('is_active', true)
        .order('manager_name', { ascending: true });

      const teamLeadersPromise = supabaseClient
        .from('au_team_leaders')
        .select('id, team_leader_name')
        .eq('is_active', true)
        .order('team_leader_name', { ascending: true });

      const { data, error } = await supabaseClient
        .from('au_stores')
        .select(`${s.id}, ${s.name}, ${s.isActive}`)
        .order(s.name, { ascending: true });

      if (error) {
        console.error('au_stores 조회 오류:', error);
        throw new Error(`매장 데이터를 불러오지 못했어. 상세 오류: ${error.message}`);
      }

      const [{ data: hierarchyRows, error: hierarchyError }, { data: managersData, error: managersError }, { data: teamLeadersData, error: teamLeadersError }] = await Promise.all([hierarchyPromise, managersPromise, teamLeadersPromise]);

      if (hierarchyError) {
        console.error('au_employees 계층 조회 오류:', hierarchyError);
        throw new Error(`계층 매핑 데이터를 불러오지 못했어. 상세 오류: ${hierarchyError.message}`);
      }

      if (managersError) {
        console.error('au_managers 조회 오류:', managersError);
        throw new Error(`담당 목록을 불러오지 못했어. 상세 오류: ${managersError.message}`);
      }

      if (teamLeadersError) {
        console.error('au_team_leaders 조회 오류:', teamLeadersError);
        throw new Error(`팀장 목록을 불러오지 못했어. 상세 오류: ${teamLeadersError.message}`);
      }

      allStores = Array.isArray(data) ? data : [];
      allManagers = Array.isArray(managersData) ? managersData : [];
      allTeamLeaders = Array.isArray(teamLeadersData) ? teamLeadersData : [];

      buildHierarchyMap(hierarchyRows || []);
      refreshManagerFilter();
      refreshTeamLeaderFilter();
      refreshStoreFilter();

      renderStoreList();
    }

    async function createStore(payload) {
      const s = COLUMN_MAP.store;
      const { error } = await supabaseClient
        .from('au_stores')
        .insert([{ [s.name]: payload.storeName, [s.isActive]: payload.isActive }]);

      if (error) {
        console.error('au_stores insert 오류:', error);
        throw new Error(`신규 매장 저장에 실패했어. 상세 오류: ${error.message}`);
      }
    }

    async function updateStore(storeId, payload) {
      const s = COLUMN_MAP.store;
      const { error } = await supabaseClient
        .from('au_stores')
        .update({ [s.name]: payload.storeName, [s.isActive]: payload.isActive })
        .eq(s.id, storeId);

      if (error) {
        console.error('au_stores update 오류:', error);
        throw new Error(`매장 수정 저장에 실패했어. 상세 오류: ${error.message}`);
      }
    }

    async function deleteStore(storeId) {
      const s = COLUMN_MAP.store;
      const { error } = await supabaseClient
        .from('au_stores')
        .delete()
        .eq(s.id, storeId);

      if (error) {
        console.error('au_stores delete 오류:', error);
        throw new Error(`매장 삭제에 실패했어. 상세 오류: ${error.message}`);
      }
    }

    async function handleSave(event) {
      event.preventDefault();
      if (isSaving) return;

      const storeName = normalizeText(storeNameInput.value);
      const isActive = toBoolean(storeActiveInput.value);

      if (!storeName) {
        showFeedback('error', '매장명을 입력해줘.');
        return;
      }

      const duplicate = allStores.find((store) => {
        const sameName = normalizeText(store.store_name).toLowerCase() === storeName.toLowerCase();
        const sameId = selectedStoreId !== null && String(store.id) === String(selectedStoreId);
        return sameName && !sameId;
      });

      if (duplicate) {
        showFeedback('error', '같은 이름의 매장이 이미 있어. 매장명을 확인해줘.');
        return;
      }

      try {
        clearFeedback();
        updateSavingState(true);
        statusText.textContent = selectedStoreId === null ? '신규 매장 저장 중...' : '매장 수정 저장 중...';

        const payload = { storeName, isActive };

        if (selectedStoreId === null) {
          await createStore(payload);
          showFeedback('success', '신규 매장을 저장했어.');
        } else {
          await updateStore(selectedStoreId, payload);
          showFeedback('success', '매장 정보를 저장했어.');
        }

        await loadStores();
        setEditorMode('create');
      } catch (err) {
        console.error(err);
        showFeedback('error', err.message || '저장 중 오류가 발생했어.');
        statusText.textContent = '저장 실패';
      } finally {
        updateSavingState(false);
      }
    }

    async function handleDelete() {
      if (selectedStoreId === null || isSaving) return;

      const target = allStores.find((store) => String(store.id) === String(selectedStoreId));
      if (!target) return;

      const confirmed = window.confirm(`"${target.store_name}" 매장을 삭제할까?`);
      if (!confirmed) return;

      try {
        clearFeedback();
        updateSavingState(true);
        statusText.textContent = '매장 삭제 중...';

        await deleteStore(selectedStoreId);
        showFeedback('success', '매장을 삭제했어.');

        await loadStores();
        setEditorMode('create');
      } catch (err) {
        console.error(err);
        showFeedback('error', err.message || '삭제 중 오류가 발생했어.');
      } finally {
        updateSavingState(false);
      }
    }

    function selectStoreForEdit(storeId) {
      const target = allStores.find((store) => String(store.id) === String(storeId));
      if (!target) return;

      clearFeedback();
      setEditorMode('edit', {
        id: target.id,
        store_name: normalizeText(target.store_name),
        is_active: toBoolean(target.is_active)
      });
      renderStoreList();
    }

    window.selectStoreForEdit = selectStoreForEdit;

    function bindEvents() {
      goFrontBtn.addEventListener('click', () => {
        location.href = 'front.html';
      });

      homeBtn.addEventListener('click', () => {
        location.href = 'front.html';
      });

      refreshBtn.addEventListener('click', async () => {
        try {
          clearFeedback();
          statusText.textContent = '새로고침 중...';
          await loadStores();
        } catch (err) {
          console.error(err);
          showError(err.message || '새로고침 중 오류가 발생했어.');
        }
      });

      createBtn.addEventListener('click', () => {
        clearFeedback();
        setEditorMode('create');
      });

      resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        activeFilter.value = '';
        managerFilter.value = '';
        refreshTeamLeaderFilter();
        refreshStoreFilter();
        renderStoreList();
      });

      searchInput.addEventListener('input', renderStoreList);
      searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') renderStoreList();
      });
      activeFilter.addEventListener('change', renderStoreList);
      managerFilter.addEventListener('change', () => {
        refreshTeamLeaderFilter();
        refreshStoreFilter();
        renderStoreList();
      });
      teamLeaderFilter.addEventListener('change', () => {
        refreshStoreFilter();
        renderStoreList();
      });
      storeFilter.addEventListener('change', renderStoreList);

      editorForm.addEventListener('submit', handleSave);
      cancelBtn.addEventListener('click', () => {
        clearFeedback();
        setEditorMode('create');
      });
      deleteBtn.addEventListener('click', handleDelete);

      supabaseClient.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') location.replace('index.html');
      });
    }

    async function init() {
      bindEvents();

      try {
        statusText.textContent = '로그인 상태 확인 중...';
        await ensureLoggedIn();

        const myAccount = await getMyAccount();
        validateAccount(myAccount);

        currentRole = await getMyEmployeeRole(myAccount.employee_no);
        roleText.textContent = `권한: ${currentRole}`;
        setAdminNavVisibility(currentRole);

        if (currentRole !== 'admin') {
          appRoot.classList.add('hidden');
          blockedBox.classList.remove('hidden');
          return;
        }

        blockedBox.classList.add('hidden');
        appRoot.classList.remove('hidden');

        statusText.textContent = '매장 목록 조회 중...';
        await loadStores();
        setEditorMode('create');
      } catch (err) {
        console.error(err);
        showError(err.message || '초기 로딩 중 오류가 발생했어.');
      }
    }

    init();
  
