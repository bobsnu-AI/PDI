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

// ══════════════════════════════════════════════
// 식습관 설문  (식품군 1문항 = 식단 점수 1성분)
// ──────────────────────────────────────────────
// 문항 하나가 식단 점수의 식품군 하나에 맞춰져 있어, 응답의 1일 회분을
// 점수에 그대로 넣습니다 (대표 음식으로 환산하지 않습니다).
//   comp    : patterns.js 의 성분 키. null 이면 점수에 직접 넣지 않는 문항
//   serve   : 선택지의 두 번째 값 — 1일 회분. 곡류는 1회분 = 밥 한 공기(생곡 90g)
//   foods   : 칼로리·제품 추천·30일 식단에 쓰는 대표 음식 (점수에는 쓰지 않음)
//   slot    : 대표 음식을 놓을 끼니 — 'meal'(아침·점심·저녁) | 'snack'
// 빈도 선택지 형식은 서울대학교병원 식생활문진표를 따릅니다.
// 문항 수는 점수가 요구하는 식품군 수로 정해집니다. 점수 5종이 문항을 서로 나눠
// 쓰도록 맞춰서 17문항입니다 — 한 문항을 빼면 적어도 한 점수에 「뺀 항목」이 생깁니다.
// 술 문항은 AHEI·AMED 의 음주 성분에 필요합니다. 논문 기준이 적정 음주를 만점으로
// 보기 때문에, 계산에는 넣고 개선 제안에서는 뺍니다.
const SURVEY_QUESTIONS = [
  // ── 곡류 ──
  { id: 'refinedGrain', comp: 'refinedGrain', slot: 'meal', foods: ['쌀밥', '식빵'],
    q: '흰쌀밥·흰빵·국수·감자를 하루에 얼마나 드시나요?',
    options: [['하루 3끼', 3], ['하루 2끼', 2], ['하루 1끼', 1], ['거의 안 먹음', 0.2]] },
  { id: 'wholeGrain', comp: 'wholeGrain', slot: 'meal', foods: ['잡곡밥'],
    q: '잡곡밥·현미밥·통밀빵·귀리를 하루에 얼마나 드시나요?',
    options: [['하루 2끼 이상', 2], ['하루 1끼', 1], ['주 3~6회', 0.6], ['거의 안 먹음', 0]] },

  // ── 채소·과일 ──
  { id: 'veg', comp: 'veg', slot: 'meal', foods: ['시금치나물', '콩나물무침', '무생채'],
    q: '김치를 뺀 채소 반찬을 하루에 몇 접시 드시나요? (나물·샐러드·생채소)',
    options: [['5접시 이상', 5], ['3~4접시', 3.5], ['1~2접시', 1.5], ['거의 안 먹음', 0.3]] },
  { id: 'fruit', comp: 'fruit', slot: 'snack', foods: ['사과', '귤'],
    q: '과일을 얼마나 드시나요? (1회 = 사과 1개 정도)',
    options: [['하루 3회 이상', 3], ['하루 1~2회', 1.5], ['주 3~6회', 0.6], ['거의 안 먹음', 0.1]] },

  // ── 고기·생선·달걀·콩 ──
  { id: 'redMeat', comp: 'redMeat', slot: 'meal', foods: ['제육볶음', '삼겹살구이'],
    q: '소고기·돼지고기를 얼마나 드시나요?',
    options: [['하루 2회 이상', 2], ['하루 1회', 1], ['주 3~6회', 0.6], ['주 2회 이하', 0.2]] },
  { id: 'processedMeat', comp: 'processedMeat', slot: 'meal', foods: ['소시지야채볶음', '라면'],
    q: '햄·소시지·베이컨·어묵·라면을 얼마나 드시나요?',
    options: [['하루 1회 이상', 1], ['주 3~6회', 0.6], ['주 1~2회', 0.2], ['거의 안 먹음', 0]] },
  { id: 'fish', comp: 'fish', slot: 'meal', foods: ['고등어구이'],
    q: '생선·해산물을 얼마나 드시나요?',
    options: [['거의 매일', 1], ['주 3~6회', 0.6], ['주 1~2회', 0.2], ['거의 안 먹음', 0]] },
  { id: 'egg', comp: 'egg', slot: 'meal', foods: ['계란말이'],
    q: '달걀을 얼마나 드시나요?',
    options: [['하루 2개 이상', 2], ['하루 1개', 1], ['주 3~6회', 0.6], ['거의 안 먹음', 0]] },
  { id: 'legumes', comp: 'legumes', slot: 'meal', foods: ['두부조림'],
    q: '두부·콩·콩자반을 얼마나 드시나요?',
    options: [['하루 2회 이상', 2], ['하루 1회', 1], ['주 3~6회', 0.6], ['거의 안 먹음', 0]] },
  { id: 'nuts', comp: 'nuts', slot: 'snack', foods: ['견과 한 줌'],
    q: '견과류를 얼마나 드시나요? (1회 = 한 줌, 약 28g)',
    options: [['매일 한 줌 이상', 1], ['주 3~6회', 0.6], ['주 1~2회', 0.2], ['거의 안 먹음', 0]] },

  // ── 유제품 ──
  { id: 'dairy', comp: 'dairy', slot: 'snack', foods: ['우유 한 컵'],
    q: '우유·요구르트·치즈를 얼마나 드시나요? (한 컵 200 mL)',
    options: [['하루 2회 이상', 2], ['하루 1회', 1], ['주 3~6회', 0.6], ['거의 안 먹음', 0]] },
  { id: 'dairyLow', comp: 'dairyLowRatio', slot: null, foods: null,
    q: '유제품은 주로 어떤 것을 고르시나요?',
    options: [['대부분 저지방·무지방', 1], ['절반쯤 저지방', 0.5], ['대부분 일반 제품', 0]] },

  // ── 간식·음료 ──
  { id: 'sweets', comp: 'sweets', slot: 'snack', foods: ['단 음식'],
    q: '과자·케이크·아이스크림을 얼마나 드시나요?',
    options: [['하루 1회 이상', 1], ['주 3~6회', 0.6], ['주 1~2회', 0.2], ['거의 안 먹음', 0]] },
  { id: 'coffeeTea', comp: 'coffeeTea', slot: 'snack', foods: ['커피 한 잔'],
    q: '커피·차를 하루에 몇 잔 드시나요? (설탕·시럽 없이)',
    options: [['3잔 이상', 3], ['1~2잔', 1.5], ['주 3~6잔', 0.6], ['거의 안 마심', 0]] },
  { id: 'ssb', comp: 'ssb', slot: 'snack', foods: ['단 음료'],
    q: '탄산음료·가당음료·주스를 하루에 몇 잔 드시나요? (한 잔 200 mL)',
    options: [['2잔 이상', 2], ['1잔 정도', 1], ['주 3~6잔', 0.6], ['거의 안 마심', 0.1]] },

  // ── 술 (AHEI·AMED 는 총 잔 수로 봅니다) ──
  { id: 'alcohol', comp: 'alcohol', slot: 'snack', foods: ['소주 한 잔'],
    q: '술을 하루 평균 몇 잔 드시나요? (한 잔 = 소주 1잔·맥주 200 mL·와인 1잔)',
    options: [['2잔 이상', 2], ['1잔 정도', 1], ['주 2~4잔', 0.45], ['안 마심', 0]] },

  // ── 짠맛 ──
  { id: 'salty', comp: null, slot: 'meal', foods: ['된장국'],
    q: '국물·젓갈·장아찌처럼 짜게 드시는 편인가요?',
    options: [['그렇지 않다', 0], ['보통이다', 1], ['그렇다', 2]] },
];

// 레시피 DB에 없는 대표 음식은 식재료 조합으로 정의 (칼로리·나트륨·식이섬유 계산용)
const SURVEY_CUSTOM_FOODS = {
  '단 음식':          { '백설탕': 20, '식빵': 40 },
  '단 음료':          { '백설탕': 22 },
  '견과 한 줌':       { '아몬드': 14, '호두': 14 },
  '우유 한 컵':       { '우유': 200 },
  '커피 한 잔':       { '녹차잎': 2 },
  '소주 한 잔':        { '소주': 50 },
};

// 응답 → 성분별 1일 회분 { veg: 3.5, fruit: 1.5, ... }
//   patterns.js 가 이 값을 그대로 점수에 씁니다.
function surveyServings(ans) {
  const serve = {};
  for (const q of SURVEY_QUESTIONS) {
    const opt = q.options[ans[q.id]];
    serve[q.id] = opt ? opt[1] : 0;
  }
  const out = {};
  for (const q of SURVEY_QUESTIONS) if (q.comp) out[q.comp] = serve[q.id];
  // 통곡물·정제곡물은 점수가 그램으로 기준을 정합니다 (밥 한 공기 = 생곡 90g)
  out.wholeGrain = serve.wholeGrain * 90;
  // 유제품은 저지방 비율로 나눕니다 (혈압 관리 점수가 저지방만 인정)
  const lowRatio = out.dairyLowRatio || 0;
  out.dairyLow  = serve.dairy * lowRatio;
  out.dairyHigh = serve.dairy * (1 - lowRatio);
  delete out.dairy;
  delete out.dairyLowRatio;
  return out;
}


// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let currentStep = 1;
// 설문 응답: { questionId: value }
const surveyAnswers = {};
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
  set('profile-waist', p.waist ? Math.round(p.waist / 2.54) : ''); set('profile-activity', p.activity);
  selectedAllergies.clear();
  for (const a of (p.allergies || [])) selectedAllergies.add(a);
  selectedGoals.clear();
  for (const g of HEALTH_GOALS) if (g.base) selectedGoals.add(g.id);
  for (const g of (tracker.goals || [])) selectedGoals.add(g);
}

document.addEventListener('DOMContentLoaded', () => {
  trackerLoad();
  // 선택지를 먼저 만들어야 저장된 값이 복원된다
  renderActivityOptions();
  renderWaistOptions();
  restoreProfileForm();
  renderAllergyChips();
  setGender(gender);
  renderSurvey();
  renderHealthGoals();
  renderProductGrid();
  initPlanFoodList();

  // 저장된 설문 응답을 복원해 결과를 미리 계산한다 (두 번째 방문)
  if (tracker.survey) {
    for (const [k, v] of Object.entries(tracker.survey)) surveyAnswers[k] = v;
    renderSurvey();
  }
  if (tracker.profile && isSurveyComplete()) calculateAndShow(true);

  // 뒤로가기·앞으로가기
  window.addEventListener('hashchange', () => {
    const id = (location.hash || '').slice(1) || 'home';
    if (resolvePage(id) !== currentPage) showPage(id);
  });
  // 첫 진입 — 기록이 있으면 결과 페이지부터, 처음이면 서비스 소개부터
  showPage((location.hash || '').slice(1) || (pdiResult ? 'result' : 'home'));

  // 서비스 흐름 패널 자동 넘김 (직접 넘기면 멈춘다)
  setInterval(() => {
    if (flowAuto && currentPage === 'home') setFlow(flowIndex + 1, true);
  }, 4500);
});

// ── 서비스 흐름 패널 — 네 단계를 돌아가며 보여준다 ──
const FLOW_STEPS = 4;
let flowIndex = 0;
let flowAuto = true;          // 직접 넘기면 자동 넘김을 멈춘다

function setFlow(i, auto) {
  if (!auto) flowAuto = false;
  flowIndex = (i + FLOW_STEPS) % FLOW_STEPS;
  for (let n = 0; n < FLOW_STEPS; n++) {
    const panel = document.getElementById('flow-' + n);
    if (panel) panel.classList.toggle('hidden', n !== flowIndex);
    const dot = document.getElementById('flowdot-' + n);
    if (dot) dot.classList.toggle('active', n === flowIndex);
  }
}

function shiftFlow(n) { setFlow(flowIndex + n); }

// ══════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════
function setGender(g) {
  gender = g;
  document.getElementById('gender-male').classList.toggle('border-emerald-500', g === 'male');
  document.getElementById('gender-male').classList.toggle('bg-emerald-50', g === 'male');
  document.getElementById('gender-male').classList.toggle('border-gray-200', g !== 'male');
  document.getElementById('gender-female').classList.toggle('border-emerald-500', g === 'female');
  document.getElementById('gender-female').classList.toggle('bg-emerald-50', g === 'female');
  document.getElementById('gender-female').classList.toggle('border-gray-200', g !== 'female');
}

// ══════════════════════════════════════════════
// PROFILE  (성별·나이·키·체중·허리둘레·활동량·알레르기 → 기준 칼로리)
// 허리둘레는 평소 입는 바지 사이즈(인치)로 받아 cm 로 환산한다 — 줄자가 없어도 답할 수 있게
//   1 인치 = 2.54 cm. 복부비만 기준(남 90 cm·여 85 cm)은 약 35.4 인치·33.5 인치에 해당
function waistCmFromInch(inch) {
  // 안 고른 경우는 반드시 null — undefined 면 validateProfile 의 범위 검사에 걸립니다
  return inch > 0 ? Math.round(inch * 2.54 * 10) / 10 : null;
}
// ══════════════════════════════════════════════
function renderWaistOptions() {
  const sel = document.getElementById('profile-waist');
  if (!sel) return;
  // 국내 바지 사이즈 범위. 복부비만 기준은 남 35인치·여 34인치 부근
  let html = '<option value="">모르겠어요</option>';
  for (let inch = 24; inch <= 44; inch++) html += '<option value="' + inch + '">' + inch + '인치</option>';
  sel.innerHTML = html;
}

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
    waist:      waistCmFromInch(num('profile-waist')),
    activity:   document.getElementById('profile-activity').value,
    allergies:  new Set(selectedAllergies),
  };
}

// 나이·키·체중은 기준 칼로리 산출에 필수
function validateProfile(p) {
  const fields = [
    ['age', '나이', 3, 120, true], ['height', '키', 80, 230, true], ['weight', '체중', 10, 300, true],
    ['waist', '허리둘레', 40, 200, false],
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

// ── 페이지 이동 ───────────────────────────────
//  탭 전환이 아니라 페이지를 갈아끼운다. 주소의 # 를 함께 바꿔 뒤로가기도 동작한다
const PAGES = ['home', 'intake', 'result', 'plan', 'log', 'pay'];
let currentPage = 'home';

// 진단 전에는 결과·제품·기록 페이지에 보여줄 것이 없다
function resolvePage(id) {
  if (!PAGES.includes(id)) return 'home';
  if (id !== 'home' && id !== 'intake' && !pdiResult) return 'intake';
  return id;
}

function showPage(id, anchor) {
  id = resolvePage(id);
  currentPage = id;
  for (const name of PAGES) {
    const page = document.getElementById('page-' + name);
    if (page) page.classList.toggle('hidden', name !== id);
    const btn = document.getElementById('nav-' + name);
    if (btn) btn.classList.toggle('active', name === id);
  }
  // 그래프는 보이는 상태에서만 크기가 잡힌다
  if (id === 'log') drawWeightChart();
  if (id === 'pay') renderPay();
  const target = anchor ? document.getElementById(anchor) : null;
  if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth' });
  else if (window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goPage(id, anchor) {
  id = resolvePage(id);
  // 주소를 함께 바꿔 둔다 — 새로고침·뒤로가기로 같은 페이지가 열린다
  if (typeof location !== 'undefined' && (location.hash || '').slice(1) !== id) location.hash = id;
  showPage(id, anchor);
}

// 히어로의 「진단 시작」 — 기록이 있으면 결과부터, 처음이면 정보 입력부터
function startService() {
  goPage(pdiResult ? 'result' : 'intake');
}

function goToStep(n) {
  if (currentPage !== 'intake') showPage('intake');
  const cur = document.getElementById('step-' + currentStep);
  const next = document.getElementById('step-' + n);
  if (cur) cur.classList.add('hidden');
  if (next) next.classList.remove('hidden');

  for (let i = 1; i <= 3; i++) {
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
  if (window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
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

function submitDietInput() {
  const el = document.getElementById('step2-error');
  if (!isSurveyComplete()) {
    const left = SURVEY_QUESTIONS.length - Object.keys(surveyAnswers).length;
    el.querySelector('span').textContent = '설문 ' + left + '개 문항이 남았어요.';
    el.classList.remove('hidden');
    return;
  }
  el.classList.add('hidden');
  goToStep(3);
}

// ── 설문 ──────────────────────────────────────
// 문항이 17개라 묶음 제목을 달아야 읽힌다 (제목이 붙는 문항 id → 제목)
const SURVEY_SECTIONS = {
  refinedGrain: '곡류',
  veg:          '채소·과일',
  redMeat:      '고기·생선·달걀·콩',
  dairy:        '유제품',
  sweets:       '간식·음료',
  alcohol:      '술',
  salty:        '짠맛',
};

function renderSurvey() {
  const el = document.getElementById('survey-questions');
  if (!el) return;
  el.innerHTML = SURVEY_QUESTIONS.map((q, qi) => {
    const answered = q.id in surveyAnswers;
    const head = SURVEY_SECTIONS[q.id]
      ? '<div class="text-xs font-bold tracking-wide mt-2" style="color:var(--deep)">' + SURVEY_SECTIONS[q.id] + '</div>'
      : '';
    return head + '<div class="rounded-2xl border ' + (answered ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-100 bg-gray-50') + ' p-4">'
      + '<div class="text-sm font-bold text-gray-800 mb-2.5"><span class="text-emerald-700 mr-1">Q' + (qi + 1) + '.</span>' + q.q + '</div>'
      + '<div class="flex flex-wrap gap-2">'
      + q.options.map(([label], oi) => {
          const on = answered && surveyAnswers[q.id] === oi;
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
  surveyAnswers[qid] = optIdx;
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
//   점수에는 쓰지 않습니다. 칼로리·나트륨·식이섬유 추정과 제품 추천·30일 식단에 씁니다.
function buildSurveyDiet(ans) {
  const diet = [];
  const serveOf = q => {
    const o = q.options[ans[q.id]];
    return o ? o[1] : 0;
  };
  const push = (name, meal, portion, qid) => {
    const base = SURVEY_CUSTOM_FOODS[name]
      ? buildCustomAnalysis(name, SURVEY_CUSTOM_FOODS[name])
      : analyzeFood(name);
    if (!base || !(portion > 0)) return;
    // q: 이 음식을 만든 설문 문항 id
    diet.push({ name, meal, portion, analysis: scaleAnalysis(base, portion), source: 'survey', q: qid });
  };
  // 끼니 수는 밥·빵 응답으로 정한다 (최소 1끼, 최대 3끼)
  const grain = SURVEY_QUESTIONS
    .filter(q => q.comp === 'refinedGrain' || q.comp === 'wholeGrain')
    .reduce((t, q) => t + serveOf(q), 0);
  const slots = ['breakfast', 'lunch', 'dinner'].slice(3 - Math.max(1, Math.min(3, Math.round(grain))));
  for (const q of SURVEY_QUESTIONS) {
    if (!q.foods) continue;
    splitPortions(serveOf(q)).forEach((p, i) =>
      push(q.foods[i % q.foods.length], q.slot === 'snack' ? 'snack' : slots[i % slots.length], p, q.id));
  }
  return diet;
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
// silent: 다시 방문한 사용자의 저장된 응답으로 조용히 다시 계산할 때 (화면 이동·경고 없음)
function calculateAndShow(silent) {
  const profile = readProfile();
  const profileErr = validateProfile(profile);
  if (profileErr) { if (silent) return; alert(profileErr); goToStep(1); return; }

  if (!isSurveyComplete()) { if (silent) return; alert('식습관 설문에 모두 답해주세요.'); goToStep(2); return; }

  const meals = buildSurveyDiet(surveyAnswers);
  pdiResult = calculatePDI(meals);
  pdiResult.meals = meals;
  pdiResult.servings = surveyServings(surveyAnswers);
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
  // 설문 응답도 저장 — 다시 방문하면 결과 화면부터 열어주기 위해
  tracker.survey = isSurveyComplete() ? { ...surveyAnswers } : null;
  if (!tracker.weights.length) tracker.weights.push({ date: isoToday(), kg: profile.weight });
  tracker.targetKcalOverride = null;
  trackerSave();
  pdiResult.targets = currentTargets();

  subCart = null;                   // 결과가 바뀌면 구독 구성 초기화
  displayResults();
  buildMealPlan();                  // 저장된 식단이 현재 구성과 맞으면 표시, 아니면 안내 화면
  if (!silent) goPage('result');
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
    + '<span>선택한 구독 구성으로 30일 식단을 계산하는 중… <span class="text-gray-400">목표 칼로리·영양 균형·메뉴 다양성을 함께 맞춥니다</span></span></div>';

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
  goPage('plan');
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

  renderTargets(r);        // ① 기준·목표 칼로리 · BMI · 복부비만 · 영양소 목표치
  renderDietScore(r.meals, r.servings, r.profile.gender); // ② 식단 점수 · 질환 위험도 · 개선 제안
  renderTips(r);           // ③ 목표 관리 팁
  renderGuide(r);          // ④ 주의사항

  renderSubscription(r);
  renderSidePick(r);
  renderMealPlan();
  renderDiary();
  renderMonitor();
}

// ── ① 하루 목표치 ────────────────────────────
function renderTargets(r) {
  const el = document.getElementById('target-section');
  if (!el) return;
  const t = r.targets, bt = t.bodyType, rg = t.ranges;
  const diff = t.targetKcal - t.eer;
  const dir = diff < 0 ? '감량' : (diff > 0 ? '증량' : '유지');
  const abd = r.body.abdominal;

  const big = (label, value, unit, sub) =>
    '<div class="bg-emerald-50 rounded-2xl p-4 min-w-0">'
    + '<div class="text-xs font-bold text-emerald-700 mb-1">' + label + '</div>'
    + '<div class="text-2xl font-black text-emerald-900 leading-tight">' + value
    + '<span class="text-sm font-medium"> ' + unit + '</span></div>'
    + '<div class="text-xs text-emerald-700 mt-1">' + sub + '</div></div>';
  const macro = (name, value, note) =>
    '<div class="bg-gray-50 rounded-2xl p-4"><div class="text-xs font-bold text-gray-500 mb-1">' + name + '</div>'
    + '<div class="text-lg font-bold text-gray-900">' + value + '</div>'
    + '<div class="text-xs text-gray-400 mt-0.5">' + note + '</div></div>';
  const limit = (name, value) =>
    '<div class="bg-gray-50 rounded-xl px-3 py-2"><div class="text-xs text-gray-500">' + name + '</div>'
    + '<div class="text-sm font-bold text-gray-800">' + value + '</div></div>';

  el.innerHTML =
    '<h3 class="text-xl font-bold text-gray-900 mb-5">하루 목표치</h3>'

    + '<div class="grid sm:grid-cols-3 gap-3 mb-3">'
    + big('목표 칼로리', t.targetKcal.toLocaleString(), 'kcal/일',
          '기준 ' + t.eer.toLocaleString() + ' kcal에서 ' + (diff >= 0 ? '+' : '') + diff)
    + big('예상 ' + dir + ' 속도', Math.abs(t.weeklyDelta), 'kg/주', '표준 체중 ' + t.targetWeight + ' kg까지')
    + big('BMI', t.bmi.toFixed(1), bt.name, bt.desc)
    + '</div>'

    + '<div class="flex items-center justify-between gap-3 bg-gray-50 rounded-2xl px-4 py-3 mb-6">'
    + '<div><div class="text-sm font-bold text-gray-700">복부비만</div>'
    + '<div class="text-xs text-gray-400">허리둘레 남 90cm · 여 85cm 이상</div></div>'
    + (abd === undefined
        ? '<span class="text-sm text-gray-400 flex-shrink-0">바지 사이즈 미입력</span>'
        : '<span class="text-base font-bold flex-shrink-0" style="color:' + (abd ? '#DC2626' : '#2C5530') + '">'
          + (abd ? '해당' : '해당 없음') + '</span>')
    + '</div>'

    + '<div class="text-sm font-bold text-gray-800 mb-2">영양소 목표치</div>'
    + '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">'
    + macro('탄수화물', Math.round(rg.carb[0]) + '–' + Math.round(rg.carb[1]) + ' g', '열량의 55–65%')
    + macro('단백질',   Math.round(rg.protein[0]) + '–' + Math.round(rg.protein[1]) + ' g', '열량의 7–20%')
    + macro('지방',     Math.round(rg.fat[0]) + '–' + Math.round(rg.fat[1]) + ' g', '열량의 15–30%')
    + '</div>'
    + '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">'
    + limit('식이섬유', Math.round(rg.fiber) + ' g 이상')
    + limit('당류', Math.round(rg.sugar) + ' g 미만')
    + limit('포화지방', Math.round(rg.satfat) + ' g 미만')
    + limit('나트륨', rg.sodium.toLocaleString() + ' mg 미만')
    + '</div>';
}

// ── ② 목표 관리 팁 ───────────────────────────
function renderTips(r) {
  const el = document.getElementById('tips-section');
  if (!el) return;
  const tips = HEALTH_GOALS.filter(g => selectedGoals.has(g.id));
  el.innerHTML =
    '<h3 class="text-xl font-bold text-gray-900 mb-4">목표 관리 팁</h3>'
    + '<ul class="space-y-3">' + tips.map(g =>
        '<li class="flex gap-3"><span class="text-xl leading-none">' + g.icon + '</span>'
        + '<span class="text-sm"><b class="text-gray-800">' + g.name + '</b> '
        + '<span class="text-gray-600">' + g.tip + '</span></span></li>').join('')
    + '</ul>';
}

// ── 사이드의 「제품 추천 받기」 요약 ───────────
function renderSidePick(r) {
  const el = document.getElementById('side-pick');
  if (!el) return;
  if (!subCart) initSubCart(r);
  const q = subscriptionQuote(subCartToQuoteInput());
  el.innerHTML = q.lines.map(l =>
    '<div class="flex items-center justify-between gap-2 text-sm">'
    + '<span class="text-emerald-100 truncate">' + l.product.icon + ' ' + l.product.name + '</span>'
    + '<span class="text-white font-bold flex-shrink-0">' + l.qty + '개</span></div>').join('')
    + '<div class="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-emerald-600">'
    + '<span class="text-emerald-100 text-xs">한 달 예상 금액</span>'
    + '<span class="text-white font-bold">' + won(q.finalPrice) + '</span></div>';
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
    kcal:       ing.kcal || 0,
    deltaPDI:   +deltaPDI.toFixed(1),
    deltaPhyto: +deltaPhyto.toFixed(0),
    newPDI:     +newPDI.toFixed(1),
    newPhyto:   newPhytoScore.total,
    newKeys,    // 신규 추가 파이토 계열
  };
}

function simBadges(sim) {
  if (!sim) return '';
  return '<span class="text-xs text-gray-400">1회 ' + Math.round(sim.kcal || 0) + ' kcal</span>';
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
//   기준은 식단 점수와 같은 것을 씁니다 (통곡물 1회분 90g · 채소 하루 350g)
//   칼슘은 식재료 DB에 칼슘 함량이 없어 판정하지 않습니다 (룰테이블의 칼슘 열도 사용 안 함)
//   기준은 식단 점수와 같은 것을 씁니다 (통곡물 90g = 밥 한 공기 · 채소 하루 3접시)
function dietLacks(scored) {
  const serv = scored.components.serv;
  return {
    wholeGrain: (serv.wholeGrain || 0) < 90,
    veg:        (serv.veg || 0) < 3,
    protein:    (serv.legumes || 0) + (serv.fish || 0) + (serv.egg || 0) < 1,
  };
}

// 추천 룰테이블의 등급 축 — 식단 점수 등급(위험·보통·안전)을 그대로 씁니다
const GRADE_OF_TIER = { low: 'poor', mid: 'inter', high: 'ideal' };

function dietGrade(scored) {
  const o = scored.insufficient ? null : ptOverall(scored);
  return o ? GRADE_OF_TIER[o.tier.key] : 'inter';
}

function initSubCart(r) {
  const scored = scoreDietPatterns(r.meals, r.servings, r.profile.gender);
  const lacks = dietLacks(scored);
  subRecommendation = recommendSubscription({
    grade: dietGrade(scored),
    bmi: r.body.bmi, age: r.profile.age,
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
  renderPay();
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
  // 모바일: 제품 선택 드롭다운은 아래 줄로 내리고, ± 버튼은 터치 영역을 36px 로 키움
  return '<div class="flex flex-wrap items-center gap-2 py-2.5 border-b border-gray-100 last:border-0">'
    + '<span class="text-2xl">' + icon + '</span>'
    + '<div class="flex-1 min-w-0">' + label + '</div>'
    + '<div class="flex items-center gap-1 flex-shrink-0">'
    + '<button type="button" onclick="setSubQty(\'' + kind + '\',-1)" class="w-9 h-9 text-lg rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 active:bg-gray-100" aria-label="줄이기">−</button>'
    + '<span class="w-8 text-center text-base font-black text-gray-900">' + qty + '</span>'
    + '<button type="button" onclick="setSubQty(\'' + kind + '\',1)" class="w-9 h-9 text-lg rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 active:bg-gray-100" aria-label="늘리기">+</button>'
    + '</div>'
    + (extra ? '<div class="w-full sm:w-auto sm:order-2">' + extra + '</div>' : '')
    + '</div>';
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

  // ── 추천 근거 — 부족한 항목만 짧게 보여준다 ──
  const ruleLabel = rec.bodyType.name + ' · ' + (AGE_BANDS.find(a => a.id === rec.rule.ageBand) || {}).name;
  const lackChips = [
    ['통곡물 섭취 부족', rec.lacks.wholeGrain], ['채소 섭취 부족', rec.lacks.veg], ['단백질 섭취 부족', rec.lacks.protein],
  ].filter(([, bad]) => bad)
   .map(([n]) => '<span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">' + n + '</span>').join('');

  const reasonsHtml = rec.reasons.map(x => {
    const names = String(x.code).split('·').map(c => (CATALOG_BY_CODE[c] || {}).name || c).join(' · ');
    return '<li class="flex gap-2 text-xs"><span class="font-bold text-emerald-800 flex-shrink-0">' + names + '</span>'
      + '<span class="text-gray-500">' + x.why + '</span></li>';
  }).join('');

  // ── 제품 선택 ──
  const soymilkSelect = '<select onchange="setSoymilkCode(this.value)" class="w-full sm:w-auto text-xs px-2 py-2 border border-gray-200 rounded-lg sm:max-w-48">'
    + soymilks.map(p => '<option value="' + p.code + '"' + (p.code === subCart.soymilkCode ? ' selected' : '') + '>'
        + p.code + '. ' + p.name + ' (' + p.pack + ' ' + won(p.price) + ')</option>').join('')
    + '</select>';

  const sm = CATALOG_BY_CODE[subCart.soymilkCode];
  const rows =
    qtyRow('<div class="text-sm font-bold text-gray-900">두유</div><div class="text-xs text-gray-500 truncate">' + sm.note + '</div>',
           sm.icon, subCart.soymilk, 'soymilk', soymilkSelect)
    + qtyRow('<div class="text-sm font-bold text-gray-900">' + phyto.name + '</div><div class="text-xs text-gray-500">' + phyto.pack + ' · ' + won(phyto.price) + ' · 1회 ' + phyto.nut.energy + ' kcal</div>',
             phyto.icon, subCart.phyto, 'phyto')
    + qtyRow('<div class="text-sm font-bold text-gray-900">' + bar.name + '</div><div class="text-xs text-gray-500">' + bar.pack + ' · ' + won(bar.price) + ' · 1회 ' + bar.nut.energy + ' kcal</div>',
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

  // ── 1회분 더 먹었을 때의 예상 점수 변화 ──
  const simRows = ['soymilk', 'phyto', 'bar'].map(kind => {
    const p = kind === 'soymilk' ? sm : (kind === 'phyto' ? phyto : bar);
    const sim = simulateAddFood(p.name);
    return sim ? '<div class="flex items-center gap-2 text-xs"><span class="flex-1 truncate text-gray-600">' + p.name + '</span>' + simBadges(sim) + '</div>' : '';
  }).join('');

  el.innerHTML =
    '<div class="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 mb-4">'
    + '<div class="flex flex-wrap items-center gap-2 mb-2">'
    + '<span class="text-sm font-bold text-emerald-900">🎯 이렇게 골랐어요</span>'
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
    + '<div class="text-xs text-gray-400 mb-2">수량을 늘리면 할인율이 올라갑니다</div>'
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
    + (quote.rate
        ? '<button type="button" onclick="goPage(\'pay\')" class="w-full mt-3 py-3 bg-emerald-700 text-white text-sm font-bold">'
          + (isPaid() ? '구독 정보 보기' : '이 구성으로 구독 시작하기') + '</button>'
        : '')
    + (simRows ? '<div class="mt-3 pt-3 border-t border-gray-100 space-y-1"><div class="text-xs font-bold text-gray-500 mb-1">1회분 추가 시 예상 변화</div>' + simRows + '</div>' : '')
    + '</div></div>'

    // 구독 → 식단 추천 흐름의 연결점 (식단까지 받는 버전에서만 보여준다)
    + (planMode() === 'guide' ? '' :
      '<div class="mt-4 rounded-2xl border-2 p-4" style="border-color:' + (planFresh() ? '#E5E7EB' : '#05966966') + ';background:' + (planFresh() ? '#F9FAFB' : '#ECFDF5') + '">'
    + '<div class="flex flex-wrap items-center justify-between gap-3">'
    + '<div class="min-w-0"><div class="text-sm font-bold text-gray-900">'
    + (planFresh() ? '✓ 이 구성으로 만든 30일 식단이 아래에 있습니다' : '🗓 이 구성으로 30일 식단을 받아보세요') + '</div>'
    + '<div class="text-xs text-gray-500 mt-0.5">'
    + (planFresh()
        ? '수량을 바꾸면 그 구성에 맞춰 다시 추천받을 수 있습니다'
        : '구독한 제품을 30일에 나눠 넣고, 목표 칼로리와 영양 균형에 맞춘 끼니를 짜드립니다')
    + '</div></div>'
    + '<button type="button" onclick="requestMealPlan()" class="flex-shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition '
    + (planFresh() ? 'border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50' : 'bg-emerald-700 text-white hover:bg-emerald-800') + '">'
    + (planFresh() ? '다시 추천받기' : '식단 추천받기 →') + '</button>'
    + '</div></div>')

    + '';
}

// ── 기록 요약 — 식사를 기록했을 때만 보여준다 ──
function renderGuide(r) {
  const el = document.getElementById('guide-section');
  if (!el) return;
  const warn = [];
  const ratio = r.pfs.eer > 0 ? r.totalCalories / r.pfs.eer : 0;
  const ps = r.phytoScore;

  if (r.allergyHits.length) {
    warn.push(['🚫', '알레르기 주의', r.allergyHits.map(h => h.name + '(' + h.allergens.join('·') + ')').join(', ')]);
  }
  if (ps.coveredCount < 6) warn.push(['🥗', '채소·과일 종류 부족', '색이 다른 채소·과일·콩을 번갈아 드시면 영양소 종류가 늘어납니다.']);
  if (r.intake.wholeGrainPct < 5) warn.push(['🌾', '통곡물 섭취 부족', '흰쌀밥을 잡곡밥·현미밥으로 바꿔보세요.']);
  if (r.intake.vegG < 200) warn.push(['🥬', '채소 섭취 부족', '끼니마다 채소 반찬 1–2접시(하루 350g 이상)를 권장합니다.']);
  if (r.intake.fruitG < 100) warn.push(['🍎', '과일 섭취 부족', '하루 1–2회(주먹 1개 크기) 과일을 드세요.']);
  if (!r.categoryMap.legumes) warn.push(['🫘', '콩 식품 미섭취', '두부·된장·콩밥 같은 콩 식품을 끼니에 넣어보세요.']);
  if (r.categoryMap.refined && r.categoryMap.refined.percentage > 40) {
    warn.push(['🍞', '정제 식품 비율 높음', '흰 곡물·당류 비율 ' + r.categoryMap.refined.percentage.toFixed(0) + '% — 가공식품을 줄여보세요.']);
  }
  if (r.body.abdominal) warn.push(['📏', '복부비만', '허리둘레가 기준(남 90cm·여 85cm) 이상입니다. 체중 관리 루틴을 꾸준히 실천하세요.']);

  el.innerHTML =
    '<h3 class="text-xl font-bold text-gray-900 mb-4">주의사항 &amp; 관리 가이드</h3>'
    + (warn.length
        ? '<div class="grid md:grid-cols-2 gap-3">' + warn.map(([icon, title, body]) =>
            '<div class="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3.5">'
            + '<span class="text-xl leading-none">' + icon + '</span>'
            + '<div><div class="text-sm font-bold text-amber-900">' + title + '</div><div class="text-xs text-amber-800 mt-0.5">' + body + '</div></div></div>'
          ).join('') + '</div>'
        : '<div class="bg-emerald-50 rounded-xl p-4 text-sm text-emerald-800">🎉 큰 문제 없이 균형 잡힌 식단입니다.</div>');
}

// ── 관리 목표 렌더링 ─────────────────────────
function renderHealthGoals() {
  const grid = document.getElementById('health-goals-grid');
  if (!grid) return;
  grid.innerHTML = HEALTH_GOALS.filter(goal => !goal.base).map(goal => {
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
      + '<button onclick="startService()" class="w-full py-2.5 rounded-xl text-white text-sm font-medium transition" style="background:' + color + '">맞춤 구독 추천받기</button>'
      + '</div></div>';
  }).join('');
}

// 「다른 음식」 입력용 datalist — 레시피 + 단품 식재료
// ponytail: 14,715개를 한 번에 넣으면 무거워 상위 2,000개만
function initPlanFoodList() {
  const dl = document.getElementById('plan-food-list');
  if (!dl) return;
  const names = RECIPE_NAMES.slice(0, 1600).concat(INGREDIENT_NAMES.slice(0, 400));
  dl.innerHTML = names.map(n => '<option value="' + n.replace(/"/g, '&quot;') + '">').join('');
}

// ── 재시작 ───────────────────────────────────
function restartAssessment() {
  subCart = null;
  tracker.survey = null;
  trackerSave();
  for (const k of Object.keys(surveyAnswers)) delete surveyAnswers[k];
  selectedGoals.clear();
  for (const g of HEALTH_GOALS) if (g.base) selectedGoals.add(g.id);
  pdiResult = null;
  renderSurvey();
  renderHealthGoals();
  goPage('intake');
  goToStep(1);
}
