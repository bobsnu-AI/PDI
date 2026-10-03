// ============================================
// 밥스누 제품 마스터 · 구독 세트 · 체중 관리자 추천 룰
// ──────────────────────────────────────────────
// 출처
//  · 가격·할인·추천 룰 : 「제품 추천 로직 구성」 엑셀 Sheet3
//  · 제품 스펙·기능    : 같은 엑셀 Sheet2
//  · 영양성분 (nut)    : 「밥스누 제품소개서_20260615.pptx」 영양정보 표시란 실측값 (1회 제공량 기준)
//
// nut 필드 (제품소개서 표시란 그대로)
//  energy(kcal) carb protein fat fiber sugar satfat trans(g) chol calcium sodium(mg) weight(g 또는 mL)
//  라벨에 표시되지 않은 항목은 0 으로 둡니다 (표시 의무가 없는 항목이며, 추정하지 않음)
//
// pdiKcal : 엑셀 「PDI 칼로리」 열 (대조용으로만 보관).
//           실제 계산에는 nut.energy(제품소개서 영양정보 표시란)를 사용합니다.
//
// phytoBase : 파이토케미컬 계열 추정에 사용할 기준 제품 (recipes.js INGREDIENTS)
//             제품별 파이토케미컬 실측값이 없어 약콩·파이토100 기준값을 그대로 사용합니다
// ============================================

// ── BMI 체중 유형 (엑셀 Sheet3 2~6행) ──────────
const BODY_TYPES = [
  { id: 'under',  name: '저체중',  max: 18.5, kcalAdj:  +300, desc: 'BMI 18.5 미만' },
  { id: 'normal', name: '정상',    max: 23,   kcalAdj:     0, desc: 'BMI 18.5–22.9' },
  { id: 'over',   name: '과체중',  max: 25,   kcalAdj:  -400, desc: 'BMI 23–24.9' },
  { id: 'obese',  name: '비만',    max: 30,   kcalAdj:  -500, desc: 'BMI 25–29.9' },
  { id: 'severe', name: '고도비만', max: Infinity, kcalAdj: -750, desc: 'BMI 30 이상' },
];

function classifyBodyType(bmi) {
  return BODY_TYPES.find(t => bmi < t.max) || BODY_TYPES[BODY_TYPES.length - 1];
}

// 엑셀 룰테이블의 체중 유형 축은 「정상」 / 「과체중 이상」 2분류
function bodyTypeAxis(typeId) {
  return (typeId === 'normal' || typeId === 'under') ? 'normal' : 'over';
}

// ── 제품 마스터 ─────────────────────────────
// kind: soymilk(두유 A~I) · phyto(가) · bar(나) · addon(추가 구성품 1~4)
// nut 은 제품소개서 영양정보 표시란 실측값 (1회 제공량 기준). 라벨 미표시 항목은 0
const BOBSNU_CATALOG = [
  // 두유 (액상 190 mL) — 엑셀 Sheet3 10~18행 / 제품소개서 slide 16~24
  { code: 'A', kind: 'soymilk', name: '오리지널 약콩 두유',          pack: '24입', price: 27000, pdiKcal: 75,  icon: '🫘',
    allergens: ['soy'], funcs: ['균형', '다이어트'], ages: ['all'], note: '해조칼슘 보강 · 전두가공공법',
    phytoBase: '약콩두유',
    nut: { weight: 190, energy: 75,  carb: 5,  protein: 6, fat: 3.5, fiber: 0,   sugar: 1,   satfat: 0.4, trans: 0, chol: 0, calcium: 130, sodium: 130 } },
  { code: 'B', kind: 'soymilk', name: '쌀눈으로 더 똑똑한 약콩100',   pack: '24입', price: 27000, pdiKcal: 70,  icon: '🧠',
    allergens: ['soy', 'walnut'], funcs: ['두뇌발달'], ages: ['10'], note: '쌀눈·아몬드·호두 + 비타민B군 · 프락토올리고당 저당설계',
    phytoFrom: { '현미': 3, '아몬드': 3, '호두': 3 },                       // 쌀눈복합페이스트(쌀눈배아·아몬드·호두)
    phytoBase: '약콩두유',
    nut: { weight: 190, energy: 100, carb: 10, protein: 7, fat: 3.8, fiber: 0,   sugar: 3.7, satfat: 0.5, trans: 0, chol: 0, calcium: 120, sodium: 115 } },
  { code: 'C', kind: 'soymilk', name: '배로 맛있는 약콩100 고단백',   pack: '24입', price: 27000, pdiKcal: 62,  icon: '💪',
    allergens: ['soy'], funcs: ['근력', '다이어트', '단백질'], ages: ['all'], note: '식물성 단백질 9 g · 배농축액으로 저당',
    phytoFrom: { '배': 20 },                                              // 배농축액 → 원물 환산
    phytoBase: '약콩두유',
    nut: { weight: 190, energy: 80,  carb: 6,  protein: 9, fat: 2.6, fiber: 2.5, sugar: 2.6, satfat: 0.4, trans: 0, chol: 0, calcium: 120, sodium: 150 } },
  { code: 'D', kind: 'soymilk', name: '포스트바이오틱스 약콩100',     pack: '24입', price: 27000, pdiKcal: 60,  icon: '🌿',
    allergens: ['soy'], funcs: ['장건강', '배변'], ages: ['20', '30', '40'], note: '프리·포스트바이오틱스 2중 설계 · 약콩유산균발효물',
    phytoBase: '약콩두유',
    nut: { weight: 190, energy: 90,  carb: 10, protein: 5, fat: 3.8, fiber: 2,   sugar: 5,   satfat: 0.7, trans: 0, chol: 0, calcium: 160, sodium: 160 } },
  { code: 'E', kind: 'soymilk', name: '칼마디 약콩100',              pack: '24입', price: 27000, pdiKcal: 70,  icon: '🦴',
    allergens: ['soy'], funcs: ['뼈건강', '칼슘'], ages: ['40', '50'], note: '칼슘 210 mg + 마그네슘 + 비타민D',
    phytoBase: '약콩두유',
    nut: { weight: 190, energy: 70,  carb: 4,  protein: 6, fat: 3.4, fiber: 0,   sugar: 0.9, satfat: 0.4, trans: 0, chol: 0, calcium: 210, sodium: 105 } },
  { code: 'F', kind: 'soymilk', name: '껍질째 약콩100',              pack: '24입', price: 27000, pdiKcal: 65,  icon: '🫘',
    allergens: ['soy'], funcs: ['다이어트'], ages: ['40'], note: '약콩원액두유 99.9% · 무순추출물',
    phytoBase: '약콩100',
    nut: { weight: 190, energy: 65,  carb: 5,  protein: 6, fat: 2.4, fiber: 0,   sugar: 0.5, satfat: 0.4, trans: 0, chol: 0, calcium: 0,   sodium: 85 } },
  { code: 'G', kind: 'soymilk', name: '더 진한 약콩100',             pack: '10입', price: 37500, pdiKcal: 60,  icon: '⭐',
    allergens: ['soy'], funcs: ['다이어트'], ages: ['50'], note: '고형분 8% · 무가당(당류 1 g 미만)',
    phytoBase: '약콩100',
    nut: { weight: 190, energy: 60,  carb: 4,  protein: 7, fat: 1.9, fiber: 0,   sugar: 0.9, satfat: 0.4, trans: 0, chol: 0, calcium: 0,   sodium: 85 } },
  { code: 'H', kind: 'soymilk', name: '더 건강한 약콩100',           pack: '10입', price: 37500, pdiKcal: 75,  icon: '🦴',
    allergens: ['soy'], funcs: ['뼈건강', '면역', '칼슘'], ages: ['50', '60'], note: '칼슘 230 mg · 마그네슘 · 비타민B군 · 아연 · 셀레늄',
    phytoBase: '약콩100',
    nut: { weight: 190, energy: 75,  carb: 5,  protein: 6, fat: 3.3, fiber: 0,   sugar: 0.9, satfat: 0.4, trans: 0, chol: 0, calcium: 230, sodium: 60 } },
  { code: 'I', kind: 'soymilk', name: '더 건강한 약콩100 슈퍼그린',   pack: '15입', price: 37500, pdiKcal: 70,  icon: '🥦',
    allergens: ['soy'], funcs: ['항산화', '장건강', '다이어트'], ages: ['50'], note: '유기농 과일채소 18종 · 식이섬유 4 g',
    phytoFrom: { '브로콜리': 3, '당근': 3, '케일': 3, '단호박': 3, '시금치': 3, '유자': 3,
                 '매실': 3, '양배추': 3, '보리': 3, '표고버섯': 3, '미나리': 3, '돌나물': 3,
                 '블루베리(생것)': 3 },                                  // 동결건조 과일채소 18종 → 원물 환산 약 39 g
    phytoBase: '파이토블랙',
    nut: { weight: 190, energy: 70,  carb: 5,  protein: 6, fat: 3.3, fiber: 4,   sugar: 0.9, satfat: 0.2, trans: 0, chol: 0, calcium: 150, sodium: 55 } },
  // 파이토 (분말 30 g/포) — 엑셀 「가」 / 제품소개서 slide 28
  // 원재료에 유기농 약콩이 있으나 대두 알레르기 환자도 섭취 가능
  { code: '가', kind: 'phyto',  name: '밥스누 파이토100',            pack: '14포', price: 42000, pdiKcal: 110, icon: '💊',
    allergens: ['tomato'], funcs: ['종합균형', '항산화', '혈당'], ages: ['40', '50', '60'], note: '국산 유기농 생식 21종 · 동결건조 · 식이섬유 4 g',
    // 유기농 생식 21종 · 원물 대비 농축율 888% → 1포 30 g = 원물 약 266 g (19종 매칭, 균등 분배)
    phytoFrom: { '현미': 14, '귀리': 14, '검정콩': 14, '케일': 14, '시금치': 14, '양배추': 14,
                 '비트': 14, '참깨': 14, '보리': 14, '당근': 14, '브로콜리': 14, '유자': 14,
                 '우엉': 14, '토마토': 14, '블루베리(생것)': 14, '양파': 14, '마늘': 14,
                 '생강': 14, '무순': 14 },
    phytoBase: '파이토100',
    nut: { weight: 30,  energy: 110, carb: 21, protein: 4, fat: 2.1, fiber: 4,   sugar: 2,   satfat: 0.5, trans: 0, chol: 0, calcium: 0,   sodium: 15 } },
  // 간식 (35 g/개) — 엑셀 「나」 / 제품소개서 slide 33
  { code: '나', kind: 'bar',    name: '약콩 프로틴바',               pack: '10입', price: 20000, pdiKcal: 140, icon: '🍫',
    allergens: ['soy', 'peanut', 'walnut'], funcs: ['장건강', '근력', '혈당', '단백질'], ages: ['20', '30', '40', '50'], note: '통곡물·견과 72.2% · 고단백 8 g · 식이섬유 4 g',
    phytoFrom: { '땅콩': 8, '아몬드': 6, '검정콩': 4, '현미': 3, '수수': 2, '호두': 2 },   // 통곡물·견과 72.2% = 25 g
    phytoBase: '약콩 프로틴바',
    nut: { weight: 35,  energy: 183, carb: 14, protein: 8, fat: 10,  fiber: 4,   sugar: 2.7, satfat: 1.7, trans: 0, chol: 0, calcium: 0,   sodium: 20 } },
  // 추가 구성품 — 엑셀 1~4 / 제품소개서 slide 32·42·43·44
  { code: '1', kind: 'addon',   name: '더 건강한 약콩차',             pack: '24입', price: 38400, pdiKcal: 14,  icon: '🍵',
    allergens: ['soy'], funcs: ['혈당', '중성지질', '배변', '장건강'], ages: ['all'], note: '3중 기능성 · 식이섬유 5 g · 비타민B군',
    phytoBase: '약콩차',
    nut: { weight: 500, energy: 14,  carb: 6,  protein: 0, fat: 0,   fiber: 5,   sugar: 0,   satfat: 0,   trans: 0, chol: 0, calcium: 0,   sodium: 0 } },
  // 건강기능식품(정제) — 식단 열량에 사실상 영향이 없어 식단 생성에서 제외 (supplement: true)
  { code: '2', kind: 'addon',   name: '뼈건강 칼마디케이',            pack: '90정', price: 40000, pdiKcal: 10,  icon: '🦴', supplement: true,
    allergens: ['milk'], funcs: ['뼈건강'], ages: ['40', '50', '60'], note: '어골칼슘 300 mg · 마그네슘 · 비타민D·K',
    nut: { weight: 4.05, energy: 10, carb: 2,  protein: 0, fat: 0.1, fiber: 0,   sugar: 0,   satfat: 0,   trans: 0, chol: 0, calcium: 300, sodium: 16 } },
  { code: '3', kind: 'addon',   name: '혈압혈당 바나바Q10',           pack: '60정', price: 40000, pdiKcal: 10,  icon: '🩸', supplement: true,
    allergens: [], funcs: ['혈당', '혈행', '기억력'], ages: ['50', '60'], note: '홍국·은행잎·바나바잎·코엔자임Q10 6중 기능성',
    nut: { weight: 2.6, energy: 10,  carb: 2,  protein: 0, fat: 0,   fiber: 0,   sugar: 0,   satfat: 0,   trans: 0, chol: 0, calcium: 0,   sodium: 0 } },
  { code: '4', kind: 'addon',   name: '에너지 마그네슘B',             pack: '60정', price: 40000, pdiKcal: 10,  icon: '🔋', supplement: true,
    allergens: ['milk'], funcs: ['피로회복'], ages: ['all'], note: '쌀발효마그네슘 + 비타민B군 8종',
    nut: { weight: 2,   energy: 10,  carb: 1,  protein: 0, fat: 0,   fiber: 0,   sugar: 0,   satfat: 0,   trans: 0, chol: 0, calcium: 0,   sodium: 0 } },
];

// ── 제품을 식재료 DB에 등록 ──────────────────
// recipes.js(INGREDIENTS)·pfs.js(PFS_BOBSNU_NUTRITION)에 제품소개서 실측값으로 등록해
// PDI·PFS·30일 식단이 모두 같은 숫자를 쓰게 합니다. 파이토케미컬은 phytoBase 기준값을 사용
// 제품의 파이토케미컬 추정
//   기준 제품(phytoBase)의 약콩 파이토케미컬 값에, phytoFrom 에 적은 원재료의 값을 더합니다.
//   phytoFrom 은 제품소개서 「원재료명 및 함량」 기준이며, 함량이 공개되지 않은 원료는
//   공개된 총함량(또는 동결건조 농축율)으로 원물 중량을 환산해 균등 분배한 추정치입니다.
//   ponytail: 제품별 실측 분석값이 들어오면 productPhytos 를 그 값으로 교체하면 됩니다
function productPhytos(p) {
  const out = {};
  const base = (p.phytoBase && INGREDIENTS[p.phytoBase]) ? INGREDIENTS[p.phytoBase].phytos : {};
  // 파이토100 은 약콩 기반이 아니라 21종 생식이므로 원재료만으로 계산
  if (p.kind !== 'phyto') {
    for (const [k, v] of Object.entries(base)) out[k] = (out[k] || 0) + v;
  }
  const from = p.phytoFrom || {};
  // 원재료 중량이 제품 라벨 열량을 넘으면 라벨 열량에 맞춰 줄인다.
  //   함량이 공개되지 않아 균등 분배한 경우(파이토100) 곡물이 과대 반영되는 것을 막는 보정입니다
  let fromKcal = 0;
  for (const [name, g] of Object.entries(from)) {
    const ing = INGREDIENTS[name];
    if (ing) fromKcal += (ing.kcal || 0) * g / 100;
  }
  const scale = fromKcal > p.nut.energy ? p.nut.energy / fromKcal : 1;

  for (const [name, grams] of Object.entries(from)) {
    const ing = INGREDIENTS[name];
    if (!ing || !ing.phytos) continue;
    for (const [k, v] of Object.entries(ing.phytos)) out[k] = (out[k] || 0) + v * grams * scale / 100;
  }
  return out;
}

function registerCatalogProducts() {
  for (const p of BOBSNU_CATALOG) {
    if (!p.nut) continue;
    INGREDIENTS[p.name] = {
      cat: 'bobsnu',
      kcal: p.nut.energy,
      prf: !p.supplement,              // 건강기능식품 정제는 PRF 식품군이 아님
      phytos: productPhytos(p),
    };
    // INGREDIENT_NAMES 는 recipes.js 로드 시점에 한 번 만들어지므로 여기서 직접 추가해야
    // 자동완성·「다른 음식」 입력 목록에 신제품이 나타납니다
    if (!INGREDIENT_NAMES.includes(p.name)) INGREDIENT_NAMES.push(p.name);
    PFS_BOBSNU_NUTRITION[p.name] = {
      weight: p.nut.weight, carb: p.nut.carb, protein: p.nut.protein, fat: p.nut.fat,
      fiber: p.nut.fiber, sugar: p.nut.sugar, satfat: p.nut.satfat, trans: p.nut.trans,
      chol: p.nut.chol, sodium: p.nut.sodium,
    };
  }
}
// 카탈로그 제품으로 대체된 구 제품명 — 식재료 DB(phytoBase·설문)에는 남겨두고
// 자동완성 목록에서만 숨겨서 같은 제품이 두 이름으로 보이지 않게 합니다
const LEGACY_PRODUCT_ALIASES = { '약콩두유': 'A', '파이토100': '가', '약콩차': '1', '약콩100': 'H' };

function hideLegacyProductNames() {
  for (const legacy of Object.keys(LEGACY_PRODUCT_ALIASES)) {
    const i = INGREDIENT_NAMES.indexOf(legacy);
    if (i >= 0) INGREDIENT_NAMES.splice(i, 1);
  }
}

registerCatalogProducts();
hideLegacyProductNames();

const CATALOG_BY_CODE = Object.fromEntries(BOBSNU_CATALOG.map(p => [p.code, p]));
const CATALOG_KIND_LABEL = { soymilk: '두유', phyto: '파이토', bar: '프로틴바', addon: '추가 구성품' };

// 포장 단위당 섭취 횟수 (30일 식단 배분용)
function packServings(p) {
  const m = /(\d+)/.exec(p.pack || '');
  return m ? Number(m[1]) : 30;
}

// 알레르기: 제품소개서 원재료명 기준으로 카탈로그에 직접 기재한 값
//   allergyHits(p, allergySet) → 사용자가 선택한 알레르기와 겹치는 항목의 한글 이름
function catalogAllergens(p) {
  return p.allergens || [];
}

function catalogAllergyHits(p, allergySet) {
  return catalogAllergens(p).filter(id => allergySet.has(id))
    .map(id => (ALLERGENS.find(a => a.id === id) || {}).name || id);
}

// ══════════════════════════════════════════════
// 구독 세트 — 수량 조정 + 할인율 (엑셀 Sheet3 20~27행)
// ══════════════════════════════════════════════
// 엑셀 프리셋 정가는 「두유 2 + 파이토 2 = 138,000원」 / 「두유 1 + 파이토 1 = 69,000원」으로
// 단가 합계와 정확히 일치합니다. 따라서 138,000·69,000 을 정가로 보고 할인율을 적용합니다.
const SUBSCRIPTION_PRESETS = [
  { id: 'optimal', title: '⭐ 최적 구독 세트', rate: 20, counts: { soymilk: 2, phyto: 2, bar: 3 },
    desc: '두유 2 · 파이토 2 · 프로틴바 3', excelRef: 138000, accent: '#059669' },
  { id: 'minimum', title: '👍 최소 권장 세트', rate: 15, counts: { soymilk: 1, phyto: 1, bar: 2 },
    desc: '두유 1 · 파이토 1 · 프로틴바 2', excelRef: 69000, accent: '#2563EB' },
];

// 할인율 판정 — 엑셀 정책
//   두유2·파이토2·프로틴바3 이상 → 20%   /   두유1·파이토1·프로틴바2 이상 → 15%
//   그 외 커스터마이징: 총 1개 → 5%, 총 2개 이상 → 10%
//   추가 구성품을 넣으면 +5%p
function subscriptionRate(counts, addonCount) {
  const s = counts.soymilk || 0, p = counts.phyto || 0, b = counts.bar || 0;
  const total = s + p + b;
  let rate;
  if (s >= 2 && p >= 2 && b >= 3)      rate = 20;
  else if (s >= 1 && p >= 1 && b >= 2) rate = 15;
  else if (total === 0)                rate = 0;
  else                                 rate = total >= 2 ? 10 : 5;
  if (rate > 0 && addonCount > 0) rate += 5;
  return rate;
}

// cart: { soymilk: ['A','E'], phyto: ['가','가'], bar: ['나','나','나'], addon: ['1','2'] }
//   같은 코드를 여러 번 넣으면 그 수량만큼 구독
function subscriptionQuote(cart) {
  const lines = [];
  const counts = { soymilk: 0, phyto: 0, bar: 0, addon: 0 };
  for (const kind of ['soymilk', 'phyto', 'bar', 'addon']) {
    const tally = {};
    for (const code of (cart[kind] || [])) tally[code] = (tally[code] || 0) + 1;
    for (const [code, qty] of Object.entries(tally)) {
      const p = CATALOG_BY_CODE[code];
      if (!p) continue;
      counts[kind] += qty;
      lines.push({ product: p, qty, amount: p.price * qty });
    }
  }
  const listPrice = lines.reduce((s, l) => s + l.amount, 0);
  const rate = subscriptionRate(counts, counts.addon);
  const finalPrice = Math.round(listPrice * (1 - rate / 100) / 10) * 10;
  const preset = SUBSCRIPTION_PRESETS.find(ps =>
    ps.counts.soymilk === counts.soymilk && ps.counts.phyto === counts.phyto && ps.counts.bar === counts.bar && counts.addon === 0);
  return { lines, counts, listPrice, rate, finalPrice, discount: listPrice - finalPrice, preset: preset || null };
}

// ══════════════════════════════════════════════
// 체중 관리자 추천 룰테이블 (엑셀 Sheet3 31~64행)
// ══════════════════════════════════════════════
// 열: PDI 구간 · 체중유형축 · 연령대
//   grain  : 통곡물 섭취 부족 시 추천 (채소도 부족하면 우선순위)
//   veg    : 채소 섭취 부족 시 추천
//   main   : 연령별 기본 추천 두유
//   calcium: 칼슘 부족 시 대체 추천 — 엑셀 원본 전사용. 식재료 DB에 칼슘 함량이 없어 판정 불가하므로 미사용
//   protein: 단백질 부족 시 대체 추천
//   gut    : 장 건강 — 두유 대체
//   sugar / bone / fatigue : 혈당·뼈건강·피로회복 — 추가 구성품
const PDI_BANDS = [
  { id: 'lt20',  name: '20% 미만', max: 20 },
  { id: '20_30', name: '20~30%',   max: 30 },
  { id: '30_40', name: '30~40%',   max: 40 },
  { id: 'gte40', name: '40% 이상', max: Infinity },
];
const AGE_BANDS = [
  { id: '10', name: '10대',      max: 20 },
  { id: '20', name: '20·30대',   max: 40 },
  { id: '40', name: '40대',      max: 50 },
  { id: '50', name: '50대 이상', max: Infinity },
];

// [pdiBand, bodyAxis, ageBand, grain, veg, main, calcium, protein, gut, sugar, bone, fatigue]
const WEIGHT_MGMT_RULES = [
  ['lt20',  'normal', '10', ['나'],      ['가'],      'B', 'E', 'C', 'D', '1', '2', '4'],
  ['lt20',  'over',   '10', ['가', '나'], ['가', '나'], 'B', 'E', 'C', 'D', '1', '2', '4'],
  ['lt20',  'normal', '20', ['나'],      ['가'],      'C', 'E', 'C', 'D', '1', '2', '4'],
  ['lt20',  'over',   '20', ['가', '나'], ['가', '나'], 'C', 'E', 'C', 'D', '1', '2', '4'],
  ['lt20',  'normal', '40', ['나'],      ['가'],      'E', 'H', 'C', 'D', '3', '2', '4'],
  ['lt20',  'over',   '40', ['가', '나'], ['가', '나'], 'I', 'H', 'C', 'D', '3', '2', '4'],
  ['lt20',  'normal', '50', ['나'],      ['가'],      'H', 'H', 'C', 'D', '3', '2', '4'],
  ['lt20',  'over',   '50', ['가', '나'], ['가', '나'], 'I', 'H', 'C', 'D', '3', '2', '4'],
  ['20_30', 'normal', '10', ['나'],      ['가'],      'C', 'E', 'C', 'D', '1', '2', '4'],
  ['20_30', 'over',   '10', ['가', '나'], ['가', '나'], 'C', 'E', 'C', 'D', '1', '2', '4'],
  ['20_30', 'normal', '20', ['나'],      ['가'],      'C', 'E', 'C', 'D', '1', '2', '4'],
  ['20_30', 'over',   '20', ['가', '나'], ['가', '나'], 'I', 'E', 'C', 'D', '1', '2', '4'],
  ['20_30', 'normal', '40', ['나'],      ['가'],      'E', 'H', 'C', 'D', '3', '2', '4'],
  ['20_30', 'over',   '40', ['가', '나'], ['가', '나'], 'I', 'H', 'C', 'D', '3', '2', '4'],
  ['20_30', 'normal', '50', ['나'],      ['가'],      'H', 'H', 'C', 'D', '3', '2', '4'],
  ['20_30', 'over',   '50', ['가', '나'], ['가', '나'], 'I', 'H', 'C', 'D', '3', '2', '4'],
  ['30_40', 'normal', '10', ['나'],      ['가'],      'C', 'E', 'C', 'D', '1', '2', '4'],
  ['30_40', 'over',   '10', ['나'],      ['가'],      'D', 'E', 'C', 'D', '1', '2', '4'],
  ['30_40', 'normal', '20', ['나'],      ['가'],      'C', 'E', 'C', 'D', '1', '2', '4'],
  ['30_40', 'over',   '20', ['나'],      ['가'],      'D', 'E', 'C', 'D', '1', '2', '4'],
  ['30_40', 'normal', '40', ['나'],      ['가'],      'E', 'H', 'C', 'D', '3', '2', '4'],
  ['30_40', 'over',   '40', ['가'],      ['가'],      'E', 'H', 'C', 'D', '3', '2', '4'],
  ['30_40', 'normal', '50', ['나'],      ['가'],      'H', 'H', 'C', 'D', '3', '2', '4'],
  ['30_40', 'over',   '50', ['가'],      ['가'],      'H', 'H', 'C', 'D', '3', '2', '4'],
  ['gte40', 'normal', '10', [],          [],          'C', 'E', 'C', 'D', '1', '2', '4'],
  ['gte40', 'over',   '10', ['나'],      ['가'],      'D', 'E', 'C', 'D', '1', '2', '4'],
  ['gte40', 'normal', '20', [],          [],          'C', 'E', 'C', 'D', '1', '2', '4'],
  ['gte40', 'over',   '20', ['나'],      ['가'],      'D', 'E', 'C', 'D', '1', '2', '4'],
  ['gte40', 'normal', '40', [],          [],          'E', 'H', 'C', 'D', '3', '2', '4'],
  ['gte40', 'over',   '40', ['나'],      ['가'],      'E', 'H', 'C', 'D', '3', '2', '4'],
  ['gte40', 'normal', '50', [],          [],          'H', 'H', 'C', 'D', '3', '2', '4'],
  ['gte40', 'over',   '50', ['나'],      ['가'],      'H', 'H', 'C', 'D', '3', '2', '4'],
].map(r => ({
  pdiBand: r[0], bodyAxis: r[1], ageBand: r[2],
  grain: r[3], veg: r[4], main: r[5], calcium: r[6], protein: r[7],
  gut: r[8], sugar: r[9], bone: r[10], fatigue: r[11],
}));

function pdiBandOf(pdi)  { return (PDI_BANDS.find(b => pdi < b.max) || PDI_BANDS[3]).id; }
function ageBandOf(age)  { return (AGE_BANDS.find(b => age < b.max) || AGE_BANDS[3]).id; }

// 목표별 추가 구성품 매핑 (장 건강은 두유 대체이므로 addon 이 아님)
const GOAL_RULE_KEY = { blood_sugar: 'sugar', bone: 'bone', fatigue: 'fatigue' };

// ──────────────────────────────────────────────
// recommendSubscription({ pdi, bmi, age, lacks, goals, allergies })
//   lacks  : { wholeGrain, veg, calcium, protein }  (boolean)
//   goals  : Set<'weight'|'gut'|'blood_sugar'|'bone'|'fatigue'>
//   반환: { rule, cart, reasons, excluded }
// ──────────────────────────────────────────────
function recommendSubscription({ pdi, bmi, age, lacks, goals, allergies }) {
  const bodyType = classifyBodyType(bmi);
  const rule = WEIGHT_MGMT_RULES.find(r =>
    r.pdiBand === pdiBandOf(pdi) && r.bodyAxis === bodyTypeAxis(bodyType.id) && r.ageBand === ageBandOf(age)
  ) || WEIGHT_MGMT_RULES[0];

  const reasons = [];
  const push = (code, why) => { if (code) reasons.push({ code, why }); };

  // 1) 두유 — 기본은 연령별 추천, 부족 영양소가 있으면 대체
  let soymilkCode = rule.main;
  push(soymilkCode, AGE_BANDS.find(a => a.id === rule.ageBand).name + ' 기본 추천 · PDI ' + PDI_BANDS.find(b => b.id === rule.pdiBand).name + ' / ' + bodyType.name);
  if (goals.has('gut') && rule.gut !== soymilkCode) {
    soymilkCode = rule.gut;
    reasons.push({ code: soymilkCode, why: '장 건강 목표 → 두유 대체' });
  } else if (lacks.protein && rule.protein !== soymilkCode) {
    soymilkCode = rule.protein;
    reasons.push({ code: soymilkCode, why: '단백질 부족 → 대체 추천' });
  }

  // 2) 파이토100 / 프로틴바 — 통곡물·채소 부족 여부로 결정
  //    통곡물·채소 모두 부족하면 엑셀 「우선 순위」 열(grain)을 따름
  let picks;
  if (lacks.wholeGrain && lacks.veg)      { picks = rule.grain; reasons.push({ code: picks.join('·'), why: '통곡물·채소 모두 부족 → 우선순위 구성' }); }
  else if (lacks.wholeGrain)              { picks = rule.grain; reasons.push({ code: picks.join('·'), why: '통곡물 섭취 부족' }); }
  else if (lacks.veg)                     { picks = rule.veg;   reasons.push({ code: picks.join('·'), why: '채소 섭취 부족' }); }
  else                                    { picks = rule.grain.length ? rule.grain : ['가']; reasons.push({ code: picks.join('·'), why: '기본 구성' }); }

  // 3) 추가 구성품 — 선택한 건강 목적별
  const addonCodes = [];
  for (const [goalId, key] of Object.entries(GOAL_RULE_KEY)) {
    if (goals.has(goalId) && !addonCodes.includes(rule[key])) {
      addonCodes.push(rule[key]);
      reasons.push({ code: rule[key], why: (HEALTH_GOALS.find(g => g.id === goalId) || {}).name + ' 목표 → 추가 구성품' });
    }
  }

  // 4) 알레르기 제외
  const blocked = new Set();
  const keep = code => {
    const p = CATALOG_BY_CODE[code];
    if (!p) return false;
    if (catalogAllergyHits(p, allergies).length) { blocked.add(code); return false; }
    return true;
  };

  const soymilk = keep(soymilkCode) ? [soymilkCode] : [];
  const phyto = picks.filter(c => c === '가').filter(keep);
  const bar   = picks.filter(c => c === '나').filter(keep);
  const addon = addonCodes.filter(keep);

  // 최소 권장 수량까지 채우기 (두유 1 · 파이토 1 · 프로틴바 2 = 15% 할인 기준)
  const cart = {
    soymilk: soymilk.length ? [soymilk[0], soymilk[0]] : [],
    phyto:   phyto.length   ? ['가', '가'] : (keep('가') ? ['가', '가'] : []),
    bar:     bar.length     ? ['나', '나', '나'] : (keep('나') ? ['나', '나', '나'] : []),
    addon,
  };

  // 5) 대두 알레르기 — 두유 A~I 와 프로틴바가 모두 약콩(대두) 제품이라 전부 제외됩니다.
  //    이 경우 파이토100 만 추천합니다.
  //    ※ 파이토100 원재료에도 유기농 약콩이 들어 있어(제품소개서) 섭취 전 확인이 필요합니다.
  if (!cart.soymilk.length && !cart.bar.length) {
    cart.phyto = ['가', '가'];
    reasons.push({ code: '가', why: '대두 알레르기로 두유·프로틴바 제외 → 파이토100 단독 구성' });
  }

  return {
    rule, bodyType, cart, reasons,
    excluded: [...blocked].map(c => CATALOG_BY_CODE[c]).filter(Boolean),
  };
}

// ──────────────────────────────────────────────
// 권장 영양 섭취량 — EER + 체중 유형별 목표 칼로리 조정
//   nutritionTargets(profile) → { eer, bmi, bodyType, targetKcal, targetWeight, ranges, weeklyDelta }
// ──────────────────────────────────────────────
function nutritionTargets(profile) {
  const eer = calculateEER(profile);
  if (!eer) return null;
  const bmi = profile.weight / ((profile.height / 100) ** 2);
  const bodyType = classifyBodyType(bmi);
  // 감량 폭은 EER 의 25% 이내로 제한 (과도한 제한 식단 방지)
  const adj = Math.sign(bodyType.kcalAdj) * Math.min(Math.abs(bodyType.kcalAdj), eer * 0.25);
  const targetKcal = Math.round(eer + adj);
  return {
    eer, bmi, bodyType,
    targetKcal,
    targetWeight: Math.round(22 * ((profile.height / 100) ** 2) * 10) / 10,  // BMI 22 기준 표준 체중
    weeklyDelta: Math.round(adj * 7 / 7700 * 100) / 100,                    // 체지방 1kg ≈ 7,700kcal
    ranges: calculateNutrientStandards(targetKcal),
  };
}
