    const supabaseClient = window.createSupabaseClient();

    const employeeNoInput = document.getElementById("employeeNoInput");
    const passwordInput = document.getElementById("passwordInput");
    const loginBtn = document.getElementById("loginBtn");
    const signupBtn = document.getElementById("signupBtn");
    const loadingText = document.getElementById("loadingText");
    const messageBox = document.getElementById("messageBox");

    function setLoading(isLoading) {
      loadingText.style.display = isLoading ? "block" : "none";
      loginBtn.disabled = isLoading;
      signupBtn.disabled = isLoading;
      employeeNoInput.disabled = isLoading;
      passwordInput.disabled = isLoading;
    }

    function showMessage(message, type = "error") {
      messageBox.className = `message ${type}`;
      messageBox.textContent = message;
    }

    function clearMessage() {
      messageBox.className = "message";
      messageBox.textContent = "";
    }

    async function checkAlreadyLoggedIn() {
      const { data, error } = await supabaseClient.auth.getUser();

      if (!error && data?.user) {
        location.href = "front.html";
      }
    }

    async function getLoginAccountByEmployeeNo(employeeNo) {
      const { data, error } = await supabaseClient.rpc("au_get_login_account_by_employee_no", {
        p_employee_no: employeeNo
      });

      if (error) {
        console.error("로그인 계정 조회 RPC 오류:", error);
        throw new Error(`사번 조회에 실패했어. 상세 오류: ${error.message}`);
      }

      if (!data || !data.length) {
        throw new Error("해당 사번으로 로그인 가능한 계정이 없습니다");
      }

      return data[0];
    }

    async function login() {
      clearMessage();

      const employeeNo = employeeNoInput.value.trim();
      const password = passwordInput.value.trim();

      if (!employeeNo) {
        showMessage("사번을 입력해주세요");
        employeeNoInput.focus();
        return;
      }

      if (!password) {
        showMessage("비밀번호를 입력해주세요");
        passwordInput.focus();
        return;
      }

      try {
        setLoading(true);

        const account = await getLoginAccountByEmployeeNo(employeeNo);

        const loginEmail = account.login_email;
        const signupApproved = account.signup_approved;
        const accountStatus = String(account.account_status || "").toLowerCase();

        if (!loginEmail) {
          throw new Error("로그인 이메일 정보가 없습니다. 관리자 문의.");
        }

        if (signupApproved !== true) {
          throw new Error("아직 승인되지 않은 계정입니다");
        }

        if (accountStatus === "disabled") {
          throw new Error("비활성화된 계정입니다. 관리자 문의.");
        }

        if (accountStatus === "locked") {
          throw new Error("잠긴 계정입니다. 관리자 문의.");
        }

        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
          email: loginEmail,
          password: password
        });

        if (signInError) {
          console.error("로그인 오류:", signInError);

          if (
            signInError.message?.toLowerCase().includes("invalid login credentials") ||
            signInError.message?.toLowerCase().includes("invalid credentials")
          ) {
            throw new Error("비밀번호가 맞지 않거나 로그인 정보가 올바르지 않아.");
          }

          throw new Error(`로그인에 실패했어. 상세 오류: ${signInError.message}`);
        }

        showMessage("로그인 성공. 이동 중...", "success");
        location.href = "front.html";
      } catch (err) {
        console.error(err);
        showMessage(err.message || "로그인 중 오류가 발생했어.");
      } finally {
        setLoading(false);
      }
    }

    loginBtn.addEventListener("click", login);

    signupBtn.addEventListener("click", () => {
      location.href = "auth.html";
    });

    employeeNoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        login();
      }
    });

    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        login();
      }
    });

    checkAlreadyLoggedIn();
  
