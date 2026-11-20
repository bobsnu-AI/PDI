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


// benefits 키워드 → HEALTH_GOALS 아이콘 매핑


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
// 체중 관리가 핵심(항상 포함), 추가 건강 관리는 5가지만 선택 제공
const HEALTH_GOALS = [
  { id: 'weight',      name: '체중 관리', icon: '⚖️', base: true, phytos: ['glucosinolates', 'catechins', 'phenolicAcids'],
    tip: '식사량보다 먹는 구성이 중요해요. 포만감은 {foods}에서 오니 이쪽을 늘리고 가공식품·단 음료를 줄이세요.' },
  { id: 'gut',         name: '장 건강',   icon: '🌿', phytos: ['phenolicAcids', 'saponins', 'gingerols'],
    tip: '식이섬유와 발효식품이 장에 좋아요. {foods} 중에서 매일 하나는 챙기세요.' },
  { id: 'cvd',         name: '심혈관 건강', icon: '❤️', phytos: ['catechins', 'anthocyanins'],
    tip: '짠 국물과 가공육을 줄이고 {foods}을 늘리세요. 나트륨은 하루 2,000 mg 아래가 좋아요.' },
  { id: 'blood_sugar', name: '혈당 관리', icon: '🩸', phytos: ['phenolicAcids', 'isoflavones', 'lignans'],
    tip: '흰쌀 대신 잡곡밥, 채소·단백질 반찬을 먼저 먹고 밥은 나중에 드세요.' },
  { id: 'bone',        name: '뼈 건강',   icon: '🦴', phytos: ['isoflavones', 'lignans', 'flavonols'],
    tip: '칼슘은 {foods}에 많아요. 햇볕도 하루 15분은 쬐세요.' },
  { id: 'fatigue',     name: '피로 회복', icon: '🔋', phytos: ['saponins', 'anthocyanins', 'catechins'],
    tip: '아침 식사를 거르지 말고 단백질을 끼니마다 나눠 드세요. 충분한 수면이 기본이에요.' },
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
// 빈도는 모두 「일주일에 며칠」(0~7일)로 묻습니다. 「하루 2끼」·「주 3~6회」가 섞여 있으면
// 「사흘은 두 끼, 나흘은 한 끼」 같은 사람이 어디를 골라야 할지 모릅니다 (1차 보완사항).
// 하루에 여러 번 먹을 수 있는 식품은 「먹는 날엔 하루에」를 한 번 더 묻습니다.
//   1일 회분 = 먹는 날 수 ÷ 7 × 먹는 날 하루 횟수
// 문항 수는 점수가 요구하는 식품군 수로 정해집니다. 점수 5종이 문항을 서로 나눠
// 쓰도록 맞춰서 17문항입니다 — 한 문항을 빼면 적어도 한 점수에 「뺀 항목」이 생깁니다.
// 술 문항은 AHEI·AMED 의 음주 성분에 필요합니다. 논문 기준이 적정 음주를 만점으로
// 보기 때문에, 계산에는 넣고 개선 제안에서는 뺍니다.
//   days : true 면 0~7일 빈도 문항. per 가 있으면 먹는 날 하루 횟수를 한 번 더 묻습니다
//   options : days 가 아닌 문항(유제품 종류·짠맛)의 선택지 [이름, 값]
const SURVEY_QUESTIONS = [
  // ── 곡류 ──
  { id: 'refinedGrain', comp: 'refinedGrain', slot: 'meal', foods: ['쌀밥', '식빵'], days: true,
    q: '일주일에 <b>흰쌀밥·흰빵·국수·감자</b>를 먹는 날은 며칠인가요?',
    per: [['1끼', 1], ['2끼', 2], ['3끼', 3]], perUnit: '끼' },
  { id: 'wholeGrain', comp: 'wholeGrain', slot: 'meal', foods: ['잡곡밥'], days: true,
    q: '일주일에 <b>잡곡밥·현미밥·통밀빵·귀리</b>를 먹는 날은 며칠인가요?',
    per: [['1끼', 1], ['2끼', 2], ['3끼', 3]], perUnit: '끼' },

  // ── 채소·과일 ──
  { id: 'veg', comp: 'veg', slot: 'meal', foods: ['시금치나물', '콩나물무침', '무생채'], days: true,
    q: '일주일에 <b>김치를 뺀 채소 반찬</b>(나물·샐러드·생채소)을 먹는 날은 며칠인가요?',
    per: [['1~2접시', 1.5], ['3~4접시', 3.5], ['5접시 이상', 5]] },
  { id: 'fruit', comp: 'fruit', slot: 'snack', foods: ['사과', '귤'], days: true,
    q: '일주일에 <b>과일</b>을 먹는 날은 며칠인가요?', note: '1회 = 사과 1개 정도',
    per: [['1회', 1], ['2회', 2], ['3회 이상', 3]] },

  // ── 고기·생선·달걀·콩 ──
  { id: 'redMeat', comp: 'redMeat', slot: 'meal', foods: ['제육볶음', '삼겹살구이'], days: true,
    q: '일주일에 <b>소고기·돼지고기</b>를 먹는 날은 며칠인가요?',
    per: [['1회', 1], ['2회 이상', 2]] },
  { id: 'processedMeat', comp: 'processedMeat', slot: 'meal', foods: ['소시지야채볶음', '라면'], days: true,
    q: '일주일에 <b>햄·소시지·베이컨·어묵·라면</b>을 먹는 날은 며칠인가요?' },
  { id: 'fish', comp: 'fish', slot: 'meal', foods: ['고등어구이'], days: true,
    q: '일주일에 <b>생선·해산물</b>을 먹는 날은 며칠인가요?' },
  { id: 'egg', comp: 'egg', slot: 'meal', foods: ['계란말이'], days: true,
    q: '일주일에 <b>달걀</b>을 먹는 날은 며칠인가요?',
    per: [['1개', 1], ['2개 이상', 2]] },
  { id: 'legumes', comp: 'legumes', slot: 'meal', foods: ['두부조림'], days: true,
    q: '일주일에 <b>두부·콩·콩자반</b>을 먹는 날은 며칠인가요?',
    per: [['1회', 1], ['2회 이상', 2]] },
  { id: 'nuts', comp: 'nuts', slot: 'snack', foods: ['견과 한 줌'], days: true,
    q: '일주일에 <b>견과류</b>를 한 줌 먹는 날은 며칠인가요?', note: '한 줌 = 약 28g' },

  // ── 유제품 ──
  { id: 'dairy', comp: 'dairy', slot: 'snack', foods: ['우유 한 컵'], days: true,
    q: '일주일에 <b>우유·요구르트·치즈</b>를 먹는 날은 며칠인가요?', note: '1회 = 우유 한 컵(200 mL)',
    per: [['1회', 1], ['2회 이상', 2]] },
  { id: 'dairyLow', comp: 'dairyLowRatio', slot: null, foods: null,
    q: '유제품은 주로 <b>어떤 것</b>을 고르시나요?',
    options: [['대부분 저지방·무지방', 1], ['절반쯤 저지방', 0.5], ['대부분 일반 제품', 0]] },

  // ── 간식·음료 ──
  { id: 'sweets', comp: 'sweets', slot: 'snack', foods: ['단 음식'], days: true,
    q: '일주일에 <b>과자·케이크·아이스크림</b>을 먹는 날은 며칠인가요?' },
  { id: 'coffeeTea', comp: 'coffeeTea', slot: 'snack', foods: ['커피 한 잔'], days: true,
    q: '일주일에 <b>커피·차</b>를 마시는 날은 며칠인가요?', note: '설탕·시럽 없이 마시는 것만',
    per: [['1~2잔', 1.5], ['3잔 이상', 3]] },
  { id: 'ssb', comp: 'ssb', slot: 'snack', foods: ['단 음료'], days: true,
    q: '일주일에 <b>탄산음료·가당음료·주스</b>를 마시는 날은 며칠인가요?', note: '한 잔 = 200 mL',
    per: [['1잔', 1], ['2잔 이상', 2]] },

  // ── 술 (AHEI·AMED 는 총 잔 수로 봅니다) ──
  { id: 'alcohol', comp: 'alcohol', slot: 'snack', foods: ['소주 한 잔'], days: true,
    q: '일주일에 <b>술</b>을 마시는 날은 며칠인가요?', note: '한 잔 = 소주 1잔·맥주 200 mL·와인 1잔',
    per: [['1~2잔', 1.5], ['3~4잔', 3.5], ['5잔 이상', 5.5]] },

  // ── 짠맛 ──
  { id: 'salty', comp: null, slot: 'meal', foods: ['된장국'],
    q: '국물·젓갈·장아찌처럼 <b>짜게</b> 드시는 편인가요?',
    options: [['그렇지 않다', 0], ['보통이다', 1], ['그렇다', 2]] },
];

// 응답 한 칸이 다 채워졌는지 — 빈도 문항은 { d: 먹는 날 수, n: 하루 횟수 선택 } 로 저장합니다
function surveyAnswered(q, a) {
  if (q.days) {
    if (!a || typeof a !== 'object' || !(a.d >= 0 && a.d <= 7)) return false;
    return a.d === 0 || !q.per || (a.n >= 0 && a.n < q.per.length);
  }
  return typeof a === 'number' && a >= 0 && a < q.options.length;
}

// 응답 → 1일 회분 (빈도 문항) 또는 선택지 값
function surveyServe(q, a) {
  if (!surveyAnswered(q, a)) return 0;
  if (!q.days) return q.options[a][1];
  if (a.d === 0) return 0;
  const perDay = q.per ? q.per[a.n][1] : 1;
  return Math.round(a.d / 7 * perDay * 1000) / 1000;
}

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
  for (const q of SURVEY_QUESTIONS) serve[q.id] = surveyServe(q, ans[q.id]);
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
  set('profile-activity', p.activity);
  set('profile-goal', p.goal); set('profile-target-weight', p.targetWeight);
  set('profile-mod-min', p.modMin); set('profile-vig-min', p.vigMin);
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
  restoreProfileForm();
  renderAllergyChips();
  setGender(gender);
  renderSurvey();
  renderHealthGoals();
  initPlanFoodList();
  rotateHomePhoto();
  renderHomeExample();

  // 저장된 설문 응답을 복원해 결과를 미리 계산한다 (두 번째 방문)
  if (tracker.survey) {
    // 예전 형식(선택지 번호)의 빈도 응답은 버립니다 — 「며칠」 형식으로 다시 답해야 합니다
    for (const q of SURVEY_QUESTIONS) {
      const v = tracker.survey[q.id];
      if (surveyAnswered(q, v)) surveyAnswers[q.id] = v;
    }
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

});

// ── 첫 화면 예시 카드 — 맞춤 리포트에 실제로 나오는 세 점수를 같은 띠로 보여준다 ──
const HOME_EXAMPLE_SCORES = [['건강 식생활 지수', 61], ['혈압 관리 식단 점수', 47], ['당뇨 위험 감소 식단', 57]];
function renderHomeExample() {
  const el = document.getElementById('home-example-scores');
  if (!el) return;
  el.innerHTML = HOME_EXAMPLE_SCORES.map(([name, score]) => {
    const t = ptTier(score / 100);
    return '<div><div class="flex items-baseline justify-between mb-2">'
      + '<span class="text-sm font-semibold text-gray-800">' + name + '</span>'
      + '<span class="text-2xl font-bold" style="color:' + t.color + '">' + score + '</span></div>'
      + '<div class="flex h-2.5 rounded-full overflow-hidden relative">'
      + PT_TIER.map((z, i) => '<div style="width:' + [40, 20, 40][i] + '%;background:' + z.tint + '"></div>').join('')
      + '<div class="absolute top-0 bottom-0" style="left:' + score + '%;transform:translateX(-50%);width:4px;border-radius:2px;background:'
      + t.color + ';box-shadow:0 0 0 2px #fff"></div></div></div>';
  }).join('');
  const qc = document.getElementById('home-q-count');
  if (qc) qc.textContent = SURVEY_QUESTIONS.length;
}

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
// PROFILE  (성별·나이·키·체중·목표·활동량·알레르기 → 기준 칼로리)
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
    goal:       document.getElementById('profile-goal').value || 'auto',
    targetWeight: num('profile-target-weight'),
    activity:   document.getElementById('profile-activity').value,
    modMin:     num('profile-mod-min'),
    vigMin:     num('profile-vig-min'),
    allergies:  new Set(selectedAllergies),
  };
}

// 주당 중·고강도 운동 시간 (분). 고강도는 2배로 셉니다 —
// WHO·WCRF 권고가 중강도 150분과 고강도 75분을 같게 봅니다.
function weeklyMvpaMin(p) {
  if (!p) return null;
  const mod = p.modMin, vig = p.vigMin;
  if (mod == null && vig == null) return null;
  return (mod || 0) + (vig || 0) * 2;
}

// 나이·키·체중은 기준 칼로리 산출에 필수
function validateProfile(p) {
  const fields = [
    ['age', '나이', 3, 120, true], ['height', '키', 80, 230, true], ['weight', '체중', 10, 300, true],
  ];
  const missing = fields.filter(f => f[4] && p[f[0]] === null).map(f => f[1]);
  if (missing.length) return '필수 항목(' + missing.join('·') + ')을 입력해주세요. 기준 칼로리 계산에 필요해요.';
  for (const [k, label, min, max] of fields) {
    if (p[k] !== null && !(p[k] >= min && p[k] <= max)) {
      return label + '은(는) ' + min + '–' + max + ' 범위로 입력해주세요.';
    }
  }
  // 목표와 목표 체중이 서로 맞는지 (성인만 — BMI 18.5 기준은 19세 이상에 씁니다)
  const h2 = (p.height / 100) ** 2, tw = p.targetWeight;
  if (tw != null && !(tw >= 20 && tw <= 300)) return '목표 체중은 20–300 범위로 입력해주세요.';
  if (p.goal === 'loss' && tw != null && tw >= p.weight) return '감량이 목표인데 목표 체중이 지금 체중보다 낮지 않아요. 목표 체중을 다시 확인해주세요.';
  if (p.goal === 'gain' && tw != null && tw <= p.weight) return '증량이 목표인데 목표 체중이 지금 체중보다 높지 않아요. 목표 체중을 다시 확인해주세요.';
  if (p.age >= 19) {
    if (tw != null && tw / h2 < 18.5) return '목표 체중이 저체중 범위예요. ' + Math.ceil(18.5 * h2) + ' kg 이상으로 입력해주세요.';
    if (p.goal === 'loss' && p.weight / h2 < 18.5) return '지금 체중이 저체중 범위라 감량 목표는 권하지 않아요. 유지나 증량을 골라주세요.';
  }
  return null;
}

// BMI 체중 유형 (products.js BODY_TYPES · 엑셀 Sheet3 기준)
function bodyIndices(p) {
  const out = {};
  if (p.height > 0 && p.weight > 0) {
    out.bmi = p.weight / ((p.height / 100) ** 2);
    out.bodyType = classifyBodyType(out.bmi);
    out.bmiLabel = out.bodyType.name;
  }
  return out;
}

// ── 목표 칼로리·영양 기준 (체중 유형 반영 + 모니터링 재조정 반영) ──
function currentTargets() {
  const p = (tracker && tracker.profile) ? tracker.profile : readProfile();
  const t = nutritionTargets(p, tracker && tracker.targetKcalOverride);
  if (!t) return null;
  // 질환 위험도 조정 (deficit_based 모드 + 조정 규칙이 있을 때만)
  return typeof wellnessAdjustTargets === 'function' ? wellnessAdjustTargets(t) : t;
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
  if (isSingleFood(name)) return analyzeIngredient(name);
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
    const left = SURVEY_QUESTIONS.length - surveyAnsweredCount();
    el.querySelector('span').textContent = '설문 ' + left + '개 문항이 남았어요.';
    const first = SURVEY_QUESTIONS.findIndex(q => !surveyAnswered(q, surveyAnswers[q.id]));
    if (first >= 0) gotoSurvey(first);
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

let surveyIndex = 0;          // 지금 보여주는 문항 — 한 화면에 한 문항씩 (1차 보완사항: 가독성)

function surveySectionOf(qi) {
  let sec = '';
  for (let i = 0; i <= qi; i++) if (SURVEY_SECTIONS[SURVEY_QUESTIONS[i].id]) sec = SURVEY_SECTIONS[SURVEY_QUESTIONS[i].id];
  return sec;
}

function surveyAnsweredCount() {
  return SURVEY_QUESTIONS.filter(q => surveyAnswered(q, surveyAnswers[q.id])).length;
}

function renderSurvey() {
  const el = document.getElementById('survey-questions');
  if (!el) return;
  const total = SURVEY_QUESTIONS.length;
  surveyIndex = Math.max(0, Math.min(total - 1, surveyIndex));
  const q = SURVEY_QUESTIONS[surveyIndex];
  const a = surveyAnswers[q.id];
  const done = surveyAnsweredCount();

  const chip = (label, on, onclick, extra) =>
    '<button type="button" onclick="' + onclick + '" aria-pressed="' + on + '" class="' + (extra || '')
    + ' py-3 rounded-xl text-sm border-2 transition '
    + (on ? 'border-emerald-700 bg-emerald-700 text-white font-bold' : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-400') + '">'
    + label + '</button>';

  let body = '';
  if (q.days) {
    const d = a && typeof a === 'object' ? a.d : null;
    body += '<div class="grid grid-cols-4 sm:grid-cols-8 gap-2">'
      + [0, 1, 2, 3, 4, 5, 6, 7].map(n => chip(n + '일', d === n, 'answerSurveyDays(\'' + q.id + '\',' + n + ')', 'w-full')).join('')
      + '</div>';
    if (q.per && d > 0) {
      body += '<div class="mt-5 pt-5" style="border-top:1px dashed var(--line)">'
        + '<div class="text-sm font-semibold text-gray-800 mb-2.5">먹는 날엔 하루에 어느 정도인가요?</div>'
        + '<div class="flex flex-wrap gap-2">'
        + q.per.map(([label], i) => chip(label, a.n === i, 'answerSurveyPer(\'' + q.id + '\',' + i + ')', 'px-5')).join('')
        + '</div></div>';
    }
  } else {
    body += '<div class="flex flex-wrap gap-2">'
      + q.options.map(([label], i) => chip(label, a === i, 'answerSurvey(\'' + q.id + '\',' + i + ')', 'px-5')).join('')
      + '</div>';
  }

  // 번호 줄 — 답한 문항은 채워 보여주고, 눌러서 바로 고칠 수 있습니다
  const dots = SURVEY_QUESTIONS.map((qq, i) => {
    const ok = surveyAnswered(qq, surveyAnswers[qq.id]);
    const cur = i === surveyIndex;
    return '<button type="button" onclick="gotoSurvey(' + i + ')" aria-label="' + (i + 1) + '번 문항"'
      + ' class="w-7 h-7 text-[11px] font-bold rounded-full transition '
      + (cur ? 'ring-2 ring-emerald-700 ring-offset-1 ' : '')
      + (ok ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200') + '">' + (i + 1) + '</button>';
  }).join('');

  el.innerHTML =
    '<div class="flex items-center justify-between gap-3 mb-2">'
    + '<span class="text-xs font-bold px-3 py-1 rounded-full text-white" style="background:var(--sage)">' + surveySectionOf(surveyIndex) + '</span>'
    + '<span class="text-xs text-gray-500">응답 <b class="text-gray-800">' + done + '</b> / ' + total + '</span></div>'
    + '<div class="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-6"><div class="h-full rounded-full transition-all" style="width:'
    + Math.round(done / total * 100) + '%;background:var(--sage)"></div></div>'

    + '<div class="rounded-2xl p-5 sm:p-7" style="border:1.5px solid var(--sage)">'
    + '<div class="text-xs font-bold text-emerald-700 mb-2">Q' + (surveyIndex + 1) + '</div>'
    + '<div class="text-lg sm:text-xl text-gray-900 leading-snug mb-1">' + q.q + '</div>'
    + '<div class="text-sm text-gray-400 mb-5">' + (q.note || (q.days ? '조금이라도 먹은 날을 세어 주세요' : '&nbsp;')) + '</div>'
    + body
    + '</div>'

    + '<div class="flex items-center justify-between mt-4">'
    + '<button type="button" onclick="gotoSurvey(' + (surveyIndex - 1) + ')" class="text-sm text-gray-500 px-2 py-2 '
    + (surveyIndex === 0 ? 'invisible' : '') + '">‹ 이전 문항</button>'
    + '<button type="button" onclick="gotoSurvey(' + (surveyIndex + 1) + ')" class="text-sm font-semibold px-2 py-2 '
    + (surveyIndex === total - 1 ? 'invisible ' : '') + (surveyAnswered(q, a) ? 'text-emerald-700' : 'text-gray-300') + '">다음 문항 ›</button>'
    + '</div>'
    + '<div class="flex flex-wrap gap-1.5 mt-3">' + dots + '</div>';
}

function gotoSurvey(i) {
  surveyIndex = i;
  renderSurvey();
}

// 다 답한 문항이면 아직 안 답한 다음 문항으로 넘어갑니다
function afterSurveyAnswer(qid) {
  const q = SURVEY_QUESTIONS.find(x => x.id === qid);
  if (isSurveyComplete()) document.getElementById('step2-error').classList.add('hidden');
  if (q && surveyAnswered(q, surveyAnswers[qid])) {
    const total = SURVEY_QUESTIONS.length;
    let next = -1;
    for (let k = 1; k <= total; k++) {
      const i = (surveyIndex + k) % total;
      if (!surveyAnswered(SURVEY_QUESTIONS[i], surveyAnswers[SURVEY_QUESTIONS[i].id])) { next = i; break; }
    }
    renderSurvey();
    if (next >= 0) setTimeout(() => gotoSurvey(next), 250);
    return;
  }
  renderSurvey();
}

function answerSurvey(qid, optIdx) {
  surveyAnswers[qid] = optIdx;
  afterSurveyAnswer(qid);
}

function answerSurveyDays(qid, d) {
  const prev = surveyAnswers[qid];
  surveyAnswers[qid] = { d, n: prev && typeof prev === 'object' ? prev.n : undefined };
  afterSurveyAnswer(qid);
}

function answerSurveyPer(qid, n) {
  const prev = surveyAnswers[qid] || {};
  surveyAnswers[qid] = { d: prev.d, n };
  afterSurveyAnswer(qid);
}

function isSurveyComplete() {
  return SURVEY_QUESTIONS.every(q => surveyAnswered(q, surveyAnswers[q.id]));
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
  const serveOf = q => surveyServe(q, ans[q.id]);
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
// 식단 분해 (식재료·식품군 kcal·파이토케미컬 합계)
//   PDI 점수는 더 이상 계산하지 않습니다 — 식단 평가는 식단 지수(patterns.js)로 합니다.
//   함수 이름은 호출부가 많아 그대로 둡니다
function calculatePDI(meals) {
  let totalCalories = 0;
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

  return {
    totalCalories,
    categoryMap, phytoMap, allIngredients,
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
  if (!silent) tracker.targetKcalOverride = null;   // 다시 진단하면 직접 고친 목표 칼로리는 지웁니다
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
  const cartKey = planKeyNow();
  // 버튼을 누르지 않았으면 최적화를 돌리지 않는다 — 저장된 식단이 맞으면 보여주고, 아니면 안내 화면
  if (!force) { renderMealPlan(); renderMonitor(); return; }

  if (el) el.innerHTML = '<div class="flex items-center gap-3 text-sm text-gray-500 py-4">'
    + '<i class="fas fa-circle-notch fa-spin text-emerald-600 text-xl"></i>'
    + '<span>선택한 구독 구성으로 30일 식단을 계산하는 중… <span class="text-gray-400">목표 칼로리·영양 균형·메뉴 다양성을 함께 맞춥니다</span></span></div>';

  // 렌더 프레임을 양보한 뒤 최적화 (버튼 클릭이 멈춘 것처럼 보이지 않게)
  setTimeout(() => {
    // 관리 목표·질환 등급 → 식단 지수 가중치와 PFS 기준치
    const scored = scoreDietPatterns(r.meals, r.servings, r.profile.gender, r.profile);
    const plan = generateMealPlan({
      profile: tracker.profile, targets: r.targets, cart,
      days: 30, allergies: r.profile.allergies,
      goals: tracker.goals, grades: scored.insufficient ? [] : diseaseGrades(scored),
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
    alert('제품을 1개 이상 담은 뒤 식단을 추천받을 수 있어요.');
    return;
  }
  const logged = Object.keys(tracker.log || {}).length;
  if (logged && !confirm('새 구성으로 식단을 다시 만들면 지금까지의 실천 기록이 초기화돼요. 계속할까요?')) return;
  tracker.startDate = isoToday();
  tracker.log = {};
  buildMealPlan(true);
  goPage('plan');
  const el = document.getElementById('mealplan-section');
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 명시적 재생성만 이행 기록을 초기화한다
// (목표 칼로리만 고치면 지금까지의 기록·체중 추이는 유지)
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
  return tracker.planKey !== planKeyNow();
}

// 식단을 만든 조건 — 구독 구성·목표 열량·관리 목표. 하나라도 바뀌면 다시 추천받게 합니다
function planKeyNow() {
  return JSON.stringify(subCartToQuoteInput()) + '|' + pdiResult.targets.targetKcal + '|' + (tracker.goals || []).join();
}

// 목표 칼로리를 적용하고 결과 화면을 새 목표로 다시 그립니다
//   rebuild: 체중 추세 제안을 적용할 때 — 받아 둔 30일 식단도 새 목표로 다시 최적화 (실천 기록은 유지)
function applyRetarget(newTargetKcal, rebuild) {
  tracker.targetKcalOverride = newTargetKcal;   // null 이면 자동 계산으로 되돌립니다
  trackerSave();
  if (!pdiResult) return;
  pdiResult.targets = currentTargets();
  displayResults();
  if (rebuild && planMode() === 'plan' && tracker.plan) buildMealPlan(true);
}

// 통곡물 kcal 비율, 채소·과일 섭취량(g) — 주의사항 판단용
const WHOLE_GRAIN_RE = /현미|흑미|보리|귀리|오트|잡곡|수수|기장|율무|메밀|통밀|퀴노아|차조|^조$|^조\(/;
function foodGroupIntake(meals) {
  let total = 0, wholeGrainKcal = 0, vegG = 0, fruitG = 0, refinedKcal = 0;
  for (const m of meals) {
    total += m.analysis.totalCal;
    for (const i of m.analysis.ingredients) {
      const g = typeof i.grams === 'number' ? i.grams : 0;
      if (i.cat === 'grains' && WHOLE_GRAIN_RE.test(i.name)) wholeGrainKcal += i.kcal;
      if (i.cat === 'vegetables') vegG += g;
      if (i.cat === 'fruits') fruitG += g;
      // 흰 곡물·당류는 음식 이름으로 가립니다. 카테고리(cat)로 보면 안 됩니다 —
      // 이 DB 는 분류표에 없는 식품군을 전부 refined 로 떨어뜨려서, 달걀·우유·
      // 김치가 「정제 식품」으로 잡힙니다.
      const comp = ptClassify(i.name, i.cat);
      if (comp === 'refinedGrain' || comp === 'sweets') refinedKcal += i.kcal;
    }
  }
  return {
    wholeGrainPct: total > 0 ? wholeGrainKcal / total * 100 : 0, vegG, fruitG,
    refinedPct: total > 0 ? refinedKcal / total * 100 : 0,
  };
}

function displayResults() {
  const r = pdiResult;

  renderTargets(r);        // ① 목표 칼로리 · 영양소 목표치
  renderDietScore(r.meals, r.servings, r.profile.gender, r.profile); // ② 개선 제안 · 식단 점수

  renderSubscription(r);
  renderSidePick(r);
  renderProductDetail(r);
  renderMealPlan();
  renderDiary();
  renderMonitor();
}

// ── ① 일일 영양섭취 목표 ─────────────────────
const GOAL_LABEL = { loss: '체중 감량', maintain: '체중 유지', gain: '증량·근육량 증가' };

// 직접 고칠 수 있는 목표 칼로리 범위 — 기준 칼로리의 70–120 %, 아래로는 1,200 kcal 까지
// (tracker.js retargetSuggestion 의 하한·상한과 같은 선입니다)
function targetKcalBounds(eer) {
  return [Math.min(eer, Math.max(1200, Math.round(eer * 0.7))), Math.round(eer * 1.2)];
}

function setTargetKcal() {
  const v = Math.round(Number(document.getElementById('target-kcal-input').value));
  const [lo, hi] = targetKcalBounds(pdiResult.targets.eer);
  if (!(v >= lo && v <= hi)) {
    document.getElementById('target-kcal-msg').textContent =
      lo.toLocaleString() + '–' + hi.toLocaleString() + ' kcal 사이로 입력해주세요. '
      + '기준 칼로리(' + pdiResult.targets.eer.toLocaleString() + ' kcal)에서 너무 멀면 건강에 무리가 갈 수 있어요.';
    return;
  }
  applyRetarget(v);
}

function renderTargets(r) {
  const el = document.getElementById('target-section');
  if (!el) return;
  const t = r.targets, rg = t.ranges;
  const diff = t.targetKcal - t.eer;
  const edited = !!tracker.targetKcalOverride;
  const [lo, hi] = targetKcalBounds(t.eer);

  const macro = (name, value, note) =>
    '<div class="bg-gray-50 rounded-2xl p-4"><div class="text-xs font-bold text-gray-500 mb-1">' + name + '</div>'
    + '<div class="text-lg font-bold text-gray-900">' + value + '</div>'
    + '<div class="text-xs text-gray-400 mt-0.5">' + note + '</div></div>';
  const limit = (name, value) =>
    '<div class="bg-gray-50 rounded-xl px-3 py-2"><div class="text-xs text-gray-500">' + name + '</div>'
    + '<div class="text-sm font-bold text-gray-800">' + value + '</div></div>';

  el.innerHTML =
    '<h3 class="text-xl font-bold text-gray-900 mb-5">일일 영양섭취 목표</h3>'

    + '<div class="bg-emerald-50 rounded-2xl p-4 mb-6">'
    + '<div class="flex flex-wrap items-end justify-between gap-3">'
    + '<div class="min-w-0"><div class="text-xs font-bold text-emerald-700 mb-1">목표 칼로리 · '
    + (edited ? '직접 입력' : (GOAL_LABEL[t.goal] || '체중 유형(' + t.bodyType.name + ')에 맞춤')) + '</div>'
    + '<div class="text-2xl font-black text-emerald-900 leading-tight">' + t.targetKcal.toLocaleString()
    + '<span class="text-sm font-medium"> kcal/일</span></div>'
    + '<div class="text-xs text-emerald-700 mt-1">체중이 유지되는 기준 칼로리 ' + t.eer.toLocaleString() + ' kcal'
    + (diff ? '에서 ' + (diff > 0 ? '+' : '−') + Math.abs(diff).toLocaleString() : '와 같아요') + '</div></div>'
    + '<div class="flex items-center gap-2">'
    + '<input id="target-kcal-input" type="number" inputmode="numeric" step="10" min="' + lo + '" max="' + hi + '" value="' + t.targetKcal + '" '
    + 'aria-label="목표 칼로리 직접 입력" class="w-24 py-2 px-3 rounded-xl border-2 border-emerald-200 bg-white text-sm text-gray-800 outline-none focus:border-emerald-500">'
    + '<button type="button" onclick="setTargetKcal()" class="px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-bold">수정</button>'
    + (edited ? '<button type="button" onclick="applyRetarget(null)" class="text-xs underline text-emerald-800">자동 계산으로</button>' : '')
    + '</div></div>'
    + '<div id="target-kcal-msg" class="text-xs text-red-600 mt-2" role="alert"></div>'
    + '</div>'

    + '<div class="text-sm font-bold text-gray-800 mb-2">영양소 목표치</div>'
    + '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">'
    + macro('탄수화물', Math.round(rg.carb[0]) + '–' + Math.round(rg.carb[1]) + ' g', '열량의 50–65%')
    + macro('단백질',   Math.round(rg.protein[0]) + '–' + Math.round(rg.protein[1]) + ' g',
            t.goal === 'gain' ? '체중 1 kg당 1.2 g 이상 · 열량의 20%까지' : '열량의 10–20%')
    + macro('지방',     Math.round(rg.fat[0]) + '–' + Math.round(rg.fat[1]) + ' g', '열량의 15–30%')
    + '</div>'
    + '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">'
    + limit('식이섬유', Math.round(rg.fiber) + ' g 이상')
    + limit('당류', Math.round(rg.sugar) + ' g 미만')
    + limit('포화지방', Math.round(rg.satfat) + ' g 미만')
    + limit('나트륨', rg.sodium.toLocaleString() + ' mg 미만')
    + '</div>';
}

// ── 사이드의 「제품 추천 받기」 요약 ───────────
function renderSidePick(r) {
  const el = document.getElementById('side-pick');
  if (!el) return;
  if (!subCart) initSubCart(r);
  const q = subscriptionQuote(subCartToQuoteInput());
  // 제품마다 왜 추천했는지 한 줄씩 붙입니다
  el.innerHTML = q.lines.map(l =>
    '<div class="text-sm">'
    + '<div class="flex items-center justify-between gap-2">'
    + '<span class="text-white font-semibold truncate">' + l.product.name + '</span>'
    + '<span class="text-white font-bold flex-shrink-0">' + l.qty + '개</span></div>'
    + '<div class="text-xs text-emerald-200 mt-0.5">' + productWhy(l.product) + '</div></div>').join('')
    + '<div class="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-emerald-600">'
    + '<span class="text-emerald-100 text-xs">한 달 예상 금액</span>'
    + '<span class="text-white font-bold">' + won(q.finalPrice) + '</span></div>';
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
  const scored = scoreDietPatterns(r.meals, r.servings, r.profile.gender, r.profile);
  const lacks = dietLacks(scored);
  subRecommendation = recommendSubscription({
    grade: dietGrade(scored),
    bmi: r.body.bmi, age: r.profile.age,
    lacks, goals: selectedGoals, allergies: r.profile.allergies,
  });
  // deficit_based 모드면 부족분 기반 선정 결과로 구성을 바꾼다 (legacy 는 null → 기존 그대로)
  // ponytail: 화면 장바구니는 두유 1종만 담는 구조라 두유가 2종 선정되면 첫 번째로 합쳐짐
  const wl = typeof wellnessRecommend === 'function' ? wellnessRecommend(r, scored) : null;
  if (wl) subRecommendation.wellness = wl;
  const c = wl ? wl.cart : subRecommendation.cart;
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
  renderSidePick(pdiResult);
  renderProductDetail(pdiResult);
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

// ── 매월 배송일 (1~28일 — 달마다 날짜 수가 달라 29~31일은 받지 않습니다) ──
function deliveryDay() {
  const d = Number(tracker && tracker.deliveryDay);
  return d >= 1 && d <= 28 ? d : 5;
}

function setDeliveryDay(v) {
  const d = Number(v);
  if (!(d >= 1 && d <= 28)) return;
  tracker.deliveryDay = d;
  trackerSave();
  onSubCartChanged();
}

// 제품을 왜 추천했는지 — 추천 룰의 사유가 있으면 그것을, 없으면 제품 특징을 씁니다
function productWhy(p) {
  const rec = subRecommendation;
  const hit = rec && rec.reasons.find(x => String(x.code).split('·').includes(p.code));
  if (hit) return hit.why + ' 때문에 추천해요';
  return { soymilk: '나이·체중에 맞춘 기본 두유예요', phyto: '채소·통곡물을 한 포로 채워요',
           bar: '간식을 단백질·식이섬유 간식으로 바꿔요', addon: '함께 고른 건강 목표에 맞춘 제품이에요' }[p.kind] || p.note || '';
}

// ── 추천 구독 제품 상세 ───────────────────────
//  담은 제품마다 사진·특징·드시는 법·영양정보·알레르기를 한 장에 보여줍니다
const PRODUCT_PHOTO = { A: 'static/img/soymilk.jpg', '가': 'static/img/phyto100.jpg' };

function renderProductDetail(r) {
  const el = document.getElementById('product-detail-section');
  if (!el || !r || !subCart) return;
  const q = subscriptionQuote(subCartToQuoteInput());
  const g = typeof guidePlacement === 'function' ? guidePlacement() : null;
  const allergyName = id => (ALLERGENS.find(a => a.id === id) || {}).name || id;
  const kindKey = { soymilk: 'soymilk', phyto: 'phyto', bar: 'bar' };

  const nutRow = (label, v, unit) => v == null ? '' :
    '<div class="flex justify-between py-1.5" style="border-bottom:1px solid var(--line)"><span class="text-gray-500">' + label + '</span>'
    + '<span class="font-semibold text-gray-800">' + v + ' ' + unit + '</span></div>';

  const cards = q.lines.map(l => {
    const p = l.product, n = p.nut || {};
    const key = kindKey[p.kind];
    let how = '';
    if (g && key && g.cov.stock[key] > 0) {
      const slots = g.where[key] || [];
      how = timesPhrase(g.cov.stock[key], g.days) + (slots.length ? ' · ' + slots.join('·') + '에' : '');
    } else if (p.kind === 'addon') {
      how = '하루 1회';
    }
    const url = productUrl(p);
    const photo = PRODUCT_PHOTO[p.code];
    return '<article class="bg-white rounded-3xl p-5 sm:p-6 md:p-8">'
      + '<div class="grid md:grid-cols-5 gap-6">'
      + '<div class="md:col-span-2">'
      + (photo
          ? '<div class="rounded-2xl overflow-hidden mb-4" style="border:1px solid var(--line)"><img src="' + photo + '" alt="' + p.name + '" class="w-full h-48 object-contain bg-white" loading="lazy"></div>'
          : '<div class="rounded-2xl mb-4 h-48 flex items-center justify-center text-5xl" style="background:var(--tint)">' + (p.icon || '') + '</div>')
      + '<div class="text-xs font-bold mb-1" style="color:var(--sage)">' + (CATALOG_KIND_LABEL[p.kind] || '') + ' · ' + p.pack + '</div>'
      + '<h4 class="text-xl font-bold text-gray-900 mb-1">' + p.name + '</h4>'
      + '<div class="text-sm text-gray-600 mb-3">' + (p.note || '') + '</div>'
      + '<div class="text-lg font-bold text-gray-900">' + won(p.price) + ' <span class="text-sm font-normal text-gray-400">× ' + l.qty + '</span></div>'
      + '</div>'
      + '<div class="md:col-span-3 space-y-4">'
      + '<div class="rounded-2xl p-4" style="background:var(--tint)"><div class="text-xs font-bold mb-1" style="color:var(--deep)">이런 분께 추천해요</div>'
      + '<div class="text-sm text-gray-800">' + productWhy(p) + '</div>'
      + (how ? '<div class="text-xs font-bold mt-3 mb-1" style="color:var(--deep)">이렇게 드세요</div><div class="text-sm text-gray-800">' + how + '</div>' : '')
      + '</div>'
      + '<div><div class="text-sm font-bold text-gray-800 mb-1">영양정보 <span class="text-xs font-normal text-gray-400">1회 제공량 ' + (n.weight || '') + (p.kind === 'soymilk' ? ' mL' : ' g') + ' 기준</span></div>'
      + '<div class="text-sm">'
      + nutRow('열량', n.energy, 'kcal') + nutRow('탄수화물', n.carb, 'g') + nutRow('단백질', n.protein, 'g')
      + nutRow('지방', n.fat, 'g') + nutRow('식이섬유', n.fiber, 'g') + nutRow('당류', n.sugar, 'g') + nutRow('나트륨', n.sodium, 'mg')
      + (n.calcium ? nutRow('칼슘', n.calcium, 'mg') : '')
      + '</div></div>'
      + '<div class="text-xs text-gray-500">알레르기 유발물질: '
      + ((p.allergens || []).length ? p.allergens.map(allergyName).join(', ') + ' 함유' : '표시 대상 없음') + '</div>'
      + (url ? '<a href="' + url + '" target="_blank" rel="noopener" class="inline-block text-sm font-semibold underline" style="color:var(--sage)">공식몰에서 자세히 보기 ›</a>' : '')
      + '</div></div></article>';
  }).join('');

  el.innerHTML = cards
    ? '<h3 class="text-xl font-bold text-gray-900 px-1">추천 구독 제품 자세히 보기</h3>' + cards
    : '';
}



// ── 구독 구성 한 줄 ──────────────────────────
// 제품명 · 수량 · 그 줄의 금액을 한 줄에 둡니다.
// 종전에는 왼쪽 카드에 제품, 오른쪽 카드에 같은 제품의 금액을 또 적어 두 번 읽어야 했습니다.
function subRow({ name, meta, qty, kind, amount }) {
  return '<div class="py-3.5" style="border-top:1px solid var(--line)">'
    + '<div class="sm:flex sm:items-center sm:gap-3">'
    + '<div class="min-w-0 sm:flex-1">'
    + '<div class="text-[0.95rem] font-semibold text-gray-900 truncate">' + name + '</div>'
    + '<div class="text-xs text-gray-500 mt-0.5">' + meta + '</div>'
    + '</div>'
    // 좁은 화면에서는 아랫줄로 내려 수량은 왼쪽·금액은 오른쪽에 둡니다
    + '<div class="flex items-center justify-between gap-3 mt-2.5 sm:mt-0 sm:justify-start">'
    + '<div class="inline-flex items-center flex-shrink-0 rounded-full" style="border:1px solid var(--line)">'
    + '<button type="button" class="qty-btn" aria-label="줄이기" onclick="setSubQty(\'' + kind + '\',-1)">−</button>'
    + '<span class="w-7 text-center text-sm font-semibold text-gray-900">' + qty + '</span>'
    + '<button type="button" class="qty-btn" aria-label="늘리기" onclick="setSubQty(\'' + kind + '\',1)">+</button>'
    + '</div>'
    + '<div class="text-right text-sm font-semibold sm:w-[4.5rem] flex-shrink-0 '
    + (qty ? 'text-gray-900' : 'text-gray-300') + '">' + (qty ? won(amount) : '—') + '</div>'
    + '</div></div></div>';
}

function renderSubscription(r) {
  const el = document.getElementById('product-recommendations');
  if (!el) return;
  if (!subCart) initSubCart(r);

  const rec = subRecommendation;
  const allergySet = r.profile.allergies;
  const blocked = p => catalogAllergyHits(p || {}, allergySet).length > 0;
  const soymilks = BOBSNU_CATALOG.filter(p => p.kind === 'soymilk' && !blocked(p));
  const phyto = CATALOG_BY_CODE['가'], bar = CATALOG_BY_CODE['나'];
  const addons = BOBSNU_CATALOG.filter(p => p.kind === 'addon' && !blocked(p));

  // 알레르기 품목은 화면에 아예 띄우지 않고, 장바구니에도 남지 않게 비웁니다
  const avail = { soymilk: soymilks.length > 0, phyto: !blocked(phyto), bar: !blocked(bar) };
  for (const kind of ['soymilk', 'phyto', 'bar']) if (!avail[kind]) subCart[kind] = 0;
  for (const code of [...subCart.addon]) if (blocked(CATALOG_BY_CODE[code])) subCart.addon.delete(code);

  const quote = subscriptionQuote(subCartToQuoteInput());

  // 상세 페이지가 있는 제품에만 「상세」 링크를 답니다 — 설명줄 안에 두어 이름과 다투지 않게 합니다
  const detailLink = p => {
    const u = productUrl(p);
    return u ? '<a href="' + u + '" target="_blank" rel="noopener" class="underline hover:text-emerald-700">상세</a>' : '';
  };
  const meta = (p, kindLabel) => [kindLabel, p.pack, won(p.price), detailLink(p)].filter(Boolean).join(' · ');

  // ── 구성 ──
  const sm = CATALOG_BY_CODE[subCart.soymilkCode];
  const soymilkTitle = '<select onchange="setSoymilkCode(this.value)" aria-label="두유 종류" class="title-select">'
    + soymilks.map(p => '<option value="' + p.code + '"' + (p.code === subCart.soymilkCode ? ' selected' : '') + '>'
        + p.name + '</option>').join('')
    + '</select>';

  const rows =
    (avail.soymilk ? subRow({ name: soymilkTitle, meta: meta(sm, '두유 9종 중에서'), qty: subCart.soymilk,
                              kind: 'soymilk', amount: sm.price * subCart.soymilk }) : '')
    + (avail.phyto ? subRow({ name: phyto.name, meta: meta(phyto, '생식 분말'), qty: subCart.phyto, kind: 'phyto',
                              amount: phyto.price * subCart.phyto }) : '')
    + (avail.bar ? subRow({ name: bar.name, meta: meta(bar, '간식'), qty: subCart.bar, kind: 'bar',
                            amount: bar.price * subCart.bar }) : '');

  // 추가 구성품도 같은 줄 모양으로 — 종전의 알약 버튼은 줄바꿈이 들쭉날쭉했습니다
  const addonRows = addons.map(p => {
    const on = subCart.addon.has(p.code);
    return '<div class="flex items-center gap-3 py-2.5" style="border-top:1px solid var(--line)">'
      + '<button type="button" onclick="toggleAddon(\'' + p.code + '\')" aria-pressed="' + on + '" '
      + 'class="addon-mark flex-shrink-0" style="' + (on ? 'background:var(--sage);border-color:var(--sage);color:#fff' : '') + '">'
      + (on ? '✓' : '') + '</button>'
      + '<div class="flex-1 min-w-0">'
      + '<div class="text-sm ' + (on ? 'font-semibold text-gray-900' : 'text-gray-700') + ' truncate">' + p.name + '</div>'
      + '<div class="text-xs text-gray-500 mt-0.5">' + p.pack + ' · ' + won(p.price) + ' · ' + detailLink(p) + '</div>'
      + '</div></div>';
  }).join('');

  // 담을 수 없는 품목이 든 세트는 보여주지 않습니다
  const presetBtns = SUBSCRIPTION_PRESETS.filter(ps =>
    ['soymilk', 'phyto', 'bar'].every(k => avail[k] || !ps.counts[k])).map(ps => {
    const on = quote.preset && quote.preset.id === ps.id;
    const q = subscriptionQuote({
      soymilk: Array(ps.counts.soymilk).fill(subCart.soymilkCode),
      phyto: Array(ps.counts.phyto).fill('가'), bar: Array(ps.counts.bar).fill('나'), addon: [],
    });
    return '<button type="button" onclick="applyPreset(\'' + ps.id + '\')" class="pick-chip' + (on ? ' on' : '') + '">'
      + ps.title + ' <span class="text-gray-400">' + q.rate + '% ' + won(q.finalPrice) + '</span></button>';
  }).join('');

  // 「이거 더 담으면 얼마 더 깎인다」 — 다른 구독 서비스의 장바구니 안내와 같은 자리
  const hints = discountHints(quote.counts, avail);

  const dd = deliveryDay();
  el.innerHTML =
    ''
    // 부족분 기반 모드: 목표 성분·부족분·제품이 채우는 양 (legacy 는 빈 문자열)
    + (rec.wellness && typeof wellnessWhyHtml === 'function' ? wellnessWhyHtml(rec.wellness) : '')

    + '<div class="grid lg:grid-cols-2 gap-5 lg:gap-8 items-start">'

    // 왼쪽: 언제·무엇을 받는지
    + '<div class="min-w-0">'
    + '<div class="rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3" style="background:var(--tint)">'
    + '<div><div class="text-sm font-bold text-gray-900">배송일 선택</div>'
    + '<div class="text-xs text-gray-500 mt-0.5">매월 배송일자를 지정할 수 있어요</div></div>'
    + '<label class="flex items-center gap-2 text-sm font-semibold text-gray-800">매월 '
    + '<select onchange="setDeliveryDay(this.value)" aria-label="매월 배송일" class="py-2 px-3 rounded-xl border-2 border-gray-200 bg-white focus:border-emerald-500 outline-none">'
    + Array.from({ length: 28 }, (_, i) => i + 1).map(d => '<option value="' + d + '"' + (d === dd ? ' selected' : '') + '>' + d + '</option>').join('')
    + '</select>일</label></div>'
    + '<div class="text-sm font-bold text-gray-900">구독 구성</div>'
    + '<div class="text-xs text-gray-500 mt-0.5 mb-1">한 달에 받을 수량이에요</div>'
    + rows
    + '<div class="text-sm font-bold text-gray-900 mt-6 mb-1">더 담고 싶은 제품</div>'
    + addonRows
    + (rec.excluded.length
      ? '<p class="text-xs text-gray-500 mt-4">알레르기로 뺀 제품: ' + rec.excluded.map(p => p.name).join(', ') + '</p>'
      : '')
    + '<div class="flex flex-wrap gap-1.5 mt-5">' + presetBtns
    + '<button type="button" onclick="resetSubCart()" class="pick-chip">처음 추천으로</button></div>'
    + '</div>'

    // 오른쪽: 얼마인지
    + '<div class="min-w-0 rounded-2xl p-5 lg:sticky lg:top-6" style="border:1px solid var(--line);background:var(--cream)">'
    + '<div class="flex items-baseline justify-between py-1">'
    + '<span class="text-sm text-gray-500">정가</span>'
    + '<span class="text-sm ' + (quote.rate ? 'line-through text-gray-400' : 'font-semibold text-gray-900') + '">'
    + won(quote.listPrice) + '</span></div>'
    + (quote.rate
        ? '<div class="flex items-baseline justify-between py-1">'
          + '<span class="text-sm text-gray-500">구독 할인 ' + quote.rate + '%</span>'
          + '<span class="text-sm font-semibold text-emerald-700">−' + won(quote.discount) + '</span></div>'
          + '<div class="flex items-baseline justify-between pt-4 mt-3" style="border-top:1px solid var(--line)">'
          + '<span class="text-sm font-semibold text-gray-700">월 결제액</span>'
          + '<span class="font-bold" style="font-size:2rem;letter-spacing:-0.03em;color:var(--deep)">'
          + won(quote.finalPrice) + '</span></div>'
          + (quote.perServing
              ? '<div class="text-xs text-gray-500 text-right">한 끼 ' + won(quote.perServing)
                + ' · 한 달 ' + quote.servings + '회분</div>'
              : '')
          + '<div class="text-xs text-gray-600 text-right mt-1">매월 <b>' + dd + '일</b> 배송</div>'
          + '<button type="button" onclick="goPage(\'pay\')" class="w-full mt-5 py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition">'
          + (isPaid() ? '구독 정보 보기' : '이 구성으로 구독 시작하기') + '</button>'
        : '<p class="text-sm text-gray-400 py-6 text-center">담긴 제품이 없어요</p>')
    + (hints.length
        ? '<ul class="mt-4 pt-4 space-y-1.5 text-xs text-gray-600" style="border-top:1px solid var(--line)">'
          + hints.map(h => '<li>' + h + '</li>').join('') + '</ul>'
        : '')
    + '</div>'

    + '</div>'

    // 구독 → 식단 추천 흐름의 연결점 (식단까지 받는 버전에서만 보여준다)
    + (planMode() === 'guide' ? '' :
      '<div class="rounded-2xl p-4" style="border:1px solid ' + (planFresh() ? 'var(--line)' : '#05966666') + ';background:' + (planFresh() ? '#F9FAFB' : '#ECFDF5') + '">'
    + '<div class="flex flex-wrap items-center justify-between gap-3">'
    + '<div class="min-w-0"><div class="text-sm font-bold text-gray-900">'
    + (planFresh() ? '이 구성으로 만든 30일 식단이 아래에 있어요' : '이 구성으로 30일 식단을 받아보세요') + '</div>'
    + '<div class="text-xs text-gray-500 mt-0.5">'
    + (planFresh()
        ? '수량을 바꾸면 그 구성에 맞춰 다시 추천받을 수 있어요'
        : '구독한 제품을 30일에 나눠 넣고, 목표 칼로리와 영양 균형에 맞춘 끼니를 짜드려요')
    + '</div></div>'
    + '<button type="button" onclick="requestMealPlan()" class="flex-shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition '
    + (planFresh() ? 'border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50' : 'bg-emerald-700 text-white hover:bg-emerald-800') + '">'
    + (planFresh() ? '다시 추천받기' : '식단 추천받기') + '</button>'
    + '</div></div>')

    + '';
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

// 「먹은 음식」 입력용 datalist
// 14,715개를 한 번에 넣으면 무거워서, 입력한 글자가 든 이름만 30개 추려 넣습니다.
// 앞쪽에서 맞는 이름·짧은 이름을 먼저 보여줍니다 (「김치」 → 「김치」, 「김치찌개」 …)
function updateFoodList(q) {
  const dl = document.getElementById('plan-food-list');
  if (!dl) return;
  q = (q || '').trim();
  const pool = logFoodNames();
  const names = q
    ? pool.filter(n => n.includes(q))
        .sort((a, b) => a.indexOf(q) - b.indexOf(q) || a.length - b.length).slice(0, 30)
    : pool.slice(0, 200);
  dl.innerHTML = names.map(n => '<option value="' + n.replace(/"/g, '&quot;') + '">').join('');
}

function initPlanFoodList() { updateFoodList(''); }

// 첫 화면 제품 사진 — 파이토100 과 약콩두유를 열 때마다 번갈아 보여줍니다
// fit — 연출 사진은 꽉 채우고(cover), 흰 바탕 제품 사진은 잘리지 않게 둡니다(contain)
const HOME_PHOTOS = [
  { src: 'static/img/phyto100.jpg', alt: '밥스누 파이토100 상자와 채소',   fit: 'object-cover' },
  { src: 'static/img/soymilk.jpg',  alt: '밥스누 오리지널 약콩두유 상자', fit: 'object-contain p-8' },
];

function rotateHomePhoto() {
  const img = document.getElementById('home-photo');
  if (!img) return;
  let n = 0;
  // 기기에 저장이 막혀 있으면(사생활 보호 모드 등) 그냥 첫 사진을 씁니다
  try {
    n = (Number(localStorage.getItem('bobsnu-home-photo')) || 0) + 1;
    localStorage.setItem('bobsnu-home-photo', String(n));
  } catch (e) { n = 0; }
  const photo = HOME_PHOTOS[n % HOME_PHOTOS.length];
  img.src = photo.src;
  img.alt = photo.alt;
  img.className = 'w-full h-full ' + photo.fit;
}

// ── 재시작 ───────────────────────────────────
function restartAssessment() {
  subCart = null;
  tracker.survey = null;
  trackerSave();
  for (const k of Object.keys(surveyAnswers)) delete surveyAnswers[k];
  surveyIndex = 0;
  selectedGoals.clear();
  for (const g of HEALTH_GOALS) if (g.base) selectedGoals.add(g.id);
  pdiResult = null;
  renderSurvey();
  renderHealthGoals();
  goPage('intake');
  goToStep(1);
}
