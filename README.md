# 유림 HR 운영관리 시스템

## 1) 프로젝트 개요
사내 직원/조직도 운영을 위한 정적 HTML + Supabase 기반 관리 시스템이다.

- 인증: Supabase Auth
- 데이터: Postgres + RPC
- UI: HTML/CSS/Vanilla JS

## 2) 페이지 구조
- `index.html` : 로그인
- `auth.html` : 회원가입 신청
- `auth-requests.html` : 가입 승인/거절(관리자)
- `front.html` : 운영 대시보드 + 조직도 조회
- `employees.html` : 직원 목록/검색 + edit 진입(관리자)
- `edit.html` : 직원 정보 수정(관리자)
- `store-edit.html` : 매장 관리(관리자)
- `attendance.html` : 근태 placeholder
- `payroll.html` : 급여 placeholder

## 3) assets 구조

```text
assets/
 ├── css/
 │   ├── common.css      # 공통 reset/hidden/base
 │   ├── layout.css      # 공통 레이아웃 래퍼/상단
 │   ├── nav.css         # 하단 네비 공통 스타일
 │   ├── dashboard.css   # front 전용
 │   ├── employee.css    # employees 전용
 │   ├── store.css       # store-edit 전용
 │   ├── auth.css        # index/auth 전용
 │   ├── admin.css       # auth-requests 전용
 │   └── edit.css        # edit 전용
 │
 └── js/
     ├── supabase.js       # Supabase 클라이언트 생성 공통
     ├── auth-common.js    # 공통 유틸(normalize/escape)
     ├── nav.js            # admin 메뉴 노출 공통
     ├── dashboard.js      # front 전용
     ├── employee.js       # employees 전용
     ├── store.js          # store-edit 전용
     ├── auth-requests.js  # 가입승인 전용
     ├── login.js          # index 전용
     ├── signup.js         # auth 전용
     ├── edit.js           # edit 전용
     └── placeholders.js   # attendance/payroll 공용
```

## 4) 핵심 원칙
- DB 구조/컬럼 추측 금지
- direct join 남용 금지
- `front`는 조회 중심(`au_employee_directory_view`)
- 관리자 판별 순서 고정
  1) `au_employee_accounts`
  2) `au_employees`
  3) `au_system_roles`
- `auth.users -> accounts -> employees -> role` 구조 유지
- 공통 로직은 `assets/js/*`로 분리, 페이지 전용은 해당 파일에만 작성

## 5) 권한 구조
- `admin`: 직원/매장/가입승인/수정 기능 접근 가능
- `viewer`: 조회 중심(대시보드 + placeholder 메뉴)

관리자 전용 메뉴:
- 직원
- 매장
- 가입승인
- 직원/매장 수정 화면

## 6) 하단 네비 구조
1. 대시보드 (`front.html`)
2. 직원 (`employees.html`, admin only)
3. 매장 (`store-edit.html`, admin only)
4. 근태 (`attendance.html`)
5. 급여 (`payroll.html`)

## 7) 현재 상태
- 구현 완료: 로그인/회원가입 신청/가입승인/대시보드/직원목록/직원수정/매장관리
- placeholder: 근태, 급여
- 향후 확장: 근태/급여 실데이터 연동, 조직도 대분류 확장 컬럼 연계

## 8) 유지보수 가이드
- 새 페이지 추가 시
  - 공통 스타일: `common/layout/nav`
  - 페이지 스타일: 새 `assets/css/<page>.css`
  - 공통 로직: `supabase.js`, `auth-common.js`, `nav.js`
  - 페이지 로직: 새 `assets/js/<page>.js`
- HTML에는 대형 `<style>`, 대형 인라인 `<script>`를 두지 않는다.
- 페이지별로 필요한 CSS/JS만 로드한다.

---

## 데이터 구조(중요)
- `auth.users`
- `au_employee_accounts`
- `au_employees`
- `au_employee_directory_view`

위 구조를 벗어나지 않는다.
