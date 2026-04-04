    const supabaseClient = window.createSupabaseClient();

    const signupForm = document.getElementById('signupForm');
    const submitBtn = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');

    const storeSelect = document.getElementById('requested_store_id');
    const managerSelect = document.getElementById('requested_manager_id');
    const teamLeaderSelect = document.getElementById('requested_team_leader_id');
    const positionSelect = document.getElementById('requested_position_id');

    function showMessage(type, text) {
      messageBox.className = `msg ${type}`;
      messageBox.textContent = text;
      messageBox.style.display = type ? 'block' : 'none';
    }

    function normalizePhone(phone) {
      return String(phone || '').replace(/[^0-9]/g, '');
    }

    function appendOptions(selectEl, list, labelKey) {
      list.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item[labelKey];
        selectEl.appendChild(option);
      });
    }

    async function loadSelectOptions() {
      const [
        storesRes,
        managersRes,
        teamLeadersRes,
        positionsRes
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
          .order('sort_order', { ascending: true })
      ]);

      console.log('storesRes:', storesRes);
      console.log('managersRes:', managersRes);
      console.log('teamLeadersRes:', teamLeadersRes);
      console.log('positionsRes:', positionsRes);

      if (storesRes.error) throw new Error(`매장 불러오기 실패: ${storesRes.error.message}`);
      if (managersRes.error) throw new Error(`담당 불러오기 실패: ${managersRes.error.message}`);
      if (teamLeadersRes.error) throw new Error(`팀장 불러오기 실패: ${teamLeadersRes.error.message}`);
      if (positionsRes.error) throw new Error(`직급 불러오기 실패: ${positionsRes.error.message}`);

      appendOptions(storeSelect, storesRes.data || [], 'store_name');
      appendOptions(managerSelect, managersRes.data || [], 'manager_name');
      appendOptions(teamLeaderSelect, teamLeadersRes.data || [], 'team_leader_name');
      appendOptions(positionSelect, positionsRes.data || [], 'position_name');
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
        requested_store_id: Number(formData.requested_store_id),
        requested_manager_id: Number(formData.requested_manager_id),
        requested_team_leader_id: Number(formData.requested_team_leader_id),
        requested_position_id: Number(formData.requested_position_id),
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
      } catch (error) {
        console.error('init error:', error);
        showMessage('error', `초기 데이터 로딩 실패: ${error.message}`);
      }
    })();
  
