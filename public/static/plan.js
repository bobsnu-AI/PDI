// ============================================
// 밥스누 체중 관리 플랜
//   설문 PDI · 체중 유형 → 제품 추천(체중 관리자 추천 서비스 표)
//   → 구독 구성·가격 → 30일 식단 → 섭취 기록 · 체중 모니터링
// 의존: recipes.js(INGREDIENTS·RECIPES), pfs.js, app.js(analyzeFood·scaleAnalysis 등)
// ============================================

// ── 제품 카탈로그 ─────────────────────────────
// type: soy(두유) · phyto(파이토100) · bar(프로틴바) · addon(건강 목적 추가 구성)
// food: 영양·파이토케미컬 계산에 사용하는 INGREDIENTS 항목 (1회 섭취분)
const SHOP_PRODUCTS = {
  A:  { name: '오리지널 약콩 두유',            pack: '24입', units: 24, price: 27000, type: 'soy',   food: '약콩두유' },
  B:  { name: '쌀눈으로 더 똑똑한 약콩100',    pack: '24입', units: 24, price: 27000, type: 'soy',   food: '약콩두유' },
  C:  { name: '배로 맛있는 약콩100 고단백',    pack: '24입', units: 24, price: 27000, type: 'soy',   food: '약콩두유' },
  D:  { name: '포스트바이오틱스 약콩100',      pack: '24입', units: 24, price: 27000, type: 'soy',   food: '약콩두유' },
  E:  { name: '칼마디 약콩100',                pack: '24입', units: 24, price: 27000, type: 'soy',   food: '약콩두유' },
  F:  { name: '껍질째 약콩100',                pack: '24입', units: 24, price: 27000, type: 'soy',   food: '약콩두유' },
  G:  { name: '더 진한 약콩100',               pack: '15입', units: 15, price: 37500, type: 'soy',   food: '약콩두유' },
  H:  { name: '더 건강한 약콩100',             pack: '15입', units: 15, price: 37500, type: 'soy',   food: '약콩두유' },
  I:  { name: '더 건강한 약콩100 슈퍼그린',    pack: '15입', units: 15, price: 37500, type: 'soy',   food: '약콩두유' },
  '가': { name: '밥스누 파이토100',            pack: '14포', units: 14, price: 42000, type: 'phyto', food: '파이토100' },
  '나': { name: '약콩 프로틴바',               pack: '10입', units: 10, price: 20000, type: 'bar',   food: '약콩 프로틴바' },
  '1': { name: '더 건강한 약콩차',             price: 38400, type: 'addon', goal: 'blood_sugar' },
  '2': { name: '뼈건강 칼마디케이',            price: 40000, type: 'addon', goal: 'bone' },
  '3': { name: '혈압혈당 바나바Q10',           price: 40000, type: 'addon', goal: 'blood_sugar' },
  '4': { name: '에너지 마그네슘B',             price: 40000, type: 'addon', goal: 'fatigue' },
};
const SOY_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const ADDON_CODES = ['1', '2', '3', '4'];

// ── 구독 가격 규칙 ────────────────────────────
// 두유·파이토100·프로틴바 수량이 세트 구성과 같으면 세트가, 그 외에는 구독 제품 종류 수로 할인율 적용
const SUBSCRIPTION_PRESETS = [
  { id: 'full',  soy: 2, phyto: 2, bar: 3, price: 138000, rate: 20 },
  { id: 'basic', soy: 1, phyto: 1, bar: 2, price: 69000,  rate: 15 },
];
const KIND_DISCOUNT = { 1: 5, 2: 10, 3: 10 };   // 제품 1종 5%, 2종 이상 10%
const ADDON_DISCOUNT = 5;                        // 추가 구성 제품은 1개 구독 할인 적용

// ── 체중 관리자 추천 서비스 표 ───────────────────
// 행: 연령대 × 설문 PDI 구간 × 체중 유형
//   wg  : 통곡물 섭취 부족 시 추천 (채소도 부족하면 이 열 우선)  · 가=파이토100, 나=프로틴바
//   veg : 채소 섭취 부족 시 추천
//   soy : 추천 두유
const RECO_TABLE = {
  // PDI 20% 미만
  'teen|0|normal': { wg: ['나'], veg: ['가'], soy: 'B' },        'teen|0|over': { wg: ['가', '나'], veg: ['가', '나'], soy: 'B' },
  '2030|0|normal': { wg: ['나'], veg: ['가'], soy: 'C' },        '2030|0|over': { wg: ['가', '나'], veg: ['가', '나'], soy: 'C' },
  '40|0|normal':   { wg: ['나'], veg: ['가'], soy: 'E' },        '40|0|over':   { wg: ['가', '나'], veg: ['가', '나'], soy: 'I' },
  '50|0|normal':   { wg: ['나'], veg: ['가'], soy: 'H' },        '50|0|over':   { wg: ['가', '나'], veg: ['가', '나'], soy: 'I' },
  // PDI 20–30%
  'teen|1|normal': { wg: ['나'], veg: ['가'], soy: 'C' },        'teen|1|over': { wg: ['가', '나'], veg: ['가', '나'], soy: 'C' },
  '2030|1|normal': { wg: ['나'], veg: ['가'], soy: 'C' },        '2030|1|over': { wg: ['가', '나'], veg: ['가', '나'], soy: 'I' },
  '40|1|normal':   { wg: ['나'], veg: ['가'], soy: 'E' },        '40|1|over':   { wg: ['가', '나'], veg: ['가', '나'], soy: 'I' },
  '50|1|normal':   { wg: ['나'], veg: ['가'], soy: 'H' },        '50|1|over':   { wg: ['가', '나'], veg: ['가', '나'], soy: 'I' },
  // PDI 30–40%
  'teen|2|normal': { wg: ['나'], veg: ['가'], soy: 'C' },        'teen|2|over': { wg: ['나'], veg: ['가'], soy: 'D' },
  '2030|2|normal': { wg: ['나'], veg: ['가'], soy: 'C' },        '2030|2|over': { wg: ['나'], veg: ['가'], soy: 'D' },
  '40|2|normal':   { wg: ['나'], veg: ['가'], soy: 'E' },        '40|2|over':   { wg: ['가'], veg: ['가'], soy: 'E' },
  '50|2|normal':   { wg: ['나'], veg: ['가'], soy: 'H' },        '50|2|over':   { wg: ['가'], veg: ['가'], soy: 'H' },
  // PDI 40% 이상
  'teen|3|normal': { wg: [], veg: [], soy: 'C' },                'teen|3|over': { wg: ['나'], veg: ['가'], soy: 'D' },
  '2030|3|normal': { wg: [], veg: [], soy: 'C' },                '2030|3|over': { wg: ['나'], veg: ['가'], soy: 'D' },
  '40|3|normal':   { wg: [], veg: [], soy: 'E' },                '40|3|over':   { wg: ['나'], veg: ['가'], soy: 'E' },
  '50|3|normal':   { wg: [], veg: [], soy: 'H' },                '50|3|over':   { wg: ['나'], veg: ['가'], soy: 'H' },
};
const AGE_GROUPS = { teen: '10대', '2030': '20·30대', '40': '40대', '50': '50대 이상' };
const PDI_BANDS = ['20% 미만', '20–30%', '30–40%', '40% 이상'];
// 대체·추가 구성 (연령대별)
const SOY_SUBSTITUTE = {
  calcium: { teen: 'E', '2030': 'E', '40': 'H', '50': 'H' },   // 칼슘 부족 시
  protein: 'C',                                                // 단백질 부족 시
  gut:     'D',                                                // 장 건강 목표 시
};
const GOAL_ADDON = {
  blood_sugar: { teen: '1', '2030': '1', '40': '3', '50': '3' },
  bone:        '2',
  fatigue:     '4',
};

function ageGroup(age) {
  if (age < 20) return 'teen';
  if (age < 40) return '2030';
  if (age < 50) return '40';
  return '50';
}
function pdiBand(pdi) {
  return pdi < 20 ? 0 : pdi < 30 ? 1 : pdi < 40 ? 2 : 3;
}
// 체중 유형: BMI 23 이상 → 과체중 이상 (대한비만학회 성인 기준)
function bodyType(profile) {
  const bmi = profile.weight / ((profile.height / 100) ** 2);
  return { bmi, type: bmi >= 23 ? 'over' : 'normal', label: bmi >= 23 ? '과체중 이상' : '정상' };
}

// ── 권장 영양 섭취량 (KDRI 2020) ────────────────
// [최대 연령, 남, 여]
const KDRI_PROTEIN = [[11, 50, 45], [14, 60, 55], [18, 65, 55], [29, 65, 55], [49, 65, 50], [64, 60, 50], [200, 60, 50]];
const KDRI_CALCIUM = [[11, 800, 750], [14, 1000, 900], [18, 900, 800], [49, 800, 700], [64, 750, 800], [200, 700, 800]];
const KDRI_FIBER   = [[11, 25, 20], [18, 30, 25], [64, 30, 20], [200, 25, 20]];
function kdriLookup(table, age, gender) {
  const row = table.find(r => age <= r[0]) || table[table.length - 1];
  return gender === 'male' ? row[1] : row[2];
}

// 목표 칼로리: 정상 = EER, 과체중 이상 = EER − 500 (최소 남 1,500 · 여 1,200)
function nutritionTargets(profile) {
  const eer = calculateEER(profile);
  const body = bodyType(profile);
  const floor = profile.gender === 'male' ? 1500 : 1200;
  const kcal = body.type === 'over' ? Math.max(floor, eer - 500) : eer;
  return {
    eer, kcal, body,
    carb:    [kcal * 0.55 / 4, kcal * 0.65 / 4],
    protein: kdriLookup(KDRI_PROTEIN, profile.age, profile.gender),
    fat:     [kcal * 0.15 / 9, kcal * 0.30 / 9],
    fiber:   kdriLookup(KDRI_FIBER, profile.age, profile.gender),
    calcium: kdriLookup(KDRI_CALCIUM, profile.age, profile.gender),
    sodium:  2300,
    sugar:   kcal * 0.10 / 4,
  };
}

// ── 설문 기반 진단 ────────────────────────────
// 통곡물 부족: 흰쌀밥 위주 · 채소 부족: 하루 2접시 이하 · 칼슘 부족: 유제품 거의 안 먹음
// 단백질 부족: 설문 예측 식단의 단백질 < 권장섭취량
function diagnose(profile, survey, surveyPDI, surveyProtein, goals) {
  const targets = nutritionTargets(profile);
  const age = ageGroup(profile.age);
  const band = pdiBand(surveyPDI);
  const row = RECO_TABLE[age + '|' + band + '|' + targets.body.type];
  const lacks = {
    wholeGrain: survey.rice === 'white',
    veg:        survey.veg <= 2,
    calcium:    survey.dairy === 0,
    protein:    surveyProtein < targets.protein,
  };

  // 파이토100·프로틴바: 통곡물 부족 열 우선, 아니면 채소 부족 열
  const items = lacks.wholeGrain ? row.wg : (lacks.veg ? row.veg : []);
  const basis = lacks.wholeGrain ? '통곡물 섭취 부족' : (lacks.veg ? '채소 섭취 부족' : null);

  // 두유: 장 건강 목표 > 칼슘 부족 > 단백질 부족 > 표 기본값
  let soy = row.soy, soyReason = '연령·PDI·체중 유형 기준 추천';
  if (goals.has('gut'))      { soy = SOY_SUBSTITUTE.gut;          soyReason = '장 건강 목표 → 포스트바이오틱스'; }
  else if (lacks.calcium)    { soy = SOY_SUBSTITUTE.calcium[age]; soyReason = '칼슘 부족 → 대체 추천'; }
  else if (lacks.protein)    { soy = SOY_SUBSTITUTE.protein;      soyReason = '단백질 부족 → 고단백 대체 추천'; }

  const addons = [];
  if (goals.has('blood_sugar')) addons.push(GOAL_ADDON.blood_sugar[age]);
  if (goals.has('bone'))        addons.push(GOAL_ADDON.bone);
  if (goals.has('fatigue'))     addons.push(GOAL_ADDON.fatigue);

  return {
    targets, age, band, lacks,
    reco: { phyto: items.includes('가'), bar: items.includes('나'), basis, soy, soyReason, addons },
  };
}

// 추천 → 기본 구독 수량
function defaultSubscription(dx, allergies) {
  const soyOk = !allergies.has('soy');
  let q;
  if (dx.reco.phyto && dx.reco.bar)      q = { soy: 2, phyto: 2, bar: 3 };
  else if (dx.reco.phyto || dx.reco.bar) q = { soy: 1, phyto: dx.reco.phyto ? 1 : 0, bar: dx.reco.bar ? 2 : 0 };
  else                                   q = { soy: 1, phyto: 0, bar: 0 };
  if (!soyOk) { q.soy = 0; q.bar = 0; }   // 약콩 원료 제품 제외
  return { ...q, soyCode: dx.reco.soy, addons: dx.reco.addons.slice() };
}

// ── 가격 계산 ────────────────────────────────
function round100(x) { return Math.round(x / 100) * 100; }
function priceSubscription(sub) {
  const soyP = SHOP_PRODUCTS[sub.soyCode] || SHOP_PRODUCTS.A;
  const lines = [
    { code: sub.soyCode, qty: sub.soy,   unit: soyP.price },
    { code: '가',         qty: sub.phyto, unit: SHOP_PRODUCTS['가'].price },
    { code: '나',         qty: sub.bar,   unit: SHOP_PRODUCTS['나'].price },
  ].filter(l => l.qty > 0);
  const coreList = lines.reduce((s, l) => s + l.qty * l.unit, 0);
  const preset = SUBSCRIPTION_PRESETS.find(p => p.soy === sub.soy && p.phyto === sub.phyto && p.bar === sub.bar);
  let corePrice, coreRate;
  if (preset) { corePrice = preset.price; coreRate = preset.rate; }
  else {
    coreRate = KIND_DISCOUNT[lines.length] || 0;
    corePrice = round100(coreList * (1 - coreRate / 100));
  }
  const addonLines = sub.addons.map(code => ({
    code, list: SHOP_PRODUCTS[code].price, price: round100(SHOP_PRODUCTS[code].price * (1 - ADDON_DISCOUNT / 100)),
  }));
  const addonPrice = addonLines.reduce((s, a) => s + a.price, 0);
  return {
    lines, coreList, corePrice, coreRate, preset,
    addonLines, addonPrice,
    total: corePrice + addonPrice,
  };
}

// ══════════════════════════════════════════════
// 30일 식단 생성
// ══════════════════════════════════════════════
// 일반 식사 = 밥 + 국 + 메인반찬 1 + 김치 + 부수반찬 1
// 레시피 DB의 잡곡밥류는 대부분 백미 위주라, 통곡물 비율을 높인 현미 기반 밥을 식재료 조합으로 정의 (1공기 90g 생쌀 기준)
const PLAN_CUSTOM_DISHES = {
  '현미잡곡밥': { '현미': 50, '수수': 10, '차조(생것)': 10, '팥(말린것)': 10, '백미': 10 },
  '현미보리밥': { '현미': 60, '보리': 30 },
  '현미흑미밥': { '현미': 70, '흑미': 20 },
  '귀리현미밥': { '현미': 60, '귀리': 30 },
  '현미콩밥':   { '현미': 75, '검정콩': 15 },
};
const PLAN_POOLS = {
  rice:  ['현미밥', '현미잡곡밥', '현미보리밥', '현미흑미밥', '귀리현미밥', '현미콩밥'],
  soup:  ['된장국', '미역국', '콩나물국', '시금치된장국', '무국', '배추된장국', '두부된장국', '근대된장국', '애호박된장국', '시래기된장국', '오이냉국', '미역냉국', '황태국', '북엇국'],
  main:  ['고등어구이', '두부조림', '닭가슴살구이', '계란말이', '연어구이', '삼치구이', '두부부침', '갈치구이', '꽁치구이', '임연수구이', '버섯불고기', '코다리조림', '고등어조림', '달걀찜', '쭈꾸미볶음', '낙지볶음', '새우볶음', '닭갈비', '두부김치', '제육볶음', '오징어볶음', '닭볶음탕'],
  kimchi:['배추김치', '깍두기', '열무김치', '나박김치', '백김치', '오이소박이', '총각김치'],
  side:  ['시금치나물', '콩나물무침', '숙주나물', '오이무침', '무생채', '가지나물', '브로콜리무침', '도라지무침', '고사리나물', '애호박볶음', '버섯볶음', '취나물', '참나물무침', '상추겉절이', '느타리버섯볶음', '비름나물', '깻잎나물', '미나리무침', '연근조림', '우엉조림'],
  fruit: ['사과', '바나나', '귤', '키위', '딸기', '배', '블루베리(생것)', '방울토마토'],
};
const PLAN_DAYS = 30;
const PLAN_RICE_RANGE = [0.5, 2];   // 밥 양 조절 범위 (공기)

// 식단 음식 분석 (식단 전용 조합 → 레시피 → 단품 순)
const planDishCache = {};
function analyzePlanFood(name) {
  if (PLAN_CUSTOM_DISHES[name]) {
    return planDishCache[name] || (planDishCache[name] = buildCustomAnalysis(name, PLAN_CUSTOM_DISHES[name]));
  }
  return analyzeFood(name);
}
const PLAN_SLOT_WEIGHT = { breakfast: 3, lunch: 4, dinner: 3 };
const KIND_LABEL = { rice: '밥', soup: '국', main: '메인', kimchi: '김치', side: '부수', fruit: '과일', product: '밥스누' };

// 시드 고정 난수 (같은 시드 → 같은 식단)
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 알레르기 식품을 뺀 음식 풀 (전부 빠지면 원래 풀 사용)
function safePool(names, allergies) {
  const ok = names.filter(n => {
    const a = analyzePlanFood(n);
    return a && !findAllergens(n, a, allergies).length;
  });
  return ok.length ? ok : names.filter(n => analyzePlanFood(n));
}

// count개를 n칸에 고르게 배치 → 배치된 칸 인덱스 목록
function spreadIndices(count, n) {
  const out = [];
  for (let i = 0; i < n && out.length < count; i++) {
    if (Math.floor((i + 1) * count / n) > Math.floor(i * count / n)) out.push(i);
  }
  return out;
}

function itemKcal(item) {
  const a = analyzePlanFood(item.food || item.name);
  return a ? a.totalCal * item.portion : 0;
}

// 제품 식사 구성: 파이토 식사(두유+파이토100) / 프로틴바 식사(두유+프로틴바+과일)
function productMealItems(type, withSoy, soyCode, fruit) {
  const items = [];
  if (withSoy) items.push({ kind: 'product', code: soyCode, name: SHOP_PRODUCTS[soyCode].name, food: '약콩두유', portion: 1 });
  if (type === 'phyto') {
    items.push({ kind: 'product', code: '가', name: '밥스누 파이토100', food: '파이토100', portion: 1 });
    if (!withSoy) items.push({ kind: 'fruit', name: fruit, portion: 1 });
  } else {
    items.push({ kind: 'product', code: '나', name: '약콩 프로틴바', food: '약콩 프로틴바', portion: 1 });
    items.push({ kind: 'fruit', name: fruit, portion: 1 });
  }
  return items;
}

// ──────────────────────────────────────────────
// generatePlan({ targetKcal, allergies, sub, seed, fromDay, prevDays })
//   fromDay 이전 날짜는 prevDays 를 그대로 유지 (목표 변경 시 남은 기간만 재계산)
// 반환: [{ day, meals: { breakfast|lunch|dinner|snack: { type, items:[{kind,name,food,code,portion}] } } }]
// ──────────────────────────────────────────────
function generatePlan(opts) {
  const { targetKcal, allergies, sub, seed } = opts;
  const fromDay = opts.fromDay || 0;
  const rnd = mulberry32(seed);
  const pools = Object.fromEntries(Object.entries(PLAN_POOLS).map(([k, v]) => [k, safePool(v, allergies)]));
  const pick = (list, recent) => {
    const fresh = list.filter(n => !recent.includes(n));
    const from = fresh.length ? fresh : list;
    return from[Math.floor(rnd() * from.length)];
  };

  // 30일 동안의 제품 섭취 횟수 (구독 박스 × 입수)
  const soyCode = sub.soyCode;
  const soyP = SHOP_PRODUCTS[soyCode] || SHOP_PRODUCTS.A;
  const soyN   = sub.soy * soyP.units;
  const phytoN = sub.phyto * SHOP_PRODUCTS['가'].units;
  const barN   = sub.bar * SHOP_PRODUCTS['나'].units;

  // 대체 끼니는 하루 한 끼(저녁). 파이토·프로틴바 식사를 구독 비율대로 나눠 고르게 배치
  const mealCount = Math.min(PLAN_DAYS, phytoN + barN);
  const phytoMeals = phytoN + barN ? Math.round(mealCount * phytoN / (phytoN + barN)) : 0;
  const barMeals = mealCount - phytoMeals;
  const phytoAt = new Set(spreadIndices(phytoMeals, mealCount));
  const dinnerDays = spreadIndices(mealCount, PLAN_DAYS);
  let soyLeft = soyN;
  const productAt = {};
  dinnerDays.forEach((d, i) => {
    const withSoy = soyLeft > 0;
    if (withSoy) soyLeft--;
    productAt[d] = { type: phytoAt.has(i) ? 'phyto' : 'bar', withSoy };
  });
  // 남는 두유·파이토100·프로틴바 → 간식으로 고르게
  const snackSets = {
    soy:   new Set(spreadIndices(Math.min(PLAN_DAYS, soyLeft), PLAN_DAYS)),
    phyto: new Set(spreadIndices(Math.min(PLAN_DAYS, phytoN - phytoMeals), PLAN_DAYS)),
    bar:   new Set(spreadIndices(Math.min(PLAN_DAYS, barN - barMeals), PLAN_DAYS)),
  };
  const snackItem = {
    soy:   () => ({ kind: 'product', code: soyCode, name: soyP.name, food: '약콩두유', portion: 1 }),
    phyto: () => ({ kind: 'product', code: '가', name: '밥스누 파이토100', food: '파이토100', portion: 1 }),
    bar:   () => ({ kind: 'product', code: '나', name: '약콩 프로틴바', food: '약콩 프로틴바', portion: 1 }),
  };

  const recent = { main: [], side: [], soup: [], rice: [], kimchi: [] };
  const remember = (k, n, keep) => { recent[k].push(n); if (recent[k].length > keep) recent[k].shift(); };
  let fruitIdx = Math.floor(rnd() * pools.fruit.length);

  const days = [];
  for (let d = 0; d < PLAN_DAYS; d++) {
    // 이미 지난 날은 기존 식단 유지 (난수 소비는 동일하게 유지하지 않아도 무방)
    const meals = {};
    let fixedKcal = 0;

    const p = productAt[d];
    if (p) {
      const fruit = pools.fruit[fruitIdx++ % pools.fruit.length];
      meals.dinner = { type: 'product', productType: p.type, items: productMealItems(p.type, p.withSoy, soyCode, fruit) };
      fixedKcal += meals.dinner.items.reduce((s, it) => s + itemKcal(it), 0);
    }
    const snack = ['soy', 'phyto', 'bar'].filter(k => snackSets[k].has(d)).map(k => snackItem[k]());
    if (snack.length) {
      meals.snack = { type: 'snack', items: snack };
      fixedKcal += snack.reduce((s, it) => s + itemKcal(it), 0);
    }
    if (sub.addons.length) {
      meals.addons = sub.addons.map(code => SHOP_PRODUCTS[code].name);
    }

    // 일반 식사: 남은 칼로리를 끼니 가중치로 나눈 뒤 밥 양으로 맞춤
    const regular = ['breakfast', 'lunch', 'dinner'].filter(s => !meals[s]);
    const weightSum = regular.reduce((s, k) => s + PLAN_SLOT_WEIGHT[k], 0);
    const budgetTotal = Math.max(0, targetKcal - fixedKcal);
    for (const slot of regular) {
      const rice = pick(pools.rice, recent.rice);       remember('rice', rice, 2);
      const soup = pick(pools.soup, recent.soup);       remember('soup', soup, 4);
      const main = pick(pools.main, recent.main);       remember('main', main, 6);
      const kimchi = pick(pools.kimchi, recent.kimchi); remember('kimchi', kimchi, 2);
      const side = pick(pools.side, recent.side);       remember('side', side, 6);
      const items = [
        { kind: 'rice', name: rice, portion: 1 },
        { kind: 'soup', name: soup, portion: 1 },
        { kind: 'main', name: main, portion: 1 },
        { kind: 'kimchi', name: kimchi, portion: 1 },
        { kind: 'side', name: side, portion: 1 },
      ];
      const budget = budgetTotal * PLAN_SLOT_WEIGHT[slot] / weightSum;
      const others = items.slice(1).reduce((s, it) => s + itemKcal(it), 0);
      const riceKcal = itemKcal(items[0]) || 1;
      items[0].portion = Math.min(PLAN_RICE_RANGE[1], Math.max(PLAN_RICE_RANGE[0], Math.round((budget - others) / riceKcal * 4) / 4));
      meals[slot] = { type: 'regular', items };
    }

    days.push(d < fromDay && opts.prevDays && opts.prevDays[d] ? opts.prevDays[d] : { day: d, meals });
  }
  return days;
}

// ── 식사·하루 분석 ────────────────────────────
// 식사 항목 → 분석 객체 목록 (PDI·영양 계산용)
function mealEntries(items, slot) {
  return items.map(it => {
    const a = analyzePlanFood(it.food || it.name);
    return a ? { name: it.name, meal: slot, portion: it.portion, analysis: scaleAnalysis(a, it.portion) } : null;
  }).filter(Boolean);
}

// 하루 계획(또는 실제 섭취) 영양 요약
function summarizeEntries(entries) {
  if (!entries.length) return { kcal: 0, pdi: 0, protein: 0, fiber: 0, sodium: 0 };
  const r = calculatePDI(entries);
  const n = entries.reduce((acc, e) => {
    const x = estimateDishNutrients(e.analysis);
    for (const k of PFS_NUTRIENT_KEYS) acc[k] = (acc[k] || 0) + x[k];
    return acc;
  }, {});
  return { kcal: r.totalCalories, pdi: r.pdiScore, protein: n.protein, fiber: n.fiber, sodium: n.sodium };
}

function planDayEntries(day) {
  const out = [];
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    const m = day.meals[slot];
    if (m) out.push(...mealEntries(m.items, slot));
  }
  return out;
}

// 실제 섭취: '먹었음'이면 계획대로, '다르게 먹음'이면 입력한 음식, '안 먹음'이면 제외
function actualDayEntries(day, rec) {
  const out = [];
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    const r = rec && rec[slot];
    const planned = day.meals[slot];
    if (!r) continue;
    if (r.status === 'ate' && planned) out.push(...mealEntries(planned.items, slot));
    if (r.status === 'changed') out.push(...mealEntries(r.foods.map(f => ({ name: f.name, portion: f.portion })), slot));
  }
  return out;
}

function planAverages(days) {
  const sums = { kcal: 0, pdi: 0, protein: 0, fiber: 0, sodium: 0 };
  for (const d of days) {
    const s = summarizeEntries(planDayEntries(d));
    for (const k in sums) sums[k] += s[k];
  }
  for (const k in sums) sums[k] /= days.length || 1;
  return sums;
}

// 체중 추세 (최근 2회 기록)
function weightTrendFromLog(weights) {
  if (weights.length < 2) return 'maintenance';
  const [prev, last] = weights.slice(-2);
  return determineWeightTrend(last.kg, prev.kg);
}

// ══════════════════════════════════════════════
// 상태 · 저장 (브라우저 localStorage)
// ══════════════════════════════════════════════
const PLAN_STORE_KEY = 'bobsnu-plan-v1';
const planState = {
  sub: null,        // { soy, phyto, bar, soyCode, addons:[] }
  dx: null,         // diagnose() 결과
  plan: null,       // { start:'YYYY-MM-DD', seed, targetKcal, days:[...] }
  records: {},      // { dayIdx: { slot: { status:'ate'|'changed'|'skipped', foods:[{name,portion}] } } }
  weights: [],      // [{ date:'YYYY-MM-DD', kg }]
  viewDay: 0,
  editSlot: null,   // '다르게 먹었어요' 입력 중인 끼니
  notice: null,     // 체중 변경 후 목표 변경 안내
};
let weightChart = null;

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d;
}
function dayIndexOf(dateStr) {
  if (!planState.plan) return 0;
  const diff = Math.round((new Date(dateStr + 'T00:00:00') - new Date(planState.plan.start + 'T00:00:00')) / 86400000);
  return diff;
}
function todayIndex() {
  return Math.min(PLAN_DAYS - 1, Math.max(0, dayIndexOf(todayStr())));
}

function savePlanState() {
  try {
    const p = readProfile();
    localStorage.setItem(PLAN_STORE_KEY, JSON.stringify({
      profile: { ...p, allergies: [...p.allergies] },
      survey: { ...surveyAnswers },
      goals: [...selectedGoals],
      sub: planState.sub, plan: planState.plan, records: planState.records, weights: planState.weights,
    }));
  } catch (e) { /* 저장 불가 환경(시크릿 모드 등)에서는 무시 */ }
}
function loadPlanState() {
  try { return JSON.parse(localStorage.getItem(PLAN_STORE_KEY)); } catch (e) { return null; }
}
function clearPlanStorage() {
  try { localStorage.removeItem(PLAN_STORE_KEY); } catch (e) { /* 무시 */ }
  Object.assign(planState, { sub: null, dx: null, plan: null, records: {}, weights: [], viewDay: 0, editSlot: null, notice: null });
  const banner = document.getElementById('resume-banner');
  if (banner) banner.classList.add('hidden');
}

// 체중 기록의 직전 값 (PFS 체중 추세용)
function planPrevWeight() {
  return planState.weights.length >= 2 ? planState.weights[planState.weights.length - 2].kg : null;
}

// 저장된 입력값을 화면에 복원
function restoreInputs(saved) {
  const p = saved.profile;
  setGender(p.gender);
  const set = (id, v) => { const el = document.getElementById(id); if (el && v !== null && v !== undefined) el.value = v; };
  set('profile-age', p.age); set('profile-height', p.height); set('profile-weight', p.weight);
  set('profile-waist', p.waist); set('profile-activity', p.activity);
  selectedAllergies.clear(); (p.allergies || []).forEach(a => selectedAllergies.add(a));
  Object.assign(surveyAnswers, saved.survey || {});
  selectedGoals.clear(); (saved.goals || ['weight']).forEach(g => selectedGoals.add(g));
  renderAllergyChips(); renderSurvey(); renderHealthGoals(); updateProfilePreview();
}

function initPlanApp() {
  const saved = loadPlanState();
  if (saved && saved.plan) {
    const banner = document.getElementById('resume-banner');
    if (banner) {
      banner.classList.remove('hidden');
      document.getElementById('resume-info').textContent =
        saved.plan.start.replace(/-/g, '.') + ' 시작 · ' + Object.keys(saved.records || {}).length + '일 기록';
    }
  }
}

// 저장된 식단 이어보기
function resumePlan() {
  const saved = loadPlanState();
  if (!saved || !saved.plan) return;
  restoreInputs(saved);
  Object.assign(planState, { sub: saved.sub, plan: saved.plan, records: saved.records || {}, weights: saved.weights || [] });
  planState.viewDay = todayIndex();
  // 진단 결과 재계산 (구독 구성 변경 화면에서 사용)
  const keepSub = planState.sub;
  calculateAndShow();
  planState.sub = keepSub;
  goToStep(5);
  renderPlan();
}

// ══════════════════════════════════════════════
// STEP 4 · 진단 & 구독 구성
// ══════════════════════════════════════════════
function startSubscription(r) {
  planState.dx = r.dx;
  if (!planState.sub) planState.sub = defaultSubscription(r.dx, r.profile.allergies);
}

function won(n) { return Math.round(n).toLocaleString() + '원'; }

function renderDiagnosis(r) {
  const el = document.getElementById('diagnosis-section');
  if (!el) return;
  const dx = r.dx, t = dx.targets;
  const chip = (on, label) => '<span class="text-xs px-2.5 py-1 rounded-full font-bold '
    + (on ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700') + '">' + label + (on ? ' 부족' : ' 양호') + '</span>';
  const recoNames = [dx.reco.phyto && '파이토100', dx.reco.bar && '프로틴바'].filter(Boolean);
  const row = (k, v, note) => '<tr class="border-b border-gray-100 last:border-0"><td class="py-1.5 pr-3 text-gray-600">' + k + '</td><td class="py-1.5 pr-3 font-bold text-gray-900 text-right whitespace-nowrap">' + v + '</td><td class="py-1.5 text-xs text-gray-400">' + (note || '') + '</td></tr>';

  el.innerHTML =
    '<h3 class="text-xl font-bold text-gray-900 mb-4">🩺 나의 진단</h3>'
    + '<div class="grid md:grid-cols-3 gap-3 mb-5">'
    + '<div class="bg-gray-50 rounded-2xl p-4"><div class="text-xs font-bold text-gray-500 mb-1">체중 유형</div>'
    + '<div class="text-2xl font-black ' + (t.body.type === 'over' ? 'text-orange-600' : 'text-emerald-700') + '">' + t.body.label + '</div>'
    + '<div class="text-xs text-gray-400 mt-1">BMI ' + t.body.bmi.toFixed(1) + ' · ' + AGE_GROUPS[dx.age] + '</div></div>'
    + '<div class="bg-gray-50 rounded-2xl p-4"><div class="text-xs font-bold text-gray-500 mb-1">PDI 기준치 (설문)</div>'
    + '<div class="text-2xl font-black" style="color:' + r.gradeColor + '">' + r.pdiScore.toFixed(1) + '%</div>'
    + '<div class="text-xs text-gray-400 mt-1">' + PDI_BANDS[dx.band] + ' 구간 · 식단 목표 40% 이상</div></div>'
    + '<div class="bg-gray-50 rounded-2xl p-4"><div class="text-xs font-bold text-gray-500 mb-1">목표 칼로리</div>'
    + '<div class="text-2xl font-black text-gray-900">' + t.kcal.toLocaleString() + '<span class="text-sm font-medium text-gray-400"> kcal/일</span></div>'
    + '<div class="text-xs text-gray-400 mt-1">' + (t.kcal !== t.eer ? '유지 칼로리 ' + t.eer.toLocaleString() + ' − 감량 500' : '유지 칼로리 (KDRI 2020)') + '</div></div>'
    + '</div>'
    + '<div class="flex flex-wrap gap-2 mb-5">'
    + chip(dx.lacks.wholeGrain, '통곡물') + chip(dx.lacks.veg, '채소') + chip(dx.lacks.calcium, '칼슘') + chip(dx.lacks.protein, '단백질')
    + '</div>'
    + '<div class="grid md:grid-cols-2 gap-4">'
    + '<div class="rounded-2xl border border-gray-100 p-4"><div class="text-sm font-bold text-gray-800 mb-2">📏 하루 권장 영양 섭취량</div>'
    + '<table class="w-full text-sm"><tbody>'
    + row('에너지', t.kcal.toLocaleString() + ' kcal', '목표')
    + row('탄수화물', Math.round(t.carb[0]) + '–' + Math.round(t.carb[1]) + ' g', '에너지 55–65%')
    + row('단백질', t.protein + ' g', '권장섭취량')
    + row('지방', Math.round(t.fat[0]) + '–' + Math.round(t.fat[1]) + ' g', '에너지 15–30%')
    + row('식이섬유', t.fiber + ' g', '충분섭취량')
    + row('칼슘', t.calcium + ' mg', '권장섭취량')
    + row('당류', Math.round(t.sugar) + ' g 미만', '에너지 10%')
    + row('나트륨', '2,300 mg 미만', '만성질환위험감소')
    + '</tbody></table><p class="text-xs text-gray-400 mt-2">출처: 2020 한국인 영양소 섭취기준</p></div>'
    + '<div class="rounded-2xl border border-gray-100 p-4"><div class="text-sm font-bold text-gray-800 mb-2">🧾 추천 근거 <span class="font-normal text-gray-400 text-xs">체중 관리자 추천 서비스</span></div>'
    + '<ul class="text-sm text-gray-700 space-y-1.5">'
    + '<li>· <b>' + AGE_GROUPS[dx.age] + '</b> · PDI <b>' + PDI_BANDS[dx.band] + '</b> · <b>' + t.body.label + '</b></li>'
    + '<li>· 파이토100·프로틴바: ' + (dx.reco.basis ? dx.reco.basis + ' → <b>' + (recoNames.join(' + ') || '해당 없음') + '</b>' : '통곡물·채소 섭취 양호 → 추가 추천 없음') + '</li>'
    + '<li>· 두유: <b>' + SHOP_PRODUCTS[dx.reco.soy].name + '</b> <span class="text-gray-400">(' + dx.reco.soyReason + ')</span></li>'
    + (dx.reco.addons.length ? '<li>· 건강 목적 추가 구성: <b>' + dx.reco.addons.map(c => SHOP_PRODUCTS[c].name).join(', ') + '</b></li>' : '')
    + '</ul></div>'
    + '</div>';
}

function setSubQty(key, delta) {
  const s = planState.sub;
  s[key] = Math.max(0, Math.min(6, s[key] + delta));
  renderSubscription();
}
function applyPreset(id) {
  const p = SUBSCRIPTION_PRESETS.find(x => x.id === id);
  Object.assign(planState.sub, { soy: p.soy, phyto: p.phyto, bar: p.bar });
  renderSubscription();
}
function setSoyCode(code) { planState.sub.soyCode = code; renderSubscription(); }
function toggleAddon(code) {
  const a = planState.sub.addons;
  const i = a.indexOf(code);
  if (i >= 0) a.splice(i, 1); else a.push(code);
  renderSubscription();
}
function resetSubscription() {
  planState.sub = defaultSubscription(planState.dx, readProfile().allergies);
  renderSubscription();
}

function renderSubscription() {
  const el = document.getElementById('subscription-section');
  if (!el || !planState.sub || !planState.dx) return;
  const s = planState.sub, dx = planState.dx;
  const allergies = readProfile().allergies;
  const soyBlocked = allergies.has('soy');
  const price = priceSubscription(s);
  const recoBadge = '<span class="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white ml-1">추천</span>';
  const soyP = SHOP_PRODUCTS[s.soyCode];

  function stepper(key, code, recommended, blocked) {
    const p = SHOP_PRODUCTS[code];
    const perDay = (s[key] * p.units / PLAN_DAYS);
    return '<div class="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">'
      + '<div class="flex-1 min-w-0">'
      + '<div class="text-sm font-bold text-gray-900">' + p.name + (recommended ? recoBadge : '') + '</div>'
      + '<div class="text-xs text-gray-500">' + p.pack + ' · ' + won(p.price)
      + (s[key] ? ' · 30일 동안 ' + (s[key] * p.units) + '회 (하루 약 ' + perDay.toFixed(1) + '회)' : '') + '</div>'
      + (blocked ? '<div class="text-xs text-red-600 mt-0.5">⚠ 대두 알레르기 — 약콩 원료 제품</div>' : '')
      + '</div>'
      + '<div class="flex items-center gap-1 flex-shrink-0">'
      + '<button type="button" onclick="setSubQty(\'' + key + '\',-1)" class="w-9 h-9 rounded-full border-2 border-gray-200 text-gray-600 font-bold hover:border-emerald-500" aria-label="' + p.name + ' 줄이기">−</button>'
      + '<span class="w-8 text-center text-lg font-black text-gray-900">' + s[key] + '</span>'
      + '<button type="button" onclick="setSubQty(\'' + key + '\',1)" class="w-9 h-9 rounded-full border-2 border-gray-200 text-gray-600 font-bold hover:border-emerald-500" aria-label="' + p.name + ' 늘리기">+</button>'
      + '</div></div>';
  }

  const presetBtns = SUBSCRIPTION_PRESETS.map(p => {
    const on = price.preset && price.preset.id === p.id;
    return '<button type="button" onclick="applyPreset(\'' + p.id + '\')" class="flex-1 min-w-[150px] rounded-xl border-2 px-3 py-2 text-left transition '
      + (on ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300') + '">'
      + '<div class="text-xs text-gray-500">두유 ' + p.soy + ' · 파이토 ' + p.phyto + ' · 프로틴바 ' + p.bar + '</div>'
      + '<div class="text-sm font-bold text-gray-900">' + won(p.price) + ' <span class="text-emerald-700">' + p.rate + '% 할인</span></div>'
      + '</button>';
  }).join('');

  const addonRows = ADDON_CODES.map(code => {
    const p = SHOP_PRODUCTS[code];
    const on = s.addons.includes(code);
    const reco = dx.reco.addons.includes(code);
    return '<label class="flex items-center gap-3 py-2 cursor-pointer">'
      + '<input type="checkbox" class="w-4 h-4 accent-emerald-600" ' + (on ? 'checked' : '') + ' onchange="toggleAddon(\'' + code + '\')">'
      + '<span class="flex-1 text-sm text-gray-800">' + p.name + (reco ? recoBadge : '') + '</span>'
      + '<span class="text-xs text-gray-500 whitespace-nowrap">' + won(p.price * (1 - ADDON_DISCOUNT / 100)) + ' <span class="line-through text-gray-300">' + won(p.price) + '</span></span>'
      + '</label>';
  }).join('');

  const coreCount = s.soy + s.phyto + s.bar;
  el.innerHTML =
    '<div class="flex flex-wrap items-start justify-between gap-2 mb-4">'
    + '<div><h3 class="text-xl font-bold text-gray-900">🛒 구독 구성 선택</h3>'
    + '<p class="text-gray-500 text-sm mt-1">수량을 조정해 구독 세트를 만드세요. 선택한 제품은 30일 식단에 자동으로 들어갑니다.</p></div>'
    + '<button type="button" onclick="resetSubscription()" class="text-xs text-gray-500 underline">추천 구성으로 되돌리기</button>'
    + '</div>'
    + '<div class="flex flex-wrap gap-2 mb-4">' + presetBtns + '</div>'
    + '<div class="grid lg:grid-cols-5 gap-5">'
    + '<div class="lg:col-span-3">'
    + '<label for="soy-code" class="block text-xs font-bold text-gray-500 mb-1">두유 종류</label>'
    + '<select id="soy-code" onchange="setSoyCode(this.value)" class="w-full py-2.5 px-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 outline-none text-sm mb-1">'
    + SOY_CODES.map(c => '<option value="' + c + '"' + (c === s.soyCode ? ' selected' : '') + '>' + SHOP_PRODUCTS[c].name + ' (' + SHOP_PRODUCTS[c].pack + ' · ' + won(SHOP_PRODUCTS[c].price) + ')' + (c === dx.reco.soy ? ' ★추천' : '') + '</option>').join('')
    + '</select>'
    + '<p class="text-xs text-gray-400 mb-2">추천: ' + SHOP_PRODUCTS[dx.reco.soy].name + ' — ' + dx.reco.soyReason + '</p>'
    + stepper('soy', s.soyCode, true, soyBlocked)
    + stepper('phyto', '가', dx.reco.phyto, false)
    + stepper('bar', '나', dx.reco.bar, soyBlocked)
    + '<div class="mt-4"><div class="text-xs font-bold text-gray-500 mb-1">건강 목적 추가 구성 <span class="font-normal">(개별 ' + ADDON_DISCOUNT + '% 할인)</span></div>' + addonRows + '</div>'
    + '</div>'
    // 가격 요약
    + '<div class="lg:col-span-2"><div class="bg-gray-50 rounded-2xl p-5 lg:sticky lg:top-20">'
    + '<div class="text-sm font-bold text-gray-800 mb-3">💳 월 구독가</div>'
    + '<div class="space-y-1 text-sm">'
    + (price.lines.length
        ? price.lines.map(l => '<div class="flex justify-between gap-2"><span class="text-gray-600 truncate">' + SHOP_PRODUCTS[l.code].name + ' × ' + l.qty + '</span><span class="text-gray-500 whitespace-nowrap">' + won(l.qty * l.unit) + '</span></div>').join('')
        : '<div class="text-gray-400">두유·파이토100·프로틴바를 1개 이상 선택하세요</div>')
    + (price.lines.length
        ? '<div class="flex justify-between gap-2 pt-1 font-bold"><span class="text-emerald-700">' + (price.preset ? '세트 구독가' : '구독 할인 ' + price.coreRate + '%') + '</span><span class="text-gray-900">' + won(price.corePrice) + '</span></div>'
          + (price.preset ? '<div class="text-xs text-emerald-700 text-right">' + price.coreRate + '% 할인 적용</div>' : '<div class="text-xs text-gray-400 text-right">' + (price.lines.length === 1 ? '1종 구독 5%' : '2종 이상 구독 10%') + '</div>')
        : '')
    + price.addonLines.map(a => '<div class="flex justify-between gap-2"><span class="text-gray-600 truncate">' + SHOP_PRODUCTS[a.code].name + '</span><span class="text-gray-900 whitespace-nowrap">' + won(a.price) + '</span></div>').join('')
    + '</div>'
    + '<div class="border-t border-gray-200 mt-3 pt-3 flex justify-between items-baseline"><span class="text-sm text-gray-600">합계</span><span class="text-2xl font-black text-gray-900">' + won(price.total) + '</span></div>'
    + '<button type="button" onclick="createPlan()" ' + (coreCount ? '' : 'disabled') + ' class="mt-4 w-full py-3 rounded-xl font-bold text-white transition '
    + (coreCount ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-gray-300 cursor-not-allowed') + '">'
    + (planState.plan ? '이 구성으로 30일 식단 다시 만들기' : '이 구성으로 30일 식단 만들기') + ' <i class="fas fa-arrow-right ml-1"></i></button>'
    + (planState.plan ? '<button type="button" onclick="goToStep(5); renderPlan()" class="mt-2 w-full py-2 rounded-xl text-sm text-emerald-700 border border-emerald-600">기존 식단으로 돌아가기</button>' : '')
    + '</div></div>'
    + '</div>';
}

// ══════════════════════════════════════════════
// STEP 5 · 30일 식단 · 기록 · 모니터링
// ══════════════════════════════════════════════
function createPlan() {
  const profile = readProfile();
  if (planState.plan && Object.keys(planState.records).length
      && !confirm('식단을 새로 만들면 지금까지의 식사 기록이 초기화됩니다. 계속할까요?')) return;
  const targets = nutritionTargets(profile);
  const seed = Math.floor(Math.random() * 2147483647);
  planState.plan = {
    start: todayStr(), seed, targetKcal: targets.kcal,
    days: generatePlan({ targetKcal: targets.kcal, allergies: profile.allergies, sub: planState.sub, seed }),
  };
  planState.records = {};
  if (!planState.weights.length) planState.weights.push({ date: todayStr(), kg: profile.weight });
  planState.viewDay = 0;
  planState.notice = null;
  savePlanState();
  goToStep(5);
  renderPlan();
}

// 체중 변경 후: 오늘부터 남은 기간을 새 목표 칼로리로 다시 구성
function replanRemaining() {
  const profile = readProfile();
  const targets = nutritionTargets(profile);
  // 오늘 기록이 있으면 오늘 식단은 유지하고 내일부터 바꿈
  const t = todayIndex();
  const todayRec = planState.records[t] || {};
  const from = Math.min(PLAN_DAYS, t + (Object.values(todayRec).some(r => r.status) ? 1 : 0));
  planState.plan.targetKcal = targets.kcal;
  planState.plan.days = generatePlan({
    targetKcal: targets.kcal, allergies: profile.allergies, sub: planState.sub,
    seed: planState.plan.seed + from + 1, fromDay: from, prevDays: planState.plan.days,
  });
  planState.notice = null;
  savePlanState();
  renderPlan();
}

function setViewDay(d) { planState.viewDay = d; planState.editSlot = null; renderPlan(); }

function recordOf(day, slot) {
  const r = planState.records[day] || (planState.records[day] = {});
  return r[slot] || (r[slot] = { status: null, foods: [] });
}

function setMealStatus(slot, status) {
  const rec = recordOf(planState.viewDay, slot);
  rec.status = rec.status === status && status !== 'changed' ? null : status;
  planState.editSlot = status === 'changed' ? slot : null;
  savePlanState();
  renderPlan();
  if (status === 'changed') {
    const input = document.getElementById('meal-input');
    if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
}

// '다르게 먹었어요' 음식 추가 (자동완성 Enter·추가 버튼)
function addMeal(nameOverride) {
  const input = document.getElementById('meal-input');
  if (!input) return;
  const slot = document.getElementById('meal-type').value;
  const portion = Number(document.getElementById('meal-portion').value) || 1;
  const name = (nameOverride || input.value).trim();
  if (!name) { showInputError('음식 이름을 입력해주세요.'); return; }
  if (!analyzeFood(name)) {
    const close = [...RECIPE_NAMES.filter(n => n.includes(name)), ...INGREDIENT_NAMES.filter(n => n.includes(name))].slice(0, 3);
    showInputError(close.length ? '"' + name + '"을 찾을 수 없습니다. 혹시 ' + close.join(', ') + ' 이신가요?' : '"' + name + '"은 지원되지 않는 음식입니다. 자동완성 목록에서 선택해주세요.');
    return;
  }
  clearInputError();
  const rec = recordOf(planState.viewDay, slot);
  rec.status = 'changed';
  rec.foods.push({ name, portion });
  planState.editSlot = slot;
  input.value = '';
  savePlanState();
  renderPlan();
}

function removeRecordFood(slot, idx) {
  const rec = recordOf(planState.viewDay, slot);
  rec.foods.splice(idx, 1);
  savePlanState();
  renderPlan();
}

// ── 체중 기록 ────────────────────────────────
function addWeight() {
  const kg = Number(document.getElementById('weight-kg').value);
  const date = document.getElementById('weight-date').value || todayStr();
  const err = document.getElementById('weight-error');
  if (!(kg >= 10 && kg <= 300)) { err.textContent = '체중은 10–300kg 범위로 입력해주세요.'; err.classList.remove('hidden'); return; }
  err.classList.add('hidden');
  const before = nutritionTargets(readProfile());
  const i = planState.weights.findIndex(w => w.date === date);
  if (i >= 0) planState.weights[i].kg = kg; else planState.weights.push({ date, kg });
  planState.weights.sort((a, b) => a.date.localeCompare(b.date));

  // 최신 체중을 프로필에 반영 → 체중 유형·목표 칼로리 재계산
  document.getElementById('profile-weight').value = planState.weights[planState.weights.length - 1].kg;
  updateProfilePreview();
  const after = nutritionTargets(readProfile());
  if (after.kcal !== planState.plan.targetKcal || after.body.type !== before.body.type) {
    planState.notice = { from: planState.plan.targetKcal, to: after.kcal, bodyChanged: after.body.type !== before.body.type, label: after.body.label };
  }
  savePlanState();
  renderPlan();
}

function removeWeight(date) {
  planState.weights = planState.weights.filter(w => w.date !== date);
  savePlanState();
  renderPlan();
}

function renderWeightChart() {
  const canvas = document.getElementById('weight-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (weightChart) weightChart.destroy();
  const w = planState.weights;
  weightChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: w.map(x => x.date.slice(5).replace('-', '/')),
      datasets: [{ data: w.map(x => x.kg), borderColor: '#059669', backgroundColor: '#05966922', fill: true, tension: 0.3, pointRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw + ' kg' } } },
      scales: { y: { ticks: { callback: v => v + 'kg' }, grid: { color: '#F3F4F6' } }, x: { grid: { display: false } } },
    },
  });
}

// 기록 현황 (오늘까지)
function adherenceStats() {
  const upto = todayIndex();
  let planned = 0, ate = 0, changed = 0, skipped = 0, kcalSum = 0, daysWithRecord = 0;
  for (let d = 0; d <= upto; d++) {
    const day = planState.plan.days[d];
    const rec = planState.records[d] || {};
    let any = false;
    for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
      if (!day.meals[slot]) continue;
      planned++;
      const s = rec[slot] && rec[slot].status;
      if (s) any = true;
      if (s === 'ate') ate++; else if (s === 'changed') changed++; else if (s === 'skipped') skipped++;
    }
    if (any) { daysWithRecord++; kcalSum += summarizeEntries(actualDayEntries(day, rec)).kcal; }
  }
  return { planned, ate, changed, skipped, daysWithRecord, avgKcal: daysWithRecord ? kcalSum / daysWithRecord : 0, upto };
}

const SLOT_INFO = { breakfast: ['🌅', '아침'], lunch: ['☀️', '점심'], dinner: ['🌙', '저녁'], snack: ['🍪', '간식'] };

function renderPlan() {
  const el = document.getElementById('plan-section');
  if (!el || !planState.plan) return;
  const plan = planState.plan;
  const profile = readProfile();
  const targets = nutritionTargets(profile);
  const price = priceSubscription(planState.sub);
  const avg = planAverages(plan.days);
  const st = adherenceStats();
  const today = todayIndex();
  const vd = planState.viewDay;
  const day = plan.days[vd];
  const rec = planState.records[vd] || {};
  const plannedSum = summarizeEntries(planDayEntries(day));
  const actualSum = summarizeEntries(actualDayEntries(day, rec));
  const hasRecord = Object.values(rec).some(r => r.status);
  const trend = PFS_TREND_LABELS[weightTrendFromLog(planState.weights)];
  const subText = [
    planState.sub.soy ? SHOP_PRODUCTS[planState.sub.soyCode].name + ' ' + planState.sub.soy : '',
    planState.sub.phyto ? '파이토100 ' + planState.sub.phyto : '',
    planState.sub.bar ? '프로틴바 ' + planState.sub.bar : '',
  ].filter(Boolean).join(' · ');

  const stat = (label, val, target, ok) => '<div class="bg-gray-50 rounded-xl p-3 min-w-0"><div class="text-xs text-gray-500">' + label + '</div>'
    + '<div class="text-lg font-black ' + (ok ? 'text-emerald-700' : 'text-amber-600') + '">' + val + '</div>'
    + '<div class="text-xs text-gray-400">' + target + '</div></div>';

  // ── 상단: 구독 · 30일 평균 ──
  let html =
    '<div class="bg-white rounded-3xl shadow-lg p-6 md:p-8 mb-6">'
    + '<div class="flex flex-wrap items-start justify-between gap-3 mb-4">'
    + '<div><h3 class="text-xl font-bold text-gray-900">📅 나의 30일 식단</h3>'
    + '<p class="text-sm text-gray-500 mt-1">' + plan.start.replace(/-/g, '.') + ' 시작 · 목표 ' + plan.targetKcal.toLocaleString() + ' kcal/일</p>'
    + '<p class="text-xs text-gray-400 mt-0.5">구독: ' + (subText || '없음') + (planState.sub.addons.length ? ' + 추가 ' + planState.sub.addons.length + '종' : '') + ' · 월 ' + won(price.total) + '</p></div>'
    + '<div class="flex gap-2 flex-wrap">'
    + '<button type="button" onclick="goToStep(4); renderSubscription()" class="text-sm px-4 py-2 rounded-xl border-2 border-emerald-700 text-emerald-700 font-medium">구독 구성 변경</button>'
    + '</div></div>'
    + '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">'
    + stat('하루 평균 칼로리', Math.round(avg.kcal).toLocaleString() + ' kcal', '목표 ' + plan.targetKcal.toLocaleString(), Math.abs(avg.kcal - plan.targetKcal) <= plan.targetKcal * 0.1)
    + stat('평균 PDI', avg.pdi.toFixed(1) + '%', '목표 40% 이상 (현재 ' + (pdiResult ? pdiResult.pdiScore.toFixed(0) : '-') + '%)', avg.pdi >= 40)
    + stat('평균 단백질', Math.round(avg.protein) + ' g', '권장 ' + targets.protein + ' g', avg.protein >= targets.protein)
    + stat('평균 식이섬유', avg.fiber.toFixed(1) + ' g', '권장 ' + targets.fiber + ' g', avg.fiber >= targets.fiber)
    + '</div>'
    + '</div>';

  // ── 체중 모니터링 ──
  const n = planState.notice;
  html +=
    '<div class="bg-white rounded-3xl shadow-lg p-6 md:p-8 mb-6">'
    + '<div class="flex flex-wrap items-center justify-between gap-2 mb-4"><h3 class="text-xl font-bold text-gray-900">⚖️ 체중 모니터링</h3>'
    + '<span class="text-xs font-bold px-2.5 py-1 rounded-full text-white" style="background:' + trend.color + '">' + trend.name + '</span></div>'
    + (n ? '<div class="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-4 text-sm text-sky-900">'
          + '<b>목표가 바뀌었어요.</b> ' + (n.bodyChanged ? '체중 유형이 <b>' + n.label + '</b>(으)로 바뀌었고, ' : '')
          + '목표 칼로리 ' + n.from.toLocaleString() + ' → <b>' + n.to.toLocaleString() + ' kcal</b>'
          + '<div class="flex flex-wrap gap-2 mt-3">'
          + '<button type="button" onclick="replanRemaining()" class="px-4 py-2 rounded-lg bg-sky-700 text-white text-sm font-bold">오늘부터 남은 식단을 새 목표로 바꾸기</button>'
          + (n.bodyChanged ? '<button type="button" onclick="calculateAndShow()" class="px-4 py-2 rounded-lg border border-sky-700 text-sky-800 text-sm">추천 제품 다시 보기</button>' : '')
          + '<button type="button" onclick="planState.notice=null; renderPlan()" class="px-3 py-2 text-sm text-sky-700 underline">나중에</button>'
          + '</div></div>' : '')
    + '<div class="grid md:grid-cols-3 gap-5">'
    + '<div>'
    + '<label class="block text-xs font-bold text-gray-500 mb-1" for="weight-date">날짜</label>'
    + '<input id="weight-date" type="date" value="' + todayStr() + '" class="w-full py-2.5 px-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 outline-none text-sm mb-2">'
    + '<label class="block text-xs font-bold text-gray-500 mb-1" for="weight-kg">체중 (kg)</label>'
    + '<div class="flex gap-2"><input id="weight-kg" type="number" inputmode="decimal" step="0.1" min="10" max="300" placeholder="예: 64.5" class="flex-1 min-w-0 py-2.5 px-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 outline-none text-sm">'
    + '<button type="button" onclick="addWeight()" class="px-4 rounded-xl bg-emerald-700 text-white text-sm font-bold">기록</button></div>'
    + '<p id="weight-error" class="hidden text-xs text-red-500 mt-1"></p>'
    + '<ul class="mt-3 text-sm divide-y divide-gray-100 max-h-40 overflow-y-auto">'
    + planState.weights.slice().reverse().map(w => '<li class="flex justify-between py-1.5"><span class="text-gray-500">' + w.date.replace(/-/g, '.') + '</span><span class="font-bold text-gray-900">' + w.kg + ' kg <button type="button" onclick="removeWeight(\'' + w.date + '\')" class="ml-1 text-gray-300 hover:text-red-400" aria-label="삭제">✕</button></span></li>').join('')
    + '</ul></div>'
    + '<div class="md:col-span-2">'
    + '<div class="relative h-48"><canvas id="weight-chart"></canvas></div>'
    + '<div class="grid grid-cols-3 gap-2 mt-3 text-center">'
    + '<div class="bg-gray-50 rounded-xl p-2"><div class="text-xs text-gray-500">변화량</div><div class="font-black text-gray-900">'
    + (planState.weights.length > 1 ? ((planState.weights[planState.weights.length - 1].kg - planState.weights[0].kg) > 0 ? '+' : '') + (planState.weights[planState.weights.length - 1].kg - planState.weights[0].kg).toFixed(1) + 'kg' : '-') + '</div></div>'
    + '<div class="bg-gray-50 rounded-xl p-2"><div class="text-xs text-gray-500">식단 실천율</div><div class="font-black text-gray-900">' + (st.planned ? Math.round(st.ate / st.planned * 100) + '%' : '-') + '</div><div class="text-xs text-gray-400">' + st.ate + '/' + st.planned + '끼</div></div>'
    + '<div class="bg-gray-50 rounded-xl p-2"><div class="text-xs text-gray-500">기록일 평균</div><div class="font-black text-gray-900">' + (st.daysWithRecord ? Math.round(st.avgKcal).toLocaleString() + 'kcal' : '-') + '</div><div class="text-xs text-gray-400">' + st.daysWithRecord + '일 기록</div></div>'
    + '</div></div></div></div>';

  // ── 날짜 선택 ──
  html += '<div class="bg-white rounded-3xl shadow-lg p-6 md:p-8 mb-6">'
    + '<div class="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1" id="day-strip">'
    + plan.days.map((d, i) => {
        const date = addDays(plan.start, i);
        const r = planState.records[i] || {};
        const done = Object.values(r).some(x => x.status);
        const hasProduct = ['breakfast', 'lunch', 'dinner'].some(s => d.meals[s] && d.meals[s].type === 'product');
        const on = i === vd;
        return '<button type="button" onclick="setViewDay(' + i + ')" class="flex-shrink-0 w-14 py-2 rounded-xl border-2 text-center transition '
          + (on ? 'border-emerald-700 bg-emerald-700 text-white' : (i === today ? 'border-emerald-400 bg-white' : 'border-gray-100 bg-gray-50')) + '">'
          + '<div class="text-[10px] ' + (on ? 'text-emerald-100' : 'text-gray-400') + '">' + (date.getMonth() + 1) + '/' + date.getDate() + '</div>'
          + '<div class="text-sm font-black">' + (i + 1) + '일</div>'
          + '<div class="text-[10px] h-3">' + (done ? '✓' : (hasProduct ? '⭐' : '')) + '</div>'
          + '</button>';
      }).join('')
    + '</div>';

  // ── 하루 식단 ──
  const date = addDays(plan.start, vd);
  html += '<div class="flex flex-wrap items-end justify-between gap-2 mb-4">'
    + '<div><h4 class="text-lg font-bold text-gray-900">' + (vd + 1) + '일차 · ' + (date.getMonth() + 1) + '월 ' + date.getDate() + '일' + (vd === today ? ' <span class="text-xs text-emerald-700">(오늘)</span>' : '') + '</h4>'
    + '<p class="text-xs text-gray-500">계획 ' + Math.round(plannedSum.kcal) + ' kcal · PDI ' + plannedSum.pdi.toFixed(0) + '% · 단백질 ' + Math.round(plannedSum.protein) + 'g'
    + (hasRecord ? ' → <b class="text-gray-800">실제 ' + Math.round(actualSum.kcal) + ' kcal</b>' : '') + '</p></div>'
    + (day.meals.addons ? '<div class="text-xs text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full">💊 함께 드세요: ' + day.meals.addons.join(', ') + '</div>' : '')
    + '</div>';

  html += '<div class="grid md:grid-cols-2 gap-4">' + ['breakfast', 'lunch', 'dinner', 'snack'].filter(s => day.meals[s]).map(slot => {
    const m = day.meals[slot];
    const r = rec[slot] || { status: null, foods: [] };
    const kcal = m.items.reduce((s, it) => s + itemKcal(it), 0);
    const isProduct = m.type === 'product' || m.type === 'snack';
    const btn = (status, label, color) => '<button type="button" onclick="setMealStatus(\'' + slot + '\',\'' + status + '\')" class="flex-1 py-1.5 rounded-lg text-xs font-bold border transition '
      + (r.status === status ? color : 'border-gray-200 text-gray-500 hover:border-gray-300') + '">' + label + '</button>';
    return '<div class="rounded-2xl border ' + (isProduct ? 'border-purple-200 bg-purple-50/40' : 'border-gray-100') + ' p-4">'
      + '<div class="flex items-center justify-between mb-2"><span class="font-bold text-gray-900 text-sm">' + SLOT_INFO[slot][0] + ' ' + SLOT_INFO[slot][1]
      + (m.type === 'product' ? ' <span class="text-xs font-bold text-purple-700">밥스누 대체식</span>' : '') + '</span>'
      + '<span class="text-xs text-gray-400">' + Math.round(kcal) + ' kcal</span></div>'
      + '<ul class="space-y-1 mb-3">' + m.items.map(it =>
          '<li class="flex items-center gap-2 text-sm"><span class="text-[10px] w-11 text-center rounded px-1 py-0.5 flex-shrink-0 whitespace-nowrap '
          + (it.kind === 'product' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500') + '">' + KIND_LABEL[it.kind] + '</span>'
          + '<span class="text-gray-800 truncate">' + it.name + '</span>'
          + (it.portion !== 1 ? '<span class="text-xs text-gray-400 flex-shrink-0">' + (it.kind === 'rice' ? it.portion + '공기' : portionLabel(it.portion)) + '</span>' : '')
          + '</li>').join('') + '</ul>'
      + '<div class="flex gap-1.5">'
      + btn('ate', '✓ 먹었음', 'bg-emerald-600 border-emerald-600 text-white')
      + btn('changed', '✎ 다르게 먹음', 'bg-amber-500 border-amber-500 text-white')
      + btn('skipped', '✕ 안 먹음', 'bg-gray-500 border-gray-500 text-white')
      + '</div>'
      + (r.status === 'changed'
          ? '<div class="mt-2 bg-amber-50 rounded-lg p-2.5">'
            + (r.foods.length
                ? '<ul class="text-sm space-y-1">' + r.foods.map((f, i) => {
                    const a = analyzeFood(f.name);
                    return '<li class="flex justify-between gap-2"><span class="text-gray-800">' + f.name + ' <span class="text-xs text-gray-400">' + portionLabel(f.portion) + '</span></span>'
                      + '<span class="text-xs text-gray-500 whitespace-nowrap">' + (a ? Math.round(a.totalCal * f.portion) : 0) + ' kcal <button type="button" onclick="removeRecordFood(\'' + slot + '\',' + i + ')" class="text-gray-300 hover:text-red-400" aria-label="삭제">✕</button></span></li>';
                  }).join('') + '</ul>'
                : '<p class="text-xs text-amber-800">아래 입력창에서 실제로 드신 음식을 추가하세요.</p>')
            + '<button type="button" onclick="planState.editSlot=\'' + slot + '\'; renderPlan(); document.getElementById(\'meal-input\').focus()" class="mt-1 text-xs text-amber-800 underline">+ 음식 추가</button>'
            + '</div>'
          : '')
      + '</div>';
  }).join('') + '</div>';

  // ── 다르게 먹은 음식 입력 ──
  const editSlot = planState.editSlot || 'dinner';
  html += '<div id="food-input-panel" class="mt-5 bg-gray-50 rounded-2xl p-4 ' + (planState.editSlot ? '' : 'hidden') + '">'
    + '<div class="text-sm font-bold text-gray-800 mb-2">✎ 실제로 드신 음식 입력</div>'
    + '<div class="flex flex-col sm:flex-row gap-2">'
    + '<div class="flex gap-2">'
    + '<select id="meal-type" aria-label="끼니" class="h-11 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm">'
    + ['breakfast', 'lunch', 'dinner', 'snack'].map(s => '<option value="' + s + '"' + (s === editSlot ? ' selected' : '') + '>' + SLOT_INFO[s][1] + '</option>').join('')
    + '</select>'
    + '<select id="meal-portion" aria-label="인분" class="h-11 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm">'
    + [0.5, 1, 1.5, 2].map(p => '<option value="' + p + '"' + (p === 1 ? ' selected' : '') + '>' + portionLabel(p) + '</option>').join('')
    + '</select></div>'
    + '<div class="flex-1 relative"><input id="meal-input" type="text" autocomplete="off" placeholder="음식 검색 (예: 김치볶음밥, 사과)" class="w-full h-11 px-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 outline-none text-sm bg-white">'
    + '<ul id="autocomplete-list" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto"></ul></div>'
    + '<button type="button" onclick="addMeal()" class="h-11 px-5 rounded-xl bg-emerald-700 text-white text-sm font-bold">추가</button>'
    + '</div>'
    + '<p id="meal-input-error" class="hidden mt-2 text-sm text-red-500"><span></span></p>'
    + '</div>';
  html += '</div>';

  el.innerHTML = html;
  initAutocomplete();
  renderWeightChart();
  const chip = document.querySelector('#day-strip button:nth-child(' + (vd + 1) + ')');
  if (chip) chip.scrollIntoView({ block: 'nearest', inline: 'center' });
}
