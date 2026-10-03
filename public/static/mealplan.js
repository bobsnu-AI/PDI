// ============================================
// 30일 식단 생성 + 다목적 최적화 (SPEA2 알고리즘)
// spea2_optimizer.py / optimizer_base.py / evaluation_function.py JS 포팅
// ──────────────────────────────────────────────
// 원본 Python 대비 변경 사항 (의도적):
//  1) evaluate_cost 제외 — 식재료 단가 DB가 없음. 대신 PDI 목적함수를 추가해 4목적 유지
//  2) evaluate_harmony 재작성 — 원본은 끼니 공동출현 행렬을 적합도 평가마다 재계산(O(n²)×세대)하고
//     예시 식단 DB를 요구함. 여기서는 「끼니 내 주재료 중복 없음 + 같은 날 메뉴 중복 없음」으로 대체
//  3) 구성 항목을 지키는 mutate/crossover — 원본은 all_menus 에서 무작위로 골라 밥 자리에 김치가 들어감.
//     밥·국·메인반찬·김치·부수반찬 각 자리의 후보 메뉴 중에서만 교체
//  4) check_termination 교체 — 원본은 「3개 목적 개선된 해가 3개」면 종료라 0세대에서 바로 끝남.
//     개선 정체(patience) + 시간 예산으로 대체
//  5) evaluate_diversity 수정 — 원본은 반복 메뉴가 전혀 없으면 0점(최악)을 반환. 100점으로 수정
//  6) 비용 정규화의 21끼 하드코딩 제거 (30일=90끼에서 오작동)
// ============================================

// ── 한 끼 구성 항목 (밥 + 국 + 메인반찬 + 김치 + 부수반찬) ──
const DISH_SLOTS = [
  { id: 'rice',   name: '밥',        icon: '🍚', kcal: [140, 460] },
  { id: 'soup',   name: '국',        icon: '🍲', kcal: [25, 260] },
  { id: 'main',   name: '메인반찬',  icon: '🍖', kcal: [70, 340] },
  { id: 'kimchi', name: '김치',      icon: '🥬', kcal: [5, 90] },
  { id: 'side',   name: '부수반찬',  icon: '🥗', kcal: [10, 190] },
];
const SLOT_IDS = DISH_SLOTS.map(s => s.id);

// 끼니별 구성 — 아침은 3품(밥·국·메인반찬), 점심·저녁은 5품
// 아침을 줄이면 하루 총열량이 내려가 목표 칼로리를 맞추기 쉬워집니다
const MEAL_TYPES = [
  { id: 'breakfast', name: '아침', icon: '🌅', dishes: ['rice', 'soup', 'main'] },
  { id: 'lunch',     name: '점심', icon: '☀️', dishes: SLOT_IDS },
  { id: 'dinner',    name: '저녁', icon: '🌙', dishes: SLOT_IDS },
];
// 끼니 순번 → 사용하는 구성 항목의 인덱스 목록
const MEAL_SLOT_INDEXES = MEAL_TYPES.map(t => t.dishes.map(id => SLOT_IDS.indexOf(id)));

// 구성 항목별 음식 분류코드 (foodclass.js · 「음식 분류체계」 엑셀 기준)
//   접두사로 비교하므로 'B05' 는 B05 로 시작하는 모든 소분류를 포함합니다
const SLOT_CLASS_CODES = {
  // 밥 — 밥류 중 「밥」 자체만. 볶음밥·덮밥·비빔밥·김밥 등은 한 그릇 요리라 5품 구성에 맞지 않음
  rice:   ['A0101', 'A0102', 'A0104', 'A0112', 'A0116'],   // 쌀밥 · 잡곡밥 · 채소밥 · 혼합영양밥 · 기타밥
  soup:   ['B05', 'B06', 'B07', 'B08'],                    // 국류 · 탕류 · 스프류 · 찌개 및 전골류
  main:   ['C09', 'C10', 'C11', 'C12', 'C13'],             // 찜 · 구이 · 전·부침 · 볶음 · 조림
  kimchi: ['C17'],                                         // 김치류
  side:   ['C15', 'C16', 'C19'],                           // 무침 · 샐러드 · 장아찌·절임
};
// 제외: C14 튀김류(다이어트 부적합) · C18 젓갈류(고나트륨) · A02 빵류 · A03 면류 · A04 죽류
//       D20 장류·양념류 · E 간식·후식·음료 · G 가공식품

// 다이어트 식단 제외 (분류로 걸러지지 않는 고열량 조리법)
const DIET_EXCLUDE_RE = /라면|돈까스|까스|탕수|크림|마요|피자|버거|깐풍|유린기|족발|보쌈|곱창|대창|막창|양념치킨|후라이드/;

// PDI 목표치 (Gamba et al. 2023 CoLaus 코호트 근거)
const PDI_TARGET = 40;

// 최적화에 쓰는 영양소 축 (Python nutrient_constraints 의 5종 + 나트륨·당류)
const PLAN_NUT_KEYS = ['energy', 'carb', 'protein', 'fat', 'fiber', 'sodium', 'sugar'];
// 원본 Python 가중치에서 energy 만 1.0 → 3.5 로 올림 (목표 칼로리 준수가 다이어트 식단의 핵심)
const PLAN_NUT_WEIGHTS = { energy: 3.5, carb: 0.8, protein: 1.4, fat: 1.2, fiber: 1.1, sodium: 1.2, sugar: 1.0 };
const PLAN_NUT_WEIGHT_SUM = Object.values(PLAN_NUT_WEIGHTS).reduce((a, b) => a + b, 0);
// 영양소별 감점 상한을 가중치에 비례하게 배분 (원식은 100/영양소수 로 모두 같았음)
const PLAN_NUT_CAPS = Object.fromEntries(
  Object.entries(PLAN_NUT_WEIGHTS).map(([k, w]) => [k, 100 * w / PLAN_NUT_WEIGHT_SUM])
);
// 기준에서 이 비율만큼 벗어나면 해당 영양소 감점이 최대가 됨 (1/5 = 20%)
const PLAN_NUT_SENS = 5;
// 칼로리가 기준보다 「부족」할 때의 가중 — 제품 대체 끼니는 열량이 낮아
// 최적화가 저열량 식단을 고르기 쉬운데, 다이어트 식단에서 과도한 저열량이 더 위험하므로
// 부족 쪽 감점을 초과 쪽보다 무겁게 둡니다
const PLAN_ENERGY_UNDER_MULT = 3;

// ── 재현 가능한 난수 (mulberry32) ─────────────
// 같은 프로필이면 같은 식단이 나와야 30일 이행 기록이 유지됨
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ══════════════════════════════════════════════
// 후보 풀 구성
// ══════════════════════════════════════════════
// 레시피 → { name, slot, kcal, prfKcal, nut:Float64Array, keyIng, phytos }
function makeCandidate(name, slot) {
  const analysis = analyzeRecipe(name);
  if (!analysis || !analysis.ingredients.length) return null;
  const n = estimateDishNutrients(analysis);
  const nut = new Float64Array(PLAN_NUT_KEYS.length);
  for (let i = 0; i < PLAN_NUT_KEYS.length; i++) nut[i] = n[PLAN_NUT_KEYS[i]] || 0;

  let prfKcal = 0, keyIng = '', keyG = -1;
  const phytos = {};
  for (const ing of analysis.ingredients) {
    if (ing.prf) prfKcal += ing.kcal || 0;
    if (typeof ing.grams === 'number' && ing.grams > keyG && ing.cat !== 'spices' && ing.cat !== 'oils') {
      keyG = ing.grams; keyIng = ing.name;
    }
    for (const [k, v] of Object.entries(ing.phytos || {})) phytos[k] = (phytos[k] || 0) + v;
  }
  return { name, slot, kcal: analysis.totalCal, prfKcal, nut, keyIng: keyIng || name, phytos, analysis };
}

// 음식명 → 구성 항목 (분류코드 기준 · 해당 없으면 null)
function classifySlot(name, cal) {
  const code = FOOD_CLASS[name];
  if (!code) return null;
  for (const [slot, codes] of Object.entries(SLOT_CLASS_CODES)) {
    if (!codes.some(c => code.startsWith(c))) continue;
    // 열량이 낮은 메인반찬은 실제로 부수반찬 역할 (멸치볶음·김구이 등)
    if (slot === 'main' && cal < 90) return 'side';
    return slot;
  }
  return null;
}

// ──────────────────────────────────────────────
// buildSlotPools({ allergies, rng, cap })
//   레시피명으로 구성 항목 분류 → 열량대·다이어트 필터 → 균등 추출 → 영양 분석
//   반환: { rice:[cand,...], soup:[...], main:[...], kimchi:[...], side:[...] }
// ──────────────────────────────────────────────
function buildSlotPools({ allergies, rng, cap }) {
  cap = cap || 150;
  const buckets = { rice: [], soup: [], main: [], kimchi: [], side: [] };
  const band = Object.fromEntries(DISH_SLOTS.map(s => [s.id, s.kcal]));

  for (const name of RECIPE_NAMES) {
    if (DIET_EXCLUDE_RE.test(name)) continue;
    const cal = RECIPES[name].cal;
    const slot = classifySlot(name, cal);
    if (!slot) continue;
    const [lo, hi] = band[slot];
    if (!(cal >= lo && cal <= hi)) continue;
    buckets[slot].push(name);
  }

  const pools = {};
  for (const slot of SLOT_IDS) {
    const names = buckets[slot];
    // 일정 간격으로 고르게 추출 + 시작점 무작위 — 가나다순 편향 없이 cap×1.5 개를 뽑고 알레르기 제외 후 cap 개
    const want = Math.min(names.length, Math.round(cap * 1.5));
    const stride = Math.max(1, Math.floor(names.length / Math.max(1, want)));
    const offset = Math.floor(rng() * stride);
    const picked = [];
    for (let i = offset; i < names.length && picked.length < want; i += stride) picked.push(names[i]);

    const out = [];
    for (const name of picked) {
      if (out.length >= cap) break;
      const c = makeCandidate(name, slot);
      if (!c) continue;
      if (allergies && allergies.size && findAllergens(name, c.analysis, allergies).length) continue;
      out.push(c);
    }

    // divKey: 다양성·메뉴 궁합을 셀 때 쓰는 「같은 메뉴」 기준.
    // 밥은 양만 다른 변형을 여러 개 만들므로, 양이 달라도 같은 메뉴로 봅니다
    out.forEach((c, i) => { c.portion = 1; c.divKey = i; });
    pools[slot] = (slot === 'rice')
      ? out.flatMap((c, i) => RICE_PORTIONS.map(f => scaleCandidate(c, f, i)))
      : out;
  }
  return pools;
}

// ── 밥 양 ────────────────────────────────────
// 목표 칼로리를 맞추려면 밥 양을 줄이는 것이 가장 효과가 큽니다 (한 공기 ≈ 300 kcal).
// 밥 후보를 공기 수별로 만들어 두고 최적화가 직접 고르게 합니다
const RICE_PORTIONS = [0.6, 0.8, 1.0];

function scaleCandidate(c, factor, divKey) {
  if (factor === 1) return { ...c, portion: 1, divKey };
  const nut = new Float64Array(c.nut.length);
  for (let i = 0; i < nut.length; i++) nut[i] = c.nut[i] * factor;
  return { ...c, nut, kcal: c.kcal * factor, prfKcal: c.prfKcal * factor, portion: factor, divKey };
}

// ══════════════════════════════════════════════
// 밥스누 제품 배치
// ══════════════════════════════════════════════
// (1) 끼니 통째로 대체 — 저녁 우선, 하루 1끼
//     조합 A: 두유 + 파이토100   /   조합 B: 두유 + 프로틴바 + 과일
//     두유 1팩(24입) = 24회분이므로 30일을 다 채우려면 두유 2팩 이상이 필요합니다
// (2) 남는 제품은 곁들임 — 아침 → 점심 → 간식 순서로 일반 식단에 추가
//     끼니를 2개 이상 대체하면 제품 끼니가 1끼 260 kcal 수준이라
//     남은 한 끼로 목표 칼로리를 채울 수 없어, 대체는 하루 1끼로 제한합니다
const PHYTO_NAME = CATALOG_BY_CODE['가'].name;
const BAR_NAME   = CATALOG_BY_CODE['나'].name;
const PRODUCT_COMBO_FRUITS = ['사과', '귤', '바나나', '키위', '딸기', '방울토마토', '블루베리'];
// 대체 끼니 우선순위 — 저녁이 1순위
const REPLACE_PRIORITY = ['dinner', 'breakfast', 'lunch'];
// 곁들임 배치 순서 — 대체되지 않은 끼니부터
const EXTRA_PRIORITY = ['breakfast', 'lunch', 'snack'];

function productServingNutrients(items) {
  const nut = new Float64Array(PLAN_NUT_KEYS.length);
  let kcal = 0, prfKcal = 0;
  const phytos = {};
  for (const it of items) {
    const analysis = analyzeFood(it.name);
    if (!analysis) continue;
    const n = estimateDishNutrients(analysis);
    for (let i = 0; i < PLAN_NUT_KEYS.length; i++) nut[i] += n[PLAN_NUT_KEYS[i]] || 0;
    kcal += analysis.totalCal;
    for (const ing of analysis.ingredients) {
      if (ing.prf) prfKcal += ing.kcal || 0;
      for (const [k, v] of Object.entries(ing.phytos || {})) phytos[k] = (phytos[k] || 0) + v;
    }
  }
  return { nut, kcal, prfKcal, phytos };
}

// n개를 days 일에 고르게 흩뿌린 날짜 목록 (예: 18/30 → 0, 2, 3, 5, 7, ...)
function spreadDays(n, days) {
  if (n >= days) return Array.from({ length: days }, (_, i) => i);
  const out = [];
  for (let i = 0; i < n; i++) out.push(Math.min(days - 1, Math.round(i * days / n)));
  return [...new Set(out)];
}

// cart(구독 세트) → 30일간 제품 배치
//   반환: {
//     meals:  { [day]: { dinner: {...} } }          — 통째로 대체한 끼니
//     extras: { [day]: { breakfast: {...}, ... } }  — 일반 끼니에 곁들인 제품
//     snacks: { [day]: {...} }                      — 간식으로 넣은 제품
//   }
function planProductMeals(cart, days, rng) {
  const servingsOf = kind => (cart[kind] || []).reduce((s, code) => {
    const p = CATALOG_BY_CODE[code];
    return s + (p ? packServings(p) : 0);
  }, 0);
  const soymilkCodes = [...new Set(cart.soymilk || [])];
  const soymilkName = soymilkCodes.length ? CATALOG_BY_CODE[soymilkCodes[0]].name : null;

  let soymilk = soymilkName ? servingsOf('soymilk') : 0;
  let phyto   = (cart.phyto || []).length ? servingsOf('phyto') : 0;
  let bar     = (cart.bar || []).length ? servingsOf('bar') : 0;
  const stock = { soymilk, phyto, bar };

  const fruits = PRODUCT_COMBO_FRUITS.filter(f => INGREDIENTS[f]);
  const meals = {}, extras = {}, snacks = {};
  const replacedBy = {};   // 끼니 종류 → 대체한 날 수

  // ── (1) 끼니 대체 — 저녁 우선, 하루 1끼 ──
  const replaceDays = soymilkName ? Math.min(days, soymilk, phyto + bar) : 0;
  const replaceType = REPLACE_PRIORITY[0];
  replacedBy[replaceType] = replaceDays;
  for (const d of spreadDays(replaceDays, days)) {
    // 파이토·프로틴바 중 잔량이 많은 쪽을 써서 30일에 균등 소진
    const useA = phyto >= 1 && (bar < 1 || phyto >= bar);
    const items = [{ name: soymilkName, qty: 1 }];
    if (useA) { items.push({ name: PHYTO_NAME, qty: 1 }); phyto--; }
    else      { items.push({ name: BAR_NAME, qty: 1 }, { name: fruits[d % fruits.length], qty: 1 }); bar--; }
    soymilk--;
    (meals[d] || (meals[d] = {}))[replaceType] =
      { type: replaceType, combo: useA ? 'A' : 'B', items, ...productServingNutrients(items) };
  }

  // ── (2) 남는 제품을 곁들임으로 — 아침 → 점심 → 간식 ──
  // (day, 끼니) 자리를 순서대로 만들어 두고 제품을 하나씩 채운다
  const slots = [];
  for (const type of EXTRA_PRIORITY) for (let d = 0; d < days; d++) slots.push({ d, type });
  let si = 0;
  const extraCount = { breakfast: 0, lunch: 0, snack: 0 };
  const place = name => {
    while (si < slots.length) {
      const { d, type } = slots[si++];
      if (meals[d] && meals[d][type]) continue;         // 이미 대체된 끼니는 건너뜀
      const bag = type === 'snack'
        ? (snacks[d] || (snacks[d] = { items: [] }))
        : ((extras[d] || (extras[d] = {}))[type] || ((extras[d])[type] = { items: [] }));
      bag.items.push({ name, qty: 1 });
      extraCount[type]++;
      return true;
    }
    return false;
  };
  while (soymilk > 0 && place(soymilkName)) soymilk--;
  while (phyto > 0   && place(PHYTO_NAME))  phyto--;
  while (bar > 0     && place(BAR_NAME))    bar--;

  // 곁들임·간식의 영양성분 계산
  for (const byType of Object.values(extras)) {
    for (const [type, bag] of Object.entries(byType)) byType[type] = { ...bag, ...productServingNutrients(bag.items) };
  }
  for (const [d, bag] of Object.entries(snacks)) snacks[d] = { ...bag, ...productServingNutrients(bag.items) };

  return {
    meals, extras, snacks,
    coverage: {
      days, stock,
      replaceType, replaceDays,            // 통째로 대체한 끼니 종류·일수
      extraCount,                          // 곁들임으로 넣은 횟수 (아침·점심·간식)
      totalServings: stock.soymilk + stock.phyto + stock.bar,
      placed: replaceDays * 2 + extraCount.breakfast + extraCount.lunch + extraCount.snack,
    },
    leftover: { soymilk: Math.max(0, soymilk), phyto: Math.max(0, phyto), bar: Math.max(0, bar) },
  };
}

// ══════════════════════════════════════════════
// 영양 제약 (Python create_nutrient_constraints 대응)
// ══════════════════════════════════════════════
function planConstraints(targets) {
  const r = targets.ranges, k = targets.targetKcal;
  return {
    min: { energy: k * 0.95, carb: r.carb[0], protein: r.protein[0], fat: r.fat[0], fiber: r.fiber,       sodium: 0,        sugar: 0 },
    max: { energy: k * 1.05, carb: r.carb[1], protein: r.protein[1], fat: r.fat[1], fiber: r.fiber * 2.5, sodium: r.sodium, sugar: r.sugar },
    caps: PLAN_NUT_CAPS,
  };
}

// ══════════════════════════════════════════════
// SPEA2 최적화기
// ══════════════════════════════════════════════
class SPEA2DietOptimizer {
  // pools: buildSlotPools 결과 / constraints: planConstraints 결과
  // fixed: { mealNut:Float64Array[], mealKcal:[], mealPrf:[], skip:Set<mealIndex> }
  constructor(pools, constraints, fixed, opts) {
    opts = opts || {};
    this.pools = SLOT_IDS.map(s => pools[s]);
    this.poolLen = this.pools.map(p => p.length);
    this.constraints = constraints;
    this.days = opts.days || 30;
    this.nMeals = this.days * 3;
    // 곁들임·간식 배열은 없어도 동작하게 기본값을 채운다
    const nm = this.nMeals, nd = this.days;
    this.fixed = Object.assign({
      skip: new Set(), mealNut: new Array(nm).fill(null),
      mealKcal: new Float64Array(nm), mealPrf: new Float64Array(nm),
      extraNut: new Array(nm).fill(null),
      extraKcal: new Float64Array(nm), extraPrf: new Float64Array(nm),
      snackNut: new Array(nd).fill(null),
      snackKcal: new Float64Array(nd), snackPrf: new Float64Array(nd),
    }, fixed);
    this.nSlots = SLOT_IDS.length;
    this.rng = opts.rng || Math.random;

    // 표준화된 매개변수 (원본 Python 값에서 브라우저 실행 가능하게 축소)
    // ponytail: pop/gen/변이율은 체감 품질 대비 속도로 정한 값 — 서버 배치로 옮기면 원본(150/100)까지 올릴 수 있음
    this.populationSize  = opts.populationSize || 60;
    this.archiveSize     = opts.archiveSize || 40;
    this.mutationProb      = opts.mutationProb || 0.30;   // 끼니 단위
    this.mutationMenuProb  = opts.mutationMenuProb || 0.15; // 슬롯 단위
    this.crossoverProb   = opts.crossoverProb || 0.8;
    this.generations     = opts.generations || 60;
    this.patience        = opts.patience || 12;
    this.timeBudgetMs    = opts.timeBudgetMs || 4000;

    this.archive = [];
    this.fitnessCache = new Map();
  }

  randomGene() {
    const g = new Int32Array(this.nMeals * this.nSlots).fill(-1);
    for (let m = 0; m < this.nMeals; m++) {
      if (this.fixed.skip.has(m)) continue;
      for (const s of MEAL_SLOT_INDEXES[m % 3]) g[m * this.nSlots + s] = Math.floor(this.rng() * this.poolLen[s]);
    }
    return g;
  }

  // ── 목적함수 1: 영양 (evaluate_nutrition 포팅) ──
  evaluateNutrition(gene) {
    const { min, max, caps } = this.constraints;
    const nk = PLAN_NUT_KEYS.length;
    let total = 0;
    const acc = new Float64Array(nk);

    for (let d = 0; d < this.days; d++) {
      acc.fill(0);
      const sn = this.fixed.snackNut[d];
      if (sn) for (let i = 0; i < nk; i++) acc[i] += sn[i];
      for (let mi = 0; mi < 3; mi++) {
        const m = d * 3 + mi;
        const fx = this.fixed.mealNut[m];
        if (fx) { for (let i = 0; i < nk; i++) acc[i] += fx[i]; continue; }
        const ex = this.fixed.extraNut[m];
        if (ex) for (let i = 0; i < nk; i++) acc[i] += ex[i];
        for (let s = 0; s < this.nSlots; s++) {
          const idx = gene[m * this.nSlots + s];
          if (idx < 0) continue;
          const nut = this.pools[s][idx].nut;
          for (let i = 0; i < nk; i++) acc[i] += nut[i];
        }
      }
      let dayScore = 100;
      for (let i = 0; i < nk; i++) {
        const key = PLAN_NUT_KEYS[i];
        const C = acc[i], L = min[key], U = max[key], cap = caps[key];
        const M = C < L ? L : (C > U ? U : C);   // 기준 범위 안이면 M === C → 감점 0
        if (M === 0) continue;
        let rel = Math.abs((C - M) / M);        // 기준에서 벗어난 비율
        if (key === 'energy' && C < L) rel *= PLAN_ENERGY_UNDER_MULT;
        dayScore -= Math.min(cap, rel * PLAN_NUT_SENS * cap);
      }
      total += Math.max(0, dayScore);
    }
    return Math.max(0, Math.min(100, total / this.days));
  }

  // ── 목적함수 2: PDI (목표 40% 도달률) ──
  evaluatePDI(gene) {
    let total = 0;
    for (let d = 0; d < this.days; d++) {
      let kcal = 0, prf = 0;
      for (let mi = 0; mi < 3; mi++) {
        const m = d * 3 + mi;
        if (this.fixed.mealNut[m]) { kcal += this.fixed.mealKcal[m]; prf += this.fixed.mealPrf[m]; continue; }
        kcal += this.fixed.extraKcal[m]; prf += this.fixed.extraPrf[m];
        for (let s = 0; s < this.nSlots; s++) {
          const idx = gene[m * this.nSlots + s];
          if (idx < 0) continue;
          const c = this.pools[s][idx];
          kcal += c.kcal; prf += c.prfKcal;
        }
      }
      kcal += this.fixed.snackKcal[d] || 0;
      prf  += this.fixed.snackPrf[d] || 0;
      const pdi = kcal > 0 ? (prf / kcal) * 100 : 0;
      total += Math.min(100, pdi / PDI_TARGET * 100);
    }
    return total / this.days;
  }

  // ── 목적함수 3: 다양성 (evaluate_diversity 포팅 + 무반복=100점 수정) ──
  evaluateDiversity(gene) {
    const occ = new Map();
    for (let m = 0; m < this.nMeals; m++) {
      if (this.fixed.skip.has(m)) continue;
      for (let s = 0; s < this.nSlots; s++) {
        const idx = gene[m * this.nSlots + s];
        if (idx < 0) continue;
        const key = s * 1e6 + this.pools[s][idx].divKey;
        let arr = occ.get(key);
        if (!arr) { arr = []; occ.set(key, arr); }
        arr.push(m);
      }
    }
    const nMeals = this.nMeals;
    const maxVar = Math.max(nMeals * nMeals / 4, 0.001);
    const scores = [];
    for (const arr of occ.values()) {
      if (arr.length < 2) continue;
      const dist = [];
      for (let i = 0; i + 1 < arr.length; i++) dist.push(arr[i + 1] - arr[i]);
      const mean = dist.reduce((a, b) => a + b, 0) / dist.length;
      const variance = dist.length > 1 ? dist.reduce((a, b) => a + (b - mean) ** 2, 0) / dist.length : 0;
      const minDist = Math.min(...dist);
      const nVar = Math.min(1, Math.max(0, variance / maxVar));
      const nMin = Math.min(1, Math.max(0, (minDist - 1) / Math.max(nMeals - 1, 1)));
      scores.push(100 * (1 - nVar + nMin) / 2);
    }
    // 반복 메뉴가 전혀 없으면 다양성 최대 (원본은 0 반환 — 버그)
    if (!scores.length) return 100;
    return Math.max(0, Math.min(100, scores.reduce((a, b) => a + b, 0) / scores.length));
  }

  // ── 목적함수 4: 조화 (끼니 내 주재료 중복 · 같은 날 메뉴 중복 없음) ──
  evaluateHarmony(gene) {
    let penalty = 0, checks = 0;
    for (let d = 0; d < this.days; d++) {
      const dayKeys = new Set();
      for (let mi = 0; mi < 3; mi++) {
        const m = d * 3 + mi;
        if (this.fixed.skip.has(m)) continue;
        const ings = new Set();
        for (let s = 0; s < this.nSlots; s++) {
          const idx = gene[m * this.nSlots + s];
          if (idx < 0) continue;
          const c = this.pools[s][idx];
          checks += 2;
          if (ings.has(c.keyIng)) penalty += 1; else ings.add(c.keyIng);
          const nameKey = s * 1e6 + c.divKey;
          if (dayKeys.has(nameKey)) penalty += 1; else dayKeys.add(nameKey);
        }
      }
    }
    return checks > 0 ? Math.max(0, 100 * (1 - penalty / checks)) : 100;
  }

  fitness(gene) {
    return [this.evaluateNutrition(gene), this.evaluatePDI(gene), this.evaluateDiversity(gene), this.evaluateHarmony(gene)];
  }

  cachedFitness(gene) {
    // Int32Array → 문자열 키. 450칸이라 join 비용보다 재평가 비용이 큼
    const key = gene.join(',');
    let f = this.fitnessCache.get(key);
    if (!f) {
      f = this.fitness(gene);
      if (this.fitnessCache.size > 4000) this.fitnessCache.clear();
      this.fitnessCache.set(key, f);
    }
    return f;
  }

  crossover(p1, p2) {
    if (this.rng() > this.crossoverProb) return p1;
    const child = new Int32Array(p1.length);
    for (let i = 0; i < p1.length; i++) child[i] = this.rng() < 0.5 ? p1[i] : p2[i];
    return child;
  }

  // 구성 항목을 지켜서 교체 — 밥 자리는 밥 후보 메뉴 중에서만
  mutate(gene) {
    const g = gene.slice();
    for (let m = 0; m < this.nMeals; m++) {
      if (this.fixed.skip.has(m)) continue;
      if (this.rng() >= this.mutationProb) continue;
      for (const s of MEAL_SLOT_INDEXES[m % 3]) {
        if (this.rng() < this.mutationMenuProb) g[m * this.nSlots + s] = Math.floor(this.rng() * this.poolLen[s]);
      }
    }
    return g;
  }

  // ── SPEA2 환경 선택 ──
  dominanceMatrix(fits) {
    const n = fits.length, m = fits[0].length;
    const dom = [];
    for (let i = 0; i < n; i++) dom.push(new Uint8Array(n));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let iGe = true, jGe = true, iGt = false, jGt = false;
        for (let k = 0; k < m; k++) {
          if (fits[i][k] < fits[j][k]) { iGe = false; jGt = true; }
          else if (fits[i][k] > fits[j][k]) { jGe = false; iGt = true; }
          if (!iGe && !jGe) break;
        }
        if (iGe && iGt) dom[i][j] = 1;
        else if (jGe && jGt) dom[j][i] = 1;
      }
    }
    return dom;
  }

  environmentalSelection(pop, fits) {
    if (!pop.length) return [];
    const n = pop.length;
    const dom = this.dominanceMatrix(fits);

    // strength: 자신이 지배하는 해의 수
    const strength = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += dom[i][j]; strength[i] = s; }
    // raw fitness: 자신을 지배하는 해들의 strength 합
    const raw = new Float64Array(n);
    for (let i = 0; i < n; i++) { let r = 0; for (let j = 0; j < n; j++) if (dom[j][i]) r += strength[j]; raw[i] = r; }

    // 거리 · 밀도
    const dist = [];
    for (let i = 0; i < n; i++) dist.push(new Float64Array(n));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let s = 0;
        for (let k = 0; k < fits[i].length; k++) { const d = fits[i][k] - fits[j][k]; s += d * d; }
        const v = Math.sqrt(s);
        dist[i][j] = v; dist[j][i] = v;
      }
      dist[i][i] = Infinity;
    }
    const k = Math.max(1, Math.floor(Math.sqrt(n)));
    const density = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const sorted = Array.from(dist[i]).sort((a, b) => a - b);
      density[i] = 1 / (sorted[Math.min(k, n - 1)] + 2);
    }
    const fitness = Array.from({ length: n }, (_, i) => raw[i] + density[i]);

    const nonDom = [];
    for (let i = 0; i < n; i++) if (raw[i] === 0) nonDom.push(i);

    if (nonDom.length === this.archiveSize) return nonDom.map(i => pop[i]);
    if (nonDom.length < this.archiveSize) {
      const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => fitness[a] - fitness[b]);
      return order.slice(0, this.archiveSize).map(i => pop[i]);
    }
    // 군집 절단: 최근접 이웃 거리가 가장 작은 해를 제거
    const selected = nonDom.slice();
    while (selected.length > this.archiveSize) {
      let minD = Infinity, remove = 0;
      for (let a = 0; a < selected.length; a++) {
        let nearest = Infinity;
        for (let b = 0; b < selected.length; b++) {
          if (a === b) continue;
          const d = dist[selected[a]][selected[b]];
          if (d < nearest) nearest = d;
        }
        if (nearest < minD) { minD = nearest; remove = a; }
      }
      selected.splice(remove, 1);
    }
    return selected.map(i => pop[i]);
  }

  optimize(initialGene, onProgress) {
    const t0 = Date.now();
    let population = [initialGene];
    for (let i = 1; i < this.populationSize; i++) population.push(this.mutate(initialGene));
    this.archive = [];

    let best = -Infinity, stale = 0;
    let gen = 0;
    for (; gen < this.generations; gen++) {
      const all = population.concat(this.archive);
      const fits = all.map(g => this.cachedFitness(g));
      this.archive = this.environmentalSelection(all, fits);

      // 개선 정체 · 시간 예산 기반 종료 (원본 check_termination 은 0세대에서 바로 종료됨)
      const bestNow = Math.max(...this.archive.map(g => this.cachedFitness(g).reduce((a, b) => a + b, 0)));
      if (bestNow > best + 1e-6) { best = bestNow; stale = 0; } else { stale++; }
      if (onProgress) onProgress(gen, this.generations, best / 4);
      if (stale >= this.patience || Date.now() - t0 > this.timeBudgetMs) { gen++; break; }

      const parentPool = this.archive.length >= 2 ? this.archive : population;
      const next = [];
      while (next.length < this.populationSize) {
        const a = parentPool[Math.floor(this.rng() * parentPool.length)];
        let b = parentPool[Math.floor(this.rng() * parentPool.length)];
        if (parentPool.length > 1 && b === a) b = parentPool[(parentPool.indexOf(a) + 1) % parentPool.length];
        let c1 = this.crossover(a, b), c2 = this.crossover(b, a);
        if (this.rng() < this.mutationProb) c1 = this.mutate(c1);
        if (this.rng() < this.mutationProb) c2 = this.mutate(c2);
        next.push(c1, c2);
      }
      population = next.slice(0, this.populationSize);
    }

    // 4목적 합이 가장 큰 해를 대표해로 선택
    const pool = this.archive.length ? this.archive : population;
    let bestGene = pool[0], bestSum = -Infinity;
    for (const g of pool) {
      const s = this.cachedFitness(g).reduce((a, b) => a + b, 0);
      if (s > bestSum) { bestSum = s; bestGene = g; }
    }
    return { gene: bestGene, fitness: this.cachedFitness(bestGene), generations: gen, elapsedMs: Date.now() - t0, archiveSize: this.archive.length };
  }
}

// ══════════════════════════════════════════════
// generateMealPlan(opts) — 공개 API
//   opts: { profile, targets, cart, days, allergies, seed, onProgress }
//   반환: { days:[...], score, meta }
// ══════════════════════════════════════════════
function generateMealPlan({ profile, targets, cart, days, allergies, seed, onProgress }) {
  days = days || 30;
  const rng = makeRng(seed != null ? seed : hashSeed(JSON.stringify([profile.gender, profile.age, profile.height, profile.weight, targets.targetKcal])));

  const pools = buildSlotPools({ allergies, rng, cap: 150 });
  const thin = SLOT_IDS.filter(s => pools[s].length < 5);
  if (thin.length) return { error: '후보 메뉴가 부족한 항목: ' + thin.map(s => DISH_SLOTS.find(x => x.id === s).name).join('·') };

  const products = planProductMeals(cart, days, rng);
  const nk = PLAN_NUT_KEYS.length;
  const mealIndex = type => MEAL_TYPES.findIndex(t => t.id === type);
  const fixed = {
    skip: new Set(), mealNut: new Array(days * 3).fill(null),
    mealKcal: new Float64Array(days * 3), mealPrf: new Float64Array(days * 3),
    extraNut: new Array(days * 3).fill(null),
    extraKcal: new Float64Array(days * 3), extraPrf: new Float64Array(days * 3),
    snackKcal: new Float64Array(days), snackPrf: new Float64Array(days),
    snackNut: new Array(days).fill(null),
  };
  // 통째로 대체한 끼니 — 최적화 대상에서 제외하고 영양을 고정값으로
  for (const [dStr, byType] of Object.entries(products.meals)) {
    const d = Number(dStr);
    for (const pm of Object.values(byType)) {
      const m = d * 3 + mealIndex(pm.type);
      fixed.skip.add(m);
      fixed.mealNut[m] = pm.nut;
      fixed.mealKcal[m] = pm.kcal;
      fixed.mealPrf[m] = pm.prfKcal;
    }
  }
  // 곁들임 — 일반 끼니에 더해지는 영양
  for (const [dStr, byType] of Object.entries(products.extras)) {
    const d = Number(dStr);
    for (const [type, ex] of Object.entries(byType)) {
      const m = d * 3 + mealIndex(type);
      fixed.extraNut[m] = ex.nut;
      fixed.extraKcal[m] = ex.kcal;
      fixed.extraPrf[m] = ex.prfKcal;
    }
  }
  for (const [dStr, sn] of Object.entries(products.snacks)) {
    const d = Number(dStr);
    fixed.snackKcal[d] = sn.kcal;
    fixed.snackPrf[d] = sn.prfKcal;
    fixed.snackNut[d] = sn.nut;
  }

  const constraints = planConstraints(targets);
  const opt = new SPEA2DietOptimizer(pools, constraints, fixed, { days, rng });
  const initial = opt.randomGene();
  const result = opt.optimize(initial, onProgress);

  // ── 계산 결과 → 사람이 읽는 식단 ──
  const out = [];
  for (let d = 0; d < days; d++) {
    const meals = MEAL_TYPES.map((mt, mi) => {
      const m = d * 3 + mi;
      const pm = (products.meals[d] || {})[mt.id];
      if (pm) {
        return { type: mt.id, name: mt.name, icon: mt.icon, kind: 'product', combo: pm.combo,
          items: pm.items.map(i => i.name), kcal: Math.round(pm.kcal), prfKcal: Math.round(pm.prfKcal) };
      }
      const dishes = MEAL_SLOT_INDEXES[mi].map(s => {
        const idx = result.gene[m * SLOT_IDS.length + s];
        const c = pools[SLOT_IDS[s]][idx];
        return { slot: SLOT_IDS[s], slotName: DISH_SLOTS[s].name, icon: DISH_SLOTS[s].icon,
          name: c.name, portion: c.portion, kcal: Math.round(c.kcal), prfKcal: Math.round(c.prfKcal) };
      });
      const ex = (products.extras[d] || {})[mt.id];
      return { type: mt.id, name: mt.name, icon: mt.icon, kind: 'food', dishes,
        extras: ex ? { items: ex.items.map(i => i.name), kcal: Math.round(ex.kcal), prfKcal: Math.round(ex.prfKcal) } : null,
        kcal: dishes.reduce((s, x) => s + x.kcal, 0) + (ex ? Math.round(ex.kcal) : 0),
        prfKcal: dishes.reduce((s, x) => s + x.prfKcal, 0) + (ex ? Math.round(ex.prfKcal) : 0) };
    });
    const snack = products.snacks[d]
      ? { kind: 'product', items: products.snacks[d].items.map(i => i.name), kcal: Math.round(products.snacks[d].kcal), prfKcal: Math.round(products.snacks[d].prfKcal) }
      : null;
    const kcal = meals.reduce((s, x) => s + x.kcal, 0) + (snack ? snack.kcal : 0);
    const prf  = meals.reduce((s, x) => s + x.prfKcal, 0) + (snack ? snack.prfKcal : 0);
    out.push({ day: d + 1, meals, snack, kcal, prfKcal: prf, pdi: kcal > 0 ? +(prf / kcal * 100).toFixed(1) : 0 });
  }

  const [nutrition, pdi, diversity, harmony] = result.fitness;
  return {
    days: out,
    score: { nutrition: +nutrition.toFixed(1), pdi: +pdi.toFixed(1), diversity: +diversity.toFixed(1), harmony: +harmony.toFixed(1) },
    meta: {
      generations: result.generations, elapsedMs: result.elapsedMs, archiveSize: result.archiveSize,
      poolSizes: Object.fromEntries(SLOT_IDS.map(s => [s, pools[s].length])),
      productMealDays: Object.keys(products.meals).length,
      coverage: products.coverage,
      leftover: products.leftover,
      targetKcal: targets.targetKcal,
      avgKcal: Math.round(out.reduce((s, d) => s + d.kcal, 0) / out.length),
      avgPDI: +(out.reduce((s, d) => s + d.pdi, 0) / out.length).toFixed(1),
    },
  };
}
