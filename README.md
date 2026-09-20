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
