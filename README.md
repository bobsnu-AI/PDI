# 밥스누 PDI 웰니스 솔루션

## 프로젝트 개요
- **이름**: 밥스누 PDI 웰니스 솔루션
- **목적**: 그린바이오 기반 맞춤형 웰니스 솔루션 사업화 - PDI(Phytoceutical Dietary Index) 기반 식단 평가 및 제품 추천 서비스
- **핵심 기능**: 식단 입력 → 파이토케미컬 분석 → PDI 점수 산출 → 맞춤 제품·식단 추천

## 서비스 URL
- **개발 서버**: http://localhost:3000
- **플랫폼**: Cloudflare Pages (Hono Framework)

## 주요 기능

### PDI 평가 엔진
- McCarty (2004) 원식 기반, 한국형 수정 PDI 계산
- PRF(파이토케미컬 풍부 식품) 칼로리 비율로 점수 산출
- 목표치: 40% (Gamba et al. 2023, CoLaus 코호트 n=3,879 근거)
- 차류 특별 가점, 알코올 제외 처리

### PFS 식단 영양 점수 (PDI·파이토 점수와 별도)
- `diet_food_scoring.py`의 `PFS_function`을 JS로 포팅 (`public/static/pfs.js`)
- 입력: 성별·나이·신장·체중·이전 체중(선택)·활동량 → KDRI 2020 에너지필요추정량(EER)
- Basic_score: 9개 영양소(탄수화물·단백질·지방·식이섬유 가점 / 콜레스테롤·당류·포화지방·트랜스지방·나트륨 감점), 최대 4.0
- ED_score(에너지 밀도), SI_score(포만 지수)
- 체중 추세별 총점: 감량기 Basic+ED · 증가기 Basic+ED+SI · 유지기 Basic
- 1일 식단 전체(기준치 ×1.0) + 음식별(본식 ×0.3·반찬 ×0.2·간식 ×0.1) 점수
- 식재료 DB에 kcal만 있어 영양성분은 식재료명 규칙·식품군 프로필로 추정 (`INGREDIENTS[x].nut`에 실측값 추가 시 우선 사용)

### 파이토케미컬 분석
12개 계열 분석:
- 이소플라본, 안토시아닌, 카테킨, 카로티노이드
- 페놀산, 글루코시놀레이트, 스틸벤, 리그난
- 사포닌, 진저롤·커큐민, 플라보놀, 티오알릴

### 식품 데이터베이스
- 37종 식품 (통곡물, 두류, 채소, 과일, 견과, 차류, 단백질 등)
- 카테고리별 필터링
- 칼로리 및 PRF 여부 표시

### 건강 목적별 추천
10가지 건강 목적:
- 다이어트, 혈당 관리, 혈관·심장, 뇌건강, 근육·시니어
- 항산화, 여성건강, 장건강, 눈건강, 항염·면역

### 밥스누 제품 추천
8종 제품: 약콩두유, 파이토100, 파이토100 시즌2, 파이토블랙, 약콩 프로틴바, 약콩차, 다이어트 두유, 약콩100

## 서비스 구조

### B2C (개인 구독)
- 건강검진센터 S-다이어트
- 아이보리 (영유아·산모)
- 냠냠키즈 (어린이 성장)

### B2B (기관 식단 설계)
- 초이스엔 (요양원·시니어)
- 아이앤나 (산후조리원·산모)
- 문원 (어린이집·어린이)

## 기술 스택
- **Backend**: Hono (Cloudflare Pages/Workers)
- **Frontend**: Vanilla JS + Tailwind CSS (CDN)
- **Charts**: Chart.js
- **Icons**: FontAwesome
- **Font**: Noto Sans KR
- **Build**: Vite + @hono/vite-build

## 과학적 근거
- McCarty (2004) Med Hypotheses - PDI 지수 원형
- Gamba et al. (2023) NMCD CoLaus - 목표치 40% 근거
- Kim & Park (2020) Nutr Res Pract - 국내 한국형 근거
- Dreosti (2000) Asia Pac J Clin Nutr - 식품군 기반 설계 원칙

## 프로젝트 구조
```
webapp/
├── src/
│   ├── index.tsx          # Hono 메인 앱 (HTML 인라인 서빙)
│   ├── data/
│   │   └── phytochemicals.ts  # 파이토케미컬 데이터베이스
│   └── lib/
│       └── pdiEngine.ts   # PDI 계산 엔진
├── public/
│   ├── index.html         # 메인 HTML 템플릿
│   └── static/
│       ├── recipes.js     # 레시피·식재료 DB
│       ├── pfs.js         # PFS 식단 점수 엔진
│       └── app.js         # 프론트엔드 JavaScript
├── ecosystem.config.cjs   # PM2 설정
├── wrangler.jsonc         # Cloudflare 설정
└── vite.config.ts         # Vite 빌드 설정
```

## 개발 방법
```bash
npm run build          # 빌드
pm2 start ecosystem.config.cjs  # 서버 시작 (포트 3000)
```

## 미구현/향후 과제
- 실제 파이토케미컬 DB 연동 (Phenol-Explorer, USDA Flavonoid DB)
- 사용자 계정 및 히스토리 관리 (Cloudflare D1)
- 한국 식품 DB 매핑 확장 (국가표준식품성분표)
- 사진 인식 기반 식단 입력
- B2B 기관 관리자 대시보드
- 식단 DB 연동 및 식단 자동 제안

## 배포 상태
- **플랫폼**: Cloudflare Pages 준비 완료
- **상태**: 개발 서버 실행 중
- **최종 업데이트**: 2024-09
