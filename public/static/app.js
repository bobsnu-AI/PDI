// ============================================
// 밥스누 PDI 웰니스 솔루션 - 메인 앱 스크립트
// (레시피 DB 기반 식재료 분해 → PDI 계산 버전)
// ============================================

// ── 식품군 정의 ─────────────────────────────
const FOOD_CATEGORIES = {
  grains:     { name: '통곡물',         icon: '🌾', color: '#D97706', isPRF: true  },
  legumes:    { name: '두류·콩가공품',  icon: '🫘', color: '#8B5CF6', isPRF: true  },
  vegetables: { name: '채소·나물·해조', icon: '🥬', color: '#10B981', isPRF: true  },
  fruits:     { name: '과일',           icon: '🍎', color: '#EF4444', isPRF: true  },
  nuts:       { name: '견과·종실',      icon: '🥜', color: '#92400E', isPRF: true  },
  oils:       { name: '식물성 오일',    icon: '🫙', color: '#EAB308', isPRF: true  },
  tea:        { name: '차·커피·코코아', icon: '🍵', color: '#6B7280', isPRF: true  },
  spices:     { name: '향신료',         icon: '🌶️', color: '#DC2626', isPRF: false },
  protein:    { name: '동물성 단백질',  icon: '🥩', color: '#9CA3AF', isPRF: false },
  dairy:      { name: '유제품',         icon: '🥛', color: '#93C5FD', isPRF: false },
  refined:    { name: '정제 곡물·당류', icon: '🍞', color: '#FCA5A5', isPRF: false },
  bobsnu:     { name: '밥스누 제품',    icon: '⭐', color: '#7C3AED', isPRF: true  },
};

// ── 파이토케미컬 계열 ────────────────────────
const PHYTOCHEMICAL_GROUPS = {
  isoflavones:    { name: '이소플라본',       benefits: ['여성건강', '골건강', '콜레스테롤'],  color: '#8B5CF6', icon: '💜' },
  anthocyanins:   { name: '안토시아닌',       benefits: ['항산화', 'LDL 억제', '시력'],        color: '#6D28D9', icon: '🫐' },
  catechins:      { name: '카테킨',           benefits: ['LDL 억제', '항염', '체지방'],         color: '#059669', icon: '🍃' },
  carotenoids:    { name: '카로티노이드',     benefits: ['항산화', '황반보호', '눈건강'],        color: '#F59E0B', icon: '🟠' },
  phenolicAcids:  { name: '페놀산',           benefits: ['항산화', '저GI', '항염'],             color: '#92400E', icon: '🌰' },
  glucosinolates: { name: '글루코시놀레이트', benefits: ['체지방', '해독효소', '항암'],          color: '#065F46', icon: '🥦' },
  stilbenes:      { name: '스틸벤',           benefits: ['심혈관', '뇌건강', '항산화'],          color: '#7C3AED', icon: '🍇' },
  lignans:        { name: '리그난',           benefits: ['콜레스테롤', '여성건강', '항산화'],    color: '#78350F', icon: '🌻' },
  saponins:       { name: '사포닌',           benefits: ['콜레스테롤', '항산화', '면역'],        color: '#047857', icon: '🫘' },
  gingerols:      { name: '진저롤·커큐민',    benefits: ['항염', '소화', '관절'],               color: '#D97706', icon: '🫚' },
  flavonols:      { name: '플라보놀',         benefits: ['항산화', '항염', '심혈관'],            color: '#B45309', icon: '🌼' },
  thioallyls:     { name: '티오알릴',         benefits: ['항염', '항혈전', '면역'],              color: '#4B5563', icon: '🧄' },
  flavones:       { name: '플라본',           benefits: ['항산화', '항염', '혈당조절'],          color: '#A16207', icon: '🌾' },
  tocopherols:    { name: '토코페롤류',        benefits: ['항산화', '세포보호', '면역'],          color: '#CA8A04', icon: '🌿' },
};

// benefits 키워드 → HEALTH_GOALS 아이콘 매핑
const BENEFIT_ICON = {
  '여성건강':   '👩',  '골건강':     '🦴',  '콜레스테롤': '🩺',
  '항산화':     '✨',  'LDL 억제':   '❤️',  '시력':       '👁️',
  '항염':       '🛡️',  '체지방':     '⚖️',  '저GI':       '🩸',
  '황반보호':   '👁️',  '눈건강':     '👁️',  '심혈관':     '❤️',
  '뇌건강':     '🧠',  '해독효소':   '🌿',  '항암':       '🛡️',
  '소화':       '🌿',  '관절':       '🛡️',  '항혈전':     '❤️',
  '면역':       '🛡️',  '세포보호':   '✨',  '혈당조절':   '🩸',
};


// 출처: 우리 DB(recipes.js 14,714개 레시피) 하루 3끼 시뮬레이션 2,000회 → p75
// 데이터 없는 계열(glucosinolates·gingerols·thioallyls·stilbenes)은
// 점수 계산 대상에서 제외하고 DB값 보유 계열만 사용
const PHYTO_DRV = {
  phenolicAcids:  38,   // p75 37.8 mg/일
  catechins:      16,   // p75 16.0 mg/일
  flavonols:      89,   // p75 88.7 mg/일
  isoflavones:    26,   // p75 25.5 mg/일
  saponins:       75,   // p75 74.8 mg/일
  carotenoids:     2,   // p75  1.9 mg/일
  anthocyanins:    6,   // p75  6.3 mg/일
  lignans:        15,   // p75 15.1 mg/일
  flavones:       26,   // p75 26.0 mg/일
  tocopherols:     6,   // p75  6.3 mg/일
};
// DRV 보유 계열 목록 (점수 계산 대상)
const PHYTO_SCORED_KEYS = Object.keys(PHYTO_DRV);  // 10개 계열

// ──────────────────────────────────────────────
// calculatePhytoScore(phytoMap, selectedGoals)
//   phytoMap : { key: totalMg } — calculatePDI() 반환값
//   selectedGoals : Set<goalId>
// 반환: {
//   total,          // 0~100
//   diversity,      // 0~40  — 커버 계열 수 / 10 × 40
//   sufficiency,    // 0~30  — DRV 달성률 평균 × 30
//   focus,          // 0~30  — 목적 계열 달성률 평균 × 30 (없으면 전체 평균)
//   focusLabel,     // 표시용 라벨
//   perKey,         // { key: { mg, drv, ratio } }
//   goalKeys,       // 목적 계열 배열
// }
// ──────────────────────────────────────────────
function calculatePhytoScore(phytoMap, selectedGoals) {
  // ── 계열별 달성률 ──
  const perKey = {};
  for (const key of PHYTO_SCORED_KEYS) {
    const mg  = phytoMap[key] || 0;
    const drv = PHYTO_DRV[key];
    perKey[key] = { mg, drv, ratio: Math.min(mg / drv, 1.0) };
  }

  // ── 다양성 (0~40) ──
  const coveredCount = PHYTO_SCORED_KEYS.filter(k => perKey[k].mg > 0).length;
  const diversity = Math.round((coveredCount / PHYTO_SCORED_KEYS.length) * 40);

  // ── 충분량 (0~30) ──
  const avgRatio = PHYTO_SCORED_KEYS.reduce((s, k) => s + perKey[k].ratio, 0)
                   / PHYTO_SCORED_KEYS.length;
  const sufficiency = Math.round(avgRatio * 30);

  // ── 목적 집중도 (0~30) ──
  // 목적 계열: 선택된 건강목적의 phytos 중 DRV 있는 것만
  const goalKeys = [...new Set(
    Array.from(selectedGoals)
      .flatMap(gid => (HEALTH_GOALS.find(h => h.id === gid) || {}).phytos || [])
      .filter(k => PHYTO_DRV[k])
  )];

  let focusRatio, focusLabel;
  if (goalKeys.length > 0) {
    focusRatio = goalKeys.reduce((s, k) => s + perKey[k].ratio, 0) / goalKeys.length;
    const goalNames = Array.from(selectedGoals)
      .map(gid => (HEALTH_GOALS.find(h => h.id === gid) || {}).name)
      .filter(Boolean).join('·');
    focusLabel = goalNames;
  } else {
    focusRatio = avgRatio;   // 목적 미선택 → 전체 평균
    focusLabel = '전체 평균';
  }
  const focus = Math.round(focusRatio * 30);

  return {
    total:      diversity + sufficiency + focus,
    diversity,
    sufficiency,
    focus,
    focusLabel,
    perKey,
    goalKeys,
    coveredCount,
  };
}

// ── 관리 목표 ────────────────────────────────
// 체중 관리가 핵심(항상 포함), 추가 건강 관리는 4가지만 선택 제공
const HEALTH_GOALS = [
  { id: 'weight',      name: '체중 관리', icon: '⚖️', base: true, phytos: ['glucosinolates', 'catechins', 'phenolicAcids'],
    tip: '식사량보다 구성이 중요해요. 통곡물·채소·콩으로 포만감을 높이고 가공식품·단 음료를 줄이세요.' },
  { id: 'gut',         name: '장 건강',   icon: '🌿', phytos: ['phenolicAcids', 'saponins', 'gingerols'],
    tip: '식이섬유(잡곡·채소·해조류)와 된장·김치 같은 발효식품을 매일 챙기세요.' },
  { id: 'blood_sugar', name: '혈당 관리', icon: '🩸', phytos: ['phenolicAcids', 'isoflavones', 'lignans'],
    tip: '흰쌀 대신 잡곡밥, 채소·단백질 반찬을 먼저 먹고 밥은 나중에 드세요.' },
  { id: 'bone',        name: '뼈 건강',   icon: '🦴', phytos: ['isoflavones', 'lignans', 'flavonols'],
    tip: '두부·두유 등 콩 식품과 멸치·우유·녹색 채소로 칼슘을 보충하고 햇볕을 쬐세요.' },
  { id: 'fatigue',     name: '피로 회복', icon: '🔋', phytos: ['saponins', 'anthocyanins', 'catechins'],
    tip: '아침 식사를 거르지 말고 단백질을 끼니마다 나눠 드세요. 충분한 수면이 기본입니다.' },
];

// ── 식재료 식품군 보정 ──────────────────────────
// recipes.js 는 자동 생성 DB라 차·코코아 원료가 「정제 곡물·당류」로 분류되어 있습니다.
// PDI 원식(McCarty 2004)은 차류를 PRF 식품군으로 보므로 바로잡습니다.
// 보정 전에는 설문의 「녹차를 하루 2잔 마신다」 응답이 PDI를 오히려 깎았습니다.
const TEA_PRF_RE      = /^(녹차|말차|홍차|우롱차|보이차|루이보스|캐모마일|페퍼민트|재스민|히비스커스|코코아|카카오)/;
const TEA_PRF_EXCLUDE = /아이스크림|소금|국수|우유|설탕|시럽|라떼|빵|쿠키|케이크|과자|떡|젤리|초콜릿|크림/;
let INGREDIENT_CAT_FIXED = 0;

for (const [name, ing] of Object.entries(INGREDIENTS)) {
  if (ing.cat !== 'refined') continue;
  if (!TEA_PRF_RE.test(name) || TEA_PRF_EXCLUDE.test(name)) continue;
  ing.cat = 'tea';
  ing.prf = true;
  INGREDIENT_CAT_FIXED++;
}

// 밥스누 제품 마스터(이름·가격·영양성분·알레르기·기능)는 products.js 의 BOBSNU_CATALOG 참조
// 제품 마스터·가격·할인·추천 룰은 products.js (엑셀 Sheet3) 참조

// ── 알레르기 (식품 등 표시기준 알레르기 유발물질, 아황산류 제외) ──
// re: 식재료명 매칭 규칙
const ALLERGENS = [
  { id: 'egg',       name: '달걀',     re: /달걀|계란|메추리알|난황|난백|마요네즈/ },
  { id: 'milk',      name: '우유',     re: /우유|치즈|(?<!땅콩)버터|요구르트|요거트|생크림|휘핑|연유|분유/ },
  { id: 'buckwheat', name: '메밀',     re: /메밀/ },
  { id: 'peanut',    name: '땅콩',     re: /땅콩/ },
  { id: 'soy',       name: '대두',     re: /대두|(?<!강낭|완두|병아리|렌틸|땅|녹|작두)콩|두부|두유|된장|간장|고추장|청국장|쌈장|춘장|유부|미소|쯔유/ },
  { id: 'wheat',     name: '밀',       re: /밀가루|통밀|밀\(|소면|국수|라면|우동|칼국수|스파게티|파스타|마카로니|빵|또띠아|부침가루|튀김가루|만두|간장|쯔유|시리얼/ },
  { id: 'mackerel',  name: '고등어',   re: /고등어/ },
  { id: 'crab',      name: '게',       re: /꽃게|대게|킹크랩|게살|게맛살|크랩|^게$|^게\(/ },
  { id: 'shrimp',    name: '새우',     re: /새우/ },
  { id: 'pork',      name: '돼지고기', re: /돼지|삼겹|베이컨|햄(?!프)|소시지|족발|스팸/ },
  { id: 'peach',     name: '복숭아',   re: /복숭아/ },
  { id: 'tomato',    name: '토마토',   re: /토마토|케첩|케찹/ },
  { id: 'walnut',    name: '호두',     re: /호두/ },
  { id: 'chicken',   name: '닭고기',   re: /닭|치킨/ },
  { id: 'beef',      name: '쇠고기',   re: /쇠고기|소고기|한우|차돌박이|사골/ },
  { id: 'squid',     name: '오징어',   re: /오징어/ },
  { id: 'shellfish', name: '조개류',   re: /조개|바지락|홍합|굴(?!비)|전복|꼬막|가리비|소라|골뱅이|재첩|관자/ },
  { id: 'pine',      name: '잣',       re: /잣/ },
];

// ── 식습관 설문 (가안 · 서울대 식이평가 설문 구조 반영 전) ──
// 응답은 대표 음식으로 환산하여 '예측 식단'을 만들고, 식사 기록과 같은 엔진으로 점수를 계산
const SURVEY_QUESTIONS = [
  { id: 'rice',   q: '평소 드시는 밥은 어떤 종류인가요?',              options: [['흰쌀밥 위주', 'white'], ['흰쌀·잡곡 반반', 'mixed'], ['잡곡·현미밥 위주', 'grain']] },
  { id: 'meals',  q: '하루에 식사는 몇 끼 하시나요?',                  options: [['1끼', 1], ['2끼', 2], ['3끼', 3]] },
  { id: 'veg',    q: '채소 반찬(나물·샐러드·채소국)은 하루 몇 접시?',   options: [['거의 안 먹음', 0], ['1–2접시', 2], ['3접시 이상', 4]] },
  { id: 'kimchi', q: '김치는 하루 몇 번 드시나요?',                    options: [['거의 안 먹음', 0], ['1번', 1], ['2번 이상', 2]] },
  { id: 'fruit',  q: '과일은 얼마나 드시나요?',                        options: [['거의 안 먹음', 0], ['하루 1번', 1], ['하루 2번 이상', 2]] },
  { id: 'soy',    q: '콩·두부·된장 음식은 얼마나 드시나요?',            options: [['주 1회 미만', 0], ['주 2–4회', 0.5], ['거의 매일', 1]] },
  { id: 'nuts',   q: '견과류는 얼마나 드시나요?',                      options: [['거의 안 먹음', 0], ['주 2–3회', 0.4], ['거의 매일', 1]] },
  { id: 'meat',   q: '고기·생선·달걀 반찬은 하루 몇 번?',               options: [['0–1번', 0.5], ['2번 정도', 1.5], ['3번 이상', 3]] },
  { id: 'tea',    q: '녹차 등 무가당 차는 하루 몇 잔?',                 options: [['안 마심', 0], ['1잔', 1], ['2잔 이상', 2]] },
  { id: 'snack',  q: '과자·단 음료·라면 같은 가공식품은?',              options: [['거의 안 먹음', 0], ['하루 1번', 1], ['하루 2번 이상', 2]] },
];

// 설문 → 대표 음식 매핑
const SURVEY_FOODS = {
  veg:   ['시금치나물', '콩나물무침', '오이무침', '무생채'],
  fruit: ['사과', '귤'],
  meat:  ['제육볶음', '고등어구이', '계란말이', '불고기'],
  // 레시피 DB에 없는 대표 음식은 식재료 조합으로 정의
  custom: {
    '녹차 한 잔':    { '녹차잎': 2 },
    '과자·단 음료':  { '백설탕': 20, '식빵': 40 },
  },
};

// 식사 기록 빠른 추가 칩
const QUICK_FOODS = ['잡곡밥', '쌀밥', '된장찌개', '김치찌개', '배추김치', '시금치나물', '계란말이', '사과', '오리지널 약콩 두유'];

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let currentStep = 1;
// 식사 기록: [{ name:'비빔밥', meal:'lunch', portion:1, analysis:{...} }, ...]
let addedMeals = [];
// 설문 응답: { questionId: value }
const surveyAnswers = {};
let inputMode = 'survey';                       // 'survey' | 'log'
const selectedGoals = new Set(['weight']);      // 체중 관리는 항상 포함
const selectedAllergies = new Set();
let pdiResult = null;
let chartInstance = null;
let gender = 'female';

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
// 저장된 프로필을 Step 1 입력 폼으로 복원
function restoreProfileForm() {
  const p = tracker.profile;
  if (!p) return;
  gender = p.gender || 'female';
  const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  set('profile-age', p.age); set('profile-height', p.height); set('profile-weight', p.weight);
  set('profile-waist', p.waist); set('profile-prev-weight', p.prevWeight); set('profile-activity', p.activity);
  selectedAllergies.clear();
  for (const a of (p.allergies || [])) selectedAllergies.add(a);
  selectedGoals.clear();
  for (const g of HEALTH_GOALS) if (g.base) selectedGoals.add(g.id);
  for (const g of (tracker.goals || [])) selectedGoals.add(g);
}

document.addEventListener('DOMContentLoaded', () => {
  trackerLoad();
  restoreProfileForm();
  renderActivityOptions();
  renderAllergyChips();
  setGender(gender);
  renderSurvey();
  renderQuickChips();
  setInputMode('survey');
  renderHealthGoals();
  renderProductGrid();
  renderMealList();
  initAutocomplete();
  initPlanFoodList();
  // 상세 분석은 펼칠 때 그림 (접힌 상태에서는 크기가 0이라 차트·생키를 그릴 수 없음)
  const detail = document.getElementById('detail-analysis');
  if (detail) detail.addEventListener('toggle', () => { if (detail.open && pdiResult) renderDetailAnalysis(pdiResult); });
});

// ══════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════
function scrollToAssessment() {
  document.getElementById('assessment').scrollIntoView({ behavior: 'smooth' });
}

function setGender(g) {
  gender = g;
  document.getElementById('gender-male').classList.toggle('border-emerald-500', g === 'male');
  document.getElementById('gender-male').classList.toggle('bg-emerald-50', g === 'male');
  document.getElementById('gender-male').classList.toggle('border-gray-200', g !== 'male');
  document.getElementById('gender-female').classList.toggle('border-emerald-500', g === 'female');
  document.getElementById('gender-female').classList.toggle('bg-emerald-50', g === 'female');
  document.getElementById('gender-female').classList.toggle('border-gray-200', g !== 'female');
  updateProfilePreview();
}

// ══════════════════════════════════════════════
// PROFILE  (성별·나이·키·체중·허리둘레·활동량·알레르기 → 기준 칼로리)
// ══════════════════════════════════════════════
function renderActivityOptions() {
  const sel = document.getElementById('profile-activity');
  if (!sel) return;
  sel.innerHTML = Object.entries(PFS_ACTIVITY_LEVELS).map(([id, a]) =>
    '<option value="' + id + '"' + (id === 'low' ? ' selected' : '') + '>' + a.name + ' · ' + a.desc + '</option>'
  ).join('');
}

function renderAllergyChips() {
  const el = document.getElementById('allergy-chips');
  if (!el) return;
  el.innerHTML = ALLERGENS.map(a => {
    const on = selectedAllergies.has(a.id);
    return '<button type="button" onclick="toggleAllergy(\'' + a.id + '\')" aria-pressed="' + on + '"'
      + ' class="px-3 py-1.5 rounded-full text-sm border-2 transition '
      + (on ? 'border-red-400 bg-red-50 text-red-700 font-bold' : 'border-gray-200 text-gray-600 hover:border-gray-300') + '">'
      + (on ? '<i class="fas fa-check mr-1 text-xs"></i>' : '') + a.name + '</button>';
  }).join('');
}

function toggleAllergy(id) {
  if (selectedAllergies.has(id)) selectedAllergies.delete(id);
  else selectedAllergies.add(id);
  renderAllergyChips();
  renderMealList();
}

// 입력값 읽기 — 빈 칸은 null
function readProfile() {
  const num = id => {
    const v = document.getElementById(id).value.trim();
    return v === '' ? null : Number(v);
  };
  return {
    gender,
    age:        num('profile-age'),
    height:     num('profile-height'),
    weight:     num('profile-weight'),
    waist:      num('profile-waist'),
    prevWeight: num('profile-prev-weight'),
    activity:   document.getElementById('profile-activity').value,
    allergies:  new Set(selectedAllergies),
  };
}

// 나이·키·체중은 기준 칼로리 산출에 필수
function validateProfile(p) {
  const fields = [
    ['age', '나이', 3, 120, true], ['height', '키', 80, 230, true], ['weight', '체중', 10, 300, true],
    ['waist', '허리둘레', 40, 200, false], ['prevWeight', '이전 체중', 10, 300, false],
  ];
  const missing = fields.filter(f => f[4] && p[f[0]] === null).map(f => f[1]);
  if (missing.length) return '필수 항목(' + missing.join('·') + ')을 입력해주세요. 기준 칼로리 계산에 필요합니다.';
  for (const [k, label, min, max] of fields) {
    if (p[k] !== null && !(p[k] >= min && p[k] <= max)) {
      return label + '은(는) ' + min + '–' + max + ' 범위로 입력해주세요.';
    }
  }
  return null;
}

// BMI 체중 유형 (products.js BODY_TYPES · 엑셀 Sheet3 기준) · 복부비만 (남 90cm, 여 85cm 이상)
function bodyIndices(p) {
  const out = {};
  if (p.height > 0 && p.weight > 0) {
    out.bmi = p.weight / ((p.height / 100) ** 2);
    out.bodyType = classifyBodyType(out.bmi);
    out.bmiLabel = out.bodyType.name;
  }
  if (p.waist > 0) out.abdominal = p.waist >= (p.gender === 'male' ? 90 : 85);
  return out;
}

// ── 목표 칼로리·영양 기준 (체중 유형 반영 + 모니터링 재조정 반영) ──
function currentTargets() {
  const p = (tracker && tracker.profile) ? tracker.profile : readProfile();
  const t = nutritionTargets(p);
  if (!t) return null;
  if (tracker && tracker.targetKcalOverride) {
    t.targetKcal = tracker.targetKcalOverride;
    t.weeklyDelta = Math.round((t.targetKcal - t.eer) * 7 / 7700 * 100) / 100;
    t.ranges = calculateNutrientStandards(t.targetKcal);
  }
  return t;
}

function updateProfilePreview() {
  const el = document.getElementById('profile-preview');
  if (!el) return;
  const p = readProfile();
  const eer = validateProfile(p) ? null : calculateEER(p);
  if (eer) document.getElementById('profile-error').classList.add('hidden');
  if (!eer) {
    el.innerHTML = '<span class="text-emerald-600">나이·키·체중을 입력하면 기준 칼로리가 표시됩니다</span>';
    return;
  }
  const b = bodyIndices(p);
  el.innerHTML =
    '<span>기준 칼로리 <b class="text-lg">' + eer.toLocaleString() + '</b> kcal/일</span>'
    + '<span class="text-emerald-700">BMI ' + b.bmi.toFixed(1) + ' (' + b.bmiLabel + ')</span>'
    + (b.abdominal === undefined ? '' : '<span class="' + (b.abdominal ? 'text-red-600 font-bold' : 'text-emerald-700') + '">허리둘레 ' + (b.abdominal ? '복부비만' : '정상') + '</span>');
}

function submitProfile() {
  const err = validateProfile(readProfile());
  const el = document.getElementById('profile-error');
  if (err) {
    el.querySelector('span').textContent = err;
    el.classList.remove('hidden');
    return;
  }
  el.classList.add('hidden');
  goToStep(2);
}

// ── 결과 화면 탭 ─────────────────────────────
//   analysis : PDI·체중 유형·목표 칼로리·파이토케미컬 분석
//   plan     : 구독 세트 + 30일 식단
//   track    : 체중 변화·실천 기록 (구독 이후 단계라 마지막)
const RESULT_TABS = ['analysis', 'plan', 'track'];
let resultTab = 'analysis';

function setResultTab(id) {
  if (!RESULT_TABS.includes(id)) return;
  resultTab = id;
  for (const t of RESULT_TABS) {
    const panel = document.getElementById('rtab-' + t);
    const btn   = document.getElementById('rtab-btn-' + t);
    if (panel) panel.classList.toggle('hidden', t !== id);
    if (btn) {
      btn.classList.toggle('active', t === id);
      btn.setAttribute('aria-selected', String(t === id));
    }
  }
  // 상세 분석·차트는 보이는 상태에서만 좌표가 잡힌다
  const detail = document.getElementById('detail-analysis');
  if (id === 'analysis' && detail && detail.open && pdiResult) renderDetailAnalysis(pdiResult);
  if (id === 'track') drawWeightChart();
  const sec = document.getElementById('assessment');
  if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goToStep(n) {
  const cur = document.getElementById('step-' + currentStep);
  const next = document.getElementById('step-' + n);
  if (cur) cur.classList.add('hidden');
  if (next) next.classList.remove('hidden');

  for (let i = 1; i <= 4; i++) {
    const dot   = document.getElementById('step-' + i + '-dot');
    const label = document.getElementById('step-' + i + '-label');
    if (!dot) continue;
    if (i < n) {
      dot.className = 'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold';
      dot.innerHTML = '<i class="fas fa-check text-xs"></i>';
      label.className = 'text-sm font-medium text-emerald-600';
    } else if (i === n) {
      dot.className = 'w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center text-sm font-bold';
      dot.textContent = i;
      label.className = 'text-sm font-medium text-emerald-700';
    } else {
      dot.className = 'w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-bold';
      dot.textContent = i;
      label.className = 'text-sm font-medium text-gray-500';
    }
  }
  currentStep = n;
  document.getElementById('assessment').scrollIntoView({ behavior: 'smooth' });
}

// ══════════════════════════════════════════════
// AUTOCOMPLETE  (자동완성)
// ══════════════════════════════════════════════
function initAutocomplete() {
  const input = document.getElementById('meal-input');
  const dropdown = document.getElementById('autocomplete-list');
  if (!input) return;

  input.addEventListener('input', () => {
    const val = input.value.trim();
    dropdown.innerHTML = '';
    if (!val) { dropdown.classList.add('hidden'); return; }

    // ① 밥스누 제품 매칭
    const bobsnuMatches = INGREDIENT_NAMES.filter(n => INGREDIENTS[n].cat === 'bobsnu' && n.includes(val));
    // ② 레시피 매칭 (최대 7개)
    const recipeMatches = RECIPE_NAMES.filter(n => n.includes(val)).slice(0, 7);
    // ③ 단품 식재료 매칭 (bobsnu·레시피 중복 제외, 최대 5개)
    const usedNames = new Set([...bobsnuMatches, ...recipeMatches]);
    const singleMatches = INGREDIENT_NAMES.filter(n => n.includes(val) && !usedNames.has(n) && INGREDIENTS[n].cat !== 'bobsnu').slice(0, 5);

    if (!bobsnuMatches.length && !recipeMatches.length && !singleMatches.length) { dropdown.classList.add('hidden'); return; }

    dropdown.classList.remove('hidden');

    function addSeparator(label) {
      const li = document.createElement('li');
      li.className = 'px-4 py-1 text-xs font-bold bg-gray-50 border-t border-gray-100';
      li.style.cssText = 'pointer-events:none;color:#7C3AED';
      li.textContent = label;
      dropdown.appendChild(li);
    }

    // ① 밥스누 제품
    if (bobsnuMatches.length) {
      addSeparator('⭐ 밥스누 제품');
      bobsnuMatches.forEach(name => {
        const ing  = INGREDIENTS[name];
        const prod = BOBSNU_CATALOG.find(p => p.name === name);
        const li = document.createElement('li');
        li.className = 'px-4 py-2.5 hover:bg-purple-50 cursor-pointer flex items-center justify-between group';
        li.innerHTML =
          '<div class="flex items-center gap-2">'
          + '<span>' + (prod ? prod.icon : '⭐') + '</span>'
          + '<span class="font-medium text-gray-900">' + name + '</span>'
          + '<span class="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">밥스누</span>'
          + '<span class="ml-1 text-xs text-gray-400">' + ing.kcal + 'kcal/1회</span>'
          + '</div>'
          + '<i class="fas fa-plus text-purple-400 opacity-0 group-hover:opacity-100 text-sm"></i>';
        li.addEventListener('mousedown', (e) => { e.preventDefault(); input.value = name; dropdown.classList.add('hidden'); });
        dropdown.appendChild(li);
      });
    }

    // ② 레시피 항목
    if (recipeMatches.length) {
      if (bobsnuMatches.length) addSeparator('🍽 레시피');
      recipeMatches.forEach(name => {
        const recipe = RECIPES[name];
        const ingCount = Object.keys(recipe.ings).length;
        const li = document.createElement('li');
        li.className = 'px-4 py-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between group';
        li.innerHTML =
          '<div>'
          + '<span class="font-medium text-gray-900">' + name + '</span>'
          + '<span class="ml-2 text-xs text-gray-400">재료 ' + ingCount + '종 · ' + recipe.cal + 'kcal</span>'
          + '</div>'
          + '<i class="fas fa-plus text-emerald-500 opacity-0 group-hover:opacity-100 text-sm"></i>';
        li.addEventListener('mousedown', (e) => { e.preventDefault(); input.value = name; dropdown.classList.add('hidden'); });
        dropdown.appendChild(li);
      });
    }

    // ③ 단품 식재료 항목
    if (singleMatches.length) {
      addSeparator('🔸 단품 식품');
      singleMatches.forEach(name => {
        const ing  = INGREDIENTS[name];
        const cat  = FOOD_CATEGORIES[ing.cat] || {};
        const g    = SINGLE_SERVING_G[ing.cat] || 100;
        const kcal = Math.round((ing.kcal / 100) * g);
        const li = document.createElement('li');
        li.className = 'px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between group';
        li.innerHTML =
          '<div class="flex items-center gap-2">'
          + '<span>' + (cat.icon || '🔸') + '</span>'
          + '<span class="font-medium text-gray-900">' + name + '</span>'
          + '<span class="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">단품</span>'
          + '<span class="ml-1 text-xs text-gray-400">' + g + 'g · ' + kcal + 'kcal</span>'
          + '</div>'
          + '<i class="fas fa-plus text-blue-400 opacity-0 group-hover:opacity-100 text-sm"></i>';
        li.addEventListener('mousedown', (e) => { e.preventDefault(); input.value = name; dropdown.classList.add('hidden'); });
        dropdown.appendChild(li);
      });
    }
  });

  input.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 150));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addMeal(); }
  });
}

// ══════════════════════════════════════════════
// 분석 유틸  (인분 조정 · 식재료 조합 · 알레르기)
// ══════════════════════════════════════════════
// 음식명 → 분석 (레시피 우선, 없으면 단품 식재료)
function analyzeFood(name) {
  if (RECIPES[name]) return analyzeRecipe(name);
  if (INGREDIENTS[name] && SINGLE_FOOD_CATS.has(INGREDIENTS[name].cat)) return analyzeIngredient(name);
  return null;
}

// 식재료 조합으로 분석 객체 생성 (레시피 DB에 없는 대표 음식용)
function buildCustomAnalysis(name, ings) {
  const ingredients = [];
  let total = 0;
  for (const [ingName, grams] of Object.entries(ings)) {
    const ing = INGREDIENTS[ingName];
    if (!ing) continue;
    const kcal = ing.kcal * grams / 100;
    total += kcal;
    ingredients.push({ name: ingName, grams, kcal: Math.round(kcal), cat: ing.cat, prf: ing.prf, phytos: ing.phytos });
  }
  return { name, totalCal: Math.round(total), ingredients };
}

// 인분 배수 적용 (칼로리·중량·파이토케미컬 선형 비례)
function scaleAnalysis(analysis, factor) {
  if (factor === 1) return analysis;
  const scalePhytos = ph => (typeof ph === 'object' && !Array.isArray(ph))
    ? Object.fromEntries(Object.entries(ph).map(([k, v]) => [k, v * factor])) : ph;
  return {
    ...analysis,
    totalCal: Math.round(analysis.totalCal * factor),
    ingredients: analysis.ingredients.map(i => ({
      ...i,
      grams:    typeof i.grams === 'number' ? i.grams * factor : factor + '회',
      servings: typeof i.grams === 'number' ? undefined : factor,
      kcal:     Math.round(i.kcal * factor),
      phytos:   scalePhytos(i.phytos),
    })),
  };
}

// 음식에 포함된 알레르기 유발 식품 (선택한 항목만)
function findAllergens(name, analysis, allergySet) {
  if (!allergySet || !allergySet.size) return [];
  const names = [name, ...analysis.ingredients.map(i => i.name)];
  return ALLERGENS.filter(a => allergySet.has(a.id) && names.some(n => a.re.test(n))).map(a => a.name);
}

// ══════════════════════════════════════════════
// STEP 2 · 입력 모드 (설문 / 식사 기록)
// ══════════════════════════════════════════════
function setInputMode(mode) {
  inputMode = mode;
  for (const m of ['survey', 'log']) {
    const on = m === mode;
    document.getElementById('panel-' + m).classList.toggle('hidden', !on);
    document.getElementById('tab-' + m).className = 'flex-1 py-2.5 rounded-xl text-sm font-bold transition '
      + (on ? 'bg-white text-emerald-800 shadow' : 'text-gray-500 hover:text-gray-700');
  }
}

function submitDietInput() {
  const el = document.getElementById('step2-error');
  if (!addedMeals.length && !isSurveyComplete()) {
    const answered = Object.keys(surveyAnswers).length;
    el.querySelector('span').textContent = answered
      ? '설문 ' + (SURVEY_QUESTIONS.length - answered) + '개 문항이 남았어요. 모두 답하거나 식사를 1개 이상 기록해주세요.'
      : '식습관 설문에 답하거나 오늘 식사를 1개 이상 기록해주세요.';
    el.classList.remove('hidden');
    return;
  }
  el.classList.add('hidden');
  goToStep(3);
}

// ── 설문 ─────────────────────────────────────
function renderSurvey() {
  const el = document.getElementById('survey-questions');
  if (!el) return;
  el.innerHTML = SURVEY_QUESTIONS.map((q, qi) => {
    const answered = q.id in surveyAnswers;
    return '<div class="rounded-2xl border ' + (answered ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-100 bg-gray-50') + ' p-4">'
      + '<div class="text-sm font-bold text-gray-800 mb-2.5"><span class="text-emerald-700 mr-1">Q' + (qi + 1) + '.</span>' + q.q + '</div>'
      + '<div class="flex flex-wrap gap-2">'
      + q.options.map(([label, v], oi) => {
          const on = answered && surveyAnswers[q.id] === v;
          return '<button type="button" onclick="answerSurvey(\'' + q.id + '\',' + oi + ')" aria-pressed="' + on + '"'
            + ' class="px-4 py-2 rounded-xl text-sm border-2 transition '
            + (on ? 'border-emerald-600 bg-emerald-600 text-white font-bold' : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300') + '">'
            + label + '</button>';
        }).join('')
      + '</div></div>';
  }).join('')
  + '<div class="text-right text-xs text-gray-500">응답 ' + Object.keys(surveyAnswers).length + ' / ' + SURVEY_QUESTIONS.length + '</div>';
}

function answerSurvey(qid, optIdx) {
  const q = SURVEY_QUESTIONS.find(x => x.id === qid);
  surveyAnswers[qid] = q.options[optIdx][1];
  renderSurvey();
  if (isSurveyComplete()) document.getElementById('step2-error').classList.add('hidden');
}

function isSurveyComplete() {
  return SURVEY_QUESTIONS.every(q => q.id in surveyAnswers);
}

// 1일 섭취량을 1인분 단위로 나눔 (예: 1.5 → [1, 0.5])
function splitPortions(total) {
  const out = [];
  for (let left = total; left > 0.001; left -= 1) out.push(Math.min(1, +left.toFixed(2)));
  return out;
}

// 설문 응답 → 대표 음식으로 구성한 예측 1일 식단
function buildSurveyDiet(ans) {
  const diet = [];
  // q: 이 음식을 만든 설문 문항 id — 상세 분석의 「문항 → 식품군 → 파이토케미컬」 연결에 사용
  let q = null;
  const push = (name, meal, portion, analysis) => {
    analysis = analysis || analyzeFood(name);
    if (!analysis || !(portion > 0)) return;
    diet.push({ name, meal, portion, analysis: scaleAnalysis(analysis, portion), source: 'survey', q });
  };
  const custom = name => buildCustomAnalysis(name, SURVEY_FOODS.custom[name]);
  const slots = ['breakfast', 'lunch', 'dinner'].slice(3 - ans.meals);
  const slotAt = i => slots[i % slots.length];

  // 밥
  q = 'rice';
  for (const slot of slots) {
    if (ans.rice === 'white')      push('쌀밥', slot, 1);
    else if (ans.rice === 'grain') push('잡곡밥', slot, 1);
    else { push('쌀밥', slot, 0.5); push('잡곡밥', slot, 0.5); }
  }
  // 반찬
  q = 'veg';    splitPortions(ans.veg).forEach((p, i)    => push(SURVEY_FOODS.veg[i % SURVEY_FOODS.veg.length], slotAt(i), p));
  q = 'kimchi'; splitPortions(ans.kimchi).forEach((p, i) => push('배추김치', slotAt(i), p));
  q = 'soy';    splitPortions(ans.soy).forEach((p, i)    => push('된장찌개', slotAt(i + 1), p));
  q = 'meat';   splitPortions(ans.meat).forEach((p, i)   => push(SURVEY_FOODS.meat[i % SURVEY_FOODS.meat.length], slotAt(i + 1), p));
  // 간식류
  q = 'fruit';  splitPortions(ans.fruit).forEach((p, i)  => push(SURVEY_FOODS.fruit[i % SURVEY_FOODS.fruit.length], 'snack', p));
  q = 'nuts';   splitPortions(ans.nuts).forEach(p        => push('아몬드', 'snack', p));
  q = 'tea';    splitPortions(ans.tea).forEach(p         => push('녹차 한 잔', 'snack', p, custom('녹차 한 잔')));
  q = 'snack';  splitPortions(ans.snack).forEach((p, i)  => i % 2 === 0
    ? push('과자·단 음료', 'snack', p, custom('과자·단 음료'))
    : push('라면', 'snack', p));
  return diet;
}

// ══════════════════════════════════════════════
// STEP 2 · 식사 기록
// ══════════════════════════════════════════════
const MEAL_SLOTS = [
  { id: 'breakfast', name: '아침', icon: '🌅' },
  { id: 'lunch',     name: '점심', icon: '☀️' },
  { id: 'dinner',    name: '저녁', icon: '🌙' },
  { id: 'snack',     name: '간식', icon: '🍪' },
];

function renderQuickChips() {
  const el = document.getElementById('quick-chips');
  if (!el) return;
  el.innerHTML = QUICK_FOODS.filter(n => analyzeFood(n)).map(n =>
    '<button type="button" onclick="addMeal(\'' + n + '\')" class="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full transition">+ ' + n + '</button>'
  ).join('');
}

function addMeal(nameOverride) {
  const input    = document.getElementById('meal-input');
  const mealType = document.getElementById('meal-type').value;
  const portion  = Number(document.getElementById('meal-portion').value) || 1;
  const rawName  = (nameOverride || input.value).trim();

  if (!rawName) {
    showInputError('음식 이름을 입력해주세요.');
    return;
  }

  const analysis = analyzeFood(rawName);
  if (!analysis) {
    const closeR = RECIPE_NAMES.filter(n => n.includes(rawName)).slice(0, 3);
    const closeI = INGREDIENT_NAMES.filter(n => n.includes(rawName)).slice(0, 3);
    const close  = [...closeR, ...closeI].slice(0, 3);
    showInputError(close.length
      ? '"' + rawName + '"을 찾을 수 없습니다. 혹시 ' + close.join(', ') + ' 이신가요?'
      : '"' + rawName + '"은 현재 지원되지 않는 음식입니다. 자동완성 목록에서 선택해주세요.');
    return;
  }

  clearInputError();
  document.getElementById('step2-error').classList.add('hidden');
  addedMeals.push({ name: rawName, meal: mealType, portion, analysis: scaleAnalysis(analysis, portion) });
  if (!nameOverride) input.value = '';
  renderMealList();
}

function removeMeal(idx) {
  addedMeals.splice(idx, 1);
  renderMealList();
}

// 끼니 카드의 '+ 추가' → 해당 끼니로 입력창 이동
function focusMealSlot(slot) {
  document.getElementById('meal-type').value = slot;
  const input = document.getElementById('meal-input');
  input.focus();
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function portionLabel(p) {
  return { 0.5: '½인분', 1: '1인분', 1.5: '1½인분', 2: '2인분' }[p] || (p + '인분');
}

// 식재료 구성은 보여주지 않고 음식명·양·칼로리만 간단히 (분석 피드백은 결과 화면에서)
function renderMealList() {
  const container = document.getElementById('meal-list');
  if (!container) return;
  const total = addedMeals.reduce((s, m) => s + m.analysis.totalCal, 0);
  document.getElementById('meal-count').textContent = '(' + addedMeals.length + '개)';
  document.getElementById('meal-total-kcal').textContent = addedMeals.length ? '총 ' + Math.round(total).toLocaleString() + ' kcal' : '';

  container.innerHTML = MEAL_SLOTS.map(slot => {
    const items = addedMeals.map((m, idx) => ({ ...m, idx })).filter(m => m.meal === slot.id);
    const kcal = items.reduce((s, m) => s + m.analysis.totalCal, 0);
    return '<div class="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm">'
      + '<div class="flex items-center justify-between mb-2">'
      + '<span class="font-bold text-gray-800 text-sm">' + slot.icon + ' ' + slot.name + '</span>'
      + '<span class="text-xs text-gray-400">' + (items.length ? Math.round(kcal) + ' kcal' : '') + '</span>'
      + '</div>'
      + (items.length
          ? '<ul class="divide-y divide-gray-50">' + items.map(renderMealItem).join('') + '</ul>'
          : '<p class="text-xs text-gray-400 py-2">기록 없음</p>')
      + '<button type="button" onclick="focusMealSlot(\'' + slot.id + '\')" class="mt-2 text-xs text-emerald-700 font-medium hover:underline"><i class="fas fa-plus mr-1"></i>' + slot.name + ' 추가</button>'
      + '</div>';
  }).join('');
}

function renderMealItem(item) {
  const allergy = findAllergens(item.name, item.analysis, selectedAllergies);
  return '<li class="flex items-center justify-between gap-2 py-1.5">'
    + '<div class="min-w-0">'
    + '<span class="text-sm text-gray-900">' + item.name + '</span>'
    + (item.portion !== 1 ? '<span class="ml-1 text-xs text-gray-400">' + portionLabel(item.portion) + '</span>' : '')
    + (allergy.length ? '<span class="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold" title="알레르기 주의">⚠ ' + allergy.join('·') + '</span>' : '')
    + '</div>'
    + '<div class="flex items-center gap-2 flex-shrink-0">'
    + '<span class="text-xs text-gray-500">' + item.analysis.totalCal + ' kcal</span>'
    + '<button type="button" onclick="removeMeal(' + item.idx + ')" class="text-gray-300 hover:text-red-400 transition" aria-label="' + item.name + ' 삭제"><i class="fas fa-times-circle"></i></button>'
    + '</div></li>';
}

// 입력 오류 메시지
function showInputError(msg) {
  const el = document.getElementById('meal-input-error');
  if (!el) return;
  const span = el.querySelector('span') || el;
  span.textContent = msg;
  el.classList.remove('hidden');
}
function clearInputError() {
  const el = document.getElementById('meal-input-error');
  if (el) el.classList.add('hidden');
}

// ══════════════════════════════════════════════
// PDI ENGINE  (McCarty 2004 방법론 준수)
// ──────────────────────────────────────────────
// PDI = PRF 식품군에서 온 kcal / 총 kcal × 100
//
// PRF(Phytochemical-Rich Foods) 판정 기준:
//   통곡물 / 두류·콩가공품 / 채소·해조 / 과일 /
//   견과·종실 / 식물성 오일 / 차·커피·코코아
//   → INGREDIENTS[x].prf === true 로 코드화
//
// ※ 차류(tea)는 실제 kcal이 거의 0이므로
//   McCarty 원 공식 그대로 실제 kcal만 산입
//   (별도 보정값 없음)
//
// ※ 파이토케미컬 계열별 커버리지(phytoCoverage)는
//   McCarty 공식 외 참고용 추정 정보입니다.
//   개별 식재료-파이토케미컬 매핑은 식품영양학
//   문헌(Phenol-Explorer, 농촌진흥청 식품성분DB 등)
//   기반의 '존재 여부(binary)' 추정이며,
//   정량 함량(mg/100g) 데이터가 아닙니다.
// ══════════════════════════════════════════════
function calculatePDI(meals) {
  let totalCalories = 0, prfCalories = 0;
  const categoryMap = {};
  const phytoMap    = {};
  const allIngredients = [];

  for (const mealEntry of meals) {
    const { analysis } = mealEntry;
    totalCalories += analysis.totalCal;

    for (const ing of analysis.ingredients) {
      allIngredients.push({ ...ing, dish: mealEntry.name });

      // ── 식품군별 kcal 집계 ──
      if (!categoryMap[ing.cat]) {
        categoryMap[ing.cat] = {
          calories: 0, percentage: 0,
          isPRF: (FOOD_CATEGORIES[ing.cat] || {}).isPRF || false,
          ingredients: []
        };
      }
      categoryMap[ing.cat].calories += ing.kcal;
      categoryMap[ing.cat].ingredients.push(ing.name);

      // ── McCarty PDI: PRF 식품군 kcal 그대로 산입 ──
      // tea(차류)는 실제 kcal(≈0)을 그대로 사용
      // — 별도 보정 없음, 공식 그대로
      if (ing.prf) {
        prfCalories += ing.kcal;
      }

      // ── 파이토케미컬 계열별 mg 합산 ──
      // phytos는 { key: mg_per_100g } 오브젝트
      const phytoObj = (typeof ing.phytos === 'object' && !Array.isArray(ing.phytos))
        ? ing.phytos : {};
      for (const [p, mg] of Object.entries(phytoObj)) {
        phytoMap[p] = (phytoMap[p] || 0) + (mg || 0);
      }
    }
  }

  // 식품군 비율 계산
  for (const k in categoryMap) {
    categoryMap[k].percentage = totalCalories > 0
      ? (categoryMap[k].calories / totalCalories) * 100 : 0;
    categoryMap[k].ingredients = [...new Set(categoryMap[k].ingredients)];
  }

  // ── PDI 점수 (McCarty 2004 공식) ──
  const pdiScore = totalCalories > 0 ? (prfCalories / totalCalories) * 100 : 0;

  // ── 파이토케미컬 커버리지 (실측 mg 기반) ──
  const phytoCoverage = Object.keys(PHYTOCHEMICAL_GROUPS).map(key => {
    const g = PHYTOCHEMICAL_GROUPS[key];
    const totalMg = phytoMap[key] || 0;
    // mg 기준 레벨: 0 / 0~5 / 5~20 / 20+
    let level, levelLabel;
    if (totalMg === 0)     { level = 'none';   levelLabel = '미검출'; }
    else if (totalMg < 5)  { level = 'low';    levelLabel = `${totalMg.toFixed(1)}mg 적음`; }
    else if (totalMg < 20) { level = 'medium'; levelLabel = `${totalMg.toFixed(1)}mg 보통`; }
    else                   { level = 'high';   levelLabel = `${totalMg.toFixed(1)}mg 풍부`; }
    return { key, name: g.name, present: totalMg > 0, totalMg: +totalMg.toFixed(2), level, levelLabel,
             color: g.color, icon: g.icon, benefits: g.benefits };
  });

  const diversityScore = phytoCoverage.filter(p => p.present).length;
  const deficient = phytoCoverage.filter(p => !p.present || p.level === 'low').map(p => p.key);

  // ── 주의사항 (McCarty 원칙 기반) ──
  const warnings = [];
  if (categoryMap['refined'] && categoryMap['refined'].percentage > 40) {
    warnings.push(
      '정제 곡물 비율 ' + categoryMap['refined'].percentage.toFixed(0) +
      '% — 통곡물(현미·잡곡·귀리)로 일부 대체하면 PDI를 높일 수 있습니다'
    );
  }
  // PRF 식품군 중 두류 미섭취 여부 (식품군 수준 경고, McCarty 원칙)
  if (!categoryMap['legumes']) {
    warnings.push('두류·콩가공품 미섭취 — 두류는 핵심 PRF 식품군입니다 (된장찌개·두부·콩밥 등)');
  }
  if (!categoryMap['vegetables']) {
    warnings.push('채소류 미섭취 — 채소는 핵심 PRF 식품군입니다');
  }

  // ── 등급 ──
  let grade, gradeLabel, gradeColor;
  if (pdiScore >= 40)      { grade = 'excellent'; gradeLabel = '🌟 목표 달성 (≥40%)'; gradeColor = '#10B981'; }
  else if (pdiScore >= 30) { grade = 'good';      gradeLabel = '👍 양호 (30–39%)';     gradeColor = '#3B82F6'; }
  else if (pdiScore >= 20) { grade = 'fair';      gradeLabel = '📈 보통 (20–29%)';     gradeColor = '#F59E0B'; }
  else                     { grade = 'poor';      gradeLabel = '⚠️ 개선 필요 (<20%)';  gradeColor = '#EF4444'; }

  // ── 식단 개선 제안 (식품군 수준, McCarty 원칙) ──
  const suggestions = [];
  if (pdiScore < 40) {
    const gap = (40 - pdiScore).toFixed(1);
    suggestions.push(
      '📊 PRF 식품군(통곡물·두류·채소·과일·견과) 칼로리 비중을 높이면 PDI가 올라갑니다. ' +
      '현재 ' + pdiScore.toFixed(1) + '%, 목표까지 약 ' + gap + '%p 필요합니다.'
    );
  }
  // 부족한 PRF 식품군 기반 제안
  if (!categoryMap['grains']) {
    suggestions.push('🌾 흰쌀밥 대신 현미밥·잡곡밥을 선택하면 통곡물 PRF 칼로리가 추가됩니다');
  }
  if (!categoryMap['legumes']) {
    suggestions.push('🫘 된장찌개·두부·콩나물 등 두류 반찬 1가지를 추가해보세요');
  }
  if (!categoryMap['vegetables']) {
    suggestions.push('🥬 나물·김치·채소국 등 채소 반찬은 PRF 칼로리를 높이는 핵심입니다');
  }
  if (!categoryMap['fruits']) {
    suggestions.push('🍎 식후 과일 1회 섭취가 PDI 향상에 효과적입니다');
  }
  if (!categoryMap['nuts']) {
    suggestions.push('🥜 견과류 한 줌(호두·아몬드 등)을 간식으로 추가해보세요');
  }
  if (!categoryMap['tea']) {
    suggestions.push('🍵 식후 녹차·보이차 한 잔은 칼로리 거의 없이 PRF 식품군을 추가하는 방법입니다');
  }
  // 파이토케미컬 다양성 보조 제안 (참고용 표시)
  if (diversityScore < 6) {
    suggestions.push(
      '🌈 [참고] 다양한 색깔의 채소·과일을 포함하면 다양한 계열의 파이토케미컬을 ' +
      '섭취할 수 있습니다 (현재 추정 ' + diversityScore + '/12 계열)'
    );
  }

  return {
    pdiScore, prfCalories, totalCalories,
    categoryMap, phytoCoverage, diversityScore,
    warnings, grade, gradeLabel, gradeColor,
    deficient, suggestions, phytoMap, allIngredients,
  };
}

// ══════════════════════════════════════════════
// DISPLAY RESULTS
// ══════════════════════════════════════════════
// 식사 기록이 있으면 기록 기반(정확), 없으면 설문 기반 예측 식단으로 계산
function calculateAndShow() {
  const profile = readProfile();
  const profileErr = validateProfile(profile);
  if (profileErr) { alert(profileErr); goToStep(1); return; }

  const surveyDiet = isSurveyComplete() ? buildSurveyDiet(surveyAnswers) : null;
  const basis = addedMeals.length ? 'log' : (surveyDiet ? 'survey' : null);
  if (!basis) { alert('식습관 설문에 답하거나 식사를 1개 이상 기록해주세요.'); goToStep(2); return; }

  const meals = basis === 'log' ? addedMeals : surveyDiet;
  pdiResult = calculatePDI(meals);
  pdiResult.meals = meals;
  pdiResult.basis = basis;
  pdiResult.surveyPDI = (basis === 'log' && surveyDiet) ? calculatePDI(surveyDiet).pdiScore : null;
  pdiResult.profile = profile;
  pdiResult.body = bodyIndices(profile);
  pdiResult.phytoScore = calculatePhytoScore(pdiResult.phytoMap, selectedGoals);
  pdiResult.pfs = calculateDietPFS(meals, profile);
  pdiResult.intake = foodGroupIntake(meals);
  pdiResult.allergyHits = meals
    .map(m => ({ name: m.name, allergens: findAllergens(m.name, m.analysis, profile.allergies) }))
    .filter(x => x.allergens.length);

  // 프로필·목표를 저장하고 목표 칼로리·영양 기준 산출 (체중 유형 반영)
  tracker.profile = { ...profile, allergies: [...profile.allergies] };
  tracker.goals = [...selectedGoals];
  if (!tracker.weights.length) tracker.weights.push({ date: isoToday(), kg: profile.weight });
  tracker.targetKcalOverride = null;
  trackerSave();
  pdiResult.targets = currentTargets();

  subCart = null;                   // 결과가 바뀌면 구독 구성 초기화
  goToStep(4);
  displayResults();
  buildMealPlan();                  // 저장된 식단이 현재 구성과 맞으면 표시, 아니면 안내 화면
}

// ── 30일 식단 생성 ────────────────────────────
function buildMealPlan(force) {
  const r = pdiResult;
  if (!r || !subCart) return;
  const el = document.getElementById('mealplan-section');
  const cart = subCartToQuoteInput();
  // 체중은 키에 넣지 않음 — 매번 체중을 기록할 때마다 식단이 낡은 것으로 표시되지 않게
  const cartKey = JSON.stringify(cart) + '|' + r.targets.targetKcal;
  // 버튼을 누르지 않았으면 최적화를 돌리지 않는다 — 저장된 식단이 맞으면 보여주고, 아니면 안내 화면
  if (!force) { renderMealPlan(); renderMonitor(); return; }

  if (el) el.innerHTML = '<div class="flex items-center gap-3 text-sm text-gray-500 py-4">'
    + '<i class="fas fa-circle-notch fa-spin text-emerald-600 text-xl"></i>'
    + '<span>선택한 구독 구성으로 30일 식단을 계산하는 중… <span class="text-gray-400">영양 균형·PDI·메뉴 다양성·메뉴 궁합을 함께 맞춥니다</span></span></div>';

  // 렌더 프레임을 양보한 뒤 최적화 (버튼 클릭이 멈춘 것처럼 보이지 않게)
  setTimeout(() => {
    const plan = generateMealPlan({
      profile: tracker.profile, targets: r.targets, cart,
      days: 30, allergies: r.profile.allergies,
    });
    if (plan.error) {
      if (el) el.innerHTML = '<p class="text-sm text-red-600">식단 생성 실패: ' + plan.error + '</p>';
      return;
    }
    tracker.plan = plan;
    tracker.planKey = cartKey;
    if (!tracker.startDate) tracker.startDate = isoToday();
    trackerSave();
    planViewFrom = Math.max(1, Math.min(30 - 6, planDayIndex() || 1));
    renderMealPlan();
    renderMonitor();
  }, 30);
}

// 「이 구성으로 식단 추천받기」 — 구독 구성을 정한 뒤 최적화를 돌린다
function requestMealPlan() {
  if (!pdiResult || !subCart) return;
  const q = subscriptionQuote(subCartToQuoteInput());
  if (q.counts.soymilk + q.counts.phyto + q.counts.bar === 0) {
    alert('제품을 1개 이상 담은 뒤 식단을 추천받을 수 있습니다.');
    return;
  }
  const logged = Object.keys(tracker.log || {}).length;
  if (logged && !confirm('새 구성으로 식단을 다시 만들면 지금까지의 실천 기록이 초기화됩니다. 계속할까요?')) return;
  tracker.startDate = isoToday();
  tracker.log = {};
  buildMealPlan(true);
  setResultTab('plan');
  const el = document.getElementById('mealplan-section');
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 명시적 재생성만 이행 기록을 초기화한다
// (applyRetarget 은 목표만 바꾸고 지금까지의 기록·체중 추이를 유지)
function regenerateMealPlan() {
  tracker.startDate = isoToday();
  tracker.log = {};
  buildMealPlan(true);
}

// 현재 구독 구성으로 만든 식단이 이미 있는지
function planFresh() {
  return !!(tracker.plan && !planStale());
}

// 구독 구성·목표가 바뀌어 저장된 식단이 최신이 아닌지
function planStale() {
  if (!tracker.plan || !pdiResult || !subCart) return false;
  const key = JSON.stringify(subCartToQuoteInput()) + '|' + pdiResult.targets.targetKcal;
  return tracker.planKey !== key;
}

// 모니터링에서 제안한 목표 칼로리를 적용하고 식단을 다시 생성
function applyRetarget(newTargetKcal) {
  tracker.targetKcalOverride = newTargetKcal;
  trackerSave();
  if (pdiResult) pdiResult.targets = currentTargets();
  renderGuide(pdiResult);
  buildMealPlan(true);
}

// 통곡물 kcal 비율, 채소·과일 섭취량(g) — 주의사항 판단용
const WHOLE_GRAIN_RE = /현미|흑미|보리|귀리|오트|잡곡|수수|기장|율무|메밀|통밀|퀴노아|차조|^조$|^조\(/;
function foodGroupIntake(meals) {
  let total = 0, wholeGrainKcal = 0, vegG = 0, fruitG = 0;
  for (const m of meals) {
    total += m.analysis.totalCal;
    for (const i of m.analysis.ingredients) {
      const g = typeof i.grams === 'number' ? i.grams : 0;
      if (i.cat === 'grains' && WHOLE_GRAIN_RE.test(i.name)) wholeGrainKcal += i.kcal;
      if (i.cat === 'vegetables') vegG += g;
      if (i.cat === 'fruits') fruitG += g;
    }
  }
  return { wholeGrainPct: total > 0 ? wholeGrainKcal / total * 100 : 0, vegG, fruitG };
}

function displayResults() {
  const r = pdiResult;

  // ─ PDI Ring ─
  const score = Math.min(r.pdiScore, 100);
  const ring = document.getElementById('pdi-ring');
  ring.setAttribute('stroke-dasharray', ((score / 100) * 314) + ' 314');
  ring.setAttribute('stroke', r.gradeColor);
  document.getElementById('pdi-score-display').textContent  = r.pdiScore.toFixed(1) + '%';
  document.getElementById('pdi-score-display').style.color  = r.gradeColor;
  const badge = document.getElementById('pdi-grade-badge');
  badge.textContent = r.gradeLabel;
  badge.style.backgroundColor = r.gradeColor;

  const basisBadge = document.getElementById('pdi-basis-badge');
  basisBadge.textContent = r.basis === 'log' ? '식사 기록 기반' : '예측치';
  basisBadge.className = 'align-middle ml-1 text-xs font-bold px-2 py-0.5 rounded-full '
    + (r.basis === 'log' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700');
  document.getElementById('pdi-basis-note').textContent = r.basis === 'log'
    ? '오늘 기록한 식사로 계산했습니다' + (r.surveyPDI !== null ? ' · 설문 예측 PDI ' + r.surveyPDI.toFixed(1) + '%' : '')
    : '식습관 설문을 대표 음식으로 환산한 예측치입니다 · 식사를 기록하면 더 정확해집니다';

  // ─ Summary Stats ─
  document.getElementById('total-cal').textContent     = Math.round(r.totalCalories) + ' kcal';
  document.getElementById('prf-cal').textContent       = Math.round(r.prfCalories) + ' kcal';
  // (설문 기반이면 위 두 칼로리 타일은 displayResults 에서 숨깁니다)
  document.getElementById('diversity-score').textContent = r.phytoScore.coveredCount + '/' + PHYTO_SCORED_KEYS.length;
  document.getElementById('food-cat-count').textContent  = Object.keys(r.categoryMap).length + '가지';

  // 설문 기반이면 섭취량에 의존하는 지표는 아예 보여주지 않는다
  const isSurvey = r.basis === 'survey';
  const show = (id, on) => {
    const sec = document.getElementById(id);
    if (sec) sec.classList.toggle('hidden', !on);
  };
  show('pfs-score-section', !isSurvey);      // PFS 식단 점수 — 나트륨·당류 등 양 의존
  show('stat-total-cal', !isSurvey);         // 총 칼로리
  show('stat-prf-cal', !isSurvey);           // PRF 칼로리

  renderKeySummary(r);
  renderGuide(r);
  renderSubscription(r);
  if (!isSurvey) renderPFSScore(r.pfs);
  renderPhytoScore(r.phytoScore, isSurvey);
  renderMealPlan();
  renderMonitor();
  setResultTab(resultTab);

  // 상세 분석은 펼쳐져 있을 때만 그림
  const detail = document.getElementById('detail-analysis');
  if (detail && detail.open) renderDetailAnalysis(r);
}

function renderDetailAnalysis(r) {
  renderIngredientBreakdown(r);
  setTimeout(() => renderCategoryChart(r.categoryMap), 150);
}

// ══════════════════════════════════════════════
// 식재료 분해 & 파이토케미컬 매핑 뷰
// ══════════════════════════════════════════════

// ─ 중복 합산된 식재료 목록 반환 (공통 유틸) ─
function getMergedIngredients(r) {
  const merged = {};
  for (const ing of r.allIngredients) {
    const key = ing.name + '|' + ing.cat;
    if (!merged[key]) merged[key] = { ...ing, totalKcal: 0, totalGrams: 0 };
    merged[key].totalKcal  += ing.kcal;
    merged[key].totalGrams += ing.grams;
  }
  return Object.values(merged).sort((a, b) => b.totalKcal - a.totalKcal);
}

// ══════════════════════════════════════════════
// 생키 플로우차트: 음식 → 식재료(식품군) → 파이토케미컬
// ══════════════════════════════════════════════

// ── 상세 분석의 1·2열 구성 ─────────────────────
// 식사 기록 기반: 음식 → 식재료
// 설문   기반: 설문 문항 → 식품군  (설문은 개별 식재료를 묻지 않으므로 식품군까지만)
const SURVEY_FLOW_META = {
  rice:   { icon: '🍚', label: '밥 종류' },
  veg:    { icon: '🥬', label: '채소 반찬' },
  kimchi: { icon: '🥬', label: '김치' },
  fruit:  { icon: '🍎', label: '과일' },
  soy:    { icon: '🫘', label: '콩·두부·된장' },
  nuts:   { icon: '🥜', label: '견과류' },
  meat:   { icon: '🍖', label: '고기·생선·달걀' },
  tea:    { icon: '🍵', label: '무가당 차' },
  snack:  { icon: '🍪', label: '가공식품' },
};
// 양념·기름은 설문이 묻지 않은 부수 재료이므로 제외 (레시피에 딸려오는 소금·참기름 등)
const SURVEY_FLOW_SKIP_CATS = new Set(['spices', 'oils']);

function buildLogFlow(r, allIng) {
  const col1To2 = {};
  r.meals.forEach((m, mi) => {
    col1To2[mi] = new Set();
    ((m.analysis || {}).ingredients || []).forEach(ing => {
      if (allIng.some(x => x.name === ing.name)) col1To2[mi].add(ing.name);
    });
  });
  const col2ToPhyto = {};
  allIng.forEach(i => {
    col2ToPhyto[i.name] = Object.keys((typeof i.phytos === 'object' && !Array.isArray(i.phytos)) ? i.phytos : {});
  });
  return {
    col1Title: '🍽 음식',
    col2Title: '🥬 식재료 (식품군)',
    col1: r.meals.map(m => {
      const slot = MEAL_SLOTS.find(x => x.id === m.meal) || { icon: '🍽', name: m.meal };
      return { icon: slot.icon, name: m.name, sub: slot.name + ' · ' + Math.round((m.analysis || {}).totalCal || 0) + 'kcal' };
    }),
    col2: allIng.map(i => ({ ...i, icon: (FOOD_CATEGORIES[i.cat] || {}).icon })),
    col1To2, col2ToPhyto,
  };
}

function buildSurveyFlow(r) {
  // 문항별로 그 문항이 만든 음식의 식재료를 식품군으로 모은다
  const qCats = {};                 // 문항 id → Set(식품군 키)
  const catPhytos = {};             // 식품군 키 → { phytoKey: mg }
  const catKcal = {};               // 식품군 키 → kcal
  for (const m of r.meals) {
    if (!m.q || !SURVEY_FLOW_META[m.q]) continue;
    for (const ing of (m.analysis || {}).ingredients || []) {
      if (!ing.cat || SURVEY_FLOW_SKIP_CATS.has(ing.cat)) continue;
      (qCats[m.q] || (qCats[m.q] = new Set())).add(ing.cat);
      catKcal[ing.cat] = (catKcal[ing.cat] || 0) + (ing.kcal || 0);
      const ph = (typeof ing.phytos === 'object' && !Array.isArray(ing.phytos)) ? ing.phytos : {};
      const bag = catPhytos[ing.cat] || (catPhytos[ing.cat] = {});
      for (const [k, v] of Object.entries(ph)) bag[k] = (bag[k] || 0) + (v || 0);
    }
  }

  // 1열: 응답한 문항 (설문 순서 유지) — 선택한 답을 함께 보여준다
  const qIds = SURVEY_QUESTIONS.map(q => q.id).filter(id => qCats[id]);
  const col1 = qIds.map(id => {
    const q = SURVEY_QUESTIONS.find(x => x.id === id);
    const picked = q.options.find(o => o[1] === surveyAnswers[id]);
    return { icon: SURVEY_FLOW_META[id].icon, name: SURVEY_FLOW_META[id].label, sub: picked ? picked[0] : '' };
  });

  // 2열: 식품군 (칼로리 큰 순)
  const cats = Object.keys(catKcal).sort((a, b) => catKcal[b] - catKcal[a]);
  const totalKcal = Object.values(catKcal).reduce((s, v) => s + v, 0) || 1;
  const col2 = cats.map(c => {
    const meta = FOOD_CATEGORIES[c] || {};
    return {
      name: meta.name || c,
      cat: c,
      icon: meta.icon || '🔸',
      prf: !!meta.isPRF,
      note: Math.round(catKcal[c] / totalKcal * 100) + '%',
      phytos: catPhytos[c] || {},
    };
  });
  const catToName = Object.fromEntries(cats.map(c => [c, (FOOD_CATEGORIES[c] || {}).name || c]));

  const col1To2 = {};
  qIds.forEach((id, i) => { col1To2[i] = new Set([...qCats[id]].map(c => catToName[c]).filter(Boolean)); });
  const col2ToPhyto = {};
  col2.forEach(n => { col2ToPhyto[n.name] = Object.keys(n.phytos).filter(k => n.phytos[k] > 0); });

  return {
    col1Title: '📝 설문 문항',
    col2Title: '🥬 식품군 <span class="font-normal">(칼로리 비중)</span>',
    col1, col2, col1To2, col2ToPhyto,
  };
}

function renderIngredientBreakdown(r) {
  const container = document.getElementById('ingredient-breakdown');
  if (!container) return;

  const allIng = getMergedIngredients(r);

  // ── 데이터 준비 ──
  // 설문 기반이면 「설문 문항 → 식품군」, 식사 기록 기반이면 「음식 → 식재료」로 잇습니다.
  // 설문은 개별 식재료를 묻지 않으므로 식재료까지 내려가면 사실과 다른 연결이 됩니다.
  const isSurvey = r.basis === 'survey';
  const flow = isSurvey ? buildSurveyFlow(r) : buildLogFlow(r, allIng);
  const meals = flow.col1;          // Col 1: 설문 문항 또는 음식
  const nodes2 = flow.col2;         // Col 2: 식품군 또는 식재료
  const mealToIng = flow.col1To2;
  const ingToPhyto = flow.col2ToPhyto;
  const presentPhytoKeys = [...new Set(Object.values(ingToPhyto).flat())];

  // phyto → functions (benefit 키워드)
  // 현재 식단에 등장한 파이토케미컬의 benefits만 모음
  const phytoToFunctions = {}; // phytoKey → [benefitStr]
  presentPhytoKeys.forEach(key => {
    const g = PHYTOCHEMICAL_GROUPS[key];
    if (g && g.benefits) phytoToFunctions[key] = g.benefits;
  });
  // 등장한 기능성 분야 목록 (중복 제거, 순서 유지)
  const presentFuncKeys = [...new Set(presentPhytoKeys.flatMap(k => phytoToFunctions[k] || []))];

  // ── 컨테이너 HTML 생성 ──
  container.innerHTML =
    '<div class="text-xs text-amber-600 mb-4 flex items-center gap-2">'
    + '<i class="fas fa-info-circle"></i>'
    + '<span>' + (isSurvey
        ? '노드에 마우스를 올리면 경로가 강조됩니다 · 설문 응답 → 식품군 → 파이토케미컬 → 기대 효과 순서로 이어집니다'
        : '노드에 마우스를 올리면 경로가 강조됩니다 · 파이토케미컬 수치는 실측 mg/100g 기반') + '</span>'
    + '</div>'
    + '<div id="sankey-wrap" style="position:relative;overflow:visible">'
    // 4열 그리드
    + '<div id="sankey-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0;align-items:start;position:relative">'

    // ── 열1: 음식 ──
    + '<div id="col-meal" style="display:flex;flex-direction:column;gap:10px;align-items:flex-end;padding-right:40px">'
    + '<div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2" style="align-self:flex-end">' + flow.col1Title + '</div>'
    + meals.map((m, mi) =>
        '<div id="node-meal-' + mi + '" data-col="meal" data-id="' + mi + '"'
        + ' class="sankey-node flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 cursor-pointer select-none transition-all border-blue-300 bg-blue-50 text-blue-800 text-xs font-semibold whitespace-nowrap"'
        + ' style="max-width:160px">'
        + '<span class="text-base leading-none">' + m.icon + '</span>'
        + '<div style="overflow:hidden">'
        + '<div class="truncate font-bold" style="max-width:120px">' + m.name + '</div>'
        + '<div class="text-blue-400 font-normal truncate" style="max-width:120px">' + m.sub + '</div>'
        + '</div>'
        + '</div>').join('')
    + '</div>'

    // ── 열2: 식재료(식품군) ──
    + '<div id="col-ing" style="display:flex;flex-direction:column;gap:8px;align-items:center;padding:0 20px">'
    + '<div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">' + flow.col2Title + '</div>'
    + nodes2.map(ing => {
        const isPRF = ing.prf;
        const bg   = isPRF ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-50 text-gray-500';
        return '<div id="node-ing-' + ing.name.replace(/\s/g,'_') + '" data-col="ing" data-id="' + ing.name + '"'
          + ' class="sankey-node flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 cursor-pointer select-none transition-all text-xs font-semibold whitespace-nowrap ' + bg + '">'
          + '<span class="text-sm leading-none">' + (ing.icon || '🔸') + '</span>'
          + '<span>' + ing.name + '</span>'
          + (ing.note ? '<span class="font-normal opacity-60">' + ing.note + '</span>' : '')
          + (isPRF ? '<span class="text-emerald-500 font-bold text-xs">PRF</span>' : '')
          + '</div>';
      }).join('')
    + '</div>'

    // ── 열3: 파이토케미컬 ──
    + '<div id="col-phyto" style="display:flex;flex-direction:column;gap:8px;align-items:flex-start;padding:0 30px">'
    + '<div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">🧬 파이토케미컬 <span class="font-normal">(추정)</span></div>'
    + presentPhytoKeys.map(key => {
        const g = PHYTOCHEMICAL_GROUPS[key];
        if (!g) return '';
        return '<div id="node-phyto-' + key + '" data-col="phyto" data-id="' + key + '"'
          + ' class="sankey-node flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer select-none transition-all border-2 text-white text-xs font-semibold whitespace-nowrap"'
          + ' style="background:' + g.color + ';border-color:' + g.color + ';">'
          + '<span class="text-sm leading-none">' + g.icon + '</span>'
          + '<span>' + g.name + '</span>'
          + '</div>';
      }).join('')
    + '</div>'

    // ── 열4: 기능성 분야 ──
    + '<div id="col-func" style="display:flex;flex-direction:column;gap:8px;align-items:flex-start;padding-left:30px">'
    + '<div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">💡 기능성 분야</div>'
    + presentFuncKeys.map(b => {
        const icon = BENEFIT_ICON[b] || '✦';
        // 이 기능성과 연결된 파이토케미컬의 색상(첫 번째) 사용
        const linkedPhyto = presentPhytoKeys.find(k => (phytoToFunctions[k] || []).includes(b));
        const color = linkedPhyto ? PHYTOCHEMICAL_GROUPS[linkedPhyto].color : '#6B7280';
        return '<div id="node-func-' + encodeURIComponent(b) + '" data-col="func" data-id="' + b + '"'
          + ' class="sankey-node flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer select-none transition-all border-2 text-xs font-semibold whitespace-nowrap"'
          + ' style="background:' + color + '18;border-color:' + color + '55;color:' + color + ';">'
          + '<span class="text-sm leading-none">' + icon + '</span>'
          + '<span class="font-bold">' + b + '</span>'
          + '</div>';
      }).join('')
    + '</div>'

    + '</div>' // sankey-grid
    + '</div>'; // sankey-wrap

  // ── SVG + 인터랙션 — DOM 완전 안정 후 그리기 ──
  // phytoScore / categoryChart 렌더 후 레이아웃이 확정되어야 좌표가 정확함
  setTimeout(() => {
    drawSankey({ meals, allIng: nodes2, presentPhytoKeys, mealToIng, ingToPhyto, phytoToFunctions, presentFuncKeys });
  }, 350);
}

// ── 생키 SVG 그리기 ──
function drawSankey({ meals, allIng, presentPhytoKeys, mealToIng, ingToPhyto, phytoToFunctions, presentFuncKeys }) {
  const wrap = document.getElementById('sankey-wrap');
  if (!wrap) return;

  // 기존 SVG 제거
  const old = wrap.querySelector('svg.sankey-svg');
  if (old) old.remove();

  const wRect = wrap.getBoundingClientRect();
  if (!wRect.width) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('sankey-svg');
  svg.setAttribute('width',  wRect.width);
  svg.setAttribute('height', wRect.height);
  // overflow:hidden — wrap 바깥으로 선이 튀어나가지 않게 차단
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;z-index:1';
  wrap.appendChild(svg);

  // getBoundingClientRect는 뷰포트 좌표 — 매 drawAll 호출 시 wrap 위치를 새로 계산
  function getWrapRect() { return wrap.getBoundingClientRect(); }
  function mid(el) {
    const wr = getWrapRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - wr.left + r.width / 2, y: r.top - wr.top + r.height / 2 };
  }
  function right(el) {
    const wr = getWrapRect();
    const r = el.getBoundingClientRect();
    return { x: r.right - wr.left, y: r.top - wr.top + r.height / 2 };
  }
  function left(el) {
    const wr = getWrapRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - wr.left, y: r.top - wr.top + r.height / 2 };
  }

  // 엣지 목록 생성
  // A: meal → ing
  const edgesA = [];
  meals.forEach((m, mi) => {
    (mealToIng[mi] || new Set()).forEach(ingName => {
      edgesA.push({ mealIdx: mi, ingName });
    });
  });
  // B: ing → phyto
  const edgesB = [];
  allIng.forEach(ing => {
    (ingToPhyto[ing.name] || []).forEach(phytoKey => {
      edgesB.push({ ingName: ing.name, phytoKey });
    });
  });
  // C: phyto → function
  const edgesC = [];
  presentPhytoKeys.forEach(phytoKey => {
    (phytoToFunctions[phytoKey] || []).forEach(funcName => {
      edgesC.push({ phytoKey, funcName });
    });
  });

  function getNode(col, id) {
    if (col === 'meal') return document.getElementById('node-meal-' + id);
    if (col === 'ing')  return document.getElementById('node-ing-' + String(id).replace(/\s/g,'_'));
    if (col === 'phyto')return document.getElementById('node-phyto-' + id);
    if (col === 'func') return document.getElementById('node-func-' + encodeURIComponent(id));
    return null;
  }

  function pathD(p1, p2) {
    const cx = (p1.x + p2.x) / 2;
    return 'M'+p1.x+' '+p1.y+' C'+cx+' '+p1.y+','+cx+' '+p2.y+','+p2.x+' '+p2.y;
  }

  function drawAll(highlightMeal, highlightIng, highlightPhyto, highlightFunc) {
    svg.innerHTML = '';
    const allNull = highlightMeal === null && highlightIng === null && highlightPhyto === null && highlightFunc === null;

    edgesA.forEach(({ mealIdx, ingName }) => {
      const mEl = getNode('meal', mealIdx);
      const iEl = getNode('ing', ingName);
      if (!mEl || !iEl) return;
      const active = allNull || highlightMeal === mealIdx || highlightIng === ingName;
      const p1 = right(mEl), p2 = left(iEl);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD(p1, p2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', active ? '#3B82F6' : '#E5E7EB');
      path.setAttribute('stroke-width', active ? '2.5' : '1');
      path.setAttribute('opacity', active ? '0.8' : '0.2');
      if (!active) path.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(path);
    });

    edgesB.forEach(({ ingName, phytoKey }) => {
      const iEl = getNode('ing', ingName);
      const pEl = getNode('phyto', phytoKey);
      if (!iEl || !pEl) return;
      const active = allNull || highlightIng === ingName || highlightPhyto === phytoKey;
      const g   = PHYTOCHEMICAL_GROUPS[phytoKey];
      const col = g ? g.color : '#9CA3AF';
      const p1 = right(iEl), p2 = left(pEl);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD(p1, p2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', active ? col : '#E5E7EB');
      path.setAttribute('stroke-width', active ? '2.5' : '1');
      path.setAttribute('opacity', active ? '0.8' : '0.2');
      if (!active) path.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(path);
    });

    edgesC.forEach(({ phytoKey, funcName }) => {
      const pEl = getNode('phyto', phytoKey);
      const fEl = getNode('func',  funcName);
      if (!pEl || !fEl) return;
      const active = allNull || highlightPhyto === phytoKey || highlightFunc === funcName;
      const g   = PHYTOCHEMICAL_GROUPS[phytoKey];
      const col = g ? g.color : '#9CA3AF';
      const p1 = right(pEl), p2 = left(fEl);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD(p1, p2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', active ? col : '#E5E7EB');
      path.setAttribute('stroke-width', active ? '2' : '1');
      path.setAttribute('opacity', active ? '0.7' : '0.15');
      if (!active) path.setAttribute('stroke-dasharray', '3 3');
      svg.appendChild(path);
    });
  }

  // SVG height를 실제 콘텐츠 높이에 맞게 재설정 (wrap이 내용에 따라 늘어남)
  requestAnimationFrame(() => {
    const newH = wrap.getBoundingClientRect().height;
    if (newH > 0) {
      svg.setAttribute('height', newH);
      svg.style.height = newH + 'px';
    }
    drawAll(null, null, null, null);
  });

  // 호버 인터랙션
  const allNodes = wrap.querySelectorAll('.sankey-node');

  function highlight(col, id) {
    const relMeals  = new Set();
    const relIngs   = new Set();
    const relPhytos = new Set();
    const relFuncs  = new Set();

    if (col === 'meal') {
      relMeals.add(id);
      (mealToIng[id] || new Set()).forEach(n => {
        relIngs.add(n);
        (ingToPhyto[n] || []).forEach(p => {
          relPhytos.add(p);
          (phytoToFunctions[p] || []).forEach(f => relFuncs.add(f));
        });
      });
    } else if (col === 'ing') {
      relIngs.add(id);
      meals.forEach((m, mi) => { if ((mealToIng[mi]||new Set()).has(id)) relMeals.add(mi); });
      (ingToPhyto[id] || []).forEach(p => {
        relPhytos.add(p);
        (phytoToFunctions[p] || []).forEach(f => relFuncs.add(f));
      });
    } else if (col === 'phyto') {
      relPhytos.add(id);
      (phytoToFunctions[id] || []).forEach(f => relFuncs.add(f));
      allIng.forEach(ing => {
        if ((ingToPhyto[ing.name]||[]).includes(id)) {
          relIngs.add(ing.name);
          meals.forEach((m, mi) => { if ((mealToIng[mi]||new Set()).has(ing.name)) relMeals.add(mi); });
        }
      });
    } else if (col === 'func') {
      relFuncs.add(id);
      presentPhytoKeys.forEach(pk => {
        if ((phytoToFunctions[pk]||[]).includes(id)) {
          relPhytos.add(pk);
          allIng.forEach(ing => {
            if ((ingToPhyto[ing.name]||[]).includes(pk)) {
              relIngs.add(ing.name);
              meals.forEach((m, mi) => { if ((mealToIng[mi]||new Set()).has(ing.name)) relMeals.add(mi); });
            }
          });
        }
      });
    }

    // 노드 강조/흐림
    allNodes.forEach(n => {
      const nc = n.getAttribute('data-col');
      const ni = n.getAttribute('data-id');
      let hit = false;
      if (nc === 'meal')  hit = relMeals.has(Number(ni)) || relMeals.has(ni);
      if (nc === 'ing')   hit = relIngs.has(ni);
      if (nc === 'phyto') hit = relPhytos.has(ni);
      if (nc === 'func')  hit = relFuncs.has(ni);
      n.style.opacity = hit ? '1' : '0.2';
      n.style.transform = hit ? 'scale(1.05)' : '';
    });

    // 엣지 강조 (drawAll 재사용)
    svg.innerHTML = '';
    edgesA.forEach(({ mealIdx, ingName }) => {
      const mEl = getNode('meal', mealIdx);
      const iEl = getNode('ing', ingName);
      if (!mEl || !iEl) return;
      const active = relMeals.has(mealIdx) && relIngs.has(ingName);
      const p1 = right(mEl), p2 = left(iEl);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD(p1, p2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', active ? '#3B82F6' : '#E5E7EB');
      path.setAttribute('stroke-width', active ? '2.5' : '1');
      path.setAttribute('opacity', active ? '0.85' : '0.1');
      if (!active) path.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(path);
    });
    edgesB.forEach(({ ingName, phytoKey }) => {
      const iEl = getNode('ing', ingName);
      const pEl = getNode('phyto', phytoKey);
      if (!iEl || !pEl) return;
      const active = relIngs.has(ingName) && relPhytos.has(phytoKey);
      const g   = PHYTOCHEMICAL_GROUPS[phytoKey];
      const col2 = g ? g.color : '#9CA3AF';
      const p1 = right(iEl), p2 = left(pEl);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD(p1, p2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', active ? col2 : '#E5E7EB');
      path.setAttribute('stroke-width', active ? '2.5' : '1');
      path.setAttribute('opacity', active ? '0.85' : '0.1');
      if (!active) path.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(path);
    });
    edgesC.forEach(({ phytoKey, funcName }) => {
      const pEl = getNode('phyto', phytoKey);
      const fEl = getNode('func',  funcName);
      if (!pEl || !fEl) return;
      const active = relPhytos.has(phytoKey) && relFuncs.has(funcName);
      const g   = PHYTOCHEMICAL_GROUPS[phytoKey];
      const col2 = g ? g.color : '#9CA3AF';
      const p1 = right(pEl), p2 = left(fEl);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD(p1, p2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', active ? col2 : '#E5E7EB');
      path.setAttribute('stroke-width', active ? '2' : '1');
      path.setAttribute('opacity', active ? '0.85' : '0.1');
      if (!active) path.setAttribute('stroke-dasharray', '3 3');
      svg.appendChild(path);
    });
  }

  function unhighlight() {
    allNodes.forEach(n => { n.style.opacity = '1'; n.style.transform = ''; });
    drawAll(null, null, null, null);
  }

  allNodes.forEach(n => {
    n.addEventListener('mouseenter', () => {
      const col = n.getAttribute('data-col');
      const raw = n.getAttribute('data-id');
      const id  = col === 'meal' ? Number(raw) : raw;
      highlight(col, id);
    });
    n.addEventListener('mouseleave', unhighlight);
  });
}

// ─ 도넛 차트 ─
function renderCategoryChart(catMap) {
  const ctx = document.getElementById('category-chart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const labels = [], data = [], colors = [];
  for (const [key, val] of Object.entries(catMap)) {
    if (val.calories > 0) {
      const cat = FOOD_CATEGORIES[key];
      if (cat) { labels.push(cat.name); data.push(Math.round(val.calories)); colors.push(cat.color); }
    }
  }

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: ctx => ctx.label + ': ' + ctx.raw + 'kcal (' + ((ctx.raw / pdiResult.totalCalories) * 100).toFixed(1) + '%)'
        }}
      },
      cutout: '60%'
    }
  });

  // 레전드
  const legend = document.getElementById('category-legend');
  legend.innerHTML = labels.map((l, i) => {
    const catEntry = Object.entries(catMap).find(([k]) => (FOOD_CATEGORIES[k] || {}).name === l);
    const catData  = catEntry ? catEntry[1] : {};
    const pct = pdiResult.totalCalories > 0 ? ((data[i] / pdiResult.totalCalories) * 100).toFixed(1) : 0;
    const ingStr = (catData.ingredients || []).slice(0, 4).join(', ');
    return '<div class="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">'
      + '<div class="flex items-start gap-2">'
      + '<div class="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style="background:' + colors[i] + '"></div>'
      + '<div>'
      + '<div class="flex items-center gap-1.5">'
      + '<span class="text-sm text-gray-800 font-medium">' + l + '</span>'
      + (catData.isPRF ? '<span class="text-xs text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">PRF</span>' : '')
      + '</div>'
      + (ingStr ? '<div class="text-xs text-gray-400 mt-0.5">' + ingStr + (catData.ingredients.length > 4 ? ' 외' : '') + '</div>' : '')
      + '</div>'
      + '</div>'
      + '<div class="text-sm font-bold text-gray-900 ml-4 text-right">'
      + data[i] + 'kcal<br><span class="text-xs text-gray-400 font-normal">' + pct + '%</span>'
      + '</div>'
      + '</div>';
  }).join('');
}

// ══════════════════════════════════════════════
// 점수 개선 시뮬레이션
// 밥스누 제품 1회분을 현재 식단에 가산했을 때
// PDI 점수·파이토 점수가 얼마나 오르는지 계산
// ══════════════════════════════════════════════
function simulateAddFood(prodName) {
  // 현재 pdiResult 없으면 계산 불가
  if (!pdiResult) return null;

  // INGREDIENTS에서 제품 데이터 가져오기
  const ing = INGREDIENTS[prodName];
  if (!ing || ing.cat !== 'bobsnu') return null;

  // ─ 현재 기준값 ─
  const curPDI   = pdiResult.pdiScore;
  const curPhyto = pdiResult.phytoScore ? pdiResult.phytoScore.total : 0;
  const curTotal = pdiResult.totalCalories;
  const curPRF   = pdiResult.prfCalories;

  // ─ 1회 가산 ─
  // 밥스누 제품은 kcal가 이미 1회 제공량 기준
  const addKcal  = ing.kcal || 0;
  const addPhytos = ing.phytos || {};

  // 가상 PDI 계산
  // 밥스누 제품은 prf:true → PRF kcal에 포함
  const newTotal  = curTotal + addKcal;
  const newPRF    = curPRF + (ing.prf ? addKcal : 0);
  const newPDI    = newTotal > 0 ? (newPRF / newTotal) * 100 : 0;
  const deltaPDI  = newPDI - curPDI;

  // 가상 파이토 점수 계산
  const newPhytoMap = { ...pdiResult.phytoMap };
  for (const [key, mg] of Object.entries(addPhytos)) {
    newPhytoMap[key] = (newPhytoMap[key] || 0) + (mg || 0);
  }
  const newPhytoScore = calculatePhytoScore(newPhytoMap, selectedGoals);
  const deltaPhyto    = newPhytoScore.total - curPhyto;

  // 추가되는 파이토케미컬 계열 (기존에 없던 신규 계열)
  const newKeys = Object.keys(addPhytos).filter(k => !(pdiResult.phytoMap[k] > 0) && addPhytos[k] > 0);

  return {
    deltaPDI:   +deltaPDI.toFixed(1),
    deltaPhyto: +deltaPhyto.toFixed(0),
    newPDI:     +newPDI.toFixed(1),
    newPhyto:   newPhytoScore.total,
    newKeys,    // 신규 추가 파이토 계열
  };
}

function simBadges(sim) {
  if (!sim) return '';
  const pdiColor = sim.deltaPDI > 0 ? 'text-emerald-700' : 'text-gray-400';
  const phyColor = sim.deltaPhyto > 0 ? 'text-purple-700' : 'text-gray-400';
  return '<span class="text-xs ' + pdiColor + '">PDI ' + (sim.deltaPDI >= 0 ? '+' : '') + sim.deltaPDI + '%p</span>'
    + '<span class="text-xs ' + phyColor + '">파이토 ' + (sim.deltaPhyto >= 0 ? '+' : '') + sim.deltaPhyto + '점</span>';
}

// ══════════════════════════════════════════════
// 구독 세트 — 수량 조정 + 할인가 (엑셀 Sheet3 가격·할인 정책)
// ══════════════════════════════════════════════
// 구독 상태: 두유는 제품 1종을 골라 수량 조정, 파이토·프로틴바는 수량만, 추가 구성품은 on/off
let subCart = null;
let subRecommendation = null;

function subCartToQuoteInput() {
  return {
    soymilk: Array(subCart.soymilk).fill(subCart.soymilkCode),
    phyto:   Array(subCart.phyto).fill('가'),
    bar:     Array(subCart.bar).fill('나'),
    addon:   [...subCart.addon],
  };
}

// 부족 판정 — 룰테이블의 「통곡물·채소·단백질 부족」 축
//   칼슘은 식재료 DB에 칼슘 함량이 없어 판정하지 않습니다 (룰테이블의 칼슘 열도 사용 안 함)
function dietLacks(r) {
  return {
    wholeGrain: r.intake.wholeGrainPct < 5,
    veg:        r.intake.vegG < 350,
    protein:    r.pfs.daily.nutrients.protein < r.pfs.ranges.protein[0],
  };
}

function initSubCart(r) {
  const lacks = dietLacks(r);
  subRecommendation = recommendSubscription({
    pdi: r.pdiScore, bmi: r.body.bmi, age: r.profile.age,
    lacks, goals: selectedGoals, allergies: r.profile.allergies,
  });
  const c = subRecommendation.cart;
  subCart = {
    soymilkCode: c.soymilk.length ? c.soymilk[0] : 'A',
    soymilk: c.soymilk.length,
    phyto:   c.phyto.length,
    bar:     c.bar.length,
    addon:   new Set(c.addon),
  };
  subRecommendation.lacks = lacks;
}

// 구독 구성이 바뀌면 구독 패널과 식단 섹션을 함께 다시 그린다
//   (식단 섹션은 「구성이 바뀌었습니다 → 다시 추천받기」 안내로 바뀜)
function onSubCartChanged() {
  renderSubscription(pdiResult);
  renderMealPlan();
}

function setSubQty(kind, delta) {
  subCart[kind] = Math.max(0, Math.min(10, subCart[kind] + delta));
  onSubCartChanged();
}

function setSoymilkCode(code) {
  subCart.soymilkCode = code;
  if (subCart.soymilk === 0) subCart.soymilk = 1;
  onSubCartChanged();
}

function toggleAddon(code) {
  if (subCart.addon.has(code)) subCart.addon.delete(code); else subCart.addon.add(code);
  onSubCartChanged();
}

function applyPreset(id) {
  const ps = SUBSCRIPTION_PRESETS.find(p => p.id === id);
  if (!ps) return;
  subCart.soymilk = ps.counts.soymilk;
  subCart.phyto   = ps.counts.phyto;
  subCart.bar     = ps.counts.bar;
  subCart.addon.clear();
  onSubCartChanged();
}

function resetSubCart() {
  initSubCart(pdiResult);
  onSubCartChanged();
}

function won(v) { return v.toLocaleString('ko-KR') + '원'; }

function qtyRow(label, icon, qty, kind, extra) {
  return '<div class="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-0">'
    + '<span class="text-2xl">' + icon + '</span>'
    + '<div class="flex-1 min-w-0">' + label + '</div>'
    + (extra || '')
    + '<div class="flex items-center gap-1 flex-shrink-0">'
    + '<button type="button" onclick="setSubQty(\'' + kind + '\',-1)" class="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400" aria-label="줄이기">−</button>'
    + '<span class="w-8 text-center text-sm font-black text-gray-900">' + qty + '</span>'
    + '<button type="button" onclick="setSubQty(\'' + kind + '\',1)" class="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400" aria-label="늘리기">+</button>'
    + '</div></div>';
}

function renderSubscription(r) {
  const el = document.getElementById('product-recommendations');
  if (!el) return;
  if (!subCart) initSubCart(r);

  const quote = subscriptionQuote(subCartToQuoteInput());
  const rec = subRecommendation;
  const allergySet = r.profile.allergies;
  const soymilks = BOBSNU_CATALOG.filter(p => p.kind === 'soymilk' && !catalogAllergens(p).some(a => allergySet.has(a)));
  const phyto = CATALOG_BY_CODE['가'], bar = CATALOG_BY_CODE['나'];

  // ── 추천 근거 (엑셀 룰테이블) ──
  const ruleLabel = PDI_BANDS.find(b => b.id === rec.rule.pdiBand).name + ' / ' + rec.bodyType.name
    + ' / ' + AGE_BANDS.find(a => a.id === rec.rule.ageBand).name;
  const lackChips = [
    ['통곡물', rec.lacks.wholeGrain], ['채소', rec.lacks.veg], ['단백질', rec.lacks.protein],
  ].map(([n, bad]) => '<span class="text-xs px-2 py-0.5 rounded-full ' + (bad ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-gray-100 text-gray-400') + '">'
    + (bad ? '부족: ' : '충족: ') + n + '</span>').join('');

  const reasonsHtml = rec.reasons.map(x => {
    const names = String(x.code).split('·').map(c => (CATALOG_BY_CODE[c] || {}).name || c).join(' · ');
    return '<li class="flex gap-2 text-xs"><span class="font-bold text-emerald-800 flex-shrink-0">' + names + '</span>'
      + '<span class="text-gray-500">' + x.why + '</span></li>';
  }).join('');

  // ── 제품 선택 ──
  const soymilkSelect = '<select onchange="setSoymilkCode(this.value)" class="text-xs px-2 py-1.5 border border-gray-200 rounded-lg max-w-48">'
    + soymilks.map(p => '<option value="' + p.code + '"' + (p.code === subCart.soymilkCode ? ' selected' : '') + '>'
        + p.code + '. ' + p.name + ' (' + p.pack + ' ' + won(p.price) + ')</option>').join('')
    + '</select>';

  const sm = CATALOG_BY_CODE[subCart.soymilkCode];
  const rows =
    qtyRow('<div class="text-sm font-bold text-gray-900">두유</div><div class="text-xs text-gray-500 truncate">' + sm.note + '</div>',
           sm.icon, subCart.soymilk, 'soymilk', soymilkSelect)
    + qtyRow('<div class="text-sm font-bold text-gray-900">' + phyto.name + '</div><div class="text-xs text-gray-500">' + phyto.pack + ' · ' + won(phyto.price) + ' · PDI 기여 ' + phyto.pdiKcal + ' kcal</div>',
             phyto.icon, subCart.phyto, 'phyto')
    + qtyRow('<div class="text-sm font-bold text-gray-900">' + bar.name + '</div><div class="text-xs text-gray-500">' + bar.pack + ' · ' + won(bar.price) + ' · PDI 기여 ' + bar.pdiKcal + ' kcal</div>',
             bar.icon, subCart.bar, 'bar');

  const addonChips = BOBSNU_CATALOG.filter(p => p.kind === 'addon').map(p => {
    const on = subCart.addon.has(p.code);
    const recommended = rec.cart.addon.includes(p.code);
    return '<button type="button" onclick="toggleAddon(\'' + p.code + '\')" aria-pressed="' + on + '" '
      + 'class="text-xs px-3 py-1.5 rounded-full border-2 ' + (on ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold' : 'border-gray-200 text-gray-600 hover:border-gray-400') + '">'
      + p.icon + ' ' + p.name + ' ' + won(p.price) + (recommended ? ' <span class="text-emerald-600">★</span>' : '') + '</button>';
  }).join('');

  const presetBtns = SUBSCRIPTION_PRESETS.map(ps => {
    const on = quote.preset && quote.preset.id === ps.id;
    const q = subscriptionQuote({
      soymilk: Array(ps.counts.soymilk).fill(subCart.soymilkCode),
      phyto: Array(ps.counts.phyto).fill('가'), bar: Array(ps.counts.bar).fill('나'), addon: [],
    });
    return '<button type="button" onclick="applyPreset(\'' + ps.id + '\')" '
      + 'class="text-xs px-3 py-1.5 rounded-full border-2 ' + (on ? 'border-emerald-600 bg-emerald-600 text-white font-bold' : 'border-gray-200 text-gray-600 hover:border-emerald-400') + '">'
      + ps.title + ' · ' + ps.desc + ' → ' + q.rate + '% ' + won(q.finalPrice) + '</button>';
  }).join('');

  // ── 가격 ──
  const lineItems = quote.lines.map(l =>
    '<li class="flex items-center gap-2 text-xs py-1"><span>' + l.product.icon + '</span>'
    + '<span class="flex-1 min-w-0 truncate text-gray-700">' + l.product.name + (l.product.pack ? ' (' + l.product.pack + ')' : '') + ' × ' + l.qty + '</span>'
    + '<span class="font-bold text-gray-800">' + won(l.amount) + '</span></li>').join('');

  const c = quote.counts;
  const baseReason =
      quote.rate === 0                                        ? '제품을 1개 이상 담아주세요'
    : (c.soymilk >= 2 && c.phyto >= 2 && c.bar >= 3)          ? '최적 구독 세트 구성 (두유 2 · 파이토 2 · 프로틴바 3)'
    : (c.soymilk >= 1 && c.phyto >= 1 && c.bar >= 2)          ? '최소 권장 세트 구성 (두유 1 · 파이토 1 · 프로틴바 2)'
    : (c.soymilk + c.phyto + c.bar >= 2)                      ? '직접 구성 · 제품 2개 이상'
    :                                                           '직접 구성 · 제품 1개';
  const rateReason = baseReason + (quote.rate > 0 && c.addon > 0 ? ' + 추가 구성품 5%p' : '');

  // ── 1회분 더 먹었을 때의 예상 점수 변화 ──
  const simRows = ['soymilk', 'phyto', 'bar'].map(kind => {
    const p = kind === 'soymilk' ? sm : (kind === 'phyto' ? phyto : bar);
    const sim = simulateAddFood(p.name);
    return sim ? '<div class="flex items-center gap-2 text-xs"><span class="flex-1 truncate text-gray-600">' + p.name + '</span>' + simBadges(sim) + '</div>' : '';
  }).join('');

  el.innerHTML =
    '<div class="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 mb-4">'
    + '<div class="flex flex-wrap items-center gap-2 mb-2">'
    + '<span class="text-sm font-bold text-emerald-900">🎯 체중 관리자 추천 룰</span>'
    + '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-emerald-800">' + ruleLabel + '</span>'
    + '</div>'
    + '<div class="flex flex-wrap gap-1.5 mb-2">' + lackChips + '</div>'
    + '<ul class="space-y-1">' + reasonsHtml + '</ul>'
    + (rec.excluded.length ? '<p class="text-xs text-red-600 mt-2"><i class="fas fa-exclamation-triangle mr-1"></i>알레르기로 제외: ' + rec.excluded.map(p => p.name).join(', ') + '</p>' : '')
    + '</div>'


    + '<div class="flex flex-wrap gap-1.5 mb-3">' + presetBtns
    + '<button type="button" onclick="resetSubCart()" class="text-xs px-3 py-1.5 rounded-full border-2 border-gray-200 text-gray-500 hover:border-gray-400">추천 구성으로 되돌리기</button></div>'

    + '<div class="grid lg:grid-cols-2 gap-4">'
    + '<div class="rounded-2xl border-2 border-gray-100 p-4">'
    + '<div class="text-sm font-bold text-gray-900 mb-1">구독 구성 (월 기준)</div>'
    + '<div class="text-xs text-gray-400 mb-2">수량을 조정하면 할인율이 바뀝니다</div>'
    + rows
    + '<div class="mt-3 pt-3 border-t border-gray-100"><div class="text-xs font-bold text-gray-500 mb-1.5">추가 구성품 <span class="font-normal text-gray-400">(넣으면 +5%p · ★ 추천)</span></div>'
    + '<div class="flex flex-wrap gap-1.5">' + addonChips + '</div></div>'
    + '</div>'

    + '<div class="rounded-2xl border-2 p-4" style="border-color:#05966933">'
    + '<div class="text-sm font-bold text-gray-900 mb-2">결제 금액</div>'
    + '<ul class="divide-y divide-gray-50 mb-3">' + (lineItems || '<li class="text-xs text-gray-400 py-2">담긴 제품이 없습니다</li>') + '</ul>'
    + '<div class="flex items-center justify-between text-sm py-1"><span class="text-gray-500">정가</span>'
    + '<span class="' + (quote.rate ? 'line-through text-gray-400' : 'font-bold text-gray-900') + '">' + won(quote.listPrice) + '</span></div>'
    + (quote.rate
        ? '<div class="flex items-center justify-between text-sm py-1"><span class="text-gray-500">구독 할인</span>'
          + '<span class="font-bold text-emerald-700">' + quote.rate + '% · −' + won(quote.discount) + '</span></div>'
          + '<div class="flex items-end justify-between pt-2 mt-1 border-t border-gray-100">'
          + '<span class="text-sm font-bold text-gray-700">월 결제액</span>'
          + '<span class="text-3xl font-black text-emerald-700">' + won(quote.finalPrice) + '</span></div>'
        : '')
    + '<p class="text-xs text-gray-400 mt-2">할인 근거: ' + rateReason + '</p>'
    + (simRows ? '<div class="mt-3 pt-3 border-t border-gray-100 space-y-1"><div class="text-xs font-bold text-gray-500 mb-1">1회분 추가 시 예상 변화</div>' + simRows + '</div>' : '')
    + '</div></div>'

    // 구독 → 식단 추천 흐름의 연결점
    + '<div class="mt-4 rounded-2xl border-2 p-4" style="border-color:' + (planFresh() ? '#E5E7EB' : '#05966966') + ';background:' + (planFresh() ? '#F9FAFB' : '#ECFDF5') + '">'
    + '<div class="flex flex-wrap items-center justify-between gap-3">'
    + '<div class="min-w-0"><div class="text-sm font-bold text-gray-900">'
    + (planFresh() ? '✓ 이 구성으로 만든 30일 식단이 아래에 있습니다' : '🗓 이 구성으로 30일 식단을 받아보세요') + '</div>'
    + '<div class="text-xs text-gray-500 mt-0.5">'
    + (planFresh()
        ? '수량을 바꾸면 그 구성에 맞춰 다시 추천받을 수 있습니다'
        : '구독한 제품을 30일에 나눠 넣고, 영양 균형·PDI·메뉴 다양성·메뉴 궁합을 함께 맞춥니다')
    + '</div></div>'
    + '<button type="button" onclick="requestMealPlan()" class="flex-shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition '
    + (planFresh() ? 'border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50' : 'bg-emerald-700 text-white hover:bg-emerald-800') + '">'
    + (planFresh() ? '다시 추천받기' : '식단 추천받기 →') + '</button>'
    + '</div></div>'

    + '<p class="text-xs text-gray-400 mt-3">※ 가격·할인율은 「제품 추천 로직 구성」 엑셀 Sheet3 기준입니다. '
    + '정가는 제품 단가 합계로 계산하며, 엑셀 프리셋 정가(두유2+파이토2 = 138,000원 / 두유1+파이토1 = 69,000원)와 수량 조합이 일치하면 함께 표시합니다.</p>';
}

// ── 파이토 점수 렌더링 ────────────────────────
// isSurvey: 설문 기반이면 mg 기반 100점 점수는 숨기고 「어떤 계열을 먹었는지」만 보여줍니다
function renderPhytoScore(ps, isSurvey) {
  const el = document.getElementById('phyto-score-section');
  if (!el) return;

  const total = ps.total;

  // 총점 등급
  let grade, gradeColor;
  if      (total >= 80) { grade = '🌟 우수';   gradeColor = '#10B981'; }
  else if (total >= 60) { grade = '👍 양호';   gradeColor = '#3B82F6'; }
  else if (total >= 40) { grade = '📈 보통';   gradeColor = '#F59E0B'; }
  else                  { grade = '⚠️ 부족';   gradeColor = '#EF4444'; }

  // 막대 하나 생성 헬퍼
  function bar(value, max, color) {
    const pct = Math.round((value / max) * 100);
    return '<div class="flex items-center gap-3">'
      + '<div class="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">'
      + '<div class="h-3 rounded-full transition-all duration-700" style="width:' + pct + '%;background:' + color + '"></div>'
      + '</div>'
      + '<span class="text-xs font-bold text-gray-700 w-14 text-right">' + value + ' / ' + max + '</span>'
      + '</div>';
  }

  // 계열별 달성률 바 (상위 5개 + 하위 표시)
  const keyRows = PHYTO_SCORED_KEYS.map(k => ({
    k,
    ...ps.perKey[k],
    g: PHYTOCHEMICAL_GROUPS[k],
  })).sort((a, b) => b.ratio - a.ratio);

  const keyBars = keyRows.map(row => {
    const pct = Math.round(row.ratio * 100);
    const isGoal = ps.goalKeys.includes(row.k);
    return '<div class="flex items-center gap-2 py-1">'
      + '<span class="text-base w-6 text-center">' + (row.g ? row.g.icon : '') + '</span>'
      + '<span class="text-xs text-gray-600 w-20 truncate' + (isGoal ? ' font-bold text-indigo-700' : '') + '">'
      + (row.g ? row.g.name : row.k)
      + (isGoal ? ' 🎯' : '')
      + '</span>'
      + '<div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">'
      + '<div class="h-2 rounded-full transition-all duration-700" style="width:' + pct + '%;background:' + (row.g ? row.g.color : '#6B7280') + '"></div>'
      + '</div>'
      + '<span class="text-xs text-gray-500 w-12 text-right">'
      + (row.mg < 0.1 ? '0' : row.mg.toFixed(1)) + 'mg'
      + '</span>'
      + '<span class="text-xs font-bold w-10 text-right" style="color:' + (row.g ? row.g.color : '#6B7280') + '">'
      + pct + '%'
      + '</span>'
      + '</div>';
  }).join('');

  el.innerHTML =
    '<div class="flex flex-wrap items-center justify-between gap-4 mb-6">'
    + '<div>'
    + '<h3 class="text-xl font-bold text-gray-900">🌿 파이토케미컬 ' + (isSurvey ? '구성' : '점수') + '</h3>'
    + '<p class="text-gray-500 text-sm mt-1">'
    + (isSurvey ? '설문으로 추정한 섭취 계열 — 섭취량(mg)은 식사를 기록해야 알 수 있습니다'
                : '우리 DB 기반 일일 기준량(p75) 대비 달성도') + '</p>'
    + '</div>'
    // 총점 뱃지 — 설문이면 mg 기반 점수 대신 계열 수만
    + '<div class="flex items-center gap-3">'
    + '<div class="text-center">'
    + '<div class="text-5xl font-black" style="color:' + (isSurvey ? '#8B5CF6' : gradeColor) + '">'
    + (isSurvey ? ps.coveredCount : total) + '</div>'
    + '<div class="text-xs text-gray-400">' + (isSurvey ? '/ ' + PHYTO_SCORED_KEYS.length + ' 계열' : '/ 100점') + '</div>'
    + '</div>'
    + '<div class="text-left">'
    + (isSurvey
        ? '<div class="inline-flex items-center px-3 py-1.5 rounded-full bg-purple-100 text-purple-800 text-sm font-bold">📝 설문 추정</div>'
          + '<div class="text-xs text-gray-400 mt-1">섭취한 계열 수</div>'
        : '<div class="inline-flex items-center px-3 py-1.5 rounded-full text-white text-sm font-bold" style="background:' + gradeColor + '">' + grade + '</div>'
          + '<div class="text-xs text-gray-400 mt-1">' + ps.coveredCount + '/' + PHYTO_SCORED_KEYS.length + '개 계열 검출</div>')
    + '</div>'
    + '</div>'
    + '</div>'

    // 3개 하위 점수 — 충분량·목적 집중도는 mg 기반이라 설문에서는 제외
    + (isSurvey ? '' : '<div class="grid grid-cols-3 gap-4 mb-6">'
    // 다양성
    + '<div class="bg-blue-50 rounded-2xl p-4">'
    + '<div class="flex items-center gap-2 mb-2"><span class="text-lg">🌈</span><span class="text-sm font-bold text-blue-800">다양성</span></div>'
    + bar(ps.diversity, 40, '#3B82F6')
    + '<p class="text-xs text-blue-600 mt-2">' + ps.coveredCount + '개 계열 섭취</p>'
    + '</div>'
    // 충분량
    + '<div class="bg-emerald-50 rounded-2xl p-4">'
    + '<div class="flex items-center gap-2 mb-2"><span class="text-lg">⚖️</span><span class="text-sm font-bold text-emerald-800">충분량</span></div>'
    + bar(ps.sufficiency, 30, '#10B981')
    + '<p class="text-xs text-emerald-600 mt-2">DRV 평균 달성률 ' + Math.round((ps.sufficiency/30)*100) + '%</p>'
    + '</div>'
    // 목적 집중도
    + '<div class="bg-indigo-50 rounded-2xl p-4">'
    + '<div class="flex items-center gap-2 mb-2"><span class="text-lg">🎯</span><span class="text-sm font-bold text-indigo-800">목적 집중도</span></div>'
    + bar(ps.focus, 30, '#6366F1')
    + '<p class="text-xs text-indigo-600 mt-2">' + ps.focusLabel + '</p>'
    + '</div>'
    + '</div>')

    // 계열별 — 기록 기반이면 DRV 달성률, 설문이면 섭취한 계열 목록
    + '<div class="bg-gray-50 rounded-2xl p-5">'
    + '<div class="text-sm font-bold text-gray-700 mb-3">'
    + (isSurvey
        ? '섭취한 파이토케미컬 계열 <span class="font-normal text-gray-400 text-xs ml-1">🎯 = 선택한 목적 계열</span>'
        : '계열별 DRV 달성률 <span class="font-normal text-gray-400 text-xs ml-1">🎯 = 선택한 목적 계열</span>')
    + '</div>'
    + (isSurvey
        ? '<div class="flex flex-wrap gap-1.5">' + keyRows.map(row => {
            const on = row.mg > 0.01;
            const isGoal = ps.goalKeys.includes(row.k);
            return '<span class="text-xs px-2.5 py-1 rounded-full font-bold '
              + (on ? 'text-white' : 'bg-gray-200 text-gray-400') + '"'
              + (on ? ' style="background:' + (row.g ? row.g.color : '#6B7280') + '"' : '') + '>'
              + (row.g ? row.g.icon + ' ' + row.g.name : row.k) + (isGoal ? ' 🎯' : '') + '</span>';
          }).join('') + '</div>'
          + '<p class="text-xs text-gray-400 mt-3">회색은 설문 응답에서 섭취가 추정되지 않은 계열입니다. '
          + '계열별 섭취량(mg)과 기준 달성률은 식사를 기록하면 계산됩니다.</p>'
        : '<div class="grid md:grid-cols-2 gap-x-6">' + keyBars + '</div>')
    + '</div>';
}

// ── 핵심 요약 ────────────────────────────────
// 섭취/기준 칼로리 게이지 + PDI · 파이토 다양성 · 단백질 · 식이섬유 · PFS
function renderKeySummary(r) {
  const el = document.getElementById('key-summary');
  if (!el) return;
  const pfs = r.pfs;
  const eer = pfs.eer;
  const intake = r.totalCalories;
  const ratio = eer > 0 ? intake / eer : 0;
  const n = pfs.daily.nutrients;

  // 칼로리 게이지: 0–150% 눈금, 100% 위치에 기준선
  let calState, calColor;
  if (ratio > 1.1)       { calState = '초과 +' + Math.round(intake - eer).toLocaleString() + ' kcal'; calColor = '#EF4444'; }
  else if (ratio >= 0.8) { calState = '적정';                                                        calColor = '#10B981'; }
  else                   { calState = '부족 −' + Math.round(eer - intake).toLocaleString() + ' kcal'; calColor = '#F59E0B'; }
  const gaugeMax = 1.5;
  const fillPct = Math.min(ratio, gaugeMax) / gaugeMax * 100;
  const markPct = 1 / gaugeMax * 100;

  // 목표 대비 막대 (target 도달 = 100%)
  function miniBar(value, target, color) {
    const pct = target > 0 ? Math.min(value / target, 1) * 100 : 0;
    return '<div class="h-2 bg-gray-100 rounded-full overflow-hidden mt-2"><div class="h-2 rounded-full" style="width:' + pct + '%;background:' + color + '"></div></div>';
  }
  function tile(label, valueHtml, sub, extra) {
    return '<div class="bg-gray-50 rounded-2xl p-4 min-w-0">'
      + '<div class="text-xs font-bold text-gray-500 mb-1">' + label + '</div>'
      + '<div class="flex items-baseline gap-1 flex-wrap">' + valueHtml + '</div>'
      + (extra || '')
      + '<div class="text-xs text-gray-400 mt-1.5">' + sub + '</div>'
      + '</div>';
  }

  const protLo = pfs.ranges.protein[0], protHi = pfs.ranges.protein[1];
  const fibT = pfs.ranges.fiber;
  const ps = r.phytoScore;
  const t = PFS_TREND_LABELS[pfs.trend];

  // 설문은 「무엇을 얼마나 자주」만 묻기 때문에 비율 지표(PDI)는 추정할 수 있지만
  // 칼로리·나트륨·당류처럼 섭취량에 직접 비례하는 값은 신뢰할 수 없습니다.
  // 그래서 설문 기반일 때는 PDI·파이토 다양성·단백질만 보여주고 나머지는 숨깁니다
  const isSurvey = r.basis === 'survey';

  const basisHtml = !isSurvey
    ? '<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">🍽 오늘 식사 기록 기반</span>'
      + (r.surveyPDI !== null ? '<span class="text-xs text-gray-500">설문 예측 PDI ' + r.surveyPDI.toFixed(1) + '% → 기록 PDI ' + r.pdiScore.toFixed(1) + '%</span>' : '')
    : '<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">📝 설문 기반 예측치</span>';

  el.innerHTML =
    '<div class="flex flex-wrap items-center justify-between gap-2 mb-5">'
    + '<h3 class="text-xl font-bold text-gray-900">📋 나의 식단 요약</h3>'
    + '<div class="flex flex-wrap items-center gap-2">' + basisHtml + '</div>'
    + '</div>'

    // 칼로리 게이지 (식사 기록 기반일 때만)
    + (isSurvey ? '' : '<div class="rounded-2xl border border-gray-100 p-5 mb-4">'
    + '<div class="flex flex-wrap items-end justify-between gap-2 mb-3">'
    + '<div><div class="text-xs font-bold text-gray-500 mb-1">섭취 칼로리 / 기준 칼로리</div>'
    + '<div class="text-2xl md:text-3xl font-black text-gray-900">' + Math.round(intake).toLocaleString()
    + '<span class="text-base font-medium text-gray-400"> / ' + eer.toLocaleString() + ' kcal</span></div></div>'
    + '<div class="text-right"><span class="text-3xl font-black" style="color:' + calColor + '">' + Math.round(ratio * 100) + '%</span>'
    + '<div class="text-sm font-bold" style="color:' + calColor + '">' + calState + '</div></div>'
    + '</div>'
    + '<div class="relative h-5 bg-gray-100 rounded-full" role="img" aria-label="기준 칼로리 대비 ' + Math.round(ratio * 100) + '%">'
    + '<div class="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style="width:' + fillPct + '%;background:' + calColor + '"></div>'
    + '<div class="absolute -top-1 -bottom-1 w-0.5 bg-gray-800" style="left:' + markPct + '%"></div>'
    + '</div>'
    + '<div class="relative h-4 mt-1 text-xs text-gray-400">'
    + '<span class="absolute left-0">0</span>'
    + '<span class="absolute -translate-x-1/2 font-bold text-gray-600" style="left:' + markPct + '%">기준 100%</span>'
    + '<span class="absolute right-0">150%</span>'
    + '</div>'
    + '<p class="text-xs text-gray-400 mt-2">기준 칼로리: KDRI 2020 에너지필요추정량 (' + (PFS_ACTIVITY_LEVELS[r.profile.activity] || {}).name + ')'
    + (r.body.bmi ? ' · BMI ' + r.body.bmi.toFixed(1) + ' (' + r.body.bmiLabel + ')' : '') + '</p>'
    + '</div>')

    // 지표 타일 — 설문이면 PDI·파이토 다양성·단백질 3개만
    + '<div class="grid grid-cols-2 ' + (isSurvey ? 'lg:grid-cols-3' : 'lg:grid-cols-5') + ' gap-3">'
    + tile('📊 PDI' + (r.basis === 'survey' ? ' (예측)' : ''),
        '<span class="text-2xl font-black" style="color:' + r.gradeColor + '">' + r.pdiScore.toFixed(1) + '%</span>',
        '목표 40% 이상', miniBar(r.pdiScore, 40, r.gradeColor))
    + tile('🌈 파이토케미컬 다양성',
        '<span class="text-2xl font-black text-purple-700">' + ps.coveredCount + '</span><span class="text-sm text-gray-400">/ ' + PHYTO_SCORED_KEYS.length + ' 계열</span>',
        isSurvey ? '섭취한 계열 수 (구성 기반)' : '파이토 점수 ' + ps.total + '/100',
        miniBar(ps.coveredCount, PHYTO_SCORED_KEYS.length, '#8B5CF6'))
    + tile('💪 단백질' + (isSurvey ? ' (예측)' : ''),
        '<span class="text-2xl font-black text-orange-600">' + Math.round(n.protein) + '</span><span class="text-sm text-gray-400">g</span>',
        '권장 ' + Math.round(protLo) + '–' + Math.round(protHi) + 'g', miniBar(n.protein, protLo, '#EA580C'))
    + (isSurvey ? '' : tile('🌾 식이섬유',
        '<span class="text-2xl font-black text-emerald-700">' + n.fiber.toFixed(1) + '</span><span class="text-sm text-gray-400">g</span>',
        '목표 ' + Math.round(fibT) + 'g 이상', miniBar(n.fiber, fibT, '#10B981')))
    + (isSurvey ? '' : '<div class="col-span-2 lg:col-span-1">' + tile('🥗 PFS 식단 점수',
        '<span class="text-2xl font-black" style="color:' + t.color + '">' + pfs.daily.total.toFixed(2) + '</span>'
        + '<span class="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style="background:' + t.color + '">' + t.name + '</span>',
        'Basic ' + pfs.daily.basic.toFixed(2) + ' (가점 ' + (pfs.daily.sub.carb + pfs.daily.sub.protein + pfs.daily.sub.fat + pfs.daily.sub.fiber).toFixed(1)
        + ' − 감점 ' + Math.abs(pfs.daily.sub.chol + pfs.daily.sub.sugar + pfs.daily.sub.satfat + pfs.daily.sub.trans + pfs.daily.sub.sodium).toFixed(1) + ')') + '</div>')
    + '</div>'
    + '<p class="text-xs text-gray-400 mt-3">'
    + (isSurvey
        ? '설문 응답을 대표 음식으로 환산한 예측치입니다. 단백질은 고기·생선·달걀·콩 문항에서 추정했습니다.'
        : '단백질·식이섬유는 식재료 칼로리·식품군 기반 추정치입니다.')
    + '</p>';
}

// ── 주의사항 & 관리 가이드 ─────────────────────
function renderGuide(r) {
  const el = document.getElementById('guide-section');
  if (!el) return;
  const warn = [];
  const ratio = r.pfs.eer > 0 ? r.totalCalories / r.pfs.eer : 0;
  const ps = r.phytoScore;

  if (r.allergyHits.length) {
    warn.push(['🚫', '알레르기 주의', r.allergyHits.map(h => h.name + '(' + h.allergens.join('·') + ')').join(', ')]);
  }
  // 칼로리·나트륨처럼 섭취량 기반 경고는 식사 기록이 있을 때만 (설문으로는 양을 알 수 없음)
  if (r.basis === 'log' && ratio > 1.1) warn.push(['🔥', '칼로리 초과', '기준보다 ' + Math.round(r.totalCalories - r.pfs.eer) + 'kcal 많아요. 간식·가공식품부터 줄여보세요.']);
  if (ps.coveredCount < 6) warn.push(['🌈', '파이토케미컬 다양성 부족', ps.coveredCount + '/' + PHYTO_SCORED_KEYS.length + '개 계열만 섭취 — 색깔이 다른 채소·과일·콩을 곁들이세요.']);
  if (r.intake.wholeGrainPct < 5) warn.push(['🌾', '통곡물 섭취 부족', '흰쌀밥을 잡곡·현미밥으로 바꾸면 식이섬유와 PDI가 함께 올라갑니다.']);
  if (r.intake.vegG < 200) warn.push(['🥬', '채소 섭취 부족', r.basis === 'log'
    ? '약 ' + Math.round(r.intake.vegG) + 'g — 끼니마다 채소 반찬 1–2접시(하루 350g 이상)를 권장합니다.'
    : '끼니마다 채소 반찬 1–2접시(하루 350g 이상)를 권장합니다.']);
  if (r.intake.fruitG < 100) warn.push(['🍎', '과일 섭취 부족', '하루 1–2회(주먹 1개 크기) 과일을 드세요.']);
  if (!r.categoryMap.legumes) warn.push(['🫘', '두류 미섭취', '두부·된장·콩밥 등 콩 식품은 핵심 PRF 식품군입니다.']);
  if (r.categoryMap.refined && r.categoryMap.refined.percentage > 40) {
    warn.push(['🍞', '정제 식품 비율 높음', '정제 곡물·당류 비율 ' + r.categoryMap.refined.percentage.toFixed(0) + '% — 가공식품을 줄여보세요.']);
  }
  if (r.body.abdominal) warn.push(['📏', '복부비만', '허리둘레가 기준(남 90cm·여 85cm) 이상입니다. 체중 관리 루틴을 꾸준히 실천하세요.']);

  // ── 체중 유형 + 권장 영양 섭취량 ──
  const t = r.targets;
  const bt = t.bodyType;
  const rg = t.ranges;
  const dirLabel = t.targetKcal < t.eer ? '감량' : (t.targetKcal > t.eer ? '증량' : '유지');
  const nutRow = (name, value, note) =>
    '<div class="flex items-baseline justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">'
    + '<span class="text-xs text-gray-500">' + name + '</span>'
    + '<span class="text-sm font-bold text-gray-800">' + value + '</span>'
    + '<span class="text-xs text-gray-400 w-20 text-right flex-shrink-0">' + note + '</span></div>';

  const targetHtml =
    '<div class="grid md:grid-cols-3 gap-3 mb-3">'
    + '<div class="bg-emerald-50 rounded-2xl p-4"><div class="text-xs font-bold text-emerald-700 mb-1">체중 유형</div>'
    + '<div class="text-2xl font-black text-emerald-900">' + bt.name + '</div>'
    + '<div class="text-xs text-emerald-700 mt-1">BMI ' + t.bmi.toFixed(1) + ' · ' + bt.desc + '</div>'
    + '<div class="text-xs text-emerald-700">표준 체중 ' + t.targetWeight + ' kg (BMI 22)</div></div>'
    + '<div class="bg-emerald-50 rounded-2xl p-4"><div class="text-xs font-bold text-emerald-700 mb-1">목표 칼로리</div>'
    + '<div class="text-2xl font-black text-emerald-900">' + t.targetKcal.toLocaleString() + '<span class="text-sm font-medium"> kcal/일</span></div>'
    + '<div class="text-xs text-emerald-700 mt-1">기준(EER) ' + t.eer.toLocaleString() + ' kcal ' + (t.targetKcal - t.eer >= 0 ? '+' : '') + (t.targetKcal - t.eer) + '</div>'
    + '<div class="text-xs text-emerald-700">예상 ' + dirLabel + ' ' + Math.abs(t.weeklyDelta) + ' kg/주</div></div>'
    + '<div class="bg-gray-50 rounded-2xl p-4"><div class="text-xs font-bold text-gray-600 mb-1">권장 영양 섭취량</div>'
    + nutRow('탄수화물', Math.round(rg.carb[0]) + '–' + Math.round(rg.carb[1]) + ' g', '55–65%E')
    + nutRow('단백질',   Math.round(rg.protein[0]) + '–' + Math.round(rg.protein[1]) + ' g', '7–20%E')
    + nutRow('지방',     Math.round(rg.fat[0]) + '–' + Math.round(rg.fat[1]) + ' g', '15–30%E')
    + '</div></div>'
    + '<div class="grid sm:grid-cols-4 gap-2 mb-4">'
    + [['식이섬유', Math.round(rg.fiber) + ' g 이상'], ['당류', Math.round(rg.sugar) + ' g 미만'],
       ['포화지방', Math.round(rg.satfat) + ' g 미만'], ['나트륨', rg.sodium.toLocaleString() + ' mg 미만']]
       .map(([n, v]) => '<div class="bg-gray-50 rounded-xl px-3 py-2"><div class="text-xs text-gray-500">' + n + '</div>'
         + '<div class="text-sm font-bold text-gray-800">' + v + '</div></div>').join('')
    + '</div>';

  const goalTips = HEALTH_GOALS.filter(g => selectedGoals.has(g.id)).map(g =>
    '<li class="flex gap-2 text-sm"><span>' + g.icon + '</span><span><b class="text-gray-800">' + g.name + '</b> <span class="text-gray-600">' + g.tip + '</span></span></li>'
  ).join('');

  el.innerHTML =
    '<h3 class="text-xl font-bold text-gray-900 mb-4">⚠️ 주의사항 & 관리 가이드</h3>'
    + (warn.length
        ? '<div class="grid md:grid-cols-2 gap-3 mb-6">' + warn.map(([icon, title, body]) =>
            '<div class="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3.5">'
            + '<span class="text-xl leading-none">' + icon + '</span>'
            + '<div><div class="text-sm font-bold text-amber-900">' + title + '</div><div class="text-xs text-amber-800 mt-0.5">' + body + '</div></div></div>'
          ).join('') + '</div>'
        : '<div class="bg-emerald-50 rounded-xl p-4 text-sm text-emerald-800 mb-6">🎉 큰 문제 없이 균형 잡힌 식단입니다.</div>')
    + '<div class="text-sm font-bold text-gray-800 mb-2">⚖️ 체중 유형 · 권장 영양 섭취량</div>'
    + targetHtml
    + '<div class="text-sm font-bold text-gray-800 mb-2">🎯 목표별 관리 팁</div>'
    + '<ul class="space-y-1.5">' + goalTips + '</ul>';
}

// ── PFS 식단 점수 렌더링 ──────────────────────
const PFS_NUTRIENT_ROWS = [
  { key: 'carb',    name: '탄수화물',   unit: 'g',  kind: 'band' },
  { key: 'protein', name: '단백질',     unit: 'g',  kind: 'band' },
  { key: 'fat',     name: '지방',       unit: 'g',  kind: 'band' },
  { key: 'fiber',   name: '식이섬유',   unit: 'g',  kind: 'min' },
  { key: 'chol',    name: '콜레스테롤', unit: 'mg', kind: 'max' },
  { key: 'sugar',   name: '당류',       unit: 'g',  kind: 'max' },
  { key: 'satfat',  name: '포화지방',   unit: 'g',  kind: 'max' },
  { key: 'trans',   name: '트랜스지방', unit: 'g',  kind: 'max' },
  { key: 'sodium',  name: '나트륨',     unit: 'mg', kind: 'max' },
];

function fmtNum(v, digits) {
  return Number(v).toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function renderPFSScore(pfs) {
  const el = document.getElementById('pfs-score-section');
  if (!el) return;

  if (!pfs) {
    el.innerHTML =
      '<h3 class="text-xl font-bold text-gray-900 mb-2">🥗 PFS 식단 영양 점수</h3>'
      + '<div class="bg-sky-50 rounded-2xl p-6 text-center">'
      + '<p class="text-sky-800 text-sm mb-3">나이·신장·체중을 입력하면 에너지필요추정량(EER) 기반 식단 영양 점수를 계산합니다.</p>'
      + '<button onclick="goToStep(1)" class="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">'
      + '<i class="fas fa-user-edit mr-1.5"></i>프로필 입력하기</button>'
      + '</div>';
    return;
  }

  const d = pfs.daily;
  const n = d.nutrients;
  const t = PFS_TREND_LABELS[pfs.trend];
  const pctEER = Math.round((n.energy / pfs.eer) * 100);

  // 부분점수 막대: 가운데 0 기준, 양수(초록) 오른쪽 / 음수(빨강) 왼쪽, |1| 에서 포화
  function subBar(v) {
    const w = Math.min(Math.abs(v), 1) * 50;
    const pos = v >= 0;
    return '<div class="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">'
      + '<div class="absolute top-0 bottom-0 w-px bg-gray-300" style="left:50%"></div>'
      + '<div class="absolute top-0 bottom-0 ' + (pos ? 'bg-emerald-500' : 'bg-red-400') + '" style="'
      + (pos ? 'left:50%' : 'right:50%') + ';width:' + w + '%"></div>'
      + '</div>';
  }

  function target(row) {
    const r = pfs.ranges[row.key];
    const u = row.unit;
    if (row.kind === 'band') return fmtNum(r[0], 0) + '–' + fmtNum(r[1], 0) + u;
    if (row.kind === 'min')  return fmtNum(r, 0) + u + ' 이상';
    return fmtNum(r, row.key === 'trans' ? 1 : 0) + u + ' 미만';
  }

  const nutRows = PFS_NUTRIENT_ROWS.map(row => {
    const v = d.sub[row.key];
    return '<tr class="border-b border-gray-50 last:border-0">'
      + '<td class="py-2 pr-3 text-sm text-gray-800 font-medium whitespace-nowrap">' + row.name + '</td>'
      + '<td class="py-2 pr-3 text-sm text-gray-900 text-right whitespace-nowrap">' + fmtNum(n[row.key], row.key === 'trans' ? 2 : 1) + row.unit + '</td>'
      + '<td class="py-2 pr-3 text-xs text-gray-400 whitespace-nowrap">' + target(row) + '</td>'
      + '<td class="py-2 pr-3 w-full min-w-[80px]">' + subBar(v) + '</td>'
      + '<td class="py-2 text-sm font-bold text-right whitespace-nowrap ' + (v >= 0 ? 'text-emerald-700' : 'text-red-500') + '">'
      + (v >= 0 ? '+' : '') + v.toFixed(2) + '</td>'
      + '</tr>';
  }).join('');

  const mealLabels = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };
  const dishRows = pfs.dishes.map(dish => {
    const role = PFS_MEAL_ROLES[dish.role];
    return '<tr class="border-b border-gray-50 last:border-0">'
      + '<td class="py-2 pr-3 text-sm text-gray-900 font-medium whitespace-nowrap">' + dish.name
      + '<span class="ml-1.5 text-xs text-gray-400 font-normal">' + (mealLabels[dish.meal] || dish.meal) + '</span></td>'
      + '<td class="py-2 pr-3 text-xs whitespace-nowrap"><span class="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">'
      + role.name + ' ×' + role.per + '</span></td>'
      + '<td class="py-2 pr-3 text-sm text-gray-600 text-right whitespace-nowrap">' + Math.round(dish.nutrients.energy) + 'kcal</td>'
      + '<td class="py-2 pr-3 text-sm text-right whitespace-nowrap ' + (dish.basic >= 0 ? 'text-emerald-700' : 'text-red-500') + '">' + dish.basic.toFixed(2) + '</td>'
      + '<td class="py-2 pr-3 text-sm text-gray-600 text-right whitespace-nowrap">' + dish.ed.toFixed(0) + '</td>'
      + '<td class="py-2 pr-3 text-sm text-gray-600 text-right whitespace-nowrap">' + dish.si.toFixed(1) + '</td>'
      + '<td class="py-2 text-sm font-bold text-right whitespace-nowrap" style="color:' + t.color + '">' + dish.total.toFixed(2) + '</td>'
      + '</tr>';
  }).join('');

  function stat(label, value, sub, cls) {
    return '<div class="rounded-2xl p-4 ' + cls + '">'
      + '<div class="text-xs text-gray-500 mb-1">' + label + '</div>'
      + '<div class="text-2xl font-black text-gray-900">' + value + '</div>'
      + '<div class="text-xs text-gray-400 mt-0.5">' + sub + '</div>'
      + '</div>';
  }

  el.innerHTML =
    '<div class="flex flex-wrap items-start justify-between gap-4 mb-6">'
    + '<div>'
    + '<h3 class="text-xl font-bold text-gray-900">🥗 PFS 식단 영양 점수</h3>'
    + '<p class="text-gray-500 text-sm mt-1">에너지필요추정량(EER) 기준 9개 영양소 적정성 + 에너지 밀도·포만 지수 · PDI·파이토 점수와 별도 산출</p>'
    + '</div>'
    + '<div class="flex items-center gap-3">'
    + '<div class="text-center">'
    + '<div class="text-5xl font-black" style="color:' + t.color + '">' + d.total.toFixed(2) + '</div>'
    + '<div class="text-xs text-gray-400">total_score</div>'
    + '</div>'
    + '<div class="text-left">'
    + '<div class="inline-flex items-center px-3 py-1.5 rounded-full text-white text-sm font-bold" style="background:' + t.color + '">' + t.name + '</div>'
    + '<div class="text-xs text-gray-400 mt-1">= ' + t.formula + '</div>'
    + '</div>'
    + '</div>'
    + '</div>'

    // 요약 통계
    + '<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">'
    + stat('Basic 점수', d.basic.toFixed(2), '가점 4종 합(최대 4.0) − 감점 5종 합', 'bg-emerald-50')
    + stat('ED 점수', d.ed.toFixed(0), '에너지 밀도 kcal/100g', 'bg-amber-50')
    + stat('SI 점수', d.si.toFixed(1), '포만 지수', 'bg-indigo-50')
    + stat('에너지필요추정량', fmtNum(pfs.eer, 0) + '<span class="text-sm font-medium text-gray-500">kcal</span>', 'KDRI 2020 공식', 'bg-gray-50')
    + stat('섭취 에너지', Math.round(n.energy) + '<span class="text-sm font-medium text-gray-500">kcal</span>', 'EER 대비 ' + pctEER + '%', 'bg-gray-50')
    + '</div>'

    // 영양소별 부분점수
    + '<div class="grid lg:grid-cols-2 gap-6">'
    + '<div class="bg-gray-50 rounded-2xl p-5 min-w-0">'
    + '<div class="text-sm font-bold text-gray-700 mb-3">영양소별 부분점수 <span class="font-normal text-gray-400 text-xs ml-1">1일 기준 · 적정 범위 +1, 초과·부족 시 감점</span></div>'
    + '<div class="overflow-x-auto"><table class="w-full"><tbody>' + nutRows + '</tbody></table></div>'
    + '</div>'

    // 음식별 점수
    + '<div class="bg-gray-50 rounded-2xl p-5 min-w-0">'
    + '<div class="text-sm font-bold text-gray-700 mb-3">음식별 PFS 점수 <span class="font-normal text-gray-400 text-xs ml-1">기준치 × 분류 비율(본식 0.3·반찬 0.2·간식 0.1)</span></div>'
    + '<div class="overflow-x-auto"><table class="w-full">'
    + '<thead><tr class="text-xs text-gray-400 border-b border-gray-200">'
    + '<th class="py-1.5 pr-3 text-left font-medium">음식</th><th class="py-1.5 pr-3 text-left font-medium">분류</th>'
    + '<th class="py-1.5 pr-3 text-right font-medium">에너지</th><th class="py-1.5 pr-3 text-right font-medium">Basic</th>'
    + '<th class="py-1.5 pr-3 text-right font-medium">ED</th><th class="py-1.5 pr-3 text-right font-medium">SI</th>'
    + '<th class="py-1.5 text-right font-medium">총점</th></tr></thead>'
    + '<tbody>' + dishRows + '</tbody></table></div>'
    + '</div>'
    + '</div>'

    + '<p class="text-xs text-amber-600 mt-4"><i class="fas fa-info-circle mr-1"></i>'
    + '영양성분은 식재료별 칼로리와 식재료명·식품군 기반 추정치이며, 중량은 조리 전 식재료 기준입니다. '
    + '체중 추세: 이전 체중보다 감소 → 감량기, 증가 → 증가기, 동일·미입력 → 유지기.</p>';
}

// ── 관리 목표 렌더링 ─────────────────────────
function renderHealthGoals() {
  const grid = document.getElementById('health-goals-grid');
  if (!grid) return;
  grid.innerHTML = HEALTH_GOALS.map(goal => {
    const sel = selectedGoals.has(goal.id);
    const cls = goal.base
      ? 'border-emerald-600 bg-emerald-600 text-white cursor-default'
      : (sel ? 'border-emerald-500 bg-emerald-50 cursor-pointer' : 'border-gray-100 bg-white hover:border-gray-300 cursor-pointer');
    return '<button type="button"' + (goal.base ? ' disabled' : ' onclick="toggleGoal(\'' + goal.id + '\')"') + ' aria-pressed="' + sel + '"'
      + ' class="border-2 rounded-2xl p-4 text-center transition-all ' + cls + '">'
      + '<div class="text-3xl mb-2">' + goal.icon + '</div>'
      + '<div class="text-sm font-bold ' + (goal.base ? '' : 'text-gray-800') + '">' + goal.name + '</div>'
      + (goal.base
          ? '<div class="mt-1 text-xs opacity-90">기본 관리</div>'
          : (sel ? '<div class="mt-1"><i class="fas fa-check-circle text-emerald-500 text-sm"></i></div>' : '<div class="mt-1 text-xs text-gray-400">+ 추가</div>'))
      + '</button>';
  }).join('');
}

function toggleGoal(id) {
  const goal = HEALTH_GOALS.find(g => g.id === id);
  if (!goal || goal.base) return;
  if (selectedGoals.has(id)) selectedGoals.delete(id);
  else selectedGoals.add(id);
  renderHealthGoals();
}

// ── 제품 목록 ────────────────────────────────
// 가격·영양성분이 있는 카탈로그(products.js)를 그대로 보여줍니다
const KIND_COLOR = { soymilk: '#8B5CF6', phyto: '#059669', bar: '#EA580C', addon: '#0D9488' };
function renderProductGrid() {
  const el = document.getElementById('product-grid');
  if (!el) return;
  el.innerHTML = BOBSNU_CATALOG.map(p => {
    const color = KIND_COLOR[p.kind] || '#6B7280';
    const n = p.nut;
    return '<div class="rounded-3xl border-2 p-6 bg-white hover:shadow-lg transition-shadow flex flex-col" style="border-color:' + color + '20">'
      + '<div class="flex items-start justify-between mb-3">'
      + '<span class="text-4xl">' + p.icon + '</span>'
      + '<span class="text-xs font-bold px-2 py-1 rounded-full text-white" style="background:' + color + '">' + p.code + ' · ' + CATALOG_KIND_LABEL[p.kind] + '</span>'
      + '</div>'
      + '<h3 class="text-lg font-bold text-gray-900 mb-1">' + p.name + '</h3>'
      + '<p class="text-sm text-gray-600 mb-3">' + p.note + '</p>'
      + '<div class="flex flex-wrap gap-1 mb-3">'
      + p.funcs.map(t => '<span class="text-xs px-2 py-1 rounded-full font-medium" style="background:' + color + '15;color:' + color + '">' + t + '</span>').join('')
      + '</div>'
      + '<div class="text-xs text-gray-500 space-y-0.5 mb-3">'
      + '<div>' + n.energy + ' kcal · 단백질 ' + n.protein + 'g · 식이섬유 ' + n.fiber + 'g'
      + (n.calcium ? ' · 칼슘 ' + n.calcium + 'mg' : '') + '</div>'
      + '<div class="text-gray-400">1회 제공량 ' + n.weight + (p.kind === 'soymilk' || p.code === '1' ? ' mL' : ' g') + ' 기준 · 제품소개서 표시값</div>'
      + '</div>'
      + '<div class="mt-auto pt-3 border-t border-gray-100">'
      + '<div class="flex items-baseline justify-between mb-2">'
      + '<span class="text-xs text-gray-500">' + p.pack + '</span>'
      + '<span class="text-lg font-black text-gray-900">' + won(p.price) + '</span></div>'
      + '<button onclick="scrollToAssessment()" class="w-full py-2.5 rounded-xl text-white text-sm font-medium transition" style="background:' + color + '">PDI 평가로 맞춤 구독 받기</button>'
      + '</div></div>';
  }).join('');
}

// 「다른 음식」 입력용 datalist — 레시피 + 단품 식재료
// ponytail: 14,715개를 한 번에 넣으면 무거워 상위 2,000개만. 부족하면 입력형 자동완성(initAutocomplete)으로 승격
function initPlanFoodList() {
  const dl = document.getElementById('plan-food-list');
  if (!dl) return;
  const names = RECIPE_NAMES.slice(0, 1600).concat(INGREDIENT_NAMES.slice(0, 400));
  dl.innerHTML = names.map(n => '<option value="' + n.replace(/"/g, '&quot;') + '">').join('');
}

// ── 재시작 ───────────────────────────────────
function restartAssessment() {
  addedMeals = [];
  subCart = null;
  resultTab = 'analysis';
  for (const k of Object.keys(surveyAnswers)) delete surveyAnswers[k];
  selectedGoals.clear();
  for (const g of HEALTH_GOALS) if (g.base) selectedGoals.add(g.id);
  pdiResult = null;
  renderMealList();
  renderSurvey();
  setInputMode('survey');
  renderHealthGoals();
  goToStep(1);
  document.getElementById('meal-input').value = '';
}
