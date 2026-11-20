# 웰니스 표 근거 (2026-11-17 문헌 검토)

`public/static/wellness-data.js` 의 값이 어디서 왔는지 적은 문서입니다.
표 버전: functional_targets 0.2.0 · risk_adjust_rules 0.2.0 · product_specs 0.1.0(변경 없음).

근거 등급 — **A** 규제기관 기준·진료/식이 지침, **B** 무작위대조시험 메타분석, **D** 임상 용량 근거를 찾지 못해 기존 값(레시피 DB 시뮬레이션 p75) 유지.
단일 시험만 있는 경우는 출처에 적되 값은 바꾸지 않았습니다.

> **모든 행이 `needs_review: true` 입니다.** 문헌의 성분과 레시피 DB 계열의 정의가 다릅니다.
> DB 에서 계열별 함량이 가장 높은 재료: 카테킨 → 계피, 사포닌 → 고추류, 리그난 → 참깨, 이소플라본 → 된장(1,379개 재료에 값 있음).
> 문헌 값은 녹차 카테킨, 대두이소플라본 비배당체, 클로로겐산처럼 특정 화합물 기준입니다.
> 같은 정의로 볼 수 있는지 연구진이 확인하기 전에는 확정값으로 쓰면 안 됩니다.

## 1. 기능성 성분 대응표 (FUNCTIONAL_TARGETS)

| 대상 | 성분 | 이전 | 현재 (mg/일) | 상한 | 등급 | 근거 |
|---|---|---|---|---|---|---|
| 체중 관리 | 글루코시놀레이트 | null | null | – | D | 체중 용량 근거 없음. 설포라판 150 µmol 시험[13]은 2형당뇨 혈당 대상. DB 값도 없음 |
| 체중 관리 | 카테킨 | 16 | **300** | 1,000 | A | 식약처 녹차추출물 체지방 감소 0.3–1 g/일의 하한[3]. 상한은 범위 상단, EFSA 는 EGCG 800 mg/일 이상에서 간 효소 상승 보고[4] |
| 체중 관리 | 페놀산 | 38 | **500** | – | B | 클로로겐산 500 mg/일 이상에서 체중 −1.30 kg. RCT 3건·103명으로 근거 약함[9] |
| 장 건강 | 페놀산 | 38 | 38 | – | D | 장 건강 용량 근거 없음 |
| 장 건강 | 사포닌 | 75 | 75 | – | D | 근거 없음 |
| 장 건강 | 진저롤 | null | null | – | D | 진저롤 기준 용량 미확립[14]. DB 값 없음 |
| 혈당 관리 | 페놀산 | 38 | 38 | – | D | 혈당 용량 근거 없음 |
| 혈당 관리 | 이소플라본 | 26 | 26 | – | D | 메타분석 결과가 엇갈림(폐경 여성 유의, 2형당뇨 환자 유의하지 않음)[7] |
| 혈당 관리 | 리그난 | 15 | 15 | – | D | 단일 RCT: 아마씨 리그난(SDG) 360 mg/일 12주, HbA1c 소폭 개선[10] |
| 뼈 건강 | 이소플라본 | 26 | **37** | 75 | A | 식약처 고시 제2026-43호 대두이소플라본 비배당체 37–45 mg/일의 하한(2027-01-01 시행)[1]. 메타분석 평균 106 mg/일에서 요추 골밀도 +1.63%[5]. 상한은 일본 식품안전위원회 70–75 mg/일[6] |
| 뼈 건강 | 리그난 | 15 | 15 | – | D | 아마씨 리그난 RCT 에서 골밀도 효과 없음[11] |
| 뼈 건강 | 플라보놀 | 89 | 89 | – | D | 뼈 용량 근거 없음 |
| 피로·활력 | 사포닌 | 75 | 75 | – | D | 식약처 인삼·홍삼 기준(진세노사이드 3–80 mg)[12]은 인삼 성분이라 적용하지 않음 |
| 피로·활력 | 안토시아닌 | 6 | 6 | – | D | 운동 수행 시험(105–315 mg)은 결과가 엇갈림[15] |
| 피로·활력 | 카테킨 | 16 | 16 | – | D | 피로 용량 근거 없음 |
| 심혈관 (신규) | 카테킨 | – | **400** | 1,000 | A | 식품 기반 플라반-3-올 지침 400–600 mg/일의 하한[2] |
| 심혈관 (신규) | 안토시아닌 | – | **300** | – | B | 300 mg/일 초과·12주 이상에서 총·LDL 콜레스테롤 개선[8] |
| 2형당뇨 (신규) | 카테킨 | – | **400** | 1,000 | A | 같은 지침[2] (인슐린·혈당 지표 포함) |
| 2형당뇨 (신규) | 안토시아닌 | – | **320** | – | B | 2형당뇨 환자 메타분석, 중앙 320 mg/일[8] |
| 암 | (행 없음) | – | – | – | – | WCRF/AICR: 암 예방 목적의 보충제 사용을 권하지 않음[16] |

## 2. 성분 ↔ 알레르기 (COMPONENT_ALLERGENS)

| 성분 | 알레르기 | 근거 |
|---|---|---|
| 이소플라본 | 대두(soy) | 식약처 대두이소플라본 주의사항 「대두에 알레르기를 나타내는 사람은 섭취에 주의할 것」[1] |

## 3. 위험도 → 영양 기준 조정 (RISK_ADJUST_RULES)

| 질환·등급 | 영양소 | 기존 | 조정 | 근거 |
|---|---|---|---|---|
| 심혈관 위험 | 나트륨 상한 | 2,300 mg | **2,000 mg** | WHO 2012 나트륨 2 g/일 미만(강한 권고)[17] |
| 심혈관 위험 | 식이섬유 하한 | 열량 1,000 kcal 당 12 g | **25 g 이상** | 한국지질·동맥경화학회 이상지질혈증 진료지침 5판(2022)[18] |

규칙을 두지 않은 것 — 지침 값이 현재 기준과 같거나 덜 엄격합니다: 포화지방 7 %E 미만[18], 당뇨 나트륨 2,300 mg[19], 고혈압학회 소금 6 g(나트륨 약 2,400 mg)[20].
「보통」 등급 규칙은 근거가 되는 지침이 등급을 나누지 않아 넣지 않았습니다.

## 4. 제품 성분 함량 (PRODUCT_SPEC_OVERRIDES)

비워 두었습니다. 제품별 실측 함량은 문헌에서 얻을 수 없고 시험성적서가 필요합니다.

## 출처

1. [식약처 고시 제2026-43호 (2026-06-11)](https://mfds.go.kr/brd/m_207/view.do?seq=15173) — 원문 PDF 의 2-10 대두이소플라본 신구조문 확인. 보도: [푸드투데이](https://foodtoday.or.kr/mobile/article.html?no=189952), [식품음료신문](https://www.thinkfood.co.kr/news/articleView.html?idxno=101847)
2. [Crowe-White 등 2022, Adv Nutr 13(6):2070](https://centaur.reading.ac.uk/id/eprint/107997) — 보충제가 아닌 식품 기반 지침
3. [식약처 녹차추출물 기준](https://www.mfds.go.kr/brd/m_207/view.do?seq=14285), [해설](https://koreascience.kr/article/JAKO201810263412194.pdf)
4. [EFSA 2018 녹차 카테킨 안전성](https://www.efsa.europa.eu/en/efsajournal/pub/5239)
5. [이소플라본·골밀도 메타분석 2022](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9409780/), [2008 메타분석](https://pubmed.ncbi.nlm.nih.gov/18063230/), 반대 결과 [2009](https://pubmed.ncbi.nlm.nih.gov/19168161/)
6. [일본 식품안전위원회 2006](https://www.fsc.go.jp/english/evaluationreports/newfoods_sphealth/soy_isoflavones.pdf), 참고 [EFSA 2015](https://www.efsa.europa.eu/en/efsajournal/pub/4246)
7. [대두 이소플라본·2형당뇨 메타분석 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8229139/)
8. [안토시아닌 심혈관대사 메타분석 보도 2018](https://www.nutraingredients.com/Article/2018/07/06/Meta-analysis-supports-cardio-metabolic-benefits-of-anthocyanins), [2형당뇨 메타분석 2023](https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2023.1199815/pdf)
9. [클로로겐산·체중 메타분석 2023](https://pubmed.ncbi.nlm.nih.gov/37710316/)
10. [Pan 등 2007, PLoS ONE](https://pmc.ncbi.nlm.nih.gov/articles/PMC2048577)
11. [아마씨 리그난·골밀도 시험 요약](https://archive.flaxcouncil.ca/?p=11581)
12. [건강기능식품의 기준 및 규격 (인삼·홍삼)](https://www.law.go.kr/LSW/flDownload.do?flSeq=170883441)
13. [Axelsson 등 2017 보도](https://cm.healio.com/news/endocrinology/20170622/concentrated-broccoli-sprout-extract-may-reduce-fasting-blood-glucose-in-type-2-diabetes-obesity)
14. [생강·위장관 체계적 고찰 2019](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6341159/)
15. [블랙커런트 안토시아닌 운동 시험 고찰](https://pmc.ncbi.nlm.nih.gov/articles/PMC8869496)
16. [WCRF/AICR 암 예방 권고](https://www.wcrf.org/research-policy/our-cancer-prevention-recommendations/)
17. [WHO 2012 Guideline: Sodium intake for adults and children](https://www.ilfattoalimentare.it/wp-content/uploads/2013/03/OMS-Sodium-intake-for-adults-children.pdf)
18. [한국지질·동맥경화학회 진료지침](https://www.lipid.or.kr/uploaded/board/guideline/_50e8f3527d0798a82a29b8ef6c363cce2.pdf), [식사요법 안내](https://lipid.or.kr/dtp/prevention_v2.php)
19. [대한당뇨병학회 2023 진료지침 요약](https://www.e-jkd.org/journal/view.php?viewtype=pubreader&number=1060)
20. [질병관리청 고혈압 식사 안내](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6855)
