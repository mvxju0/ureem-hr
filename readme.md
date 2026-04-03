# 📌 프로젝트 개요

이 시스템은 사내 직원 조직도 관리 시스템이다.

주요 기능:

* 직원 조직도 조회 (front.html)
* 직원 정보 수정 (edit.html, 관리자 전용)
* 회원가입 신청 및 승인 (auth.html / auth-requests.html)
* 매장 / 담당 / 팀장 / 직급 기반 조직 구조 관리

기술 스택:

* HTML / CSS / Vanilla JS
* Supabase Auth + Postgres

---

# 📌 페이지 구조

index.html → 로그인
auth.html → 회원가입 신청
auth-requests.html → 가입 승인 (관리자)
front.html → 조직도 조회 (전체 사용자)
edit.html → 직원 정보 수정 (관리자)
store-edit.html → 매장 관리 (예정)

---

# 📌 핵심 구조 (매우 중요)

시스템은 아래 4단 구조다:

1. auth.users (Supabase 인증)
2. au_employee_accounts (로그인 연결)
3. au_employees (직원 본체)
4. au_employee_directory_view (조회용 view)

절대 이 구조를 벗어나면 안 된다.

---

# 📌 DB 테이블 구조

## 1. au_signup_requests (가입 신청)

* id
* auth_user_id
* employee_no
* name
* birth_date
* phone
* email
* address
* hire_date
* requested_store_id
* requested_manager_id
* requested_team_leader_id
* requested_position_id
* request_status (pending / approved / rejected)
* reviewed_by_employee_no
* reviewed_at
* reject_reason
* created_at
* updated_at

👉 실제 조직 반영 전 대기 테이블

---

## 2. au_employees (직원 본체)

* employee_no (PK)
* name
* birth_date
* phone
* email
* address
* hire_date
* employment_status
* is_active
* current_store_id
* current_manager_id
* current_team_leader_id
* current_position_id
* system_role_id
* is_contact_public
* created_at
* updated_at

👉 조직 / 권한 / 소속의 기준

---

## 3. au_employee_accounts (로그인 연결)

* employee_no
* auth_user_id
* login_email
* signup_approved
* account_status
* failed_login_count
* created_at
* updated_at

👉 로그인 가능 여부 판단 기준

---

## 4. au_system_roles (권한)

* id
* role_name

예:

* admin
* viewer

---

## 5. 조직 마스터 테이블

### au_stores

* id
* store_name
* is_active

### au_managers

* id
* manager_name
* is_active

### au_team_leaders

* id
* team_leader_name
* is_active

### au_positions

* id
* position_name
* sort_order
* is_active

---

## 6. 조직도 view

au_employee_directory_view

컬럼:

* employee_no
* name
* store_name
* manager_name
* team_leader_name
* position_name
* public_phone

👉 front는 무조건 이 view 사용

---

# 📌 로그인 구조

1. index에서 로그인
2. au_employee_accounts 조회
3. signup_approved 확인
4. account_status 확인
5. Supabase 로그인
6. front 이동
7. front에서 다시 auth.getUser()
8. employee_no 확인
9. system_role_id 조회
10. role_name 조회

---

# 📌 관리자 판별 로직 (절대 변경 금지)

1. au_employee_accounts → employee_no
2. au_employees → system_role_id
3. au_system_roles → role_name

role_name === 'admin' → 관리자

---

# 📌 front.html 기능

* 조직도 표 출력

* 컬럼:
  담당 / 팀장 / 매장 / 직원명 / 직급 / 연락처

* 기능:

  * 검색 (이름/사번)
  * 필터 (매장/담당/팀장/직급)
  * 직급별 요약 표시
  * 통화 버튼 (tel 링크)

* 관리자 기능:

  * 가입승인 버튼
  * 매장편집 버튼
  * 직원 클릭 시 edit 이동

---

# 📌 연락처 통화 버튼 규칙

반드시 이 방식 사용:

```html
<a href="tel:01012345678">통화</a>
```

* 모바일: 바로 전화 연결
* PC: 환경 따라 다름

row 클릭 충돌 방지 필수:

```html
onclick="event.stopPropagation();"
```

---

# 📌 edit.html 기능

* 직원 정보 수정
* employees + accounts 동시 수정

수정 대상:

* 이름
* 전화번호
* 이메일
* 주소
* 매장
* 담당
* 팀장
* 직급
* 권한
* 계정 상태

---

# 📌 auth.html

* 회원가입 신청
* au_signup_requests insert

---

# 📌 auth-requests.html

* 승인 시:

  * au_employees insert
  * au_employee_accounts insert

---

# 📌 절대 금지 사항

❌ 컬럼명 추측 금지
❌ 테이블 구조 추측 금지
❌ view 안 쓰고 직접 join 금지
❌ myRole / currentRole 혼용 금지

---

# 📌 자주 발생하는 오류

1. JS 전체 멈춤
   → return 위치 오류

2. 관리자 버튼 안 보임
   → role 변수 꼬임

3. 연락처 안 보임
   → select에 public_phone 없음

4. 클릭하면 페이지 이동 안됨
   → stopPropagation 없음

---

# 📌 반드시 지켜야 할 원칙

1. front는 조회용이다 (절대 막히면 안 됨)
2. edit는 관리자 전용이다
3. 조직도는 view 기준이다
4. 권한 판별은 지정된 순서만 사용한다
5. 디버깅 시 console.error 필수

---

# 📌 현재 상태

* front: 완성
* edit: 완성
* auth: 완료
* 승인: 완료
* 매장편집: 미완성

---

# 📌 다음 작업

우선순위:

1. store-edit.html 구현
2. 수정 로그 테이블 추가
3. edit 로그 저장 기능
4. 권한 세분화

---

이 구조를 기반으로 유지보수 및 기능 추가를 진행한다.
모든 작업은 위 구조를 절대 기준으로 한다.
