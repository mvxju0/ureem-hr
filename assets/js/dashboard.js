    const supabaseClient = window.createSupabaseClient();

    const COLUMN_MAP = {
      directory: {
        employeeNo: 'employee_no', employeeName: 'name', storeName: 'store_name', managerName: 'manager_name',
        teamLeaderName: 'team_leader_name', positionName: 'position_name', publicPhone: 'public_phone', phone: 'phone'
      },
      account: { employeeNo: 'employee_no', authUserId: 'auth_user_id', signupApproved: 'signup_approved', accountStatus: 'account_status' },
      employee: { employeeNo: 'employee_no', systemRoleId: 'system_role_id' },
      role: { id: 'id', roleName: 'role_name' }
    };

    let allGroups = [];
    let employeeGroupMap = new Map();

    const approveBtn = document.getElementById('approveBtn');
    const storeEditBtn = document.getElementById('storeEditBtn');
    const welcomeText = document.getElementById('welcomeText');
    const refreshBtn = document.getElementById('refreshBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const searchInput = document.getElementById('searchInput');
    const positionFilter = document.getElementById('positionFilter');
    const countBadge = document.getElementById('countBadge');
    const leaderBadge = document.getElementById('leaderBadge');
    const roleText = document.getElementById('roleText');
    const statusText = document.getElementById('statusText');
    const metricEmployees = document.getElementById('metricEmployees');
    const metricStores = document.getElementById('metricStores');
    const metricLeaders = document.getElementById('metricLeaders');
    const metricTab = document.getElementById('metricTab');

    const majorTabList = document.getElementById('majorTabList');
    const majorGuideText = document.getElementById('majorGuideText');
    const majorMissingNotice = document.getElementById('majorMissingNotice');
    const loadingBox = document.getElementById('loadingBox');
    const errorBox = document.getElementById('errorBox');
    const errorMessage = document.getElementById('errorMessage');
    const emptyBox = document.getElementById('emptyBox');
    const leaderList = document.getElementById('leaderList');

    let allRows = [];
    let currentUser = null;
    let currentRole = 'viewer';
    let selectedMajorGroup = '전체';

    function setAdminNavVisibility(roleName) {
      document.querySelectorAll('[data-admin-only="true"]').forEach((el) => {
        el.classList.toggle('hidden', roleName !== 'admin');
      });
    }

    function escapeHtml(value) {
      return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
    }
    function normalizeText(value) { return String(value ?? '').trim(); }
    function normalizeAccountStatus(status) { return String(status || '').toLowerCase().trim(); }

    function extractDialableNumber(phoneValue) {
      const raw = normalizeText(phoneValue);
      if (!raw) return '';
      return raw.replace(/[^0-9+]/g, '');
    }

    function buildContactButtons(phoneValue) {
      const dialable = extractDialableNumber(phoneValue);
      if (!dialable) return '';
      return `
        <div class="staff-contact-wrap">
          <a href="tel:${escapeHtml(dialable)}" class="contact-btn call-btn" onclick="event.stopPropagation();">📞</a>
          <a href="sms:${escapeHtml(dialable)}" class="contact-btn sms-btn" onclick="event.stopPropagation();">💬</a>
        </div>
      `;
    }

    function buildLeaderContactButtons(phoneValue) {
      const dialable = extractDialableNumber(phoneValue);
      if (!dialable) return '';
      return `
        <div class="leader-contact-wrap">
          <a href="tel:${escapeHtml(dialable)}" class="contact-btn call-btn" onclick="event.stopPropagation();">📞</a>
          <a href="sms:${escapeHtml(dialable)}" class="contact-btn sms-btn" onclick="event.stopPropagation();">💬</a>
        </div>
      `;
    }

    function uniqueSortedValues(rows, key) {
      const values = rows.map((row) => row[key]).filter((v) => normalizeText(v) !== '').map((v) => normalizeText(v));
      return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ko'));
    }

    function fillSelect(selectEl, values) {
      const oldValue = selectEl.value;
      selectEl.innerHTML = '<option value="">전체</option>';
      values.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        selectEl.appendChild(option);
      });
      selectEl.value = values.includes(oldValue) ? oldValue : '';
    }

    function setLoading(isLoading) {
      loadingBox.classList.toggle('hidden', !isLoading);
      if (isLoading) {
        leaderList.classList.add('hidden');
        emptyBox.classList.add('hidden');
        errorBox.classList.add('hidden');
      }
    }

    function showError(message) {
      loadingBox.classList.add('hidden');
      leaderList.classList.add('hidden');
      emptyBox.classList.add('hidden');
      errorBox.classList.remove('hidden');
      errorMessage.textContent = message;
      statusText.textContent = '오류 발생';
    }

    function canUseMajorFilter() {
      return allGroups.length > 0;
    }

    function renderMajorTabs() {
      majorTabList.innerHTML = '';
      const majorFilterEnabled = canUseMajorFilter();
      const groups = ['전체', ...allGroups.map((group) => normalizeText(group.group_name)).filter(Boolean)];
      groups.forEach((groupName) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tab-chip${groupName === selectedMajorGroup ? ' active' : ''}`;
        button.textContent = groupName;
        button.addEventListener('click', () => {
          selectedMajorGroup = groupName;
          renderMajorTabs();
          renderDirectory();
        });
        majorTabList.appendChild(button);
      });

      majorMissingNotice.classList.add('hidden');
      majorGuideText.textContent = majorFilterEnabled
        ? '대분류(담당) 탭을 누르면 팀장 카드/매장/직원 목록이 즉시 갱신돼.'
        : '담당 데이터를 불러오는 중이야.';
    }

    function filterRows() {
      const c = COLUMN_MAP.directory;
      const keyword = normalizeText(searchInput.value).toLowerCase();
      const selectedPosition = positionFilter.value;

      return allRows.filter((row) => {
        const employeeNo = normalizeText(row[c.employeeNo]).toLowerCase();
        const employeeName = normalizeText(row[c.employeeName]).toLowerCase();
        const teamLeaderName = normalizeText(row[c.teamLeaderName]).toLowerCase();
        const storeName = normalizeText(row[c.storeName]).toLowerCase();
        const positionName = normalizeText(row[c.positionName]);

        const matchKeyword = !keyword || employeeNo.includes(keyword) || employeeName.includes(keyword) || teamLeaderName.includes(keyword) || storeName.includes(keyword);
        const matchPosition = !selectedPosition || positionName === selectedPosition;

        let matchMajor = true;
        if (selectedMajorGroup !== '전체') {
          if (canUseMajorFilter()) {
            const employeeNoRaw = normalizeText(row[c.employeeNo]);
            const groupId = employeeGroupMap.get(employeeNoRaw);
            const selectedGroup = allGroups.find((group) => normalizeText(group.group_name) === selectedMajorGroup);
            matchMajor = Boolean(selectedGroup && String(selectedGroup.id) === String(groupId));
          } else {
            matchMajor = false;
          }
        }
        return matchKeyword && matchPosition && matchMajor;
      });
    }

    function sortRows(rows) {
      const c = COLUMN_MAP.directory;
      return [...rows].sort((a, b) => {
        const leaderCompare = normalizeText(a[c.teamLeaderName]).localeCompare(normalizeText(b[c.teamLeaderName]), 'ko');
        if (leaderCompare !== 0) return leaderCompare;
        const storeCompare = normalizeText(a[c.storeName]).localeCompare(normalizeText(b[c.storeName]), 'ko');
        if (storeCompare !== 0) return storeCompare;
        return normalizeText(a[c.employeeName]).localeCompare(normalizeText(b[c.employeeName]), 'ko');
      });
    }

    function groupByLeaderAndStore(rows) {
      const c = COLUMN_MAP.directory;
      const leaderMap = new Map();

      rows.forEach((row) => {
        const leaderName = normalizeText(row[c.teamLeaderName]) || '팀장 미지정';
        const storeName = normalizeText(row[c.storeName]) || '매장 미지정';
        const employeeName = normalizeText(row[c.employeeName]);
        const employeePhone = row[c.publicPhone] ?? row[c.phone] ?? '';

        if (!leaderMap.has(leaderName)) {
          leaderMap.set(leaderName, { leaderName, leaderPhone: '', stores: new Map(), staffCount: 0 });
        }

        const leader = leaderMap.get(leaderName);
        if (!leader.leaderPhone && employeeName && employeeName === leaderName) {
          leader.leaderPhone = employeePhone;
        }

        if (!leader.stores.has(storeName)) {
          leader.stores.set(storeName, { storeName, staff: [] });
        }

        leader.stores.get(storeName).staff.push(row);
        leader.staffCount += 1;
      });

      return [...leaderMap.values()]
        .sort((a, b) => a.leaderName.localeCompare(b.leaderName, 'ko'))
        .map((leader) => {
          const stores = [...leader.stores.values()]
            .sort((a, b) => a.storeName.localeCompare(b.storeName, 'ko'))
            .map((store) => ({
              ...store,
              staff: store.staff.sort((a, b) => normalizeText(a[c.employeeName]).localeCompare(normalizeText(b[c.employeeName]), 'ko'))
            }));

          return { leaderName: leader.leaderName, leaderPhone: leader.leaderPhone, storeCount: stores.length, staffCount: leader.staffCount, stores };
        });
    }

    function goEdit(employeeNo) {
      if (currentRole !== 'admin') return;
      location.href = `edit.html?employee_no=${encodeURIComponent(employeeNo)}`;
    }

    function buildStaffItem(row) {
      const c = COLUMN_MAP.directory;
      const employeeNo = normalizeText(row[c.employeeNo]);
      const employeeName = normalizeText(row[c.employeeName]) || '-';
      const positionName = normalizeText(row[c.positionName]) || '직급 미지정';
      const phoneValue = row[c.publicPhone] ?? row[c.phone] ?? '';
      const adminClass = currentRole === 'admin' ? 'admin-action' : '';
      const adminClick = currentRole === 'admin' ? `onclick="goEdit('${String(employeeNo).replaceAll("'", "\\'")}')"` : '';

      return `
        <li class="staff-item ${adminClass}" ${adminClick}>
          <div class="staff-main">
            <span class="staff-name">${escapeHtml(employeeName)}</span>
            <span class="staff-position">${escapeHtml(positionName)}</span>
          </div>
          ${buildContactButtons(phoneValue)}
        </li>
      `;
    }

    function buildLeaderCard(leaderGroup) {
      const storeHtml = leaderGroup.stores.map((store) => `
        <section class="store-block">
          <h4 class="store-title">${escapeHtml(store.storeName)}</h4>
          <ul class="staff-list">${store.staff.map(buildStaffItem).join('')}</ul>
        </section>
      `).join('');

      return `
        <article class="leader-card">
          <div class="leader-head">
            <div class="leader-title-wrap">
              <span class="leader-label">TEAM LEADER</span>
              <h3 class="leader-name">${escapeHtml(leaderGroup.leaderName)}</h3>
              ${buildLeaderContactButtons(leaderGroup.leaderPhone)}
            </div>
            <div class="leader-meta">
              <span class="meta-pill">매장 ${leaderGroup.storeCount}개</span>
              <span class="meta-pill">직원 ${leaderGroup.staffCount}명</span>
            </div>
          </div>
          <div class="store-list">${storeHtml}</div>
        </article>
      `;
    }

    function updateDashboardMetrics(filteredRows, leaderGroups) {
      const c = COLUMN_MAP.directory;
      const storeSet = new Set(filteredRows.map((row) => normalizeText(row[c.storeName])).filter(Boolean));
      metricEmployees.textContent = String(filteredRows.length);
      metricStores.textContent = String(storeSet.size);
      metricLeaders.textContent = String(leaderGroups.length);
      metricTab.textContent = selectedMajorGroup;
    }

    function renderDirectory() {
      const filteredRows = sortRows(filterRows());
      const leaderGroups = groupByLeaderAndStore(filteredRows);
      loadingBox.classList.add('hidden');
      errorBox.classList.add('hidden');
      countBadge.textContent = `총 ${filteredRows.length}명`;
      leaderBadge.textContent = `팀장 ${leaderGroups.length}명`;
      updateDashboardMetrics(filteredRows, leaderGroups);

      if (!filteredRows.length) {
        leaderList.classList.add('hidden');
        emptyBox.classList.remove('hidden');
        statusText.textContent = '검색 결과 없음';
        leaderList.innerHTML = '';
        return;
      }

      emptyBox.classList.add('hidden');
      leaderList.classList.remove('hidden');
      leaderList.innerHTML = leaderGroups.map(buildLeaderCard).join('');
      statusText.textContent = currentRole === 'admin' ? '조회 완료 · 직원 클릭 시 수정 페이지로 이동 가능' : '조회 완료';
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
      if (!data) throw new Error('로그인된 계정의 직원 연결 정보가 없어.');
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

    async function loadDirectory() {
      setLoading(true);
      const c = COLUMN_MAP.directory;
      const directoryPromise = supabaseClient
        .from('au_employee_directory_view')
        .select(`${c.employeeNo}, ${c.employeeName}, ${c.storeName}, ${c.managerName}, ${c.teamLeaderName}, ${c.positionName}, ${c.publicPhone}`)
        .order(c.teamLeaderName, { ascending: true })
        .order(c.storeName, { ascending: true })
        .order(c.employeeName, { ascending: true });

      const groupsPromise = supabaseClient
        .from('au_groups')
        .select('id, group_name')
        .eq('is_active', true)
        .order('group_name', { ascending: true });

      const employeesPromise = supabaseClient
        .from('au_employees')
        .select('employee_no, current_manager_id');

      const [
        { data, error },
        { data: groupsData, error: groupsError },
        { data: employeesData, error: employeesError }
      ] = await Promise.all([directoryPromise, groupsPromise, employeesPromise]);

      if (error) {
        console.error('au_employee_directory_view 조회 오류:', error);
        throw new Error(`조직도 데이터를 불러오지 못했어. 상세 오류: ${error.message}`);
      }
      if (groupsError) {
        console.error('au_groups 조회 오류:', groupsError);
        throw new Error(`담당 데이터를 불러오지 못했어. 상세 오류: ${groupsError.message}`);
      }
      if (employeesError) {
        console.error('au_employees 조회 오류:', employeesError);
        throw new Error(`직원-담당 매핑 데이터를 불러오지 못했어. 상세 오류: ${employeesError.message}`);
      }

      allRows = Array.isArray(data) ? data : [];
      allGroups = Array.isArray(groupsData) ? groupsData : [];
      employeeGroupMap = new Map(
        (Array.isArray(employeesData) ? employeesData : [])
          .filter((row) => normalizeText(row.employee_no) !== '')
          .map((row) => [normalizeText(row.employee_no), row.current_manager_id])
      );
      fillSelect(positionFilter, uniqueSortedValues(allRows, c.positionName));
      renderMajorTabs();
      renderDirectory();
    }

    approveBtn.addEventListener('click', () => { location.href = 'auth-requests.html'; });
    storeEditBtn.addEventListener('click', () => { location.href = 'store-edit.html'; });
    refreshBtn.addEventListener('click', async () => {
      try { statusText.textContent = '새로고침 중...'; await loadDirectory(); }
      catch (err) { console.error(err); showError(err.message || '새로고침 중 오류가 발생했어.'); }
    });

    logoutBtn.addEventListener('click', async () => {
      try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) { console.error('로그아웃 오류:', error); alert(`로그아웃 실패: ${error.message}`); return; }
        location.replace('index.html');
      } catch (err) {
        console.error('로그아웃 처리 예외:', err);
        alert(err.message || '로그아웃 중 오류가 발생했어.');
      }
    });

    searchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') renderDirectory(); });
    searchInput.addEventListener('input', renderDirectory);
    positionFilter.addEventListener('change', renderDirectory);

    supabaseClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') location.replace('index.html');
    });

    async function init() {
      try {
        statusText.textContent = '로그인 상태 확인 중...';
        await ensureLoggedIn();
        statusText.textContent = '조직도 조회 중...';
        await loadDirectory();

        const myAccount = await getMyAccount();
        validateAccount(myAccount);
        currentRole = await getMyEmployeeRole(myAccount.employee_no);
        setAdminNavVisibility(currentRole);

        welcomeText.textContent = `${myAccount.employee_no} 로그인됨`;
        roleText.textContent = `권한: ${currentRole}`;

        if (currentRole === 'admin') {
          approveBtn.style.display = 'inline-flex';
          storeEditBtn.style.display = 'inline-flex';
        }

        renderDirectory();
      } catch (err) {
        console.error(err);
        showError(err.message || '초기 로딩 중 오류가 발생했어.');
      }
    }

    init();
  
