    const supabaseClient = window.createSupabaseClient();

    const COLUMN_MAP = {
      directory: {
        employeeNo: 'employee_no', employeeName: 'name', storeName: 'store_name', positionName: 'position_name'
      },
      account: { employeeNo: 'employee_no', authUserId: 'auth_user_id', signupApproved: 'signup_approved', accountStatus: 'account_status' },
      employee: { employeeNo: 'employee_no', systemRoleId: 'system_role_id' },
      role: { id: 'id', roleName: 'role_name' }
    };

    const homeBtn = document.getElementById('homeBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const searchInput = document.getElementById('searchInput');
    const storeFilter = document.getElementById('storeFilter');
    const positionFilter = document.getElementById('positionFilter');
    const countBadge = document.getElementById('countBadge');
    const statusText = document.getElementById('statusText');
    const loadingBox = document.getElementById('loadingBox');
    const errorBox = document.getElementById('errorBox');
    const errorMessage = document.getElementById('errorMessage');
    const emptyBox = document.getElementById('emptyBox');
    const employeeList = document.getElementById('employeeList');
    const blockedBox = document.getElementById('blockedBox');
    const appRoot = document.getElementById('appRoot');

    let allRows = [];
    let currentUser = null;
    let currentRole = 'viewer';

    function normalizeText(value) { return String(value ?? '').trim(); }
    function escapeHtml(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
    function normalizeAccountStatus(status) { return String(status || '').toLowerCase().trim(); }
    function setAdminNavVisibility(roleName) {
      document.querySelectorAll('[data-admin-only="true"]').forEach((el)=>el.classList.toggle('hidden', roleName !== 'admin'));
    }

    function showError(message) {
      loadingBox.classList.add('hidden');
      employeeList.classList.add('hidden');
      emptyBox.classList.add('hidden');
      errorBox.classList.remove('hidden');
      errorMessage.textContent = message;
      statusText.textContent = '오류 발생';
    }

    function fillSelect(selectEl, values) {
      const old = selectEl.value;
      selectEl.innerHTML = '<option value="">전체</option>';
      values.forEach((v) => {
        const op = document.createElement('option');
        op.value = v;
        op.textContent = v;
        selectEl.appendChild(op);
      });
      selectEl.value = values.includes(old) ? old : '';
    }

    function uniqueSorted(rows, key) {
      return [...new Set(rows.map((row) => normalizeText(row[key])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    }

    function renderList() {
      const c = COLUMN_MAP.directory;
      const keyword = normalizeText(searchInput.value).toLowerCase();
      const storeValue = storeFilter.value;
      const positionValue = positionFilter.value;

      const rows = allRows
        .filter((row) => {
          const no = normalizeText(row[c.employeeNo]).toLowerCase();
          const name = normalizeText(row[c.employeeName]).toLowerCase();
          const store = normalizeText(row[c.storeName]);
          const position = normalizeText(row[c.positionName]);
          const matchKeyword = !keyword || no.includes(keyword) || name.includes(keyword);
          const matchStore = !storeValue || store === storeValue;
          const matchPosition = !positionValue || position === positionValue;
          return matchKeyword && matchStore && matchPosition;
        })
        .sort((a, b) => normalizeText(a[c.employeeName]).localeCompare(normalizeText(b[c.employeeName]), 'ko'));

      loadingBox.classList.add('hidden');
      errorBox.classList.add('hidden');
      countBadge.textContent = `총 ${rows.length}명`;

      if (!rows.length) {
        emptyBox.classList.remove('hidden');
        employeeList.classList.add('hidden');
        employeeList.innerHTML = '';
        statusText.textContent = '검색 결과 없음';
        return;
      }

      emptyBox.classList.add('hidden');
      employeeList.classList.remove('hidden');
      employeeList.innerHTML = rows.map((row) => {
        const no = normalizeText(row[c.employeeNo]);
        const name = normalizeText(row[c.employeeName]) || '-';
        const store = normalizeText(row[c.storeName]) || '매장 미지정';
        const position = normalizeText(row[c.positionName]) || '직급 미지정';
        const editBtn = currentRole === 'admin'
          ? `<button type="button" class="btn-secondary" onclick="goEdit('${String(no).replaceAll("'", "\\'")}')">수정</button>`
          : '';

        return `
          <article class="employee-card">
            <div class="employee-main">
              <h3>${escapeHtml(name)} <span style="font-size:12px;color:#667085;">(${escapeHtml(no)})</span></h3>
              <div class="employee-meta">
                <span>매장: ${escapeHtml(store)}</span>
                <span>직급: ${escapeHtml(position)}</span>
              </div>
            </div>
            ${editBtn}
          </article>
        `;
      }).join('');

      statusText.textContent = currentRole === 'admin' ? '목록 조회 완료 · 수정 진입 가능' : '목록 조회 완료';
    }

    function goEdit(employeeNo) {
      if (currentRole !== 'admin') return;
      location.href = `edit.html?employee_no=${encodeURIComponent(employeeNo)}`;
    }
    window.goEdit = goEdit;

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

    async function loadEmployees() {
      const c = COLUMN_MAP.directory;
      loadingBox.classList.remove('hidden');

      const { data, error } = await supabaseClient
        .from('au_employee_directory_view')
        .select(`${c.employeeNo}, ${c.employeeName}, ${c.storeName}, ${c.positionName}`)
        .order(c.employeeName, { ascending: true });

      if (error) {
        console.error('au_employee_directory_view 조회 오류:', error);
        throw new Error(`직원 목록을 불러오지 못했어. 상세 오류: ${error.message}`);
      }

      allRows = Array.isArray(data) ? data : [];
      fillSelect(storeFilter, uniqueSorted(allRows, c.storeName));
      fillSelect(positionFilter, uniqueSorted(allRows, c.positionName));
      renderList();
    }

    homeBtn.addEventListener('click', () => { location.href = 'front.html'; });
    refreshBtn.addEventListener('click', async () => {
      try {
        statusText.textContent = '새로고침 중...';
        await loadEmployees();
      } catch (err) {
        console.error(err);
        showError(err.message || '새로고침 중 오류가 발생했어.');
      }
    });
    searchInput.addEventListener('input', renderList);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') renderList(); });
    storeFilter.addEventListener('change', renderList);
    positionFilter.addEventListener('change', renderList);

    supabaseClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') location.replace('index.html');
    });

    async function init() {
      try {
        statusText.textContent = '로그인 확인 중...';
        await ensureLoggedIn();
        const account = await getMyAccount();
        validateAccount(account);
        currentRole = await getMyEmployeeRole(account.employee_no);
        setAdminNavVisibility(currentRole);
        if (currentRole !== 'admin') {
          appRoot.classList.add('hidden');
          blockedBox.classList.remove('hidden');
          statusText.textContent = '접근 권한 없음';
          return;
        }
        blockedBox.classList.add('hidden');
        appRoot.classList.remove('hidden');
        await loadEmployees();
      } catch (err) {
        console.error(err);
        showError(err.message || '초기 로딩 중 오류가 발생했어.');
      }
    }

    init();
  
