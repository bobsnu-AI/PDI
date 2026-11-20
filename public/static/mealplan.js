// ============================================
// 30일 식단 생성 + 다목적 최적화 (SPEA2 알고리즘)
// spea2_optimizer.py / optimizer_base.py / evaluation_function.py JS 포팅
// ──────────────────────────────────────────────
// 원본 Python 대비 변경 사항 (의도적):
//  1) evaluate_cost 제외 — 식재료 단가 DB가 없음. 대신 식단 지수·PFS 목적함수를 넣어 5목적
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

// ── 식단 지수 (식품군 기반 식단 점수) ─────────
// 기준은 patterns.js 그대로입니다 (ptClassify · PT_SERVING_G · PATTERN_DEFS 성분별 range).
//   DIET_INDEX_KEY  : null 이면 종합값(식단 점수 5종의 평균 — 주요 건강 목표가 있으면 가중 평균).
//                     'DASH' 처럼 PATTERN_DEFS 의 key 를 적으면 그 점수 하나만 씁니다
//   DIET_INDEX_SKIP : 식단으로 알 수 없는 성분(음주) — 점수에서 뺍니다
const DIET_INDEX_KEY = null;
const DIET_INDEX_SKIP = ['alcohol'];
const DIET_INDEX_DEFS = PATTERN_DEFS.filter(d => !DIET_INDEX_KEY || d.key === DIET_INDEX_KEY)
  .map(d => ({ key: d.key, comps: d.comps.filter(c => !DIET_INDEX_SKIP.includes(c.c)) }));

// ── 주요 건강 목표 ────────────────────────────
// 관리 목표로 골랐거나, 설문으로 낸 질환 등급이 위험·보통이면 그 목표가 「주요 목표」입니다.
//   GOAL_DISEASE : 관리 목표 id → 질환 등급 key (patterns.js PT_DISEASE_HR 의 열)
const GOAL_DISEASE = { cvd: 'cvd', blood_sugar: 'diabetes' };
function planFocus(goals, grades) {
  const f = new Set(goals || []);
  for (const g of grades || []) {
    if (g.tier.key === 'high') continue;
    for (const [goal, d] of Object.entries(GOAL_DISEASE)) if (d === g.key) f.add(goal);
  }
  return [...f].sort();
}

// 주요 목표 → 식단 점수별 가중치. 그 질환과 관련이 깊은 점수일수록 큰 몫 — diseaseGrades 와 같은 |ln 위험비| 입니다.
// 질환이 둘이면 몫을 더합니다. 해당하는 목표가 없으면 null(5종 단순 평균)
function dietIndexWeights(focus) {
  const w = {};
  for (const goal of focus || []) {
    const d = GOAL_DISEASE[goal];
    if (!d) continue;
    const ln = Object.fromEntries(Object.entries(PT_DISEASE_HR).map(([k, hr]) => [k, Math.abs(Math.log(hr[d]))]));
    const sum = Object.values(ln).reduce((a, b) => a + b, 0);
    for (const k in ln) w[k] = (w[k] || 0) + ln[k] / sum;
  }
  return Object.keys(w).length ? w : null;
}

// 식단 지수 최적화 목표 — 하루 식단 지수가 이 값이면 목적함수 100점
//   측정값(30일·4개 프로필): 식단 지수만 최적화하면 72~73점, 영양+식단 지수 2목적이면 69~70점이 상한.
//   ※ 위는 암 예방 권고 점수를 빼기 전(6종) 값입니다. 5종 단순 평균으로는 식단 지수만 최적화해도 68~69점이라
//     74 는 여유가 큰 편 — 목표를 다시 잡을지는 연구자 결정 사항으로 남겨 둡니다
//   상한 바로 위로 잡아 점수가 100 에 붙지 않게 합니다 (100 으로 두면 다른 목적에 밀려 식단 지수가 1~2점 낮게 나왔음)
const DIET_INDEX_OPT_TARGET = 74;

// 접시별 식품군 벡터 — 후보를 만들 때 한 번 계산해 두고, 평가 때는 더하기만 합니다
//   [식품군 1회분 수(통곡물은 g) ..., 트랜스지방 g, 초가공식품 kcal, 총 kcal, 나트륨 mg, 식이섬유 g, 추정 열량 kcal]
const FG_KEYS = [...Object.keys(PT_SERVING_G), 'wholeGrain'];
const FG_N = FG_KEYS.length, FG_LEN = FG_N + 6;
const FG_UPF_ALSO = new Set(['ssb', 'juice', 'processedMeat', 'alcohol']);   // patterns.js ptComponents 와 같은 목록

function foodGroupVector(name, analysis) {
  const v = new Float64Array(FG_LEN);
  const whole = PT_UPF.has(name);
  for (const ing of analysis.ingredients) {
    const k = ptClassify(ing.name, ing.cat);
    if (!whole && (PT_UPF.has(ing.name) || FG_UPF_ALSO.has(k))) v[FG_N + 1] += ing.kcal || 0;
    // 밥스누 제품은 grams 가 '1회' 로 들어오므로 제품 1회 제공량(g)으로 바꿉니다
    const g = typeof ing.grams === 'number' ? ing.grams : ptProductWeight(ing.name);
    const i = FG_KEYS.indexOf(k);
    if (g > 0 && i >= 0) v[i] += k === 'wholeGrain' ? g : g / PT_SERVING_G[k];
  }
  const n = estimateDishNutrients(analysis);
  v[FG_N] = n.trans || 0;
  if (whole) v[FG_N + 1] = analysis.totalCal || 0;
  v[FG_N + 2] = analysis.totalCal || 0;
  v[FG_N + 3] = n.sodium || 0; v[FG_N + 4] = n.fiber || 0; v[FG_N + 5] = n.energy || 0;
  return v;
}

// 식품군 벡터(하루 합계) → 성분별 섭취량. 묶음 성분은 patterns.js ptComponents 와 같은 식입니다
function dietServ(v) {
  const s = {};
  for (let i = 0; i < FG_N; i++) s[FG_KEYS[i]] = v[i];
  s.nutsLegumes    = s.nuts + s.legumes;
  s.redProcMeat    = s.redMeat + s.processedMeat;
  s.ssbAll         = s.ssb + s.juice;
  s.healthyPlant   = s.fruit + s.veg + s.nuts + s.legumes + s.vegOil + s.coffeeTea + s.wholeGrain / 90;
  s.unhealthyPlant = s.juice + s.refinedGrain + s.potato + s.ssb + s.sweets;
  s.animalFood     = s.redMeat + s.processedMeat + s.poultry + s.fish + s.egg + s.dairyLow + s.dairyHigh + s.animalFat;
  s.sodium = v[FG_N + 3]; s.fiber = v[FG_N + 4];
  s.transPctE = v[FG_N + 5] > 0 ? v[FG_N] * 9 / v[FG_N + 5] * 100 : 0;
  return s;
}

// 식품군 벡터(하루 합계) → 식단 지수 0~100
// ponytail: 유전자마다 불리므로 scoreDietPatterns 를 부르지 않고 같은 식(ptPosition 가중 평균)을 풀어 썼습니다.
//           두 계산이 같은지는 scripts/test-mealplan.mjs 가 확인합니다
//   weights: dietIndexWeights 결과({ 점수 key: 가중치 }) — 없으면 단순 평균
function dietIndexOf(v, gender, serv, weights) {
  const s = serv || dietServ(v);
  let sum = 0, wSum = 0;
  for (const { key, comps } of DIET_INDEX_DEFS) {
    let num = 0, den = 0;
    for (const c of comps) {
      const r = (gender !== 'male' && c.rangeW) ? c.rangeW : c.range;
      const w = c.w == null ? 1 : c.w;
      num += w * (c.score ? c.score(s[c.c], gender, s) : ptDirectional(s[c.c], r[0], r[1]));
      den += w;
    }
    const pw = weights ? (weights[key] || 0) : 1;
    sum += pw * (den > 0 ? num / den : 0);
    wSum += pw;
  }
  return wSum > 0 ? sum / wSum * 100 : 0;
}

// 최적화에 쓰는 영양소 축 (Python nutrient_constraints 의 5종 + 나트륨·당류)
const PLAN_NUT_KEYS = ['energy', 'carb', 'protein', 'fat', 'fiber', 'sodium', 'sugar'];
// 접시·하루 합계 배열에 함께 담는 영양소 — 뒤 3개는 PFS 점수에만 씁니다
const PLAN_NUT_ALL = [...PLAN_NUT_KEYS, 'chol', 'satfat', 'trans'];

// ── PFS 점수 (pfs.js pfsScore 의 Basic) ───────
// 하루 영양소 합계 → Basic. 가점 4종(최대 4) − 감점 5종이라 −5 ~ 4 가 기본 범위이고, 이를 0~100 으로 폅니다
// ponytail: Basic 만 씁니다. 원식의 감량기·증가기 총점은 에너지 밀도(kcal/100 g, 수십~수백)를 Basic(4 이하)에
//           그대로 더해 「열량 밀도가 높을수록 고득점」이 되므로 목적함수로 쓰지 않았습니다. 넣으려면 여기서 정규화할 것
function pfsBasic(acc, ranges) {
  const n = {};
  for (let i = 0; i < PLAN_NUT_ALL.length; i++) n[PLAN_NUT_ALL[i]] = acc[i];
  return pfsScore(n, ranges, 1, 'maintenance').basic;
}
const pfs100 = basic => Math.max(0, Math.min(100, (basic + 5) / 9 * 100));

// 최적화 루프용 — pfsBasic 과 같은 값을 객체를 만들지 않고 냅니다 (세대마다 수천 번 불려 pfsScore 로는 15% 느려짐).
// 수식을 고치면 pfs.js pfsScore 와 함께 고칠 것 — 두 값이 같은지는 test-mealplan.mjs 가 확인합니다
function pfsFlat(r) {
  return [...pfsRange(r.carb), ...pfsRange(r.protein), ...pfsRange(r.fat), r.fiber, r.chol, r.sugar, r.satfat, r.trans, r.sodium];
}
function pfsBasicFast(a, f) {   // a: PLAN_NUT_ALL 순서의 하루 합계, f: pfsFlat 결과
  const band = (x, A, B) => x < A ? 1 - ((x - A) / A) ** 2 : x > B ? 1 - ((x - B) / A) ** 2 : 1;
  const lack = (x, A) => x < A ? ((x - A) / A) ** 2 : 0;
  return band(a[1], f[0], f[1]) + band(a[2], f[2], f[3]) + band(a[3], f[4], f[5])
    + 1 - lack(a[4], f[6]) - 1 + lack(a[7], f[7])
    - a[6] / Math.max(0.1, f[8]) - a[8] / Math.max(0.1, f[9]) - a[9] / Math.max(0.1, f[10]) - a[5] / Math.max(0.1, f[11]);
}
// 원본 Python 가중치에서 energy 만 1.0 → 3.5 로 올림 (목표 칼로리 준수가 다이어트 식단의 핵심)
const PLAN_NUT_WEIGHTS = { energy: 3.5, carb: 0.8, protein: 1.4, fat: 1.2, fiber: 1.1, sodium: 1.2, sugar: 1.0 };
const PLAN_NUT_WEIGHT_SUM = Object.values(PLAN_NUT_WEIGHTS).reduce((a, b) => a + b, 0);
// 영양소별 감점 상한을 가중치에 비례하게 배분 (원식은 100/영양소수 로 모두 같았음)
const PLAN_NUT_CAPS = Object.fromEntries(
  Object.entries(PLAN_NUT_WEIGHTS).map(([k, w]) => [k, 100 * w / PLAN_NUT_WEIGHT_SUM])
);
// 기준에서 이 비율만큼 벗어나면 해당 영양소 감점이 최대가 됨 (1/5 = 20%)
// ── 하드 리밋 ────────────────────────────────
// 감점만으로는 막지 못하는 영양소(나트륨 등)에 거는 「넘으면 추천하지 않는」 기준입니다.
//   PLAN_HARD_LIMITS  : 하루 합계가 「영양 기준 상한 × 계수」를 넘는 날이 하나라도 있으면 그 식단은 탈락
//   PLAN_DISH_SHARE   : 한 접시가 하루 상한에서 차지할 수 있는 최대 비율. 기준을 못 맞추면 다음 단계로 좁혀 다시 찾습니다
//   모든 단계에서 못 찾으면 식단을 내지 않고 사유를 돌려줍니다 (기준을 넘는 식단은 추천하지 않음)
const PLAN_HARD_LIMITS = { sodium: 1.0 };
const PLAN_DISH_SHARE = { sodium: [0.20, 0.15, 0.11] };

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
// 레시피 → { name, slot, kcal, fg:식품군 벡터, nut:Float64Array, keyIng, phytos }
function makeCandidate(name, slot) {
  const analysis = analyzeRecipe(name);
  if (!analysis || !analysis.ingredients.length) return null;
  const n = estimateDishNutrients(analysis);
  const nut = new Float64Array(PLAN_NUT_ALL.length);
  for (let i = 0; i < PLAN_NUT_ALL.length; i++) nut[i] = n[PLAN_NUT_ALL[i]] || 0;

  // 열량은 식재료 합으로 계산합니다 (레시피 DB 선언 총열량과는 반올림 때문에 1 kcal 안쪽으로 차이가 납니다.
  //  식재료 합은 영양소 추정값 nut[energy] 과도 같은 기준입니다)
  let kcalSum = 0, keyIng = '', keyG = -1;
  const phytos = {};
  for (const ing of analysis.ingredients) {
    kcalSum += ing.kcal || 0;
    if (typeof ing.grams === 'number' && ing.grams > keyG && ing.cat !== 'spices' && ing.cat !== 'oils') {
      keyG = ing.grams; keyIng = ing.name;
    }
    for (const [k, v] of Object.entries(ing.phytos || {})) phytos[k] = (phytos[k] || 0) + v;
  }
  return { name, slot, kcal: kcalSum, fg: foodGroupVector(name, analysis), nut, keyIng: keyIng || name, phytos, analysis };
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
function buildSlotPools({ allergies, rng, cap, dishMax, riceMax }) {
  cap = cap || 150;
  // dishMax: { sodium: mg } — 한 접시(1인분)가 넘으면 후보에서 뺀다. 걸러질 것을 감안해 더 많이 뽑는다
  const dishKeys = dishMax ? Object.keys(dishMax).map(k => [PLAN_NUT_KEYS.indexOf(k), dishMax[k]]).filter(([i]) => i >= 0) : [];
  const over = dishKeys.length ? 6 : 1.5;
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
    const want = Math.min(names.length, Math.round(cap * over));
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
      if (dishKeys.some(([i, lim]) => c.nut[i] > lim)) continue;
      out.push(c);
    }

    // divKey: 다양성·메뉴 궁합을 셀 때 쓰는 「같은 메뉴」 기준.
    // 밥은 양만 다른 변형을 여러 개 만들므로, 양이 달라도 같은 메뉴로 봅니다
    out.forEach((c, i) => { c.portion = 1; c.divKey = i; });
    pools[slot] = (slot === 'rice')
      ? out.flatMap((c, i) => RICE_PORTIONS.filter(f => f <= (riceMax || 1)).map(f => scaleCandidate(c, f, i)))
      : out;
  }
  return pools;
}

// ── 밥 양 ────────────────────────────────────
// 목표 칼로리를 맞추려면 밥 양을 조절하는 것이 가장 효과가 큽니다 (한 공기 ≈ 300 kcal).
// 밥 후보를 공기 수별로 만들어 두고 최적화가 직접 고르게 합니다
// 1공기를 넘는 양은 목표 칼로리가 높을 때만 후보에 넣습니다 (낮은 목표에서는 열량이 넘칩니다)
const RICE_LARGE_KCAL = 1800;
const RICE_PORTIONS = [0.6, 0.8, 1.0, 1.2, 1.5];

function scaleCandidate(c, factor, divKey) {
  if (factor === 1) return { ...c, portion: 1, divKey };
  const nut = new Float64Array(c.nut.length);
  for (let i = 0; i < nut.length; i++) nut[i] = c.nut[i] * factor;
  return { ...c, nut, kcal: c.kcal * factor, fg: c.fg.map(x => x * factor), portion: factor, divKey };
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

// 구독한 제품으로 설계할 수 있는 일수
//   하루에 제품 1회분 이상이 들어가도록 설계하므로,
//   두유 회분 수와 (파이토 + 프로틴바) 회분 수 중 큰 쪽이 상한입니다.
//   (끼니 대체는 두유 1 + 파이토나 프로틴바 1 을 한 쌍으로 쓰고, 남는 쪽은 곁들임으로 들어감)
function subscriptionDays(cart, maxDays) {
  const servingsOf = kind => (cart[kind] || []).reduce((s, code) => {
    const p = CATALOG_BY_CODE[code];
    return s + (p ? packServings(p) : 0);
  }, 0);
  const soymilk = servingsOf('soymilk');
  const other   = servingsOf('phyto') + servingsOf('bar');
  return Math.max(0, Math.min(maxDays || 30, Math.max(soymilk, other)));
}

// 30일을 채우려면 무엇을 더 담아야 하는지 (안내용)
function daysShortfallHint(cart, maxDays) {
  const cap = maxDays || 30;
  const servingsOf = kind => (cart[kind] || []).reduce((s, code) => {
    const p = CATALOG_BY_CODE[code];
    return s + (p ? packServings(p) : 0);
  }, 0);
  const soymilk = servingsOf('soymilk');
  const other   = servingsOf('phyto') + servingsOf('bar');
  const need = cap - Math.max(soymilk, other);
  if (need <= 0) return null;

  // 설계 일수 = max(두유 회분, 파이토+프로틴바 회분) 이므로,
  // 어느 한쪽을 cap 까지 끌어올리면 cap 일을 채울 수 있습니다
  const soymilkPack = CATALOG_BY_CODE[(cart.soymilk || [])[0]] || CATALOG_BY_CODE['A'];
  const packsFor = (pack, have) => Math.ceil((cap - have) / packServings(pack));
  return {
    need,
    soymilkName:  soymilkPack.name,
    soymilkPacks: packsFor(soymilkPack, soymilk),
    phytoPacks:   packsFor(CATALOG_BY_CODE['가'], other),
    barPacks:     packsFor(CATALOG_BY_CODE['나'], other),
  };
}

function productServingNutrients(items) {
  const nut = new Float64Array(PLAN_NUT_ALL.length);
  let kcal = 0;
  const phytos = {}, fg = new Float64Array(FG_LEN);
  for (const it of items) {
    const analysis = analyzeFood(it.name);
    if (!analysis) continue;
    const n = estimateDishNutrients(analysis);
    for (let i = 0; i < PLAN_NUT_ALL.length; i++) nut[i] += n[PLAN_NUT_ALL[i]] || 0;
    kcal += analysis.totalCal;
    foodGroupVector(it.name, analysis).forEach((x, i) => { fg[i] += x; });
    for (const ing of analysis.ingredients) {
      for (const [k, v] of Object.entries(ing.phytos || {})) phytos[k] = (phytos[k] || 0) + v;
    }
  }
  return { nut, kcal, fg, phytos };
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
  // 자리 순서: 제품이 아직 하나도 없는 날을 먼저 채운다.
  //   (그래야 설계한 일수 안에 밥스누 제품이 없는 날이 남지 않음)
  const hasProduct = d => !!(meals[d] && Object.keys(meals[d]).length);
  const slots = [];
  for (const type of EXTRA_PRIORITY) {
    for (let d = 0; d < days; d++) if (!hasProduct(d)) slots.push({ d, type });
    for (let d = 0; d < days; d++) if (hasProduct(d)) slots.push({ d, type });
  }
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
      // 제품이 하나도 안 들어간 날 (설계 일수 안에서) — 0 이어야 정상
      plainDays: Array.from({ length: days }, (_, d) =>
        !(meals[d] && Object.keys(meals[d]).length) && !(extras[d] && Object.keys(extras[d]).length) && !snacks[d]
      ).filter(Boolean).length,
    },
    leftover: { soymilk: Math.max(0, soymilk), phyto: Math.max(0, phyto), bar: Math.max(0, bar) },
  };
}

// ══════════════════════════════════════════════
// 영양 제약 (Python create_nutrient_constraints 대응)
// ══════════════════════════════════════════════
//   focus: planFocus 결과 — PFS 기준치(pfs)만 목표에 맞춰 고칩니다. min·max(영양 점수·나트륨 상한)는 그대로
function planConstraints(targets, focus) {
  const r = targets.ranges, k = targets.targetKcal;
  return {
    pfs: pfsStandards(r, focus, k),
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
  // fixed: { mealNut:Float64Array[], mealFg:식품군 벡터[], skip:Set<mealIndex> }
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
      skip: new Set(), mealNut: new Array(nm).fill(null), mealFg: new Array(nm).fill(null),
      extraNut: new Array(nm).fill(null), extraFg: new Array(nm).fill(null),
      snackNut: new Array(nd).fill(null), snackFg: new Array(nd).fill(null),
    }, fixed);
    this.gender = opts.gender;
    this.dietWeights = opts.dietWeights || null;
    this.pfsFlat = pfsFlat(constraints.pfs);
    this.nSlots = SLOT_IDS.length;
    this.rng = opts.rng || Math.random;
    // 하드 리밋: [영양소 인덱스, 하루 상한] — 상한이 없는(0) 영양소는 걸지 않는다
    this.hardIdx = Object.entries(PLAN_HARD_LIMITS)
      .map(([k, f]) => [PLAN_NUT_KEYS.indexOf(k), (constraints.max[k] || 0) * f])
      .filter(([i, lim]) => i >= 0 && lim > 0);
    this._viol = 0;

    // 표준화된 매개변수 (원본 Python 값에서 브라우저 실행 가능하게 축소)
    // ponytail: pop/gen/변이율은 체감 품질 대비 속도로 정한 값 — 서버 배치로 옮기면 원본(150/100)까지 올릴 수 있음
    this.populationSize  = opts.populationSize || 60;
    this.archiveSize     = opts.archiveSize || 40;
    this.mutationProb      = opts.mutationProb || 0.30;   // 끼니 단위
    this.mutationMenuProb  = opts.mutationMenuProb || 0.15; // 슬롯 단위
    this.crossoverProb   = opts.crossoverProb || 0.8;
    this.generations     = opts.generations || (this.hardIdx.length ? 120 : 60);   // 하드 리밋이 걸리면 탐색을 더 길게
    this.patience        = opts.patience || 12;

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
    const nk = PLAN_NUT_KEYS.length, na = PLAN_NUT_ALL.length;
    let total = 0, viol = 0, pfs = 0;
    const hard = this.hardIdx;
    const acc = new Float64Array(na);

    for (let d = 0; d < this.days; d++) {
      acc.fill(0);
      const sn = this.fixed.snackNut[d];
      if (sn) for (let i = 0; i < na; i++) acc[i] += sn[i];
      for (let mi = 0; mi < 3; mi++) {
        const m = d * 3 + mi;
        const fx = this.fixed.mealNut[m];
        if (fx) { for (let i = 0; i < na; i++) acc[i] += fx[i]; continue; }
        const ex = this.fixed.extraNut[m];
        if (ex) for (let i = 0; i < na; i++) acc[i] += ex[i];
        for (let s = 0; s < this.nSlots; s++) {
          const idx = gene[m * this.nSlots + s];
          if (idx < 0) continue;
          const nut = this.pools[s][idx].nut;
          for (let i = 0; i < na; i++) acc[i] += nut[i];
        }
      }
      for (const [i, lim] of hard) if (acc[i] > lim) viol += (acc[i] - lim) / lim;
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
      pfs += pfs100(pfsBasicFast(acc, this.pfsFlat));
    }
    this._viol = viol;
    this._pfs = pfs / this.days;   // 목적함수 5 — 같은 하루 합계로 내므로 여기서 함께 계산
    return Math.max(0, Math.min(100, total / this.days));
  }

  // ── 목적함수 2: 식단 지수 달성도 (하루 식품군 합계 → 식단 지수, 날짜 평균) ──
  evaluateDietIndex(gene) {
    let total = 0;
    const acc = new Float64Array(FG_LEN);
    const add = v => { if (v) for (let i = 0; i < FG_LEN; i++) acc[i] += v[i]; };
    for (let d = 0; d < this.days; d++) {
      acc.fill(0);
      add(this.fixed.snackFg[d]);
      for (let mi = 0; mi < 3; mi++) {
        const m = d * 3 + mi;
        if (this.fixed.mealNut[m]) { add(this.fixed.mealFg[m]); continue; }
        add(this.fixed.extraFg[m]);
        for (let s = 0; s < this.nSlots; s++) {
          const idx = gene[m * this.nSlots + s];
          if (idx >= 0) add(this.pools[s][idx].fg);
        }
      }
      total += Math.min(100, dietIndexOf(acc, this.gender, null, this.dietWeights) / DIET_INDEX_OPT_TARGET * 100);
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
    // 목적함수 5(PFS)는 evaluateNutrition 이 this._pfs 에 남깁니다
    const f = [this.evaluateNutrition(gene), this.evaluateDietIndex(gene), this.evaluateDiversity(gene), this.evaluateHarmony(gene)];
    f.push(this._pfs);
    // 하드 리밋을 넘는 날이 있으면 모든 목적 점수를 크게 깎아, 기준을 지키는 식단에 항상 지게 만든다
    if (this._viol > 0) { const pen = 100 + 100 * this._viol; return f.map(x => x - pen); }
    return f;
  }

  // 날짜별 영양소 합계 (PLAN_NUT_KEYS 순서) — 하드 리밋 확인·표시용
  dayTotals(gene) {
    const nk = PLAN_NUT_ALL.length, out = [];
    for (let d = 0; d < this.days; d++) {
      const acc = new Float64Array(nk);
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
      out.push(acc);
    }
    return out;
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

      // 개선 정체 기반 종료 (원본 check_termination 은 0세대에서 바로 종료됨)
      // ponytail: 시계로 끊지 않습니다 — 기기 속도에 따라 식단이 달라지면 안 되니까요. 느린 기기에서 오래 걸리면 generations 를 줄이세요
      const bestNow = Math.max(...this.archive.map(g => this.cachedFitness(g).reduce((a, b) => a + b, 0)));
      if (bestNow > best + 1e-6) { best = bestNow; stale = 0; } else { stale++; }
      if (onProgress) onProgress(gen, this.generations, best / 5);
      if (stale >= this.patience) { gen++; break; }

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

    // 5목적 합이 가장 큰 해를 대표해로 선택
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
//   opts: { profile, targets, cart, days, allergies, seed, onProgress, noProducts, goals, grades }
//   goals·grades: 관리 목표 id 목록 · diseaseGrades() 결과 — 주요 건강 목표(식단 지수 가중치·PFS 기준치)를 정합니다
//   noProducts: 제품 없이 days 일을 모두 일반 식단으로 설계 (웰니스 파이프라인의 부족분 산출용)
//   반환: { days:[...], score, meta }
// ══════════════════════════════════════════════
function generateMealPlan({ profile, targets, cart, days, allergies, seed, onProgress, noProducts, goals, grades }) {
  // days 는 상한. 실제 설계 일수는 구독량이 커버하는 만큼만 (남는 날을 일반 식단으로 채우지 않음)
  const maxDays = days || 30;
  if (noProducts) cart = {};
  days = noProducts ? maxDays : subscriptionDays(cart, maxDays);
  if (days < 1) return { error: '제품을 1개 이상 담으면 식단을 설계할 수 있어요.' };
  const rng = makeRng(seed != null ? seed : hashSeed(JSON.stringify([profile.gender, profile.age, profile.height, profile.weight, targets.targetKcal])));
  const riceMax = targets.targetKcal > RICE_LARGE_KCAL ? Infinity : 1;

  let pools = buildSlotPools({ allergies, rng, cap: 150, riceMax });
  const thin = SLOT_IDS.filter(s => pools[s].length < 5);
  if (thin.length) return { error: '후보 메뉴가 부족한 항목: ' + thin.map(s => DISH_SLOTS.find(x => x.id === s).name).join('·') };

  const products = planProductMeals(cart, days, rng);
  const nk = PLAN_NUT_KEYS.length;
  const mealIndex = type => MEAL_TYPES.findIndex(t => t.id === type);
  const fixed = {
    skip: new Set(), mealNut: new Array(days * 3).fill(null), mealFg: new Array(days * 3).fill(null),
    extraNut: new Array(days * 3).fill(null), extraFg: new Array(days * 3).fill(null),
    snackNut: new Array(days).fill(null), snackFg: new Array(days).fill(null),
  };
  // 통째로 대체한 끼니 — 최적화 대상에서 제외하고 영양을 고정값으로
  for (const [dStr, byType] of Object.entries(products.meals)) {
    const d = Number(dStr);
    for (const pm of Object.values(byType)) {
      const m = d * 3 + mealIndex(pm.type);
      fixed.skip.add(m);
      fixed.mealNut[m] = pm.nut;
      fixed.mealFg[m] = pm.fg;
    }
  }
  // 곁들임 — 일반 끼니에 더해지는 영양
  for (const [dStr, byType] of Object.entries(products.extras)) {
    const d = Number(dStr);
    for (const [type, ex] of Object.entries(byType)) {
      const m = d * 3 + mealIndex(type);
      fixed.extraNut[m] = ex.nut;
      fixed.extraFg[m] = ex.fg;
    }
  }
  for (const [dStr, sn] of Object.entries(products.snacks)) {
    const d = Number(dStr);
    fixed.snackNut[d] = sn.nut;
    fixed.snackFg[d] = sn.fg;
  }

  const focus = planFocus(goals, grades), dietWeights = dietIndexWeights(focus);
  const constraints = planConstraints(targets, focus);
  const gender = profile.gender;
  // ── 하드 리밋을 지키는 식단을 찾을 때까지 접시당 상한을 좁혀 가며 다시 최적화 ──
  const hardKeys = Object.keys(PLAN_HARD_LIMITS).filter(k => constraints.max[k] > 0);
  const steps = hardKeys.length ? Math.max(...hardKeys.map(k => (PLAN_DISH_SHARE[k] || [1]).length)) : 1;
  let opt = null, result = null, totals = null, overDays = 0, dishMaxUsed = null, tries = 0;
  for (let st = 0; st < steps; st++) {
    const dishMax = {};
    for (const k of hardKeys) {
      const sh = PLAN_DISH_SHARE[k] || [1];
      dishMax[k] = constraints.max[k] * PLAN_HARD_LIMITS[k] * sh[Math.min(st, sh.length - 1)];
    }
    const p2 = hardKeys.length ? buildSlotPools({ allergies, rng, cap: 150, dishMax, riceMax }) : pools;
    if (SLOT_IDS.some(sid => p2[sid].length < 5)) continue;
    pools = p2; tries++;
    opt = new SPEA2DietOptimizer(pools, constraints, fixed, { days, rng, gender, dietWeights });
    result = opt.optimize(opt.randomGene(), onProgress);
    totals = opt.dayTotals(result.gene);
    overDays = totals.filter(t => opt.hardIdx.some(([i, lim]) => t[i] > lim)).length;
    dishMaxUsed = dishMax;
    if (!overDays) break;
  }
  const hardInfo = Object.fromEntries(hardKeys.map(k => {
    const i = PLAN_NUT_KEYS.indexOf(k), vals = totals ? totals.map(t => t[i]) : [];
    return [k, { limit: Math.round(constraints.max[k] * PLAN_HARD_LIMITS[k]),
      maxDay: vals.length ? Math.round(Math.max(...vals)) : null,
      avgDay: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
      dishMax: dishMaxUsed ? Math.round(dishMaxUsed[k]) : null }];
  }));
  if (!result) return { error: '영양 기준 상한을 지키는 후보 메뉴가 부족해 식단을 만들지 못했어요.', hardLimit: hardInfo };
  if (overDays) return {
    error: '영양 기준 상한(' + hardKeys.map(k => (k === 'sodium' ? '나트륨 ' : k + ' ') + hardInfo[k].limit + ' mg/일').join(', ')
      + ')을 지키는 식단을 찾지 못했어요. 기준을 넘는 식단은 추천하지 않아요.',
    hardLimit: hardInfo, overDays, tries,
  };

  // ── 계산 결과 → 사람이 읽는 식단 ──
  // 끼니·간식마다 식품군 벡터(fg)를 남깁니다 — 기록 화면이 실제로 먹은 끼니만 더해 식단 지수를 다시 냅니다
  const fgOut = v => Array.from(v, x => +x.toFixed(3));
  const addTo = (acc, v) => { for (let i = 0; i < FG_LEN; i++) acc[i] += v[i]; };
  const servSum = {};
  const out = [];
  for (let d = 0; d < days; d++) {
    const dayFg = new Float64Array(FG_LEN);
    const meals = MEAL_TYPES.map((mt, mi) => {
      const m = d * 3 + mi;
      const pm = (products.meals[d] || {})[mt.id];
      if (pm) {
        addTo(dayFg, pm.fg);
        return { type: mt.id, name: mt.name, icon: mt.icon, kind: 'product', combo: pm.combo,
          items: pm.items.map(i => i.name), kcal: Math.round(pm.kcal), fg: fgOut(pm.fg) };
      }
      const mealFg = new Float64Array(FG_LEN);
      const dishes = MEAL_SLOT_INDEXES[mi].map(s => {
        const idx = result.gene[m * SLOT_IDS.length + s];
        const c = pools[SLOT_IDS[s]][idx];
        addTo(mealFg, c.fg);
        return { slot: SLOT_IDS[s], slotName: DISH_SLOTS[s].name, icon: DISH_SLOTS[s].icon,
          name: c.name, portion: c.portion, kcal: Math.round(c.kcal) };
      });
      const ex = (products.extras[d] || {})[mt.id];
      if (ex) addTo(mealFg, ex.fg);
      addTo(dayFg, mealFg);
      return { type: mt.id, name: mt.name, icon: mt.icon, kind: 'food', dishes,
        extras: ex ? { items: ex.items.map(i => i.name), kcal: Math.round(ex.kcal) } : null,
        kcal: dishes.reduce((s, x) => s + x.kcal, 0) + (ex ? Math.round(ex.kcal) : 0), fg: fgOut(mealFg) };
    });
    const sn = products.snacks[d];
    if (sn) addTo(dayFg, sn.fg);
    const snack = sn ? { kind: 'product', items: sn.items.map(i => i.name), kcal: Math.round(sn.kcal), fg: fgOut(sn.fg) } : null;
    const kcal = meals.reduce((s, x) => s + x.kcal, 0) + (snack ? snack.kcal : 0);
    const serv = dietServ(dayFg);
    for (const k in serv) servSum[k] = (servSum[k] || 0) + serv[k];
    out.push({ day: d + 1, meals, snack, kcal, dietIndex: +dietIndexOf(dayFg, gender, serv, dietWeights).toFixed(1),
      pfs: +pfsBasic(totals[d], constraints.pfs).toFixed(2),
      sodium: Math.round(totals[d][PLAN_NUT_KEYS.indexOf('sodium')]) });
  }

  // 식품군(식단 지수 성분)별 하루 평균 섭취량과 목표 — 이후 「부족 식품군 산출」 단계에서 씁니다.
  //   목표는 그 성분의 「가장 좋은 값」. 점수마다 다르면 가장 엄격한 값(늘릴 것은 큰 값, 줄일 것은 작은 값)
  const groups = {};
  for (const { comps } of DIET_INDEX_DEFS) for (const c of comps) {
    const r = (gender !== 'male' && c.rangeW) ? c.rangeW : c.range, good = r[1] > r[0];
    const g = groups[c.c] || (groups[c.c] = { key: c.c, label: c.label, unit: c.unit, good, target: r[1] });
    g.target = good ? Math.max(g.target, r[1]) : Math.min(g.target, r[1]);
    g.avg = +(servSum[c.c] / days).toFixed(2);
  }

  const [nutrition, dietIndex, diversity, harmony, pfs] = result.fitness;
  return {
    days: out,
    score: { nutrition: +nutrition.toFixed(1), dietIndex: +dietIndex.toFixed(1), diversity: +diversity.toFixed(1), harmony: +harmony.toFixed(1), pfs: +pfs.toFixed(1) },
    meta: {
      generations: result.generations, elapsedMs: result.elapsedMs, archiveSize: result.archiveSize,
      days, maxDays,
      dietIndexKey: DIET_INDEX_KEY || 'overall', dietIndexOptTarget: DIET_INDEX_OPT_TARGET,
      focus, dietIndexWeights: dietWeights,
      pfsStandards: constraints.pfs, avgPfs: +(out.reduce((s, d) => s + d.pfs, 0) / out.length).toFixed(2),
      shortfall: daysShortfallHint(cart, maxDays),
      poolSizes: Object.fromEntries(SLOT_IDS.map(s => [s, pools[s].length])),
      productMealDays: Object.keys(products.meals).length,
      coverage: products.coverage,
      leftover: products.leftover,
      targetKcal: targets.targetKcal,
      hardLimit: hardInfo, hardLimitTries: tries,
      avgKcal: Math.round(out.reduce((s, d) => s + d.kcal, 0) / out.length),
      avgDietIndex: +(out.reduce((s, d) => s + d.dietIndex, 0) / out.length).toFixed(1),
      foodGroups: Object.values(groups),
    },
  };
}
