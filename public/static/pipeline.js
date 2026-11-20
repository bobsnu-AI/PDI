// ══════════════════════════════════════════════
// 웰니스 파이프라인
//   F1 목표 기능성 성분 → F2 부족분 → F3 부족분 기반 제품 선정 → F4 재추천
//   F5 이미지 인식 결과 환산 · F6 위험도 → 영양 기준 · F7 원터치 기록
//   표(대응표·제품 함량·조정 규칙)는 wellness-data.js, 설정값은 아래 WELLNESS_CONFIG 한곳.
// ══════════════════════════════════════════════
const WELLNESS_CONFIG = {
  PIPELINE_MODE: 'legacy',            // 'legacy'(기존 룰테이블) | 'deficit_based'(부족분 기반)
  // F1
  maxTargets: 5,                      // 목표 성분 최대 개수
  riskAmountFactor: { low: 1.0, mid: 1.0 },   // 위험·보통 등급의 필요 섭취량 가중 계수 (기본 1.0 = 늘리지 않음)
  // F3
  maxProducts: 3,                     // 조합당 제품 수 상한
  defaultServingsPerDay: 1,           // serving_per_day_max 가 비어 있을 때 1일 섭취 횟수
  scoreWeights: { excess: 1, cost: 0.1, overlap: 0.05 },
  costScale: 100000,                  // 비용 벌점 = cost × 월 비용 ÷ costScale
  monthlyBudget: null,                // 월 예산 상한(원). null 이면 제한 없음
  refitMaxIter: 2,                    // 제품 반영 → 부족분 재계산 반복 상한
  cycleDays: 30,                      // 구독 주기
  // F4
  refreshDays: 7,                     // 정기 재산출 주기
  intakeWindowDays: 14,               // 섭취 기록을 볼 최근 일수
  gradeMinLogDays: 3,        // 기록이 이 일수보다 적으면 위험등급을 다시 매기지 않음 (잠정값 · 연구진 확인 필요)
  fillRateMin: 0.8,                   // 충족률 기준
  fillRateLowDays: 3,                 // 기준 미만이 이 일수만큼 이어지면 재추천
  phaseKgPerWeek: 0.2,                // 체중 추이 단계 경계 (tracker.js retargetSuggestion 과 같은 값)
  // F5
  imageConfidenceMin: 0.6,            // 이 미만이면 자동 저장하지 않고 확인 요청
  // F7
  portionRatios: { all: 1, half: 0.5, little: 0.25 },
  logMax: 200,                        // 보관할 단계 로그 수
};
// 코드를 고치지 않고 모드를 바꿔 볼 수 있게: localStorage 'bobsnu-pipeline-mode'
try {
  const m = localStorage.getItem('bobsnu-pipeline-mode');
  if (m === 'legacy' || m === 'deficit_based') WELLNESS_CONFIG.PIPELINE_MODE = m;
} catch (e) {}

const wlRound = v => v == null ? null : +v.toPrecision(6);   // 유효숫자 6자리 (g 단위의 작은 값도 살린다)
const wlDeficitMode = () => WELLNESS_CONFIG.PIPELINE_MODE === 'deficit_based';

// ── 단계별 입력·출력 로그 ─────────────────────
const WELLNESS_LOG = (() => {   // 새로고침해도 이전 로그를 이어 씁니다
  try { return JSON.parse(localStorage.getItem('bobsnu-wellness-log')) || []; } catch (e) { return []; }
})();
function stepLog(userId, step, input, output) {
  WELLNESS_LOG.push(JSON.parse(JSON.stringify({
    user_id: userId || 'local', at: new Date().toISOString(), step, input, output,
    versions: WELLNESS_DATA_VERSION,
  })));
  if (WELLNESS_LOG.length > WELLNESS_CONFIG.logMax) WELLNESS_LOG.shift();
  try { localStorage.setItem('bobsnu-wellness-log', JSON.stringify(WELLNESS_LOG)); } catch (e) {}
  return output;
}

// ── 단위 변환 (g · mg · μg) ───────────────────
const WL_UNIT = { g: 1e6, mg: 1e3, 'μg': 1, 'µg': 1, ug: 1, mcg: 1 };
function convertUnit(v, from, to) {
  if (v == null || from === to) return v;
  if (!WL_UNIT[from] || !WL_UNIT[to]) throw new Error('변환할 수 없는 단위: ' + from + ' → ' + to);
  return v * WL_UNIT[from] / WL_UNIT[to];
}

const wlGrades = grades => (grades || []).map(g => ({ key: g.key, name: g.name, tier: g.tier, position: g.position }));

// ══════════════════════════════════════════════
// F1. 목표 기능성 성분·필요 섭취량
//   grades: diseaseGrades() 결과 · goals: 관리목표 id 목록 · allergies: 알레르기 id 목록
// ══════════════════════════════════════════════
function functionalTargets({ userId, grades, goals, allergies, table, allergenMap }) {
  const cfg = WELLNESS_CONFIG;
  // (1) 대상 수집 — rank: 위험 0 > 보통 1 > 관리목표 2
  const active = {};
  for (const g of goals || []) {
    active['goal:' + g] = { rank: 2, tier: null, label: '관리목표: ' + ((HEALTH_GOALS.find(x => x.id === g) || {}).name || g) };
  }
  for (const d of grades || []) {
    if (d.tier.key !== 'high') active[d.key] = { rank: d.tier.key === 'low' ? 0 : 1, tier: d.tier.key, label: d.name + ' ' + d.tier.label };
  }
  // (2)(3) 조회·병합 — 필요량은 최댓값, 상한은 최솟값
  const merged = {};
  for (const row of table || FUNCTIONAL_TARGETS) {
    const a = active[row.target_id];
    if (!a) continue;
    const m = merged[row.component_id] || (merged[row.component_id] = {
      component_id: row.component_id, name: row.component_name, daily_amount: null, unit: row.unit,
      upper_limit: null, reason: [], rank: 9, tablePriority: Infinity, source: [], needs_review: false,
    });
    const amt = row.daily_amount == null ? null
      : convertUnit(row.daily_amount, row.unit, m.unit) * (a.tier ? cfg.riskAmountFactor[a.tier] : 1);
    const up = convertUnit(row.upper_limit, row.unit, m.unit);
    if (amt != null) m.daily_amount = m.daily_amount == null ? amt : Math.max(m.daily_amount, amt);
    if (up != null)  m.upper_limit  = m.upper_limit == null ? up : Math.min(m.upper_limit, up);
    m.reason.push(a.label);
    m.rank = Math.min(m.rank, a.rank);
    m.tablePriority = Math.min(m.tablePriority, row.priority == null ? 99 : row.priority);
    if (row.source && !m.source.includes(row.source)) m.source.push(row.source);
    if (row.needs_review || row.daily_amount == null) m.needs_review = true;
  }
  // (4) 알레르기 연관 성분 제외
  const allergySet = new Set(allergies || []);
  const amap = allergenMap || COMPONENT_ALLERGENS;
  const excluded = [], kept = [];
  for (const m of Object.values(merged)) {
    const hit = (amap[m.component_id] || []).filter(a => allergySet.has(a));
    if (hit.length) excluded.push({ component_id: m.component_id, name: m.name, reason: '알레르기 연관: ' + hit.join(', ') });
    else kept.push(m);
  }
  // (4)(5) 위험 > 보통 > 관리목표, 그 안에서 표의 priority 순 → 상위 maxTargets 개
  kept.sort((x, y) => x.rank - y.rank || x.tablePriority - y.tablePriority || x.component_id.localeCompare(y.component_id));
  // 필요량이 상한보다 크면 상한까지만 권한다 (여러 행이 겹쳐 필요량 최댓값 > 상한 최솟값이 될 수 있다)
  const capped = m => m.daily_amount != null && m.upper_limit != null ? Math.min(m.daily_amount, m.upper_limit) : m.daily_amount;
  const targets = kept.slice(0, cfg.maxTargets).map((m, i) => ({
    component_id: m.component_id, name: m.name, daily_amount: wlRound(capped(m)), unit: m.unit,
    upper_limit: wlRound(m.upper_limit), reason: m.reason, priority: i + 1,
    source: m.source.join(' / '), needs_review: m.needs_review,
  }));
  return stepLog(userId, 'F1_functional_targets',
    { grades: wlGrades(grades), goals: [...(goals || [])], allergies: [...allergySet] },
    { user_id: userId || 'local', targets, excluded, rule_version: WELLNESS_DATA_VERSION.functional_targets });
}

// ══════════════════════════════════════════════
// F2. 부족분
// ══════════════════════════════════════════════
// 레시피 DB 가 함량을 가진 성분 코드 (여기 없는 성분은 공급 0 + data_missing)
let WL_KNOWN_COMPONENTS = null;
function knownComponentIds() {
  if (!WL_KNOWN_COMPONENTS) {
    WL_KNOWN_COMPONENTS = new Set();
    for (const ing of Object.values(INGREDIENTS)) {
      if (ing.phytos && typeof ing.phytos === 'object' && !Array.isArray(ing.phytos))
        for (const k of Object.keys(ing.phytos)) WL_KNOWN_COMPONENTS.add(k);
    }
  }
  return WL_KNOWN_COMPONENTS;
}

// 음식 1개의 기능성 성분(mg) — 식재료는 100 g 당 함량 × 중량, 밥스누 제품은 1회 제공량 × 횟수
function addAnalysisComponents(analysis, out) {
  for (const ing of analysis.ingredients) {
    const ph = (INGREDIENTS[ing.name] || {}).phytos;
    if (!ph || typeof ph !== 'object' || Array.isArray(ph)) continue;
    const f = typeof ing.grams === 'number' ? ing.grams / 100 : (ing.servings || parseFloat(ing.grams) || 1);
    for (const [k, v] of Object.entries(ph)) out[k] = (out[k] || 0) + v * f;
  }
  return out;
}

// 하루치 음식 [{ name, analysis }] → { nut, comp }.  영양소는 식사 기록 화면(renderDiary)과 같은 계산.
function intakeOfMeals(meals) {
  const nut = emptyNutrients(), comp = {};
  let kcal = 0;
  for (const m of meals) {
    const n = estimateDishNutrients(m.analysis);
    for (const k of PFS_NUTRIENT_KEYS) nut[k] += n[k] || 0;
    kcal += m.analysis.totalCal;
    addAnalysisComponents(m.analysis, comp);
  }
  nut.energy = kcal;
  return { nut, comp };
}

// 식단의 끼니 하나 → [[음식 이름, 인분]]
function planMealItems(meal) {
  if (!meal) return [];
  if (meal.kind === 'product' || !meal.dishes) return (meal.items || []).map(n => [n, 1]);
  return meal.dishes.map(d => [d.name, d.portion || 1]).concat(meal.extras ? meal.extras.items.map(n => [n, 1]) : []);
}

// 식단의 하루 → [{ name, analysis }].  foodOnly 면 밥스누 제품을 뺀다 (제품 선정용 부족분 계산)
function planDayMeals(day, foodOnly) {
  const items = day.meals.flatMap(planMealItems).concat(planMealItems(day.snack));
  return items
    .filter(([n]) => !(foodOnly && (INGREDIENTS[n] || {}).cat === 'bobsnu'))
    .map(([n, p]) => { const a = analyzeFood(n); return a ? { name: n, analysis: scaleAnalysis(a, p) } : null; })
    .filter(Boolean);
}

// 개인 영양 기준 → [{ id, lower, upper, unit }]
function nutrientBounds(targets) {
  const rg = targets.ranges;
  const b = [{ id: 'energy', lower: Math.round(targets.targetKcal * 0.9), upper: Math.round(targets.targetKcal * 1.1), unit: 'kcal' }];
  for (const k of ['carb', 'protein', 'fat']) b.push({ id: k, lower: rg[k][0], upper: rg[k][1], unit: 'g' });
  b.push({ id: 'fiber', lower: rg.fiber, upper: null, unit: 'g' });
  for (const [k, unit] of [['sugar', 'g'], ['satfat', 'g'], ['trans', 'g'], ['chol', 'mg'], ['sodium', 'mg']])
    b.push({ id: k, lower: null, upper: rg[k], unit });
  return b;
}

// basis: 'meal_plan' | 'no_meal_plan' | 'intake_log'
// days : [{ nut, comp }] (intakeOfMeals 결과). 식단 미이용이면 null
function deficitReport({ userId, basis, targets, ftargets, days, note }) {
  const noPlan = basis === 'no_meal_plan' || !days || !days.length;
  if (noPlan && basis !== 'intake_log') basis = 'no_meal_plan';
  const n = noPlan ? 0 : days.length;
  const avg = get => noPlan ? 0 : days.reduce((s, d) => s + (get(d) || 0), 0) / n;

  // 식단이 없으면 영양소 부족분은 계산하지 않는다
  const nutrients = noPlan ? [] : nutrientBounds(targets).map(b => {
    const supply = avg(d => d.nut[b.id]);
    return {
      id: b.id, need: wlRound(b.lower), upper: wlRound(b.upper), supply: wlRound(supply),
      deficit: b.lower == null ? 0 : wlRound(Math.max(0, b.lower - supply)),
      excess:  b.upper == null ? null : wlRound(Math.max(0, supply - b.upper)),
      unit: b.unit,
    };
  });

  const known = knownComponentIds();
  const fill = (t, d) => Math.max(0, Math.min(1, convertUnit(d.comp[t.component_id] || 0, 'mg', t.unit) / t.daily_amount));
  const components = ftargets.targets.map(t => {
    const supply = convertUnit(avg(d => d.comp[t.component_id]), 'mg', t.unit);
    const need = t.daily_amount;
    return {
      id: t.component_id, need, supply: wlRound(supply),
      deficit:   need == null ? null : wlRound(Math.max(0, need - supply)),    // 필요량이 비어 있으면 계산하지 않고 표시만
      fill_rate: need > 0 ? wlRound(Math.max(0, Math.min(1, supply / need))) : null,
      excess:    t.upper_limit == null ? null : wlRound(Math.max(0, supply - t.upper_limit)),
      unit: t.unit, data_missing: !known.has(t.component_id), needs_review: !!t.needs_review,
    };
  });
  // 날짜별 충족률 (필요량이 있는 성분의 평균) — F4 의 「기준 미만 N일 연속」 판단용
  const withNeed = ftargets.targets.filter(t => t.daily_amount > 0);
  const daily_fill_rate = noPlan || !withNeed.length ? []
    : days.map(d => wlRound(withNeed.reduce((s, t) => s + fill(t, d), 0) / withNeed.length));

  return stepLog(userId, 'F2_deficit', { basis, days: n, note: note || null, targets: ftargets.targets.map(t => t.component_id) },
    { basis, days: n, nutrients, components, daily_fill_rate });
}

// ══════════════════════════════════════════════
// F3. 부족분 기반 제품 선정
// ══════════════════════════════════════════════
// 카탈로그 → 제품 규격. 성분 함량은 PRODUCT_SPEC_OVERRIDES 가 있으면 그 값, 없으면 원재료 기반 추정값.
function productSpecs() {
  return BOBSNU_CATALOG.map(p => {
    const o = PRODUCT_SPEC_OVERRIDES[p.code] || {};
    const est = Object.entries((INGREDIENTS[p.name] || {}).phytos || {}).filter(([, v]) => v > 0)
      .map(([k, v]) => ({ component_id: k, amount: wlRound(v), unit: 'mg' }));
    const components = o.components || est;
    return {
      product_id: p.code, name: p.name, kind: p.kind,
      components, components_estimated: !o.components,
      nutrients: p.nut || null,
      serving_per_day_max: o.serving_per_day_max == null ? null : o.serving_per_day_max,
      price_per_serving: Math.round(p.price / packServings(p)),
      pack_price: p.price, pack_servings: packServings(p),
      allergens: p.allergens || [],
      contraindications: o.contraindications || null,
      meal_replace: o.meal_replace == null ? null : o.meal_replace,
      source: o.source || (components.length ? 'products.js productPhytos (원재료 기반 추정 · 실측 아님)' : null),
      needs_review: o.needs_review == null ? true : o.needs_review,
    };
  });
}

// deficit: F2 출력 · ftargets: F1 출력
function selectProducts({ userId, deficit, ftargets, allergies, conditions, specs, budget }) {
  const cfg = WELLNESS_CONFIG, w = cfg.scoreWeights;
  const allergySet = new Set(allergies || []), condSet = new Set(conditions || []);
  budget = budget == null ? cfg.monthlyBudget : budget;

  // (1) 알레르기·주의 대상·함량 없는 제품 제외
  const excluded = [], cands = [];
  for (const s of specs || productSpecs()) {
    const hits = s.allergens.filter(a => allergySet.has(a));
    const contra = (s.contraindications || []).filter(c => condSet.has(c));
    if (hits.length)        excluded.push({ product_id: s.product_id, reason: '알레르기: ' + hits.join(', ') });
    else if (contra.length) excluded.push({ product_id: s.product_id, reason: '섭취 주의 대상: ' + contra.join(', ') });
    else if (!s.components.length) excluded.push({ product_id: s.product_id, reason: '성분 함량 없음 (needs_review)' });
    else cands.push(s);
  }

  // 채워야 할 성분 — 우선순위(목록 순서)가 높을수록 가중치가 크다
  const upperOf = {};
  for (const t of ftargets.targets) upperOf[t.component_id] = t.upper_limit;
  const comps = deficit.components.map((c, i) => ({ ...c, weight: 1 / (i + 1) }));
  const needs = comps.filter(c => c.deficit > 0);
  const wSum = needs.reduce((s, c) => s + c.weight, 0);

  const evaluate = picked => {
    const sup = {}, suppliers = {}, perProduct = [];
    let monthly = 0;
    const nutAdd = {};
    for (const { spec, n } of picked) {
      const covers = [];
      for (const c of spec.components) {
        const t = comps.find(x => x.id === c.component_id);
        if (!t) continue;
        const amt = convertUnit(c.amount * n, c.unit, t.unit);
        sup[t.id] = (sup[t.id] || 0) + amt;
        suppliers[t.id] = (suppliers[t.id] || 0) + 1;
        covers.push({ component_id: t.id, amount: wlRound(amt) });
      }
      for (const [k, v] of Object.entries(spec.nutrients || {})) nutAdd[k] = (nutAdd[k] || 0) + v * n;
      const packs = Math.ceil(cfg.cycleDays * n / spec.pack_servings);
      monthly += packs * spec.pack_price;
      perProduct.push({ product_id: spec.product_id, name: spec.name, servings_per_day: n, packs_per_cycle: packs, covers });
    }
    if (budget != null && monthly > budget) return null;
    // 성분 상한 — 식단 + 제품이 상한을 넘기는 조합은 버린다
    for (const c of comps) {
      const up = upperOf[c.id];
      if (up != null && sup[c.id] > 0 && c.supply + sup[c.id] > up) return null;
    }
    const fill = wSum ? needs.reduce((s, c) => s + c.weight * Math.min(sup[c.id] || 0, c.deficit) / c.deficit, 0) / wSum : 0;
    // 영양소 상한 — 제품 때문에 늘어난 초과분만큼 벌점
    let excess = 0;
    for (const nu of deficit.nutrients) {
      if (nu.upper == null || !nutAdd[nu.id]) continue;
      excess += (Math.max(0, nu.supply + nutAdd[nu.id] - nu.upper) - Math.max(0, nu.supply - nu.upper)) / nu.upper;
    }
    const overlap = Object.values(suppliers).reduce((s, k) => s + Math.max(0, k - 1), 0);
    const score = {
      fill: wlRound(fill), excess_penalty: wlRound(w.excess * excess),
      cost_penalty: wlRound(w.cost * monthly / cfg.costScale), overlap_penalty: wlRound(w.overlap * overlap),
    };
    score.total = wlRound(fill - w.excess * excess - w.cost * monthly / cfg.costScale - w.overlap * overlap);
    return {
      selected: perProduct, monthly_cost: monthly, score,
      remaining_deficit: comps.map(c => ({ component_id: c.id, unit: c.unit,
        deficit: c.deficit == null ? null : wlRound(Math.max(0, c.deficit - (sup[c.id] || 0))) })),
    };
  };

  // (2) 조합 탐색 — 빈 조합(제품 없음)도 후보
  // ponytail: 전수 탐색. 15종·3개 한도에서 수백 조합이라 충분함. 제품이 수십 종으로 늘면 탐욕 탐색으로.
  const results = [];
  const walk = (start, picked) => {
    const r = evaluate(picked);
    if (r) results.push(r);
    if (picked.length >= cfg.maxProducts) return;
    for (let i = start; i < cands.length; i++) {
      const max = cands[i].serving_per_day_max || cfg.defaultServingsPerDay;
      for (let n = 1; n <= max; n++) walk(i + 1, picked.concat({ spec: cands[i], n }));
    }
  };
  walk(0, []);
  results.sort((a, b) => b.score.total - a.score.total || a.monthly_cost - b.monthly_cost);

  const best = results[0];
  return stepLog(userId, 'F3_select_products',
    { deficit: deficit.components.map(c => ({ id: c.id, deficit: c.deficit, unit: c.unit })), allergies: [...allergySet],
      conditions: [...condSet], candidates: cands.map(s => s.product_id), budget },
    { ...best,
      alternatives: results.slice(1, 3).map(r => ({ selected: r.selected, score: r.score, monthly_cost: r.monthly_cost })),
      excluded, product_version: WELLNESS_DATA_VERSION.product_specs });
}

// 선정 결과 → 기존 구독 장바구니 형식 { soymilk:[code…], phyto:[…], bar:[…], addon:[…] }
function selectionToCart(selection) {
  const cart = { soymilk: [], phyto: [], bar: [], addon: [] };
  for (const s of selection.selected) {
    const p = CATALOG_BY_CODE[s.product_id];
    for (let i = 0; i < s.packs_per_cycle; i++) cart[p.kind].push(p.code);
  }
  return cart;
}

// ══════════════════════════════════════════════
// F6. 질환 위험도 → 영양 기준 조정
//   값이 채워진 규칙만 적용. 겹치면 더 엄격한 쪽(상한은 최솟값, 하한은 최댓값).
//   locked: 질환 제한량 공식이 이미 정한 영양소 id — 그쪽이 우선이라 건드리지 않는다.
// ══════════════════════════════════════════════
function applyRiskAdjust(ranges, grades, rules, locked) {
  const after = JSON.parse(JSON.stringify(ranges)), applied = [];
  for (const r of rules || RISK_ADJUST_RULES) {
    if (r.value == null || (locked && locked.includes(r.nutrient)) || !(r.nutrient in after)) continue;
    if (!(grades || []).some(g => g.key === r.disease && g.tier.label === r.risk)) continue;
    const cur = after[r.nutrient], pair = Array.isArray(cur);
    const upper = r.mode === 'upper_reduce';
    // 하나짜리 기준은 식이섬유만 하한, 나머지는 상한
    if (!pair && upper === (r.nutrient === 'fiber')) continue;
    const from = pair ? cur[upper ? 1 : 0] : cur;
    const to = upper ? Math.min(from, r.value) : Math.max(from, r.value);
    if (pair) cur[upper ? 1 : 0] = to; else after[r.nutrient] = to;
    applied.push({ disease: r.disease, risk: r.risk, nutrient: r.nutrient, mode: r.mode, from, to, source: r.source || null });
  }
  return { before: ranges, after, applied, rule_version: WELLNESS_DATA_VERSION.risk_adjust_rules };
}

// currentTargets() 가 부르는 연결점 — 규칙표가 비었거나 legacy 모드면 아무것도 하지 않는다
function wellnessAdjustTargets(t) {
  if (!wlDeficitMode() || !RISK_ADJUST_RULES.some(r => r.value != null)) return t;
  const grades = (typeof pdiResult !== 'undefined' && pdiResult && pdiResult.meals)
    ? diseaseGrades(scoreDietPatterns(pdiResult.meals, pdiResult.servings, pdiResult.profile.gender, pdiResult.profile))
    : (((tracker || {}).wellness || {}).last || {}).grades;
  const adj = applyRiskAdjust(t.ranges, grades);
  t.rangesBefore = adj.before;
  t.ranges = adj.after;
  t.riskAdjust = adj.applied;
  return t;
}

// ══════════════════════════════════════════════
// 전체 흐름 (deficit_based)
//   식단 이용:   F1 → 식단 최적화(제품 없이) → F2 → F3 → 제품을 식단에 반영 → F2 (최대 refitMaxIter 회)
//   식단 미이용: F1 → F2(no_meal_plan) → F3
// ══════════════════════════════════════════════
function runDeficitPipeline({ userId, profile, grades, goals, allergies, targets, useMealPlan, seed, table, specs, rules }) {
  const cfg = WELLNESS_CONFIG;
  const adj = applyRiskAdjust(targets.ranges, grades, rules);
  stepLog(userId, 'F6_risk_adjust', { grades: wlGrades(grades), ranges: adj.before }, { ranges: adj.after, applied: adj.applied, rule_version: adj.rule_version });
  targets = { ...targets, ranges: adj.after };

  const ftargets = functionalTargets({ userId, grades, goals, allergies, table });
  const pick = d => selectProducts({ userId, deficit: d, ftargets, allergies, conditions: profile.conditions, specs });
  const base = { mode: 'deficit_based', grades: wlGrades(grades), targets, ftargets, versions: WELLNESS_DATA_VERSION };

  if (useMealPlan === false) {
    const deficit = deficitReport({ userId, basis: 'no_meal_plan', targets, ftargets, days: null });
    const selection = pick(deficit);
    return { ...base, plan: null, deficit, selection, cart: selectionToCart(selection), finalDeficit: null };
  }

  const design = cart => generateMealPlan({ profile, targets, cart, days: cfg.cycleDays, allergies, seed, noProducts: !cart, goals, grades });
  const report = (plan, foodOnly, note) => deficitReport({ userId, basis: 'meal_plan', targets, ftargets, note,
    days: plan.days.map(d => intakeOfMeals(planDayMeals(d, foodOnly))) });
  const ids = s => s.selected.map(x => x.product_id + '×' + x.servings_per_day).join();

  let plan = design(null);
  if (plan.error) return { ...base, error: plan.error };
  let deficit = report(plan, false, '제품 없이 최적화한 식단');
  let selection = pick(deficit);
  for (let i = 0; i < cfg.refitMaxIter && selection.selected.length; i++) {
    const refit = design(selectionToCart(selection));
    if (refit.error) break;                       // 끼니에 넣을 수 없는 구성(추가 구성품만) — 식단은 그대로 둔다
    plan = refit;
    deficit = report(plan, true, '제품 반영 식단의 음식만 (반복 ' + (i + 1) + ')');
    const next = pick(deficit);
    const same = ids(next) === ids(selection);
    selection = next;
    if (same) break;
  }
  const finalDeficit = report(plan, false, '최종 식단 + 제품');
  return { ...base, plan, deficit, selection, cart: selectionToCart(selection), finalDeficit };
}

// ══════════════════════════════════════════════
// F4. 위험도·부족분 갱신 → 재추천
//   상태는 tracker.wellness = { last, history, proposal, lastRunAt, sig } 에 저장
// ══════════════════════════════════════════════
function wellnessState() {
  return tracker.wellness || (tracker.wellness = { last: null, history: [], proposal: null, lastRunAt: null, sig: null });
}

// 최근 N일 식사 기록 → 기록이 있는 날만 [{ date, nut, comp, meals }] (오래된 날부터)
function intakeLogDays(windowDays, today) {
  const out = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = dayOffset(today, -i);
    const meals = diaryMealsOf(date);
    if (meals.length) out.push({ date, meals, ...intakeOfMeals(meals) });
  }
  return out;
}

// 체중 추이 단계 — 주당 변화량과 목표 방향으로 나눈다
function weightPhase(targets) {
  const tr = weightTrend();
  if (!tr) return null;
  const k = WELLNESS_CONFIG.phaseKgPerWeek;
  if (tr.perWeek <= -k) return '감량기';
  if (tr.perWeek >= k) return '증량기';
  return targets.weeklyDelta < 0 ? '정체기' : '유지기';
}

const planDigest = plan => plan ? plan.days.map(d => d.meals.flatMap(planMealItems).concat(planMealItems(d.snack)).map(x => x[0])) : null;

// 재산출 + 재추천 판단. 반환 { rerecommend, reasons, ... }
function reassess({ userId, trigger, today, seed, table, specs }) {
  const cfg = WELLNESS_CONFIG, w = wellnessState(), prev = w.last;
  today = today || isoToday();
  if (!prev || !tracker.profile) return null;
  const profile = tracker.profile, targets = currentTargets();
  const goals = tracker.goals || [], allergies = profile.allergies || [];

  // (1) 점수·위험등급 — 기록 평균 하루치로 다시 채점. 기록이 모자라면 이전 등급을 유지한다
  const log = intakeLogDays(cfg.intakeWindowDays, today);
  let grades = prev.grades;
  // ponytail: 기록 '일수'만 봄. 한 끼만 적은 날도 하루로 셈 — 끼니 수 기준이 필요하면 여기서.
  if (log.length >= cfg.gradeMinLogDays) {
    const f = 1 / log.length;
    const meals = log.flatMap(d => d.meals.map(m => ({ name: m.name, analysis: { ...m.analysis,
      totalCal: m.analysis.totalCal * f,
      ingredients: m.analysis.ingredients.map(i => ({ ...i, kcal: (i.kcal || 0) * f,
        grams: typeof i.grams === 'number' ? i.grams * f : i.grams,
        servings: typeof i.grams === 'number' ? i.servings : (i.servings || 1) * f })) } })));
    const scored = scoreDietPatterns(meals, null, profile.gender, profile);
    if (!scored.insufficient) grades = wlGrades(diseaseGrades(scored));
  }
  // (2)(3) F1 → F2(intake_log)
  const ftargets = functionalTargets({ userId, grades, goals, allergies, table });
  const deficit = deficitReport({ userId, basis: 'intake_log', targets, ftargets, days: log });
  const phase = weightPhase(targets);

  // 재추천 판단
  const reasons = [];
  for (const g of grades) {
    const p = prev.grades.find(x => x.key === g.key);
    if (p && p.tier.key !== g.tier.key) reasons.push('위험등급 변화: ' + g.name + ' ' + p.tier.label + '→' + g.tier.label);
  }
  const idList = t => t.targets.map(x => x.component_id).sort().join();
  if (idList(ftargets) !== idList(prev.ftargets)) reasons.push('목표 성분 목록 변화');
  let low = 0;
  for (let i = deficit.daily_fill_rate.length - 1; i >= 0 && deficit.daily_fill_rate[i] < cfg.fillRateMin; i--) low++;
  if (low >= cfg.fillRateLowDays) reasons.push('충족률 ' + cfg.fillRateMin + ' 미만 ' + low + '일 연속');
  if (phase && prev.phase && phase !== prev.phase) reasons.push('체중 추이 단계 변화: ' + prev.phase + '→' + phase);

  w.lastRunAt = today;
  const judged = { trigger: trigger || 'manual', reasons, rerecommend: reasons.length > 0 };
  if (!reasons.length) {
    stepLog(userId, 'F4_reassess', { trigger: judged.trigger, log_days: log.length }, judged);
    return { ...judged, grades, ftargets, deficit, phase };
  }

  // 실행: 식단 재최적화(현재 구독 구성) → F2 → F3
  // ponytail: 최적화를 동기로 돌려 그동안 화면이 멈춤. 거슬리면 buildMealPlan 처럼 setTimeout 으로 넘길 것.
  const cart = prev.cart;
  const hasCart = cart && cart.soymilk.length + cart.phyto.length + cart.bar.length > 0;
  const usePlan = !!tracker.plan;
  let plan = null;
  if (usePlan) {
    plan = generateMealPlan({ profile, targets, cart: hasCart ? cart : null, days: cfg.cycleDays, allergies, seed, noProducts: !hasCart, goals, grades });
    if (plan.error) plan = null;
  }
  const planDeficit = deficitReport({ userId, basis: plan ? 'meal_plan' : 'no_meal_plan', targets, ftargets,
    note: '재최적화 식단의 음식만', days: plan ? plan.days.map(d => intakeOfMeals(planDayMeals(d, true))) : null });
  const selection = selectProducts({ userId, deficit: planDeficit, ftargets, allergies, conditions: profile.conditions, specs });
  const newCart = selectionToCart(selection);

  const before = { grades: prev.grades, deficit: prev.deficit, plan: planDigest(tracker.plan), products: prev.cart };
  if (plan) tracker.plan = plan;
  // 제품 변경은 바로 적용하지 않고 다음 구독 주기 제안으로 둔다
  const changed = JSON.stringify(newCart) !== JSON.stringify(prev.cart);
  const start = tracker.startDate || today;
  const proposal = changed ? {
    created_at: today, status: 'pending', cart: newCart, products: selection.selected,
    effective_from: dayOffset(start, cfg.cycleDays * (Math.floor(daysBetween(start, today) / cfg.cycleDays) + 1)),
    reasons,
  } : null;
  if (proposal) w.proposal = proposal;
  const entry = { at: new Date().toISOString(), trigger: judged.trigger, reasons, before,
    after: { grades, deficit: planDeficit, plan: planDigest(plan), products: newCart }, proposal_status: proposal ? 'pending' : 'no_change' };
  w.history.push(entry);
  if (w.history.length > 20) w.history.shift();
  w.last = { ...prev, grades, ftargets, deficit: planDeficit, phase: phase || prev.phase };
  stepLog(userId, 'F4_reassess', { trigger: judged.trigger, log_days: log.length }, { ...judged, proposal });
  return { ...judged, grades, ftargets, deficit, phase, plan, selection, proposal, history: entry };
}

// 사용자가 제안을 확인하면 구독 구성에 반영
function confirmProposal(accept) {
  const w = wellnessState(), p = w.proposal;
  if (!p || p.status !== 'pending') return null;
  p.status = accept === false ? 'rejected' : 'confirmed';
  if (p.status === 'confirmed' && w.last) w.last.cart = p.cart;
  if (w.history.length) w.history[w.history.length - 1].proposal_status = p.status;
  trackerSave();
  return p;
}

// trackerSave() 가 부르는 연결점 — 식사 기록·체중·프로필 변경, 정기 주기를 감지해 reassess 실행
let wlBusy = false;
const wlSig = () => ({
  meal_log: hashSeed(JSON.stringify(tracker.diary || {})),
  weight:   hashSeed(JSON.stringify(tracker.weights || [])),
  profile:  hashSeed(JSON.stringify([{ ...tracker.profile, weight: 0, prevWeight: 0 }, tracker.goals])),
});
function wellnessTrigger(today) {
  if (!wlDeficitMode() || wlBusy || !tracker || !tracker.profile || !tracker.wellness || !tracker.wellness.last) return null;
  const w = tracker.wellness;
  today = today || isoToday();
  const sig = wlSig();
  const old = w.sig || sig;
  const triggers = Object.keys(sig).filter(k => sig[k] !== old[k]);
  if (!triggers.length && w.lastRunAt && daysBetween(w.lastRunAt, today) >= WELLNESS_CONFIG.refreshDays) triggers.push('periodic');
  w.sig = sig;
  if (!triggers.length) return null;
  wlBusy = true;
  try { return reassess({ trigger: triggers.join('+'), today }); } finally { wlBusy = false; }
}

// ══════════════════════════════════════════════
// F5. 이미지 인식 결과 → 영양소 + 기능성 성분 → 식사 기록
//   foods: 인식 API(/analyze) 의 음식 목록 [{ name, grams, confidence }]
//   after: 식후 사진의 인식 결과(있으면 식전 − 식후 = 섭취량)
// ══════════════════════════════════════════════
function imageToIntake({ userId, foods, after, meal, date, save }) {
  const cfg = WELLNESS_CONFIG;
  const left = name => ((after || []).find(a => a.name === name) || {}).grams || 0;
  const items = (foods || []).map(f => {
    const confidence = f.confidence > 1 ? f.confidence / 100 : f.confidence;   // 0~100 으로 오는 경우
    let matched = analyzeFood(f.name) ? f.name : null, match = matched ? 'exact' : null;
    if (!matched) {
      const hit = fpExact(f.name).sort((a, b) => b.len - a.len)[0];            // 이름 안에 든 DB 음식명 중 가장 긴 것
      if (hit && analyzeFood(hit.name)) { matched = hit.name; match = 'similar'; }
    }
    const grams = Math.max(0, (f.grams || 0) - left(f.name));
    const item = { input_name: f.name, matched_name: matched, match, grams, confidence,
      candidates: matched ? [] : fpCandidates(f.name, 5) };
    if (matched) {
      const a = analyzeFood(matched);
      const baseG = estimateDishNutrients(a).weight || a.ingredients.reduce((s, i) => s + (typeof i.grams === 'number' ? i.grams : 0), 0);
      item.portion = baseG > 0 ? Math.round(grams / baseG * 100) / 100 : 1;
      item.analysis = scaleAnalysis(a, item.portion);
    }
    return item;
  });
  const ok = items.filter(i => i.matched_name);
  const { nut, comp } = intakeOfMeals(ok.map(i => ({ name: i.matched_name, analysis: i.analysis })));
  const lowConf = items.filter(i => !(i.confidence >= cfg.imageConfidenceMin));
  const needs_confirmation = !items.length || ok.length < items.length || lowConf.length > 0;
  const saved = save !== false && !needs_confirmation;
  if (saved) {
    const d = date || isoToday();
    const list = tracker.diary[d] || (tracker.diary[d] = []);
    for (const i of ok) if (i.portion > 0) list.push({ name: i.matched_name, meal: meal || 'lunch', portion: i.portion, source: 'image' });
    trackerSave();                                 // → wellnessTrigger (F4)
  }
  return stepLog(userId, 'F5_image_intake', { foods, after: after || null }, {
    items: items.map(({ analysis, ...rest }) => rest),
    nutrients: Object.fromEntries(Object.entries(nut).map(([k, v]) => [k, wlRound(v)])),
    components: Object.entries(comp).map(([id, v]) => ({ id, amount: wlRound(v), unit: 'mg' })),
    saved, needs_confirmation,
    reason: !needs_confirmation ? null
      : ok.length < items.length ? '레시피 DB 에서 찾지 못한 음식이 있음 — 후보에서 골라 주세요'
      : '인식 신뢰도 ' + cfg.imageConfidenceMin + ' 미만 — 확인이 필요합니다',
  });
}

// ══════════════════════════════════════════════
// F7. 원터치 기록 — 추천 식단·제품을 그대로 식사 기록에 저장 (출처 plan)
//   ratio: 1(전부) · 0.5(절반) · 0.25(조금) — WELLNESS_CONFIG.portionRatios
//   itemName 을 주면 그 음식·제품 하나만
// ══════════════════════════════════════════════
function logPlanMeal(day, mealType, ratio, itemName) {
  const d = tracker.plan && tracker.plan.days[day - 1];
  const date = planDateOf(day);
  if (!d || !date) return [];
  const meal = mealType === 'snack' ? d.snack : d.meals.find(m => m.type === mealType);
  const r = ratio == null ? 1 : ratio;
  const list = tracker.diary[date] || (tracker.diary[date] = []);
  const added = planMealItems(meal).filter(([n]) => !itemName || n === itemName)
    .map(([name, portion]) => ({ name, meal: mealType, portion: wlRound(portion * r), source: 'plan', planDay: day }));
  list.push(...added);
  if (!list.length) delete tracker.diary[date];
  trackerSave();                                   // → wellnessTrigger (F4)
  return added;
}

function unlogPlanMeal(day, mealType) {
  const date = planDateOf(day);
  if (!date || !tracker.diary[date]) return;
  tracker.diary[date] = tracker.diary[date].filter(e => !(e.source === 'plan' && e.planDay === day && e.meal === mealType));
  if (!tracker.diary[date].length) delete tracker.diary[date];
}

// setMealStatus() 가 부르는 연결점 — 「먹었어요」를 누르면 그 끼니를 그대로 기록
function onPlanMealStatus(day, mealType, status) {
  unlogPlanMeal(day, mealType);
  if (status === 'eaten') logPlanMeal(day, mealType, 1);
  renderDiary();   // 기록 화면의 그날 식사 목록에도 바로 보이게
}

// ══════════════════════════════════════════════
// 화면 연결 — initSubCart() 가 부른다. legacy 면 null 을 돌려 기존 룰테이블 추천을 그대로 쓴다.
// ══════════════════════════════════════════════
function wellnessRecommend(r, scored) {
  if (!wlDeficitMode()) return null;
  // ponytail: 식단 최적화를 동기로 1~3회 돌려 결과 화면이 그만큼 늦게 뜸. 거슬리면 setTimeout 으로 넘길 것.
  const res = runDeficitPipeline({
    profile: tracker.profile || r.profile, grades: diseaseGrades(scored), goals: [...selectedGoals],
    allergies: [...r.profile.allergies], targets: r.targets || currentTargets(),
    useMealPlan: planMode() === 'plan',   // 가이드 모드(식단 미이용)면 필요량 전체가 부족분
  });
  if (res.error) return null;
  const w = wellnessState();
  w.last = { grades: res.grades, ftargets: res.ftargets, deficit: res.finalDeficit || res.deficit,
    selection: res.selection, cart: res.cart, phase: weightPhase(res.targets) };
  w.lastRunAt = isoToday();
  w.sig = wlSig();
  return res;
}

// ══════════════════════════════════════════════
// 화면 — 「이 구성을 권하는 이유」 (목표 성분 → 식단에서 채운 양 → 부족분 → 제품이 채우는 양)
//   renderSubscription() 이 구독 구성 위에 그린다. legacy 모드에서는 wl 이 없어 아무것도 그리지 않는다.
// ══════════════════════════════════════════════
function wellnessWhyHtml(wl) {
  if (!wl || !wl.ftargets || !wl.ftargets.targets || !wl.ftargets.targets.length) return '';
  const esc = v => String(v).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const fmt = v => v == null ? '—' : (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString();
  const before = Object.fromEntries(((wl.deficit || {}).components || []).map(c => [c.id, c]));
  const after  = Object.fromEntries((((wl.finalDeficit || wl.deficit) || {}).components || []).map(c => [c.id, c]));
  const noPlan = (wl.deficit || {}).basis === 'no_meal_plan';

  // 성분별로 어느 제품이 얼마나 채우는지
  const byComp = {};
  for (const sel of ((wl.selection || {}).selected || []))
    for (const c of (sel.covers || []))
      if (c.amount >= 0.05) (byComp[c.component_id] || (byComp[c.component_id] = [])).push({ name: sel.name, amount: c.amount });

  const rows = wl.ftargets.targets.map(t => {
    const b = before[t.component_id] || {}, a = after[t.component_id] || b;
    const need = t.daily_amount, unit = t.unit || 'mg';
    const reason = (t.reason || []).map(esc).join(' · ');
    const head = '<div class="flex flex-wrap items-baseline justify-between gap-x-3">'
      + '<span class="text-sm font-semibold text-gray-900">' + esc(t.name) + '</span>'
      + '<span class="text-xs text-gray-500">' + reason + '</span></div>';
    if (need == null) {
      return '<li class="py-3" style="border-top:1px solid var(--line)">' + head
        + '<p class="text-xs text-gray-400 mt-1">하루 필요량이 아직 정해지지 않아 부족분을 계산하지 않았어요</p></li>';
    }
    const food = Math.min(b.supply || 0, need);
    // 제품이 채우는 양: 선택 결과(covers) 합. 식단 없이 고른 경우 finalDeficit 이 없어 covers 로 계산한다.
    const cov = (byComp[t.component_id] || []).reduce((s, x) => s + x.amount, 0);
    const prod = Math.min(Math.max(cov, (a.supply || 0) - (b.supply || 0), 0), need - food);
    const lack = Math.max(0, need - food - prod);
    const pct = v => Math.max(0, Math.min(100, v / need * 100)).toFixed(1);
    const bar = '<div class="flex h-2 rounded-full overflow-hidden mt-2" style="background:#E5E7EB" role="img" aria-label="'
      + esc(t.name) + ' 식단 ' + fmt(food) + unit + ', 제품 ' + fmt(prod) + unit + ', 부족 ' + fmt(lack) + unit + '">'
      + '<div style="width:' + pct(food) + '%;background:#065F46"></div>'
      + '<div style="width:' + pct(prod) + '%;background:#34D399"></div></div>';
    const from = (byComp[t.component_id] || []).map(x => esc(x.name) + ' ' + fmt(x.amount) + unit).join(', ');
    return '<li class="py-3" style="border-top:1px solid var(--line)">' + head + bar
      + '<div class="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-600 mt-1.5">'
      + '<span>하루 필요 <b class="text-gray-900">' + fmt(need) + unit + '</b></span>'
      + '<span>' + (noPlan ? '식단 미이용' : '식단에서 ' + fmt(b.supply || 0) + unit) + '</span>'
      + '<span>제품으로 +' + fmt(prod) + unit + '</span>'
      + '<span class="' + (lack > 0 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold') + '">'
      + (lack > 0 ? '아직 ' + fmt(lack) + unit + ' 부족' : '채워졌어요') + '</span></div>'
      + (from ? '<p class="text-xs text-gray-500 mt-1">채우는 제품: ' + from + '</p>' : '')
      + '</li>';
  }).join('');

  const draft = wl.ftargets.targets.some(t => t.needs_review);
  return '<div class="rounded-2xl p-5 mb-5" style="border:1px solid var(--line);background:#fff">'
    + '<div class="text-sm font-bold text-gray-900">이 구성을 권하는 이유</div>'
    + '<div class="text-xs text-gray-500 mt-0.5">관리 목표와 질환 위험 등급으로 챙길 성분을 정하고, '
    + (noPlan ? '하루 필요량을 제품으로 채우도록 골랐어요' : '식단으로 모자란 만큼을 제품으로 채웠어요') + '</div>'
    + '<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-3">'
    + '<span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#065F46"></i> 식단</span>'
    + '<span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#34D399"></i> 제품</span>'
    + '<span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#E5E7EB"></i> 부족</span></div>'
    + '<ul class="mt-2">' + rows + '</ul>'
    + (draft ? '<p class="text-xs text-gray-400 mt-2">성분별 하루 필요량은 확정 전 기준값이에요</p>' : '')
    + '</div>';
}
