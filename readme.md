1. 프로젝트 개요

이 시스템은 다음 목적을 가진다.

직원 조직도 조회 (Front)
직원 정보 수정 (Admin)
가입 승인 관리 (Admin)
매장 / 담당 / 팀장 구조 기반 조직 관리
2. 페이지 구조
index.html          → 로그인
auth.html           → 회원가입 신청
auth-requests.html  → 가입 승인 (관리자)
front.html          → 조직도 조회 (전체 사용자)
edit.html           → 직원 정보 수정 (관리자)
store-edit.html     → 매장 관리 (예정)
3. 핵심 기능
1) 조직도 조회 (front)
담당 / 팀장 / 매장 / 직원 / 직급 / 연락처 표시
검색 / 필터 기능
직급별 인원 요약 표시
관리자:
직원 클릭 → edit 페이지 이동
2) 직원 수정 (edit)
직원 기본 정보 수정
매장 / 담당 / 팀장 / 직급 변경
계정 상태 수정
수정 히스토리 표시
3) 가입 승인 (auth-requests)
회원가입 요청 승인 / 거절
승인 시 직원 테이블 반영
4) 권한 구조
역할	설명
viewer	조회만 가능
admin	전체 수정 가능
4. DB 구조 (핵심)
1) 직원

au_employees

employee_no (PK)
name
phone
email
address
hire_date
employment_status
current_store_id
current_manager_id
current_team_leader_id
current_position_id
system_role_id
is_active
is_contact_public
2) 계정

au_employee_accounts

employee_no
auth_user_id
login_email
signup_approved
account_status
3) 매장

au_stores

id
store_name
is_active
4) 담당

au_managers

id
manager_name
is_active
5) 팀장

au_team_leaders

id
team_leader_name
is_active
6) 직급

au_positions

id
position_name
sort_order
7) 시스템 권한

au_system_roles

id
role_name
8) 조직도 뷰

au_employee_directory_view

employee_no
name
store_name
manager_name
team_leader_name
position_name
public_phone
5. 기술 스택
Frontend: HTML / CSS / Vanilla JS
Backend: Supabase
Auth: Supabase Auth
DB: PostgreSQL
6. 핵심 로직
로그인 체크
supabase.auth.getUser()

→ 없으면 index로 리다이렉트

권한 판별
au_employees → system_role_id
→ au_system_roles → role_name
조직도 조회
au_employee_directory_view 조회
수정 처리
직원 → au_employees update
계정 → au_employee_accounts update
7. 통화 버튼 기능
연락처 옆 "통화" 버튼 제공
tel: 링크 사용
href="tel:01012345678"
모바일 → 바로 전화 연결
PC → 환경에 따라 다름
8. 주요 이슈 / 주의사항
1) JS 전체 멈춤 이슈
원인: return 위치 오류 / 변수명 불일치
해결: 함수 전체 교체
2) 연락처 안 보임
원인: select 쿼리에 컬럼 없음
해결: public_phone 추가
3) 로그아웃 후 자동 로그인
원인: 세션 유지
해결: signOut() + redirect
4) 관리자 버튼 안 보임
원인: role 변수 오류
해결: currentRole 통일
9. 향후 확장
매장 CRUD 페이지
수정 히스토리 로그 테이블 추가
관리자 권한 세분화
RLS 정책 강화
통계 대시보드
10. 결론

이 시스템은

조직도 조회 (O2O 연결 기반)
관리자 중심 데이터 관리
Supabase 기반 빠른 구축

을 목표로 설계된 내부 운영 시스템이다.
