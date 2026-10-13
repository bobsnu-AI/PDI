// ============================================
// 30일 식단 실천 기록 · 체중 모니터링 · 목표 재조정
// localStorage 영속화 (계정·서버 없이 브라우저에 보관)
// ponytail: 단일 기기 한정. 기기 간 동기화가 필요해지면 Cloudflare D1 + 계정으로 승격
// ============================================

const TRACKER_KEY = 'bobsnu-pdi-v1';

// 체지방 1kg ≈ 7,700kcal
const KCAL_PER_KG = 7700;

let tracker = null;

function trackerDefault() {
  return { version: 1, profile: null, goals: ['weight'], cart: null, startDate: null, plan: null, planMode: 'guide', paid: false, log: {}, diary: {}, weights: [], targetKcalOverride: null };
}

function trackerLoad() {
  try {
    const raw = localStorage.getItem(TRACKER_KEY);
    tracker = raw ? JSON.parse(raw) : trackerDefault();
  } catch (e) {
    tracker = trackerDefault();
  }
  if (tracker.version !== 1) tracker = trackerDefault();
  return tracker;
}

function trackerSave() {
  try {
    localStorage.setItem(TRACKER_KEY, JSON.stringify(tracker));
  } catch (e) {
    // 용량 초과 시 식단만 비우고 재시도 (기록·체중이 더 중요)
    tracker.plan = null;
    try { localStorage.setItem(TRACKER_KEY, JSON.stringify(tracker)); } catch (e2) {}
  }
}

function trackerReset() {
  tracker = trackerDefault();
  trackerSave();
}

// ── 날짜 ────────────────────────────────────
function isoToday() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dayOffset(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

// 식단 시작일 기준 오늘이 며칠째인지 (1-based · 범위 밖이면 null)
function planDayIndex() {
  if (!tracker.startDate || !tracker.plan) return null;
  const n = daysBetween(tracker.startDate, isoToday()) + 1;
  return (n >= 1 && n <= tracker.plan.days.length) ? n : null;
}

function planDateOf(dayIndex) {
  return tracker.startDate ? dayOffset(tracker.startDate, dayIndex - 1) : null;
}

// ══════════════════════════════════════════════
// 실천 기록
// ══════════════════════════════════════════════
// log[day][mealType] = { status: 'eaten'|'skipped'|'other', subs: [{name, portion, kcal, prfKcal}] }
function mealLog(day, mealType) {
  const d = tracker.log[day] || (tracker.log[day] = {});
  return d[mealType] || (d[mealType] = { status: null, subs: [] });
}

function setMealStatus(day, mealType, status) {
  const e = mealLog(day, mealType);
  e.status = e.status === status ? null : status;
  if (e.status !== 'other') e.subs = [];
  trackerSave();
  renderMealPlan();
  renderMonitor();
}

// 다른 음식 입력 (인분 포함) — 레시피 DB·단품 식재료 모두 허용
function addSubstitute(day, mealType, name, portion) {
  const base = analyzeFood(name);
  if (!base) return '「' + name + '」을(를) 찾을 수 없습니다. 다른 이름으로 입력해보세요.';
  const a = scaleAnalysis(base, portion);
  const prfKcal = a.ingredients.reduce((s, i) => s + (i.prf ? (i.kcal || 0) : 0), 0);
  const e = mealLog(day, mealType);
  e.status = 'other';
  e.subs.push({ name, portion, kcal: Math.round(a.totalCal), prfKcal: Math.round(prfKcal) });
  trackerSave();
  renderMealPlan();
  renderMonitor();
  return null;
}

function removeSubstitute(day, mealType, idx) {
  const e = mealLog(day, mealType);
  e.subs.splice(idx, 1);
  if (!e.subs.length) e.status = null;
  trackerSave();
  renderMealPlan();
  renderMonitor();
}

// 실제 섭취 요약 — 추천대로 먹은 끼니는 계획값, 다른 음식은 입력값, 안 먹은 끼니는 0
function actualDay(dayIndex) {
  const plan = tracker.plan.days[dayIndex - 1];
  let kcal = 0, prf = 0, logged = 0;
  for (const meal of plan.meals) {
    const e = (tracker.log[dayIndex] || {})[meal.type];
    if (!e || !e.status) continue;
    logged++;
    if (e.status === 'eaten')      { kcal += meal.kcal; prf += meal.prfKcal; }
    else if (e.status === 'other') { kcal += e.subs.reduce((s, x) => s + x.kcal, 0); prf += e.subs.reduce((s, x) => s + x.prfKcal, 0); }
  }
  if (plan.snack) { kcal += plan.snack.kcal; prf += plan.snack.prfKcal; }
  return { kcal, prfKcal: prf, pdi: kcal > 0 ? +(prf / kcal * 100).toFixed(1) : 0, logged, total: plan.meals.length };
}

function adherence() {
  if (!tracker.plan) return { eaten: 0, other: 0, skipped: 0, logged: 0, total: 0, pct: 0, avgPDI: 0 };
  let eaten = 0, other = 0, skipped = 0, total = 0;
  const pdis = [];
  const upto = planDayIndex() || tracker.plan.days.length;
  for (let d = 1; d <= Math.min(upto, tracker.plan.days.length); d++) {
    total += tracker.plan.days[d - 1].meals.length;
    for (const meal of tracker.plan.days[d - 1].meals) {
      const e = (tracker.log[d] || {})[meal.type];
      if (!e || !e.status) continue;
      if (e.status === 'eaten') eaten++;
      else if (e.status === 'other') other++;
      else skipped++;
    }
    const a = actualDay(d);
    if (a.logged) pdis.push(a.pdi);
  }
  const logged = eaten + other + skipped;
  return {
    eaten, other, skipped, logged, total,
    pct: total ? Math.round((eaten + other) / total * 100) : 0,
    avgPDI: pdis.length ? +(pdis.reduce((a, b) => a + b, 0) / pdis.length).toFixed(1) : 0,
  };
}

// ══════════════════════════════════════════════
// 체중 모니터링 · 목표 재조정
// ══════════════════════════════════════════════
function logWeight(kg, date) {
  const d = date || isoToday();
  const i = tracker.weights.findIndex(w => w.date === d);
  if (i >= 0) tracker.weights[i].kg = kg; else tracker.weights.push({ date: d, kg });
  tracker.weights.sort((a, b) => a.date.localeCompare(b.date));
  if (tracker.profile) {
    tracker.profile.prevWeight = tracker.weights.length > 1 ? tracker.weights[tracker.weights.length - 2].kg : tracker.profile.weight;
    tracker.profile.weight = kg;
  }
  trackerSave();
}

// 최근 체중 추세 — 최소제곱 직선의 기울기(kg/주)
function weightTrend() {
  const w = tracker.weights;
  if (w.length < 2) return null;
  const t0 = new Date(w[0].date + 'T00:00:00').getTime();
  const xs = w.map(p => (new Date(p.date + 'T00:00:00').getTime() - t0) / 86400000);
  const ys = w.map(p => p.kg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  if (den === 0) return null;
  const perDay = num / den;
  return {
    perWeek: +(perDay * 7).toFixed(2),
    total: +(ys[n - 1] - ys[0]).toFixed(1),
    spanDays: Math.round(xs[n - 1]),
    first: w[0], last: w[n - 1],
  };
}

// 실측 추세 vs 계획 추세 → 목표 칼로리 재조정 제안
//   조정량 = (실제 주당변화 − 계획 주당변화) × 7,700 / 7  (1회 조정은 ±300kcal 로 제한)
function retargetSuggestion(targets) {
  const tr = weightTrend();
  if (!tr || tr.spanDays < 7) return { ready: false, reason: '체중을 7일 이상 기록하면 목표를 재조정합니다.', trend: tr };
  const planned = targets.weeklyDelta;
  const gap = tr.perWeek - planned;
  if (Math.abs(gap) < 0.2) return { ready: true, onTrack: true, trend: tr, planned, gap: +gap.toFixed(2), delta: 0, newTargetKcal: targets.targetKcal };
  let delta = Math.round(-gap * KCAL_PER_KG / 7 / 10) * 10;
  delta = Math.max(-300, Math.min(300, delta));
  const floor = Math.max(1200, Math.round(targets.eer * 0.7));
  const newTargetKcal = Math.max(floor, Math.min(Math.round(targets.eer * 1.2), targets.targetKcal + delta));
  return { ready: true, onTrack: false, trend: tr, planned, gap: +gap.toFixed(2), delta: newTargetKcal - targets.targetKcal, newTargetKcal, floor };
}

// ══════════════════════════════════════════════
// 렌더링 — 30일 식단
// ══════════════════════════════════════════════
let planViewFrom = 1;          // 보여줄 첫 날
const PLAN_PAGE = 7;           // 한 번에 보여줄 일수 (설계 일수가 더 적으면 전체)
function planPage() { return Math.min(PLAN_PAGE, tracker.plan ? tracker.plan.days.length : PLAN_PAGE); }

function setPlanView(from) {
  const max = openPlanDays() || 1;
  planViewFrom = Math.max(1, Math.min(Math.max(1, max - planPage() + 1), from));
  renderMealPlan();
}

function statusBtn(day, type, status, label, icon, active) {
  const cls = active
    ? { eaten: 'bg-emerald-600 text-white', skipped: 'bg-gray-500 text-white', other: 'bg-amber-500 text-white' }[status]
    : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400';
  return '<button type="button" onclick="setMealStatus(' + day + ',\'' + type + '\',\'' + status + '\')" '
    + 'class="text-xs font-bold px-3 py-2 rounded-full ' + cls + '">' + icon + ' ' + label + '</button>';
}

// 구독 구성을 고르고 버튼을 누르기 전에 보여주는 안내 화면
//   「제품을 구독하면 그 구성에 맞는 30일 식단을 받는다」는 흐름을 그대로 보여줍니다
// ══════════════════════════════════════════════
// 받는 범위 — 「칼로리 가이드」 / 「30일 식단까지」
//   가이드 버전은 메뉴를 짜지 않는다. 하루 목표 칼로리를 끼니로 나누고,
//   구독한 제품을 어느 끼니에 넣을지까지만 알려준 뒤 나머지는 「일반식」으로 둔다
// ══════════════════════════════════════════════
function planMode() { return tracker.planMode === 'plan' ? 'plan' : 'guide'; }

function setPlanMode(m) {
  tracker.planMode = (m === 'plan') ? 'plan' : 'guide';
  trackerSave();
  // 구독 패널의 「식단 추천받기」도 버전에 따라 나타났다 사라진다
  if (typeof pdiResult !== 'undefined' && pdiResult) onSubCartChanged();
  else renderMealPlan();
}

function syncPlanModeButtons() {
  for (const m of ['guide', 'plan']) {
    const b = document.getElementById('planmode-' + m);
    if (b) b.classList.toggle('active', planMode() === m);
  }
}

// 끼니별 칼로리 배분 — 하루 목표를 나눈 가이드 값 (고정 규칙이 아니라 기준점)
const GUIDE_MEAL_SHARE = { breakfast: 0.30, lunch: 0.35, dinner: 0.35 };

function riceLabel(b) { return b === 0.5 ? '½공기' : (b === 1.5 ? '1½공기' : b + '공기'); }

// 칼로리에서 대략의 상차림을 역산 (밥 1공기 ≈ 300 kcal · 국 ≈ 80 · 반찬 1가지 ≈ 95)
function plainMealHint(kcal) {
  if (kcal < 180) return '과일 한 조각이나 가벼운 한 접시';
  const rice  = Math.max(0.5, Math.min(1.5, Math.round(kcal * 0.5 / 300 * 2) / 2));
  const sides = Math.max(1, Math.round((kcal - rice * 300 - 80) / 95));
  return '밥 ' + riceLabel(rice) + ' · 국 1가지 · 반찬 ' + sides + '가지';
}

// 구독한 제품을 끼니에 배치한 결과를 가이드용으로 요약
function guidePlacement() {
  const cart = (typeof subCart !== 'undefined' && subCart) ? subCartToQuoteInput() : null;
  if (!cart) return null;
  const counts = subscriptionQuote(cart).counts;
  if (counts.soymilk + counts.phyto + counts.bar === 0) return null;
  const days = subscriptionDays(cart, 30);
  if (!days) return null;
  // 식단 버전과 같은 배치 규칙을 쓴다 (과일만 날마다 다른데, 가이드에서는 고정)
  const place = planProductMeals(cart, days, () => 0.5);

  const extra = { breakfast: null, lunch: null, snack: null };
  const add = (type, bag) => {
    if (!bag || !bag.items.length) return;
    if (!extra[type]) extra[type] = { names: [], kcal: Math.round(bag.kcal || 0) };
    for (const it of bag.items) if (!extra[type].names.includes(it.name)) extra[type].names.push(it.name);
  };
  for (const byType of Object.values(place.extras)) for (const [t, bag] of Object.entries(byType)) add(t, bag);
  for (const bag of Object.values(place.snacks)) add('snack', bag);

  const firstMeal = Object.values(place.meals)[0];
  const replaced = firstMeal ? firstMeal[place.coverage.replaceType] : null;
  return {
    days, counts, extra,
    cov: place.coverage,
    leftover: place.leftover,
    replaceType: place.coverage.replaceType,
    replaceDays: place.coverage.replaceDays,
    replacedItems: replaced ? replaced.items.map(i => i.name) : [],
    replacedKcal: replaced ? Math.round(replaced.kcal) : 0,
  };
}

function guidePlanHtml() {
  const targets = currentTargets();
  if (!targets) return '';
  const g = guidePlacement();
  const total = targets.targetKcal;

  // 제품이 저녁을 대신하면 그만큼 남는 칼로리를 아침·점심에 나눠 준다
  const share = { ...GUIDE_MEAL_SHARE };
  const kcal = {};
  for (const t of Object.keys(share)) kcal[t] = total * share[t];
  if (g && g.replaceDays && g.replacedKcal) {
    const freed = kcal[g.replaceType] - g.replacedKcal;
    kcal[g.replaceType] = g.replacedKcal;
    const rest = Object.keys(share).filter(t => t !== g.replaceType);
    const sum = rest.reduce((s, t) => s + share[t], 0);
    for (const t of rest) kcal[t] += freed * (share[t] / sum);
  }

  const row = (mt) => {
    const isReplaced = g && g.replaceDays && g.replaceType === mt.id;
    const ex = g ? g.extra[mt.id] : null;
    const plain = Math.max(0, Math.round(kcal[mt.id] - (ex ? ex.kcal : 0)));
    return '<div class="flex gap-3 sm:gap-4 py-4 border-b border-gray-100 last:border-0">'
      + '<div class="flex-shrink-0 w-14 text-center">'
      + '<div class="text-2xl leading-none">' + mt.icon + '</div>'
      + '<div class="text-xs font-bold text-gray-500 mt-1">' + mt.name + '</div></div>'
      + '<div class="min-w-0 flex-1">'
      + '<div class="text-lg font-bold text-gray-900 mb-1">' + Math.round(kcal[mt.id]).toLocaleString()
      + '<span class="text-sm font-medium text-gray-400"> kcal</span></div>'
      + (isReplaced
          ? '<div class="text-sm text-emerald-800 font-bold">밥스누 제품으로 대신</div>'
            + '<div class="text-xs text-gray-500 mt-0.5">' + g.replacedItems.join(' + ') + '</div>'
            + (g.replaceDays < g.days
                ? '<div class="text-xs text-gray-400 mt-1">' + g.days + '일 중 ' + g.replaceDays + '일 · 나머지 날은 일반식 '
                  + Math.round(total * GUIDE_MEAL_SHARE[mt.id]).toLocaleString() + ' kcal</div>' : '')
          : '<div class="text-sm text-gray-800"><b>일반식</b> ' + plain.toLocaleString() + ' kcal</div>'
            + '<div class="text-xs text-gray-500 mt-0.5">' + plainMealHint(plain) + '</div>')
      + (ex && !isReplaced
          ? '<div class="text-xs text-emerald-800 mt-1.5">+ ' + ex.names.join(' · ') + ' ' + ex.kcal + ' kcal</div>' : '')
      + '</div></div>';
  };

  const snack = g && g.extra.snack
    ? '<div class="flex gap-3 sm:gap-4 py-4 border-t border-gray-100">'
      + '<div class="flex-shrink-0 w-14 text-center"><div class="text-2xl leading-none">🍪</div>'
      + '<div class="text-xs font-bold text-gray-500 mt-1">간식</div></div>'
      + '<div class="min-w-0 flex-1"><div class="text-lg font-bold text-gray-900 mb-1">' + g.extra.snack.kcal
      + '<span class="text-sm font-medium text-gray-400"> kcal</span></div>'
      + '<div class="text-xs text-emerald-800">' + g.extra.snack.names.join(' · ') + '</div></div></div>'
    : '';

  // ── 제품을 어떻게 나눠 먹는지 ──
  let productHtml;
  if (!g) {
    productHtml = '<div class="bg-gray-50 rounded-2xl p-4 text-sm text-gray-500">'
      + '위에서 제품을 담으시면 어느 끼니에 나눠 드실지 알려드립니다</div>';
  } else {
    const stock = g.cov.stock;
    const line = (icon, name, n) => n > 0
      ? '<div class="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">'
        + '<span class="text-sm text-gray-700">' + icon + ' ' + name + '</span>'
        + '<span class="text-sm"><b class="text-gray-900">' + n + '회</b>'
        + '<span class="text-gray-400"> · 하루 ' + (n / g.days).toFixed(1) + '회</span></span></div>'
      : '';
    const left = g.leftover.soymilk + g.leftover.phyto + g.leftover.bar;
    productHtml =
      '<div class="rounded-2xl border border-gray-100 p-4 mb-3">'
      + line('🥛', '두유', stock.soymilk)
      + line('💊', '밥스누 파이토100', stock.phyto)
      + line('🍫', '약콩 프로틴바', stock.bar)
      + '</div>'
      + '<p class="text-xs text-gray-500">'
      + (g.cov.plainDays === 0
          ? '구독한 제품이 <b class="text-gray-800">' + g.days + '일</b> 내내 하루 1회 이상 들어갑니다'
          : '구독한 제품으로 <b class="text-gray-800">' + g.days + '일</b>을 채울 수 있습니다')
      + (g.days < 30 ? ' · 30일을 채우려면 제품을 더 담아주세요' : '')
      + (left ? ' · 남는 제품 ' + left + '회분은 원하는 날 드세요' : '')
      + (g.counts.addon ? ' · 추가 구성품은 하루 1회' : '')
      + '</p>';
  }

  return '<h3 class="text-xl font-bold text-gray-900 mb-1">30일 체중 관리 가이드</h3>'
    + '<p class="text-gray-500 text-sm mb-5">하루 <b class="text-gray-800">' + total.toLocaleString() + ' kcal</b>'
    + '을 끼니로 나눈 기준입니다. 메뉴는 직접 고르시고, 칼로리만 맞춰 주세요</p>'

    + '<div class="rounded-2xl border border-gray-100 px-4 sm:px-5 mb-6">'
    + MEAL_TYPES.map(row).join('')
    + snack
    + '</div>'

    + '<div class="text-sm font-bold text-gray-800 mb-2">제품을 이렇게 나눠 드세요</div>'
    + productHtml

    + '<div class="text-sm font-bold text-gray-800 mt-6 mb-2">일반식은 이렇게</div>'
    + '<ul class="space-y-1.5 text-sm text-gray-600">'
    + ['끼니마다 채소 반찬을 1–2접시 곁들이세요',
       '흰쌀밥 대신 잡곡밥·현미밥으로 바꾸면 포만감이 오래갑니다',
       '튀김·가공식품과 단 음료는 주 2회 안으로 줄여보세요']
      .map(t => '<li class="flex gap-2"><span class="text-emerald-600">·</span><span>' + t + '</span></li>').join('')
    + '</ul>'

    + '<div class="mt-6 rounded-2xl bg-gray-50 p-4">'
    + '<div class="text-sm font-bold text-gray-800 mb-1">메뉴까지 짜 드릴까요?</div>'
    + '<div class="text-xs text-gray-500 mb-3">위 「30일 식단까지」를 고르시면 끼니마다 먹을 메뉴를 추천해 드립니다</div>'
    + '<button type="button" onclick="setPlanMode(\'plan\')" class="px-5 py-2.5 bg-emerald-700 text-white text-sm font-bold">30일 식단까지 받기</button>'
    + '</div>';
}

// ══════════════════════════════════════════════
// 7일 무료 샘플 · 구독 시작 (시연용 — 실제 결제는 일어나지 않습니다)
// ponytail: 결제 상태를 브라우저에만 보관. 실제 결제 연동은 서버가 필요하다
// ══════════════════════════════════════════════
const SAMPLE_DAYS = 7;
function isPaid() { return !!tracker.paid; }

// 구독을 시작하기 전에는 앞 7일만 열어 둔다
function openPlanDays() {
  const n = tracker.plan ? tracker.plan.days.length : 0;
  return isPaid() ? n : Math.min(SAMPLE_DAYS, n);
}

function startDemoSubscription() {
  tracker.paid = true;
  trackerSave();
  renderPay();
  goPage('plan');
  renderMealPlan();
}

function stopDemoSubscription() {
  tracker.paid = false;
  trackerSave();
  renderPay();
  renderMealPlan();
}

// 요금제 카드 — 프리셋 두 가지와 지금 담은 구성을 나란히 보여준다
function payCards() {
  const code = (typeof subCart !== 'undefined' && subCart) ? subCart.soymilkCode : 'A';
  const mine = (typeof subCart !== 'undefined' && subCart) ? subCartToQuoteInput() : null;
  const cards = SUBSCRIPTION_PRESETS.map(ps => ({
    id: ps.id,
    name: ps.id === 'optimal' ? '최적 구독' : '최소 권장',
    badge: ps.id === 'optimal' ? '가장 많이 고르는 구성' : '',
    cart: { soymilk: Array(ps.counts.soymilk).fill(code), phyto: Array(ps.counts.phyto).fill('가'),
            bar: Array(ps.counts.bar).fill('나'), addon: [] },
    preset: ps.id,
  }));
  if (mine) cards.push({ id: 'mine', name: '지금 담은 구성', badge: '', cart: mine, preset: null });
  return cards;
}

function payCardHtml(c, mineKey) {
  const q = subscriptionQuote(c.cart);
  const days = subscriptionDays(c.cart, 30);
  const on = JSON.stringify(c.cart) === mineKey;
  const check = t => '<li class="flex gap-2 text-xs text-gray-600"><span class="text-emerald-600 font-bold">✓</span><span>' + t + '</span></li>';
  return '<div class="rounded-3xl border-2 p-5 flex flex-col" style="border-color:' + (on ? 'var(--deep)' : 'var(--line)')
    + ';background:' + (on ? 'var(--tint)' : '#fff') + '">'
    + (c.badge ? '<span class="self-start text-xs font-bold px-3 py-1 rounded-full bg-emerald-700 text-white mb-2">' + c.badge + '</span>' : '')
    + '<div class="text-sm font-bold text-gray-900">' + c.name + '</div>'
    + '<div class="text-xs text-gray-500 mb-3">'
    + [['두유', q.counts.soymilk], ['파이토100', q.counts.phyto], ['프로틴바', q.counts.bar], ['추가 구성품', q.counts.addon]]
        .filter(([, n]) => n > 0).map(([t, n]) => t + ' ' + n).join(' · ')
    + '</div>'
    + '<div class="flex items-end gap-2 mb-1"><span class="text-3xl font-black text-emerald-800">' + won(q.finalPrice) + '</span>'
    + '<span class="text-xs text-gray-400 mb-1">/ 월</span></div>'
    + '<div class="text-xs mb-4">' + (q.rate ? '<span class="line-through text-gray-400">' + won(q.listPrice) + '</span>'
        + ' <b class="text-emerald-700">' + q.rate + '% 할인</b>' : '<span class="text-gray-400">할인 없음</span>') + '</div>'
    + '<ul class="space-y-1.5 mb-5">'
    + check('30일 체중 관리 가이드')
    + check(days + '일 식단 전체 공개')
    + check('날마다 먹은 것 · 체중 기록')
    + check('제품 ' + Math.round(q.counts.soymilk + q.counts.phyto + q.counts.bar) + '팩 한 달 배송')
    + '</ul>'
    + '<div class="mt-auto">'
    + (on
        ? '<button type="button" onclick="startDemoSubscription()" class="w-full py-3 bg-emerald-700 text-white text-sm font-bold">이 구성으로 구독 시작</button>'
        : '<button type="button" onclick="' + (c.preset ? 'applyPreset(\'' + c.preset + '\')' : 'resetSubCart()') + '" '
          + 'class="w-full py-3 border-2 border-emerald-700 text-emerald-700 text-sm font-bold">이 구성으로 바꾸기</button>')
    + '</div></div>';
}

function renderPay() {
  const el = document.getElementById('pay-section');
  if (!el) return;
  const mineKey = (typeof subCart !== 'undefined' && subCart) ? JSON.stringify(subCartToQuoteInput()) : '';

  if (isPaid()) {
    el.innerHTML = '<div class="rounded-3xl border-2 p-6 text-center" style="border-color:var(--deep);background:var(--tint)">'
      + '<div class="text-lg font-bold text-emerald-900 mb-1">구독이 시작되었습니다</div>'
      + '<div class="text-sm text-gray-600 mb-5">30일 식단 전체가 열렸습니다. 날마다 먹은 것을 기록해 보세요</div>'
      + '<div class="flex flex-wrap gap-2 justify-center">'
      + '<button type="button" onclick="goPage(\'plan\')" class="px-5 py-3 bg-emerald-700 text-white text-sm font-bold">30일 식단 보기</button>'
      + '<button type="button" onclick="goPage(\'log\')" class="px-5 py-3 border-2 border-emerald-700 text-emerald-700 text-sm font-bold">기록 페이지로</button>'
      + '<button type="button" onclick="stopDemoSubscription()" class="px-5 py-3 border border-gray-200 text-gray-500 text-sm">시연 상태 되돌리기</button>'
      + '</div></div>';
    return;
  }

  el.innerHTML = '<div class="grid md:grid-cols-3 gap-4 mb-6">'
    + payCards().map(c => payCardHtml(c, mineKey)).join('')
    + '</div>'
    + '<div class="rounded-2xl bg-white border p-5" style="border-color:var(--line)">'
    + '<div class="text-sm font-bold text-gray-800 mb-2">구독하시면 이렇게 달라집니다</div>'
    + '<ul class="space-y-1.5 text-sm text-gray-600">'
    + ['지금은 30일 식단 중 앞 ' + SAMPLE_DAYS + '일만 보실 수 있습니다',
       '구독을 시작하시면 남은 날의 식단이 모두 열립니다',
       '제품은 한 달에 한 번 배송되고, 언제든 수량을 바꾸실 수 있습니다']
      .map(t => '<li class="flex gap-2"><span class="text-emerald-600">·</span><span>' + t + '</span></li>').join('')
    + '</ul></div>';
}

function mealPlanPromptHtml(reason) {
  const q = (typeof subCart !== 'undefined' && subCart) ? subscriptionQuote(subCartToQuoteInput()) : null;
  const c = q ? q.counts : null;
  const empty = !c || (c.soymilk + c.phyto + c.bar === 0);
  const willDays = (!empty && typeof subscriptionDays === 'function') ? subscriptionDays(subCartToQuoteInput(), 30) : 0;
  const step = (n, title, body, done) =>
    '<div class="flex gap-3">'
    + '<span class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold '
    + (done ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500') + '">' + (done ? '✓' : n) + '</span>'
    + '<div><div class="text-sm font-bold ' + (done ? 'text-gray-900' : 'text-gray-500') + '">' + title + '</div>'
    + '<div class="text-xs text-gray-500 mt-0.5">' + body + '</div></div></div>';

  return '<h3 class="text-xl font-bold text-gray-900 mb-1">🗓 맞춤 식단</h3>'
    + '<p class="text-sm text-gray-500 mb-5">구독하는 제품 구성에 맞춰 식단을 만들어 드립니다 (최대 30일) · 앞 7일은 무료로 보실 수 있습니다</p>'
    + (reason ? '<div class="bg-amber-50 border border-amber-100 rounded-xl p-3.5 mb-5 text-sm text-amber-900">' + reason + '</div>' : '')
    + '<div class="space-y-3 mb-5">'
    + step(1, '구독 구성 정하기', '위 「맞춤 구독 세트」에서 두유·파이토100·프로틴바 수량을 정하세요', !empty)
    + step(2, '식단 추천받기', '정한 구성으로 ' + (willDays || 30) + '일 식단을 계산합니다 (약 1초)', false)
    + step(3, '매일 실천 기록', '끼니마다 먹었는지 체크하고 체중을 기록하면 목표를 다시 맞춰 드립니다', false)
    + '</div>'
    + (empty
        ? '<div class="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">제품을 1개 이상 담으면 식단을 추천받을 수 있습니다.</div>'
        : '<div class="rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4">'
          + '<div class="text-sm font-bold text-emerald-900 mb-1">선택한 구성</div>'
          + '<div class="text-xs text-emerald-800 mb-1">두유 ' + c.soymilk + ' · 파이토100 ' + c.phyto + ' · 프로틴바 ' + c.bar
          + (c.addon ? ' · 추가 구성품 ' + c.addon : '')
          + ' → 월 ' + won(q.finalPrice) + ' (' + q.rate + '% 할인)</div>'
          + '<div class="text-xs text-emerald-700 mb-3">이 구성으로 <b>' + willDays + '일치</b> 식단을 설계할 수 있습니다'
          + (willDays < 30 ? ' (30일을 채우려면 제품을 더 담아주세요)' : '') + '</div>'
          + '<button type="button" onclick="requestMealPlan()" class="w-full py-3 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition">'
          + '🗓 이 구성으로 ' + willDays + '일 식단 추천받기</button></div>');
}

function renderMealPlan() {
  const el = document.getElementById('mealplan-section');
  if (!el) return;
  syncPlanModeButtons();
  // 「칼로리 가이드」 버전은 메뉴를 짜지 않는다
  if (planMode() === 'guide') { el.innerHTML = guidePlanHtml(); return; }
  if (!tracker.plan) { el.innerHTML = mealPlanPromptHtml(null); return; }
  if (typeof planStale === 'function' && planStale()) {
    el.innerHTML = mealPlanPromptHtml('구독 구성이 바뀌었습니다. 새 구성으로 식단을 다시 추천받으세요. (지금까지의 실천 기록은 초기화됩니다)');
    return;
  }

  const plan = tracker.plan;
  const today = planDayIndex();
  const m = plan.meta, sc = plan.score;
  const openN = openPlanDays();
  const lastFrom = Math.max(1, openN - planPage() + 1);
  const lockHtml = plan.days.length > openN
    ? '<div class="mt-3 rounded-2xl border-2 border-dashed p-5 text-center" style="border-color:#D1D5DB">'
      + '<div class="text-sm font-bold text-gray-800 mb-1">🔒 Day ' + (openN + 1) + '–' + plan.days.length + '은 구독 후에 열립니다</div>'
      + '<div class="text-xs text-gray-500 mb-3">먼저 ' + openN + '일치를 보시고 결정하세요</div>'
      + '<button type="button" onclick="goPage(\'pay\')" class="px-5 py-2.5 bg-emerald-700 text-white text-sm font-bold">구독 시작하고 30일 전체 보기</button></div>'
    : '';

  const scoreTile = (label, v, color, sub) =>
    '<div class="bg-gray-50 rounded-xl px-3 py-2 min-w-0"><div class="text-xs text-gray-500">' + label + '</div>'
    + '<div class="text-lg font-black" style="color:' + color + '">' + v + '</div>'
    + (sub ? '<div class="text-xs text-gray-400">' + sub + '</div>' : '') + '</div>';

  const dayCards = plan.days.slice(planViewFrom - 1, Math.min(planViewFrom - 1 + planPage(), openN)).map(d => {
    const isToday = d.day === today;
    const date = planDateOf(d.day);
    const act = actualDay(d.day);
    const mealsHtml = d.meals.map(meal => {
      const e = (tracker.log[d.day] || {})[meal.type] || { status: null, subs: [] };
      const body = meal.kind === 'product'
        ? '<div class="flex flex-wrap gap-1.5">' + meal.items.map(n =>
            '<span class="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800">' + n + '</span>').join('')
          + '<span class="text-xs text-emerald-700 self-center">· 밥스누 대체식 ' + (meal.combo === 'A' ? '(두유+파이토)' : '(두유+프로틴바+과일)') + '</span></div>'
        : '<div class="grid sm:grid-cols-5 gap-1.5">' + meal.dishes.map(x =>
            '<div class="bg-gray-50 rounded-lg px-2 py-1.5 min-w-0"><div class="text-xs text-gray-400">' + x.icon + ' ' + x.slotName
            + (x.portion && x.portion !== 1 ? ' <span class="text-emerald-700 font-bold">' + x.portion + '공기</span>' : '') + '</div>'
            + '<div class="text-xs font-bold text-gray-800 truncate" title="' + x.name + '">' + x.name + '</div>'
            + '<div class="text-xs text-gray-400">' + x.kcal + ' kcal</div></div>').join('') + '</div>'
          + (meal.extras
              ? '<div class="flex flex-wrap items-center gap-1.5 mt-1.5">'
                + '<span class="text-xs text-emerald-700 font-bold">+ 함께</span>'
                + meal.extras.items.map(n => '<span class="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800">' + n + '</span>').join('')
                + '<span class="text-xs text-gray-400">' + meal.extras.kcal + ' kcal</span></div>'
              : '');

      const subsHtml = e.subs.length
        ? '<ul class="mt-1.5 space-y-1">' + e.subs.map((s, i) =>
            '<li class="flex items-center gap-2 text-xs bg-amber-50 rounded-lg px-2 py-1">'
            + '<span class="font-bold text-amber-900">' + s.name + '</span>'
            + '<span class="text-amber-700">' + s.portion + '인분 · ' + s.kcal + ' kcal</span>'
            + '<button type="button" onclick="removeSubstitute(' + d.day + ',\'' + meal.type + '\',' + i + ')" class="ml-auto text-amber-400 hover:text-red-500" aria-label="삭제"><i class="fas fa-times"></i></button></li>').join('') + '</ul>'
        : '';

      const otherForm = e.status === 'other'
        ? '<div class="mt-1.5 flex flex-wrap gap-1.5 items-center">'
          + '<input id="sub-' + d.day + '-' + meal.type + '" list="plan-food-list" placeholder="실제로 먹은 음식" '
          + 'class="flex-1 min-w-32 text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400">'
          + '<select id="subp-' + d.day + '-' + meal.type + '" class="text-xs px-2 py-1.5 border border-gray-200 rounded-lg">'
          + [0.5, 1, 1.5, 2, 3].map(p => '<option value="' + p + '"' + (p === 1 ? ' selected' : '') + '>' + p + '인분</option>').join('')
          + '</select>'
          + '<button type="button" onclick="submitSubstitute(' + d.day + ',\'' + meal.type + '\')" class="text-sm font-bold px-4 py-2 rounded-lg bg-amber-500 text-white">추가</button>'
          + '<span id="suberr-' + d.day + '-' + meal.type + '" class="text-xs text-red-600"></span></div>'
        : '';

      return '<div class="border-t border-gray-100 pt-2.5 mt-2.5 first:border-0 first:pt-0 first:mt-0">'
        + '<div class="flex flex-wrap items-center gap-2 mb-1.5">'
        + '<span class="text-sm font-bold text-gray-800">' + meal.icon + ' ' + meal.name + '</span>'
        + '<span class="text-xs text-gray-400">' + meal.kcal + ' kcal</span>'
        + '<span class="flex gap-1 ml-auto">'
        + statusBtn(d.day, meal.type, 'eaten', '먹었어요', '✓', e.status === 'eaten')
        + statusBtn(d.day, meal.type, 'other', '다른 음식', '✎', e.status === 'other')
        + statusBtn(d.day, meal.type, 'skipped', '안 먹음', '–', e.status === 'skipped')
        + '</span></div>' + body + subsHtml + otherForm + '</div>';
    }).join('');

    return '<details class="rounded-2xl border-2 p-4" style="border-color:' + (isToday ? '#059669' : '#F3F4F6') + '"' + (isToday ? ' open' : '') + '>'
      + '<summary class="flex flex-wrap items-center gap-2 cursor-pointer list-none">'
      + '<span class="text-sm font-black text-gray-900">Day ' + d.day + '</span>'
      + (date ? '<span class="text-xs text-gray-400">' + date.slice(5).replace('-', '/') + '</span>' : '')
      + (isToday ? '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">오늘</span>' : '')
      + '<span class="text-xs text-gray-500 ml-auto">계획 ' + d.kcal + ' kcal · 식물성 식품 ' + d.pdi + '%</span>'
      + (act.logged ? '<span class="text-xs font-bold text-amber-700">실제 ' + act.kcal + ' kcal · 식물성 식품 ' + act.pdi + '% (' + act.logged + '/' + act.total + '끼 기록)</span>' : '')
      + '</summary><div class="mt-3">' + mealsHtml + '</div>'
      + (d.snack ? '<div class="mt-2.5 pt-2.5 border-t border-gray-100 text-xs"><b class="text-gray-700">🍪 간식</b> '
          + d.snack.items.join(' + ') + ' <span class="text-gray-400">' + d.snack.kcal + ' kcal</span></div>' : '')
      + '</details>';
  }).join('');

  el.innerHTML =
    '<div class="flex flex-wrap items-center justify-between gap-2 mb-4">'
    + '<h3 class="text-xl font-bold text-gray-900">🗓 ' + plan.days.length + '일 맞춤 식단</h3>'
    + (plan.days.length > openN
        ? '<span class="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800">' + openN + '일 미리보기</span>' : '')
    + '<p class="w-full text-xs text-gray-500">영양 균형 · 식물성 식품 비율 · 메뉴 다양성 · 메뉴 궁합 네 가지를 함께 맞춘 결과입니다</p>'
    + '<button type="button" onclick="requestMealPlan()" class="text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50"><i class="fas fa-rotate mr-1"></i>식단 다시 만들기</button>'
    + '</div>'

    + '<div class="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">'
    + scoreTile('영양 균형', sc.nutrition, '#6B8E73')
    + scoreTile('식물성 식품 비율', sc.pdi, '#6B8E73', '목표 ' + m.pdiOptTarget + '%')
    + scoreTile('메뉴 다양성', sc.diversity, '#6B8E73')
    + scoreTile('메뉴 궁합', sc.harmony, '#6B8E73')
    + scoreTile('평균 칼로리', m.avgKcal, '#2C5530')
    + scoreTile('평균 식물성 비율', m.avgPDI + '%', '#2C5530', '자체 설정 목표 40%')
    + '</div>'
    + '<div class="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-3 text-xs text-emerald-900">'
    + '<b>밥스누 제품 배치</b> · 구독한 ' + m.coverage.totalServings + '회분을 ' + plan.days.length + '일에 나눠 넣었습니다<br>'
    + '저녁 ' + m.coverage.replaceDays + '일은 제품으로 한 끼 대체'
    + (m.coverage.extraCount.breakfast ? ' · 아침 ' + m.coverage.extraCount.breakfast + '일 곁들임' : '')
    + (m.coverage.extraCount.lunch ? ' · 점심 ' + m.coverage.extraCount.lunch + '일 곁들임' : '')
    + (m.coverage.extraCount.snack ? ' · 간식 ' + m.coverage.extraCount.snack + '회' : '')
    + (m.shortfall
        ? '<div class="mt-2 pt-2 border-t border-emerald-200 text-amber-800">'
          + '구독량으로는 <b>' + plan.days.length + '일</b>까지 설계됩니다. ' + m.maxDays + '일을 채우려면 '
          + m.shortfall.soymilkName + ' ' + m.shortfall.soymilkPacks + '팩'
          + ' 또는 약콩 프로틴바 ' + m.shortfall.barPacks + '팩'
          + ' 또는 밥스누 파이토100 ' + m.shortfall.phytoPacks + '팩을 더 담아주세요.'
          + '</div>'
        : '')
    + '</div>'
    + '<p class="text-xs text-gray-400 mb-4">목표 ' + m.targetKcal + ' kcal/일 · '
    + '선택 가능 메뉴 ' + Object.entries(m.poolSizes).map(([k, v]) => DISH_SLOTS.find(s => s.id === k).name + ' ' + v + '개').join(' · ')
    + ' · 계산 ' + m.generations + '회 반복 · ' + (m.elapsedMs / 1000).toFixed(1) + '초</p>'

    + '<div class="flex items-center justify-between gap-2 mb-3">'
    + '<button type="button" onclick="setPlanView(' + (planViewFrom - planPage()) + ')" ' + (planViewFrom <= 1 ? 'disabled' : '')
    + ' class="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-30">← 이전 7일</button>'
    + '<span class="text-sm font-bold text-gray-700">Day ' + planViewFrom + '–' + Math.min(openN, planViewFrom + PLAN_PAGE - 1) + '</span>'
    + '<button type="button" onclick="setPlanView(' + (planViewFrom + planPage()) + ')" ' + (planViewFrom >= lastFrom ? 'disabled' : '')
    + ' class="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-30">다음 7일 →</button>'
    + '</div>'
    + '<div class="space-y-3">' + dayCards + '</div>' + lockHtml;
}

function submitSubstitute(day, mealType) {
  const input = document.getElementById('sub-' + day + '-' + mealType);
  const sel   = document.getElementById('subp-' + day + '-' + mealType);
  const err   = document.getElementById('suberr-' + day + '-' + mealType);
  const name = (input.value || '').trim();
  if (!name) { err.textContent = '음식명을 입력해주세요.'; return; }
  const msg = addSubstitute(day, mealType, name, Number(sel.value));
  if (msg) {
    const e2 = document.getElementById('suberr-' + day + '-' + mealType);
    if (e2) e2.textContent = msg;
  }
}

// ══════════════════════════════════════════════
// 렌더링 — 체중 모니터링
// ══════════════════════════════════════════════
let weightChart = null;

// ══════════════════════════════════════════════
// 날짜별 기록 (달력)
//   식단을 받지 않아도 쓸 수 있다 — tracker.plan 과 무관하게 날짜로만 저장한다
//   저장하는 것은 음식 이름·끼니·양뿐이고 영양은 그릴 때 다시 계산한다
// ══════════════════════════════════════════════
let diaryDate = null;     // 선택한 날짜 (YYYY-MM-DD)
let diaryMonth = null;    // 달력에 보이는 달 (YYYY-MM)
let diaryMeal = 'breakfast';   // 다시 그려도 유지되도록 기억해 둔다
let diaryPortion = 1;

const DIARY_MEALS = [
  { id: 'breakfast', name: '아침', icon: '🌅' },
  { id: 'lunch',     name: '점심', icon: '☀️' },
  { id: 'dinner',    name: '저녁', icon: '🌙' },
  { id: 'snack',     name: '간식', icon: '🍪' },
];

function diaryInit() {
  if (!tracker.diary) tracker.diary = {};
  if (!diaryDate) diaryDate = isoToday();
  if (!diaryMonth) diaryMonth = diaryDate.slice(0, 7);
}

function diaryList(date) { return (tracker.diary && tracker.diary[date]) || []; }

function diaryMealsOf(date) {
  return diaryList(date).map(e => {
    const a = analyzeFood(e.name);
    return a ? { name: e.name, meal: e.meal, portion: e.portion, analysis: scaleAnalysis(a, e.portion) } : null;
  }).filter(Boolean);
}

function weightOf(date) {
  const w = (tracker.weights || []).find(x => x.date === date);
  return w ? w.kg : null;
}

// 달력에서 쓰는 날짜 문자열 (toISOString 은 UTC 라 하루 밀릴 수 있어 직접 조립)
function diaryIso(y, m, d) {
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function setDiaryDate(iso) {
  diaryDate = iso;
  diaryMonth = iso.slice(0, 7);
  renderDiary();
}

function shiftDiaryMonth(n) {
  diaryInit();
  const [y, m] = diaryMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  diaryMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  renderDiary();
}

function diaryAdd(nameOverride) {
  diaryInit();
  const input = document.getElementById('diary-food');
  const err   = document.getElementById('diary-error');
  const name  = (nameOverride || (input ? input.value : '')).trim();
  const meal  = (document.getElementById('diary-meal') || {}).value || diaryMeal;
  const portion = Number((document.getElementById('diary-portion') || {}).value) || diaryPortion;
  diaryMeal = meal; diaryPortion = portion;
  if (!name) { if (err) err.textContent = '음식 이름을 입력해주세요.'; return; }
  if (!analyzeFood(name)) {
    if (err) err.textContent = '"' + name + '"을 찾을 수 없습니다. 입력창의 목록에서 골라주세요.';
    return;
  }
  if (err) err.textContent = '';
  (tracker.diary[diaryDate] || (tracker.diary[diaryDate] = [])).push({ name, meal, portion });
  trackerSave();
  if (input) input.value = '';
  renderDiary();
}

function diaryRemove(i) {
  const list = tracker.diary[diaryDate];
  if (!list || !list[i]) return;
  list.splice(i, 1);
  if (!list.length) delete tracker.diary[diaryDate];
  trackerSave();
  renderDiary();
}

function submitDiaryWeight() {
  diaryInit();
  const el  = document.getElementById('diary-weight');
  const err = document.getElementById('diary-weight-error');
  const kg  = Number(el ? el.value : NaN);
  if (!(kg >= 10 && kg <= 300)) { if (err) err.textContent = '10–300 kg 범위로 입력해주세요.'; return; }
  if (err) err.textContent = '';
  logWeight(kg, diaryDate);
  renderDiary();
  renderMonitor();
  renderMealPlan();
}

// 적정 구간을 띠로 깔고 그 위에 섭취량 막대를 그린다 — 미달/적정/초과를 한눈에
//   lo 만 있으면 「이상」, hi 만 있으면 「이하」 기준
function intakeBar(label, value, lo, hi, unit, digits) {
  const scale = (hi || lo) * 1.5 || 1;
  const pct   = Math.min(value / scale, 1) * 100;
  const loPct = lo ? Math.min(lo / scale, 1) * 100 : 0;
  const hiPct = hi ? Math.min(hi / scale, 1) * 100 : 100;
  let state, color;
  if (lo && value < lo)      { state = '미달'; color = '#B45309'; }
  else if (hi && value > hi) { state = '초과'; color = '#DC2626'; }
  else                       { state = '적정'; color = '#6B8E73'; }
  const f = v => Number(v).toLocaleString('ko-KR', { maximumFractionDigits: digits || 0 });
  const std = (lo && hi) ? f(lo) + '–' + f(hi) : (hi ? f(hi) + ' 이하' : f(lo) + ' 이상');
  return '<div class="min-w-0">'
    + '<div class="flex items-baseline justify-between gap-2 mb-1">'
    + '<span class="text-xs font-bold text-gray-600">' + label + '</span>'
    + '<span class="text-xs font-bold" style="color:' + color + '">' + state + '</span></div>'
    + '<div class="relative h-2.5 bg-gray-100 rounded-full overflow-hidden mb-1">'
    + '<div class="absolute inset-y-0 bg-emerald-100" style="left:' + loPct + '%;width:' + (hiPct - loPct) + '%"></div>'
    + '<div class="absolute inset-y-0 left-0 rounded-full" style="width:' + pct + '%;background:' + color + '"></div>'
    + '</div>'
    + '<div class="text-xs text-gray-400">' + f(value) + ' ' + unit + ' <span class="text-gray-300">/ 적정 ' + std + '</span></div>'
    + '</div>';
}

function renderDiary() {
  const el = document.getElementById('diary-section');
  if (!el) return;
  if (!tracker.profile) { el.innerHTML = ''; return; }
  diaryInit();

  const targets = currentTargets();
  const meals   = diaryMealsOf(diaryDate);
  const today   = isoToday();

  // ── 달력 ──
  const [cy, cm] = diaryMonth.split('-').map(Number);
  const lead = new Date(cy, cm - 1, 1).getDay();
  const last = new Date(cy, cm, 0).getDate();
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div></div>';
  for (let d = 1; d <= last; d++) {
    const iso  = diaryIso(cy, cm, d);
    const sel  = iso === diaryDate;
    const food = diaryList(iso).length > 0;
    const wt   = weightOf(iso) !== null;
    const dot  = c => '<span class="w-1.5 h-1.5 rounded-full ' + c + '"></span>';
    cells += '<button type="button" onclick="setDiaryDate(\'' + iso + '\')" '
      + 'class="aspect-square flex flex-col items-center justify-center text-sm leading-none '
      + (sel ? 'bg-emerald-700 text-white font-bold'
             : (iso === today ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-gray-700 hover:bg-gray-100'))
      + (iso > today ? ' opacity-40' : '') + '">'
      + d + '<span class="flex gap-0.5 h-1.5 mt-1">'
      + (food ? dot(sel ? 'bg-white' : 'bg-emerald-600') : '')
      + (wt   ? dot(sel ? 'bg-white' : 'bg-gray-400') : '')
      + '</span></button>';
  }

  // ── 기록한 음식 ──
  const foodHtml = DIARY_MEALS.map(mt => {
    const items = diaryList(diaryDate)
      .map((e, i) => ({ ...e, i }))
      .filter(e => e.meal === mt.id);
    if (!items.length) return '';
    return '<div class="flex flex-wrap items-center gap-1.5 mb-2">'
      + '<span class="text-xs font-bold text-gray-500 w-12 flex-shrink-0">' + mt.icon + ' ' + mt.name + '</span>'
      + items.map(e => '<span class="inline-flex items-center gap-1 text-xs bg-gray-50 rounded-full pl-3 pr-1.5 py-1.5">'
          + e.name + (e.portion !== 1 ? ' <span class="text-gray-400">' + e.portion + '인분</span>' : '')
          + '<button type="button" onclick="diaryRemove(' + e.i + ')" aria-label="삭제" '
          + 'class="w-5 h-5 leading-none text-gray-400 hover:text-red-500">×</button></span>').join('')
      + '</div>';
  }).join('');

  // ── 기준 대비 ──
  let barsHtml;
  if (!meals.length) {
    barsHtml = '<div class="bg-gray-50 rounded-2xl p-5 text-sm text-gray-500 text-center">'
      + '이 날 먹은 음식을 추가하면 목표치와 비교해 보여드립니다</div>';
  } else {
    const pfs  = calculateDietPFS(meals, tracker.profile);
    const n    = pfs.daily.nutrients;
    const rg   = targets.ranges;
    const kcal = meals.reduce((s, m) => s + m.analysis.totalCal, 0);
    const ig   = foodGroupIntake(meals);
    const lacks = [];
    if (ig.wholeGrainPct < 5)            lacks.push('통곡물');
    if (ig.vegG < 350)                   lacks.push('채소');
    if (ig.fruitG < 100)                 lacks.push('과일');
    if (n.protein < rg.protein[0])       lacks.push('단백질');
    if (n.fiber < rg.fiber)              lacks.push('식이섬유');

    barsHtml =
      '<div class="grid sm:grid-cols-2 gap-x-6 gap-y-4 mb-5">'
      + intakeBar('칼로리', kcal, Math.round(targets.targetKcal * 0.9), Math.round(targets.targetKcal * 1.1), 'kcal')
      + intakeBar('탄수화물', n.carb, rg.carb[0], rg.carb[1], 'g')
      + intakeBar('단백질', n.protein, rg.protein[0], rg.protein[1], 'g')
      + intakeBar('지방', n.fat, rg.fat[0], rg.fat[1], 'g')
      + intakeBar('식이섬유', n.fiber, rg.fiber, null, 'g', 1)
      + intakeBar('나트륨', n.sodium, null, rg.sodium, 'mg')
      + '</div>'
      + '<div class="text-sm font-bold text-gray-800 mb-2">이 날 부족했던 것</div>'
      + (lacks.length
          ? '<div class="flex flex-wrap gap-1.5">' + lacks.map(x =>
              '<span class="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800">' + x + ' 섭취 부족</span>').join('') + '</div>'
          : '<div class="text-sm text-emerald-700">🎉 부족한 것 없이 고르게 드셨습니다</div>');
  }

  const wt = weightOf(diaryDate);
  const label = Number(diaryDate.slice(5, 7)) + '월 ' + Number(diaryDate.slice(8)) + '일'
    + (diaryDate === today ? ' (오늘)' : '');

  el.innerHTML =
    '<h3 class="text-xl font-bold text-gray-900 mb-1">날짜별 기록</h3>'
    + '<p class="text-gray-500 text-sm mb-5">달력에서 날짜를 고르면 그 날 먹은 음식과 체중을 기록할 수 있습니다</p>'

    + '<div class="grid lg:grid-cols-2 gap-6">'
    // 달력
    + '<div>'
    + '<div class="flex items-center justify-between mb-3">'
    + '<button type="button" onclick="shiftDiaryMonth(-1)" class="w-9 h-9 text-gray-500 hover:bg-gray-100" aria-label="이전 달">‹</button>'
    + '<span class="text-base font-bold text-gray-900">' + cy + '년 ' + cm + '월</span>'
    + '<button type="button" onclick="shiftDiaryMonth(1)" class="w-9 h-9 text-gray-500 hover:bg-gray-100" aria-label="다음 달">›</button>'
    + '</div>'
    + '<div class="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">'
    + ['일', '월', '화', '수', '목', '금', '토'].map(d => '<div>' + d + '</div>').join('')
    + '</div>'
    + '<div class="grid grid-cols-7 gap-1">' + cells + '</div>'
    + '<div class="flex gap-4 mt-3 text-xs text-gray-400">'
    + '<span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>식사 기록</span>'
    + '<span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>체중 기록</span>'
    + '</div>'
    + '</div>'

    // 선택한 날짜
    + '<div>'
    + '<div class="text-base font-bold text-gray-900 mb-3">' + label + '</div>'
    + '<div class="bg-gray-50 rounded-2xl p-4 mb-4">'
    + '<div class="flex flex-wrap gap-2 mb-2">'
    + '<select id="diary-meal" class="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm">'
    + DIARY_MEALS.map(m => '<option value="' + m.id + '"' + (m.id === diaryMeal ? ' selected' : '') + '>'
        + m.icon + ' ' + m.name + '</option>').join('')
    + '</select>'
    + '<select id="diary-portion" class="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm">'
    + [0.5, 1, 1.5, 2].map(p => '<option value="' + p + '"' + (p === diaryPortion ? ' selected' : '') + '>' + p + '인분</option>').join('')
    + '</select>'
    + '<input id="diary-food" list="plan-food-list" placeholder="먹은 음식" autocomplete="off" '
    + 'class="flex-1 min-w-32 h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-emerald-500">'
    + '<button type="button" onclick="diaryAdd()" class="h-11 px-5 bg-emerald-700 text-white text-sm font-bold">추가</button>'
    + '</div>'
    + '<span id="diary-error" class="text-xs text-red-600"></span>'
    + '</div>'
    + (foodHtml || '<p class="text-sm text-gray-400 mb-4">아직 기록한 음식이 없습니다</p>')
    + '<div class="flex flex-wrap items-end gap-2 bg-gray-50 rounded-2xl p-4 mt-4">'
    + '<div><label for="diary-weight" class="block text-xs font-bold text-gray-500 mb-1">이 날 체중 (kg)</label>'
    + '<input id="diary-weight" type="number" step="0.1" min="10" max="300" value="' + (wt !== null ? wt : '') + '" '
    + 'placeholder="예: 65.0" class="w-28 h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-emerald-500"></div>'
    + '<button type="button" onclick="submitDiaryWeight()" class="h-11 px-5 bg-emerald-700 text-white text-sm font-bold">기록</button>'
    + '<span id="diary-weight-error" class="text-xs text-red-600 self-center"></span>'
    + '</div>'
    + '</div>'
    + '</div>'

    + '<div class="mt-6 pt-6 border-t border-gray-100">'
    + '<div class="text-sm font-bold text-gray-800 mb-3">' + label + ' 기준 대비</div>'
    + barsHtml
    + '</div>'

    + preferenceNoteHtml();
}

// 기록을 쌓으면 자주 먹는 음식으로 식단을 짤 수 있다는 안내
function preferenceNoteHtml() {
  const n = Object.keys(tracker.diary || {}).filter(d => (tracker.diary[d] || []).length).length;
  return '<div class="mt-5 rounded-2xl bg-gray-50 p-4 text-xs text-gray-600">'
    + '🍽 지금까지 <b class="text-gray-800">' + n + '일</b> 기록하셨어요. 꾸준히 기록하시면 자주 드시는 음식으로 식단을 짜 드릴 수 있어요'
    + (n < SAMPLE_DAYS ? ' (' + (SAMPLE_DAYS - n) + '일 더)' : '')
    + '</div>';
}

function renderMonitor() {
  const el = document.getElementById('monitor-section');
  if (!el) return;
  if (!tracker.profile) { el.innerHTML = ''; return; }

  const targets = currentTargets();
  const ad = adherence();
  const rt = retargetSuggestion(targets);
  const tr = rt.trend;
  const cur = tracker.weights.length ? tracker.weights[tracker.weights.length - 1].kg : tracker.profile.weight;
  const bmi = cur / ((tracker.profile.height / 100) ** 2);
  const bt = classifyBodyType(bmi);

  const tile = (label, value, sub, color) =>
    '<div class="bg-gray-50 rounded-2xl p-4 min-w-0"><div class="text-xs font-bold text-gray-500 mb-1">' + label + '</div>'
    + '<div class="text-2xl font-black" style="color:' + (color || '#111827') + '">' + value + '</div>'
    + '<div class="text-xs text-gray-400 mt-1">' + sub + '</div></div>';

  const retargetHtml = !rt.ready
    ? '<div class="bg-gray-50 rounded-xl p-3.5 text-sm text-gray-600">' + rt.reason + '</div>'
    : rt.onTrack
      ? '<div class="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 text-sm text-emerald-800">'
        + '✅ 계획대로 진행 중입니다 (계획 ' + rt.planned + ' kg/주 · 실제 ' + tr.perWeek + ' kg/주). 목표 칼로리를 유지합니다.</div>'
      : '<div class="bg-amber-50 border border-amber-100 rounded-xl p-3.5">'
        + '<div class="text-sm font-bold text-amber-900 mb-1">🎯 목표 재조정 제안</div>'
        + '<div class="text-xs text-amber-800">계획 ' + rt.planned + ' kg/주 → 실제 <b>' + tr.perWeek + ' kg/주</b> (차이 ' + (rt.gap > 0 ? '+' : '') + rt.gap + ')<br>'
        + '목표 칼로리를 <b>' + targets.targetKcal.toLocaleString() + ' → ' + rt.newTargetKcal.toLocaleString() + ' kcal</b>'
        + ' (' + (rt.delta > 0 ? '+' : '') + rt.delta + ') 로 조정하고 남은 식단을 다시 생성합니다.</div>'
        + '<button type="button" onclick="applyRetarget(' + rt.newTargetKcal + ')" class="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 text-white">목표 적용 + 식단 재생성</button>'
        + '</div>';

  el.innerHTML =
    '<h3 class="text-xl font-bold text-gray-900 mb-4">📈 체중 변화 · 실천 현황</h3>'

    + '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">'
    + tile('현재 체중', cur + ' kg', 'BMI ' + bmi.toFixed(1) + ' · ' + bt.name, '#2C5530')
    + tile('누적 변화', (tr ? (tr.total > 0 ? '+' : '') + tr.total + ' kg' : '–'), tr ? tr.spanDays + '일간 · ' + tr.perWeek + ' kg/주' : '2회 이상 기록 필요', tr && tr.total < 0 ? '#6B8E73' : '#B45309')
    + tile('표준 체중까지', (Math.round((cur - targets.targetWeight) * 10) / 10) + ' kg', 'BMI 22 기준 ' + targets.targetWeight + ' kg', '#6B8E73')
    + tile('식단 실천율', ad.pct + '%', ad.logged + '/' + ad.total + '끼 기록', '#2C5530')
    + '</div>'

    + '<div class="rounded-2xl border border-gray-100 p-4 mb-4"><canvas id="weight-chart" height="140"></canvas></div>'
    + retargetHtml
    + '<div class="flex flex-wrap gap-3 mt-4 text-xs text-gray-500">'
    + '<span>✓ 추천대로 ' + ad.eaten + '끼</span><span>✎ 다른 음식 ' + ad.other + '끼</span><span>– 안 먹음 ' + ad.skipped + '끼</span>'
    + '<button type="button" onclick="if(confirm(\'기록·식단·체중을 모두 삭제합니다. 계속할까요?\')){trackerReset();location.reload();}" class="ml-auto underline text-gray-400 hover:text-red-500">기록 초기화</button>'
    + '</div>';

  drawWeightChart();
}

function drawWeightChart() {
  const canvas = document.getElementById('weight-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (weightChart) { weightChart.destroy(); weightChart = null; }
  const w = tracker.weights;
  if (w.length < 1) return;

  const targets = currentTargets();
  // 계획 추세선: 시작 체중에서 weeklyDelta 기울기로 30일
  const start = w[0];
  const labels = [], actual = [], planned = [];
  const span = Math.max(29, daysBetween(start.date, w[w.length - 1].date));
  for (let i = 0; i <= span; i++) {
    const date = dayOffset(start.date, i);
    labels.push(date.slice(5).replace('-', '/'));
    const hit = w.find(p => p.date === date);
    actual.push(hit ? hit.kg : null);
    planned.push(+(start.kg + targets.weeklyDelta * i / 7).toFixed(2));
  }

  weightChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '실제 체중', data: actual, borderColor: '#059669', backgroundColor: '#05966922', spanGaps: true, tension: 0.3, pointRadius: 4 },
        { label: '계획 추세', data: planned, borderColor: '#9CA3AF', borderDash: [5, 4], pointRadius: 0, tension: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: { y: { ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 }, maxTicksLimit: 10 } } },
    },
  });
}

