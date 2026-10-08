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
  return { version: 1, profile: null, goals: ['weight'], cart: null, startDate: null, plan: null, log: {}, weights: [], targetKcalOverride: null };
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
  const max = tracker.plan ? tracker.plan.days.length : 1;
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
    + '<p class="text-sm text-gray-500 mb-5">구독하는 제품 구성에 맞춰 식단을 만들어 드립니다 (최대 30일)</p>'
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
  if (!tracker.plan) { el.innerHTML = mealPlanPromptHtml(null); return; }
  if (typeof planStale === 'function' && planStale()) {
    el.innerHTML = mealPlanPromptHtml('구독 구성이 바뀌었습니다. 새 구성으로 식단을 다시 추천받으세요. (지금까지의 실천 기록은 초기화됩니다)');
    return;
  }

  const plan = tracker.plan;
  const today = planDayIndex();
  const m = plan.meta, sc = plan.score;
  const lastFrom = Math.max(1, plan.days.length - planPage() + 1);

  const scoreTile = (label, v, color, sub) =>
    '<div class="bg-gray-50 rounded-xl px-3 py-2 min-w-0"><div class="text-xs text-gray-500">' + label + '</div>'
    + '<div class="text-lg font-black" style="color:' + color + '">' + v + '</div>'
    + (sub ? '<div class="text-xs text-gray-400">' + sub + '</div>' : '') + '</div>';

  const dayCards = plan.days.slice(planViewFrom - 1, planViewFrom - 1 + planPage()).map(d => {
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
      + '<span class="text-xs text-gray-500 ml-auto">계획 ' + d.kcal + ' kcal · PDI ' + d.pdi + '%</span>'
      + (act.logged ? '<span class="text-xs font-bold text-amber-700">실제 ' + act.kcal + ' kcal · PDI ' + act.pdi + '% (' + act.logged + '/' + act.total + '끼 기록)</span>' : '')
      + '</summary><div class="mt-3">' + mealsHtml + '</div>'
      + (d.snack ? '<div class="mt-2.5 pt-2.5 border-t border-gray-100 text-xs"><b class="text-gray-700">🍪 간식</b> '
          + d.snack.items.join(' + ') + ' <span class="text-gray-400">' + d.snack.kcal + ' kcal</span></div>' : '')
      + '</details>';
  }).join('');

  el.innerHTML =
    '<div class="flex flex-wrap items-center justify-between gap-2 mb-4">'
    + '<h3 class="text-xl font-bold text-gray-900">🗓 ' + plan.days.length + '일 맞춤 식단</h3>'
    + '<p class="w-full text-xs text-gray-500">영양 균형 · PDI 달성도 · 메뉴 다양성 · 메뉴 궁합 네 가지를 함께 맞춘 결과입니다</p>'
    + '<button type="button" onclick="requestMealPlan()" class="text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50"><i class="fas fa-rotate mr-1"></i>식단 다시 만들기</button>'
    + '</div>'

    + '<div class="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">'
    + scoreTile('영양 균형', sc.nutrition, '#10B981')
    + scoreTile('PDI 달성도', sc.pdi, '#059669', '목표 ' + m.pdiOptTarget + '%')
    + scoreTile('메뉴 다양성', sc.diversity, '#8B5CF6')
    + scoreTile('메뉴 궁합', sc.harmony, '#2563EB')
    + scoreTile('평균 칼로리', m.avgKcal, '#374151')
    + scoreTile('평균 PDI', m.avgPDI + '%', '#374151', '임계 40% 이상')
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
    + '<span class="text-sm font-bold text-gray-700">Day ' + planViewFrom + '–' + Math.min(plan.days.length, planViewFrom + PLAN_PAGE - 1) + '</span>'
    + '<button type="button" onclick="setPlanView(' + (planViewFrom + planPage()) + ')" ' + (planViewFrom >= lastFrom ? 'disabled' : '')
    + ' class="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-30">다음 7일 →</button>'
    + '</div>'
    + '<div class="space-y-3">' + dayCards + '</div>';
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

    + '<div class="flex flex-wrap gap-2 items-end mb-5 bg-gray-50 rounded-2xl p-4">'
    + '<div><label class="block text-xs font-bold text-gray-500 mb-1">오늘 체중 (kg)</label>'
    + '<input id="weight-input" type="number" step="0.1" min="10" max="300" value="' + cur + '" class="w-28 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"></div>'
    + '<div><label class="block text-xs font-bold text-gray-500 mb-1">측정일</label>'
    + '<input id="weight-date" type="date" value="' + isoToday() + '" class="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"></div>'
    + '<button type="button" onclick="submitWeight()" class="px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800">기록</button>'
    + '<span id="weight-error" class="text-xs text-red-600 self-center"></span>'
    + '</div>'

    + '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">'
    + tile('현재 체중', cur + ' kg', 'BMI ' + bmi.toFixed(1) + ' · ' + bt.name, '#111827')
    + tile('누적 변화', (tr ? (tr.total > 0 ? '+' : '') + tr.total + ' kg' : '–'), tr ? tr.spanDays + '일간 · ' + tr.perWeek + ' kg/주' : '2회 이상 기록 필요', tr && tr.total < 0 ? '#0EA5E9' : '#F97316')
    + tile('표준 체중까지', (Math.round((cur - targets.targetWeight) * 10) / 10) + ' kg', 'BMI 22 기준 ' + targets.targetWeight + ' kg', '#8B5CF6')
    + tile('식단 실천율', ad.pct + '%', ad.logged + '/' + ad.total + '끼 기록 · 평균 PDI ' + ad.avgPDI + '%', '#059669')
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

function submitWeight() {
  const el = document.getElementById('weight-input');
  const de = document.getElementById('weight-date');
  const err = document.getElementById('weight-error');
  const kg = Number(el.value);
  if (!(kg >= 10 && kg <= 300)) { err.textContent = '체중은 10–300kg 범위로 입력해주세요.'; return; }
  logWeight(kg, de.value || isoToday());
  renderMonitor();
  renderMealPlan();
}
