    const supabaseClient = window.createSupabaseClient();

    const messageBox = document.getElementById('messageBox');
    const appRoot = document.getElementById('appRoot');
    const blockedBox = document.getElementById('blockedBox');
    const requestTableBody = document.getElementById('requestTableBody');
    const detailEmpty = document.getElementById('detailEmpty');
    const detailBox = document.getElementById('detailBox');
    const rejectReasonEl = document.getElementById('rejectReason');
    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');

    let selectedRequest = null;
    let currentAdminEmployeeNo = null;
    let currentRole = 'viewer';
    let requestRows = [];

    function showMessage(type, text) {
      messageBox.className = `msg ${type}`;
      messageBox.textContent = text;
    }
    function clearMessage() {
      messageBox.className = 'msg';
      messageBox.textContent = '';
      messageBox.style.display = 'none';
    }
    function safeText(value) { return value ?? '-'; }
    function formatDateTime(value) {
      if (!value) return '-';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }
    function normalizeAccountStatus(status) { return String(status || '').toLowerCase().trim(); }

    function setAdminNavVisibility(roleName) {
      document.querySelectorAll('[data-admin-only="true"]').forEach((el) => {
        el.classList.toggle('hidden', roleName !== 'admin');
      });
    }

    async function ensureAdmin() {
      const { data: userData, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !userData?.user) {
        location.replace('index.html');
        return;
      }

      const user = userData.user;

      const { data: account, error: accountError } = await supabaseClient
        .from('au_employee_accounts')
        .select('employee_no, signup_approved, account_status')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (accountError) {
        console.error('au_employee_accounts 조회 오류:', accountError);
        throw new Error(`계정 정보를 불러오지 못했어. 상세 오류: ${accountError.message}`);
      }
      if (!account) throw new Error('로그인 계정의 직원 연결 정보가 없어.');
      if (!account.signup_approved) throw new Error('승인되지 않은 계정이야.');

      const accountStatus = normalizeAccountStatus(account.account_status);
      if (accountStatus === 'disabled') throw new Error('비활성 계정이야.');
      if (accountStatus === 'locked') throw new Error('잠긴 계정이야.');

      const { data: employeeData, error: employeeError } = await supabaseClient
        .from('au_employees')
        .select('employee_no, system_role_id')
        .eq('employee_no', account.employee_no)
        .maybeSingle();

      if (employeeError) {
        console.error('au_employees 조회 오류:', employeeError);
        throw new Error(`직원 정보를 불러오지 못했어. 상세 오류: ${employeeError.message}`);
      }

      const roleId = employeeData?.system_role_id;
      const { data: roleData, error: roleError } = await supabaseClient
        .from('au_system_roles')
        .select('id, role_name')
        .eq('id', roleId)
        .maybeSingle();

      if (roleError) {
        console.error('au_system_roles 조회 오류:', roleError);
        throw new Error(`권한 정보를 불러오지 못했어. 상세 오류: ${roleError.message}`);
      }

      currentRole = String(roleData?.role_name || 'viewer').toLowerCase();
      currentAdminEmployeeNo = account.employee_no;
      setAdminNavVisibility(currentRole);

      if (currentRole !== 'admin') {
        appRoot.classList.add('hidden');
        blockedBox.classList.remove('hidden');
      }
    }

    async function loadPendingRequests() {
      clearMessage();
      const { data, error } = await supabaseClient
        .from('au_signup_requests')
        .select(`
          id, employee_no, name, birth_date, phone, email, address, hire_date,
          request_status, created_at,
          requested_store_id, requested_manager_id, requested_team_leader_id, requested_position_id,
          au_stores:requested_store_id ( id, store_name ),
          au_managers:requested_manager_id ( id, manager_name ),
          au_team_leaders:requested_team_leader_id ( id, team_leader_name ),
          au_positions:requested_position_id ( id, position_name )
        `)
        .eq('request_status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('au_signup_requests 조회 오류:', error);
        throw new Error(`신청 목록 조회에 실패했어. 상세 오류: ${error.message}`);
      }

      requestRows = data || [];
      renderRequestTable();
    }

    function renderRequestTable() {
      if (!requestRows.length) {
        requestTableBody.innerHTML = `<tr><td colspan="9" class="empty">대기중인 신청이 없어.</td></tr>`;
        selectedRequest = null;
        detailBox.style.display = 'none';
        detailEmpty.style.display = 'block';
        return;
      }

      requestTableBody.innerHTML = requestRows.map((row) => {
        const isActive = selectedRequest && selectedRequest.id === row.id;
        return `
          <tr class="${isActive ? 'active-row' : ''}">
            <td>${formatDateTime(row.created_at)}</td>
            <td>${safeText(row.employee_no)}</td>
            <td>${safeText(row.name)}</td>
            <td>${safeText(row.email)}</td>
            <td>${safeText(row.phone)}</td>
            <td>${safeText(row.au_stores?.store_name)}</td>
            <td>${safeText(row.au_positions?.position_name)}</td>
            <td><span class="badge">${safeText(row.request_status)}</span></td>
            <td><button class="row-btn" type="button" onclick="window.selectRequest(${row.id})">선택</button></td>
          </tr>
        `;
      }).join('');
    }

    function fillDetail(row) {
      document.getElementById('d_id').textContent = safeText(row.id);
      document.getElementById('d_employee_no').textContent = safeText(row.employee_no);
      document.getElementById('d_name').textContent = safeText(row.name);
      document.getElementById('d_phone').textContent = safeText(row.phone);
      document.getElementById('d_email').textContent = safeText(row.email);
      document.getElementById('d_store').textContent = safeText(row.au_stores?.store_name);
      document.getElementById('d_manager').textContent = safeText(row.au_managers?.manager_name);
      document.getElementById('d_team_leader').textContent = safeText(row.au_team_leaders?.team_leader_name);
      document.getElementById('d_position').textContent = safeText(row.au_positions?.position_name);
      document.getElementById('d_status').textContent = safeText(row.request_status);
      document.getElementById('d_created_at').textContent = formatDateTime(row.created_at);
    }

    window.selectRequest = function(requestId) {
      const found = requestRows.find((item) => item.id === requestId);
      if (!found) return;
      selectedRequest = found;
      fillDetail(found);
      detailEmpty.style.display = 'none';
      detailBox.style.display = 'block';
      renderRequestTable();
    };

    async function approveSelectedRequest() {
      if (!selectedRequest) return showMessage('error', '선택된 신청건이 없어.');
      if (!currentAdminEmployeeNo) return showMessage('error', '관리자 사번을 읽지 못했어. 다시 로그인해줘.');

      const ok = confirm(`사번 ${selectedRequest.employee_no || '-'} / ${selectedRequest.name || '-'} 신청을 승인할까?`);
      if (!ok) return;

      const { error } = await supabaseClient.rpc('au_approve_signup_request', {
        p_request_id: selectedRequest.id,
        p_reviewed_by_employee_no: currentAdminEmployeeNo
      });

      if (error) {
        console.error('au_approve_signup_request 오류:', error);
        throw new Error(`승인 처리 실패: ${error.message}`);
      }

      showMessage('success', '승인 처리 완료.');
      selectedRequest = null;
      rejectReasonEl.value = '';
      detailBox.style.display = 'none';
      detailEmpty.style.display = 'block';
      await loadPendingRequests();
    }

    async function rejectSelectedRequest() {
      if (!selectedRequest) return showMessage('error', '선택된 신청건이 없어.');
      if (!currentAdminEmployeeNo) return showMessage('error', '관리자 사번을 읽지 못했어. 다시 로그인해줘.');

      const reason = rejectReasonEl.value.trim();
      if (!reason) return showMessage('error', '거절 사유를 입력해.');

      const ok = confirm(`사번 ${selectedRequest.employee_no || '-'} / ${selectedRequest.name || '-'} 신청을 거절할까?`);
      if (!ok) return;

      const { error } = await supabaseClient.rpc('au_reject_signup_request', {
        p_request_id: selectedRequest.id,
        p_reviewed_by_employee_no: currentAdminEmployeeNo,
        p_reject_reason: reason
      });

      if (error) {
        console.error('au_reject_signup_request 오류:', error);
        throw new Error(`거절 처리 실패: ${error.message}`);
      }

      showMessage('success', '거절 처리 완료.');
      selectedRequest = null;
      rejectReasonEl.value = '';
      detailBox.style.display = 'none';
      detailEmpty.style.display = 'block';
      await loadPendingRequests();
    }

    document.getElementById('gofrontBtn').addEventListener('click', () => { location.href = 'front.html'; });
    document.getElementById('refreshBtn').addEventListener('click', async () => {
      try {
        if (currentRole === 'admin') await loadPendingRequests();
      } catch (error) {
        console.error(error);
        showMessage('error', error.message || '새로고침 중 오류가 발생했어.');
      }
    });

    approveBtn.addEventListener('click', async () => {
      try {
        approveBtn.disabled = true;
        rejectBtn.disabled = true;
        await approveSelectedRequest();
      } catch (error) {
        console.error(error);
        showMessage('error', error.message || '승인 처리 중 오류가 발생했어.');
      } finally {
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
      }
    });

    rejectBtn.addEventListener('click', async () => {
      try {
        approveBtn.disabled = true;
        rejectBtn.disabled = true;
        await rejectSelectedRequest();
      } catch (error) {
        console.error(error);
        showMessage('error', error.message || '거절 처리 중 오류가 발생했어.');
      } finally {
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
      }
    });

    supabaseClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') location.replace('index.html');
    });

    (async function init() {
      try {
        await ensureAdmin();
        if (currentRole === 'admin') await loadPendingRequests();
      } catch (error) {
        console.error(error);
        showMessage('error', error.message || '초기 로딩 중 오류가 발생했어.');
      }
    })();
  
