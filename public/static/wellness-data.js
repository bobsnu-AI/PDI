// ══════════════════════════════════════════════
// 웰니스 파이프라인 데이터 — 연구진이 채우는 표
//   · 값이 없으면 null + needs_review: true 로 둡니다 (임의 수치 금지)
//   · 표를 고치면 아래 버전 번호를 올립니다. 결과 JSON 에 사용 버전이 함께 남습니다.
// ══════════════════════════════════════════════
const WELLNESS_DATA_VERSION = {
  functional_targets: '0.2.0',   // 2026-11-17 문헌 검토 반영
  product_specs:      '0.2.0',
  risk_adjust_rules:  '0.2.0',   // 2026-11-17 문헌 검토 반영
};

// ── F1. 질환·관리목표 → 기능성 성분 대응표 ──────────────
//   target_id : 질환은 'cvd' | 'diabetes' | 'cancer', 관리목표는 'goal:<HEALTH_GOALS id>'
//   component_id : 레시피 DB 파이토케미컬 계열 코드
//   daily_amount · upper_limit : unit 기준 하루 양. 모르면 null
//   priority : 작을수록 먼저
//   evidence : 'A' 규제기관 기준·진료/식이 지침 | 'B' 무작위대조시험 메타분석
//              'D' 임상 용량 근거를 찾지 못함 → 기존 값(app.js PHYTO_DRV, 레시피 DB 시뮬레이션 p75) 유지
//
// 수치를 바꾼 기준: A·B 근거가 있는 행만 문헌 값으로 바꿨습니다. 단일 시험(C)만 있는 경우는
// source 에 적어 두되 값은 바꾸지 않았습니다. 근거 목록·링크는 docs/wellness-evidence.md.
// 전부 needs_review: true — 문헌의 성분 정의(예: 이소플라본 비배당체, 녹차 카테킨)와
// 레시피 DB 계열 값의 정의가 같은지 연구진 확인이 필요합니다.
const WT_P75 = 'app.js PHYTO_DRV (레시피 DB 시뮬레이션 p75 · 임상 근거 아님)';
const wtRow = (target_id, component_id, component_name, daily_amount, priority, evidence, source, upper_limit = null) => ({
  target_id, component_id, component_name, daily_amount, unit: 'mg', upper_limit, priority,
  evidence, source, needs_review: true,
});
const WT_FLAVAN = 'Crowe-White 2022 Adv Nutr 13(6):2070 식품 기반 플라반-3-올 지침 400–600 mg/일(심혈관대사)';
const WT_EGCG = '상한: 식약처 녹차추출물 일일섭취량 범위 상단 1 g · EFSA 2018(EGCG ≥800 mg/일 간 효소 상승)';
const FUNCTIONAL_TARGETS = [
  wtRow('goal:weight',      'glucosinolates', '글루코시놀레이트', null, 1, 'D',
    '체중 용량 근거 없음 (Axelsson 2017: 설포라판 150 µmol 은 2형당뇨 혈당 시험) · 레시피 DB 값 없음'),
  wtRow('goal:weight',      'catechins',      '카테킨',           300,  2, 'A',
    '식약처 건강기능식품 녹차추출물 체지방 감소: 카테킨 0.3–1 g/일 (하한 적용) / ' + WT_EGCG, 1000),
  wtRow('goal:weight',      'phenolicAcids',  '페놀산',           500,  3, 'B',
    '2023 메타분석(PMID 37710316): 클로로겐산 ≥500 mg/일, 체중 −1.30 kg (RCT 3건 · 103명 · 근거 약함)'),
  wtRow('goal:gut',         'phenolicAcids',  '페놀산',           38,   1, 'D', WT_P75),
  wtRow('goal:gut',         'saponins',       '사포닌',           75,   2, 'D', WT_P75),
  wtRow('goal:gut',         'gingerols',      '진저롤',           null, 3, 'D',
    '진저롤 기준 용량 미확립 (Nikkhah Bodagh 2019 Food Sci Nutr: 생강 용량 연구 필요) · 레시피 DB 값 없음'),
  wtRow('goal:blood_sugar', 'phenolicAcids',  '페놀산',           38,   1, 'D', WT_P75),
  wtRow('goal:blood_sugar', 'isoflavones',    '이소플라본',       26,   2, 'D',
    WT_P75 + ' · 혈당 효과 메타분석 결과 엇갈림 (Fang 2016 폐경 여성 유의 / 2021 2형당뇨 메타분석 유의하지 않음)'),
  wtRow('goal:blood_sugar', 'lignans',        '리그난',           15,   3, 'D',
    WT_P75 + ' · 단일 RCT: Pan 2007 PLoS ONE, SDG 360 mg/일 12주 HbA1c 소폭 개선(2형당뇨 환자)'),
  wtRow('goal:bone',        'isoflavones',    '이소플라본',       37,   1, 'A',
    '식약처 고시 제2026-43호(2027-01-01 시행) 대두이소플라본 비배당체 37–45 mg/일 (하한 적용) · '
    + '2022 메타분석(PMC9409780 · RCT 18건, 평균 106 mg/일, 요추 골밀도 +1.63%) / 상한: 일본 식품안전위원회 2006 비배당체 70–75 mg/일', 75),
  wtRow('goal:bone',        'lignans',        '리그난',           15,   2, 'D',
    WT_P75 + ' · 아마씨 리그난 543 mg/일 6개월 RCT 에서 골밀도 효과 없음'),
  wtRow('goal:bone',        'flavonols',      '플라보놀',         89,   3, 'D', WT_P75),
  wtRow('goal:fatigue',     'saponins',       '사포닌',           75,   1, 'D',
    WT_P75 + ' · 식약처 인삼·홍삼 피로개선 기준(진세노사이드 3–80 mg)은 인삼 성분이라 이 계열에 적용하지 않음'),
  wtRow('goal:fatigue',     'anthocyanins',   '안토시아닌',       6,    2, 'D',
    WT_P75 + ' · 운동 수행·회복 시험(블랙커런트 105–315 mg)은 결과가 엇갈리고 적정 용량 미확립'),
  wtRow('goal:fatigue',     'catechins',      '카테킨',           16,   3, 'D', WT_P75),

  // 질환 — 심혈관(cvd) · 2형당뇨(diabetes)
  wtRow('cvd',      'catechins',    '카테킨',     400, 1, 'A', WT_FLAVAN + ' / ' + WT_EGCG, 1000),
  wtRow('cvd',      'anthocyanins', '안토시아닌', 300, 2, 'B',
    '2018 메타분석(시험 19건): 안토시아닌 >300 mg/일 · 12주 이상에서 총·LDL 콜레스테롤 개선'),
  wtRow('diabetes', 'catechins',    '카테킨',     400, 1, 'A', WT_FLAVAN + ' (인슐린·혈당 지표 포함) / ' + WT_EGCG, 1000),
  wtRow('diabetes', 'anthocyanins', '안토시아닌', 320, 2, 'B',
    '2023 Front Nutr 메타분석(2형당뇨 환자): 중앙 320 mg/일에서 HbA1c·LDL·중성지방 감소'),
  // 암(cancer) 행은 두지 않습니다 — WCRF/AICR 2018: 암 예방 목적의 보충제 사용을 권하지 않음.
];

// 성분 ↔ 알레르기 유발 원료
//   이소플라본: 급원이 대두 식품 · 식약처 대두이소플라본 주의사항 「대두에 알레르기를 나타내는 사람은 섭취에 주의할 것」
const COMPONENT_ALLERGENS = { isoflavones: ['soy'] };

// ── F3. 제품 성분 함량 ─────────────────────────────────
//   적지 않은 제품은 products.js productPhytos() 의 원재료 기반 추정값을 쓰고 needs_review 로 표시합니다.
//   실측값을 받으면 제품 코드별로 덮어씁니다:
//   A: { components: [{ component_id: 'isoflavones', amount: 25, unit: 'mg' }],
//        serving_per_day_max: 2, contraindications: ['pregnancy'], meal_replace: false,
//        source: '시험성적서 2026-..', needs_review: false },
const PRODUCT_SPEC_OVERRIDES = {
  // 혈압혈당 바나바Q10 — 제품소개서(2026-06-15) 기능성분 표시: 플라보놀 배당체 36 mg / 1일 섭취량 2정 → 1정 18 mg
  //   은행잎추출물의 플라보놀 배당체를 파이토케미컬 「플라보놀」 계열로 본 것은 연구진 확인이 필요합니다.
  '3': { components: [{ component_id: 'flavonols', amount: 18, unit: 'mg' }], serving_per_day_max: 2,
         source: '제품소개서(2026-06-15) 영양·기능정보 — 플라보놀 배당체 36 mg/일(2정)', needs_review: true },
};

// ── F6. 질환 위험도 → 영양 기준 조정 규칙 ───────────────
//   mode : 'upper_reduce'(상한 축소) | 'lower_raise'(하한 상향)
//   value : 조정 후 기준값(영양 기준과 같은 단위 · 절대값). null 이면 적용하지 않습니다.
//   지침 값이 현재 기준과 같아 규칙을 두지 않은 것: 포화지방 7 %E 미만(한국지질·동맥경화학회 2022),
//   당뇨 나트륨 2,300 mg(대한당뇨병학회 2023), 고혈압학회 2022 소금 6 g(나트륨 약 2,400 mg).
const RISK_ADJUST_RULES = [
  { disease: 'cvd', risk: '위험', nutrient: 'sodium', mode: 'upper_reduce', value: 2000,
    source: 'WHO 2012 Guideline: Sodium intake for adults and children — 나트륨 2 g/일 미만(강한 권고)', needs_review: true },
  { disease: 'cvd', risk: '위험', nutrient: 'fiber', mode: 'lower_raise', value: 25,
    source: '한국지질·동맥경화학회 이상지질혈증 진료지침 5판(2022) — 식이섬유 하루 25 g 이상', needs_review: true },
];
