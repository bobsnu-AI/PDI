// 웰니스 파이프라인(F1~F7) 자체 점검 + 가상 사용자 전체 흐름
//   실행: node scripts/test-pipeline.mjs          (검사만)
//         node scripts/test-pipeline.mjs --emit   (docs/wellness-example-run.json 에 단계별 입력·출력 저장)
//
// ※ 아래 FIXTURE_* 는 로직 검사용 가상값입니다. 임상·실측 근거가 없으며 서비스 데이터가 아닙니다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const noop = () => {}
const ctx = vm.createContext({
  console,
  document: { addEventListener: noop, getElementById: () => null },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  location: { hash: '' },
  window: { addEventListener: noop, matchMedia: () => ({ matches: true }), scrollTo: noop },
  Chart: undefined,
  setTimeout: fn => { fn(); return 0 },
  clearTimeout: noop,
})
for (const f of ['recipes', 'foodnut', 'foodclass', 'pfs', 'patterns', 'products', 'mealplan', 'foodparse', 'tracker', 'app', 'wellness-data', 'pipeline'])
  vm.runInContext(read(`public/static/${f}.js`), ctx, { filename: f + '.js' })
const $ = name => vm.runInContext(name, ctx)
const run = code => vm.runInContext(code, ctx)
const plain = v => JSON.parse(JSON.stringify(v))
const setMode = m => run(`WELLNESS_CONFIG.PIPELINE_MODE = '${m}'`)

const r6 = v => +v.toPrecision(6)
let pass = 0
const ok = (label, fn) => { fn(); pass++; console.log('  ✓ ' + label) }

// ── 가상값 (검사용) ─────────────────────────────
const FX = 'TEST FIXTURE (가상값 · 근거 없음)'
const FIXTURE_TABLE = [
  // 실제 표의 질환 행(문헌 기반 초안)은 빼고 관리목표 행만 씁니다 — 로직 검사가 표 내용에 흔들리지 않게
  ...$('FUNCTIONAL_TARGETS').filter(r => r.target_id.startsWith('goal:')),
  { target_id: 'cvd',      component_id: 'anthocyanins',   component_name: '안토시아닌',       daily_amount: 50,   unit: 'mg', upper_limit: 200, priority: 1, source: FX, needs_review: true },
  { target_id: 'diabetes', component_id: 'isoflavones',    component_name: '이소플라본',       daily_amount: 0.04, unit: 'g',  upper_limit: 0.15, priority: 1, source: FX, needs_review: true },
  { target_id: 'cancer',   component_id: 'glucosinolates', component_name: '글루코시놀레이트', daily_amount: null, unit: 'mg', upper_limit: null, priority: 1, source: FX, needs_review: true },
]
const FIXTURE_RULES = [
  { disease: 'cvd', risk: '위험', nutrient: 'sodium', mode: 'upper_reduce', value: 2000, source: FX, needs_review: true },
  { disease: 'cvd', risk: '위험', nutrient: 'sodium', mode: 'upper_reduce', value: 1800, source: FX, needs_review: true },
  { disease: 'diabetes', risk: '위험', nutrient: 'fiber', mode: 'lower_raise', value: 30, source: FX, needs_review: true },
  { disease: 'cancer', risk: '위험', nutrient: 'sugar', mode: 'upper_reduce', value: null, source: FX, needs_review: true },
]

// ── 가상 사용자 ────────────────────────────────
const SURVEY = {
  bad:  { refinedGrain: 0, wholeGrain: 3, veg: 2, fruit: 3, redMeat: 1, processedMeat: 1, fish: 3, egg: 2, legumes: 3, nuts: 3, dairy: 3, dairyLow: 2, sweets: 1, coffeeTea: 1, ssb: 1, alcohol: 2, salty: 2 },
  mid:  { refinedGrain: 1, wholeGrain: 2, veg: 2, fruit: 2, redMeat: 2, processedMeat: 2, fish: 2, egg: 2, legumes: 2, nuts: 3, dairy: 2, dairyLow: 1, sweets: 2, coffeeTea: 1, ssb: 2, alcohol: 2, salty: 1 },
  good: { refinedGrain: 2, wholeGrain: 0, veg: 0, fruit: 1, redMeat: 3, processedMeat: 3, fish: 1, egg: 2, legumes: 0, nuts: 0, dairy: 1, dairyLow: 0, sweets: 3, coffeeTea: 1, ssb: 3, alcohol: 3, salty: 0 },
}
const USERS = [
  { id: 'U1', survey: 'bad',  goals: ['weight'],                   allergies: [],      useMealPlan: true,  profile: { gender: 'female', age: 35, height: 162, weight: 68, prevWeight: 69, activity: 'low' } },
  { id: 'U2', survey: 'mid',  goals: ['weight', 'blood_sugar'],    allergies: ['soy'], useMealPlan: true,  profile: { gender: 'male',   age: 52, height: 174, weight: 82, prevWeight: 82, activity: 'low' } },
  { id: 'U3', survey: 'good', goals: ['weight', 'bone'],           allergies: [],      useMealPlan: false, profile: { gender: 'female', age: 28, height: 165, weight: 55, prevWeight: 55, activity: 'low' } },
  { id: 'U4', survey: 'bad',  goals: ['weight', 'fatigue', 'gut'], allergies: ['milk'], useMealPlan: false, profile: { gender: 'male',  age: 61, height: 168, weight: 74, prevWeight: 75, activity: 'low' } },
]
const gradesOf = u => {
  const a = SURVEY[u.survey]
  return $('diseaseGrades')($('scoreDietPatterns')($('buildSurveyDiet')(a), $('surveyServings')(a), u.profile.gender))
}
const pipe = (u, extra) => $('runDeficitPipeline')({
  userId: u.id, profile: u.profile, grades: gradesOf(u), goals: u.goals, allergies: u.allergies,
  targets: $('nutritionTargets')(u.profile), useMealPlan: u.useMealPlan, seed: 7, table: FIXTURE_TABLE, ...extra })
const F1 = (u, extra) => $('functionalTargets')({ userId: u.id, grades: gradesOf(u), goals: u.goals, allergies: u.allergies, table: FIXTURE_TABLE, ...extra })

console.log('\n── 단위 변환 ──')
ok('mg · g · μg 변환', () => {
  const c = $('convertUnit')
  assert.equal(c(1, 'g', 'mg'), 1000)
  assert.equal(c(250, 'mg', 'g'), 0.25)
  assert.equal(c(400, 'μg', 'mg'), 0.4)
  assert.equal(c(0.4, 'mg', 'μg'), 400)
  assert.equal(c(2, 'g', 'μg'), 2e6)
  assert.equal(c(null, 'g', 'mg'), null)
  assert.throws(() => c(1, 'IU', 'mg'))
})

console.log('\n── F1 목표 기능성 성분 ──')
ok('사용자 4명의 목표 성분 목록이 서로 다르다', () => {
  const lists = USERS.map(u => F1(u).targets.map(t => t.component_id + ':' + t.daily_amount).join())
  assert.equal(new Set(lists).size, USERS.length, lists.join(' | '))
})
ok('필요량이 null 인 성분은 needs_review 로 표시되고 계산은 계속된다', () => {
  const out = F1(USERS[0])
  const g = out.targets.find(t => t.component_id === 'glucosinolates')
  assert.equal(g.daily_amount, null)
  assert.equal(g.needs_review, true)
  assert.ok(out.targets.length > 1)
  assert.equal(out.rule_version, $('WELLNESS_DATA_VERSION').functional_targets)
})
ok('중복 성분은 필요량 최댓값(합산 아님)·상한 최솟값, 단위가 달라도 맞춘다', () => {
  // U2 는 2형당뇨 보통(0.04 g = 40 mg) + 혈당 관리 목표(26 mg) 가 이소플라본에서 겹친다
  const out = F1({ ...USERS[1], allergies: [] })
  const iso = out.targets.find(t => t.component_id === 'isoflavones')
  assert.equal(iso.unit, 'mg')
  assert.equal(iso.daily_amount, 40)
  assert.equal(iso.upper_limit, 150)
  assert.equal(iso.reason.length, 2)
})
ok('필요량이 상한보다 크면 상한으로 자른다', () => {
  const table = FIXTURE_TABLE.map(r => r.target_id === 'diabetes' ? { ...r, upper_limit: 0.03 } : r)
  const iso = F1({ ...USERS[1], allergies: [] }, { table }).targets.find(t => t.component_id === 'isoflavones')
  assert.equal(iso.upper_limit, 30)
  assert.equal(iso.daily_amount, 30)
})
ok('위험 > 보통 > 관리목표 순, 최대 5개', () => {
  const out = F1(USERS[3])
  assert.ok(out.targets.length <= 5)
  assert.ok(out.targets[0].reason.some(r => r.includes('위험')), JSON.stringify(out.targets[0]))
  assert.deepEqual(out.targets.map(t => t.priority), out.targets.map((_, i) => i + 1))
})
ok('알레르기 연관 성분은 제외 목록으로 간다', () => {
  const out = F1(USERS[1], { allergenMap: { isoflavones: ['soy'] } })
  assert.ok(!out.targets.some(t => t.component_id === 'isoflavones'))
  assert.ok(out.excluded.some(e => e.component_id === 'isoflavones'))
})
ok('안전 등급·기본 목표만이면 실제 표(질환 행 없음)로도 동작', () => {
  const out = $('functionalTargets')({ grades: gradesOf(USERS[2]), goals: ['weight'], allergies: [] })
  assert.deepEqual(plain(out.targets.map(t => t.component_id)), ['glucosinolates', 'catechins', 'phenolicAcids'])
})

console.log('\n── F2 부족분 ──')
const u1 = USERS[0], t1 = $('nutritionTargets')(u1.profile), ft1 = F1(u1)
const DIARY_DAY = [['쌀밥', 1], ['시금치나물', 1], ['제육볶음', 0.5], ['약콩두유', 1]]
const mealsOf = list => list.map(([n, p]) => ({ name: n, analysis: $('scaleAnalysis')($('analyzeFood')(n), p) }))
ok('영양소 공급량이 식사 기록 화면(renderDiary) 계산과 같다', () => {
  const meals = mealsOf(DIARY_DAY)
  const it = $('intakeOfMeals')(meals)
  // 화면: kcal = Σ analysis.totalCal, 나머지 = Σ estimateDishNutrients
  const kcal = meals.reduce((s, m) => s + m.analysis.totalCal, 0)
  const nut = {}
  for (const m of meals) for (const [k, v] of Object.entries($('estimateDishNutrients')(m.analysis))) nut[k] = (nut[k] || 0) + v
  assert.equal(it.nut.energy, kcal)
  for (const k of ['carb', 'protein', 'fat', 'fiber', 'sodium', 'sugar']) assert.ok(Math.abs(it.nut[k] - nut[k]) < 1e-9, k)
  const d = $('deficitReport')({ basis: 'intake_log', targets: t1, ftargets: ft1, days: [it] })
  assert.equal(d.nutrients.find(n => n.id === 'sodium').supply, r6(nut.sodium))
})
ok('기능성 성분 = 100 g 당 함량 × 중량, 제품은 1회 제공량 × 횟수', () => {
  const one = $('intakeOfMeals')(mealsOf([['약콩두유', 1]])).comp
  const two = $('intakeOfMeals')(mealsOf([['약콩두유', 2]])).comp
  const iso = $('INGREDIENTS')['약콩두유'].phytos.isoflavones
  assert.ok(iso > 0)
  assert.ok(Math.abs(one.isoflavones - iso) < 1e-9 && Math.abs(two.isoflavones - iso * 2) < 1e-9)
  const a = $('analyzeFood')('시금치나물')
  const want = a.ingredients.reduce((s, i) => s + ((($('INGREDIENTS')[i.name] || {}).phytos || {}).flavonols || 0) * (typeof i.grams === 'number' ? i.grams : 0) / 100, 0)
  assert.ok(Math.abs(($('intakeOfMeals')([{ name: '시금치나물', analysis: a }]).comp.flavonols || 0) - want) < 1e-9)
})
ok('식단 유무에 따라 결과가 다르다 · 미이용이면 성분 부족분 = 필요량 전체', () => {
  const no = $('deficitReport')({ basis: 'no_meal_plan', targets: t1, ftargets: ft1, days: null })
  const yes = $('deficitReport')({ basis: 'meal_plan', targets: t1, ftargets: ft1, days: [$('intakeOfMeals')(mealsOf(DIARY_DAY))] })
  assert.equal(no.basis, 'no_meal_plan')
  assert.equal(no.nutrients.length, 0)
  for (const c of no.components) if (c.need != null) { assert.equal(c.deficit, c.need); assert.equal(c.fill_rate, 0) }
  assert.ok(yes.nutrients.length > 0)
  assert.notDeepEqual(plain(no.components), plain(yes.components))
  for (const c of yes.components) if (c.need != null) {
    assert.ok(c.fill_rate >= 0 && c.fill_rate <= 1)
    assert.equal(c.deficit, r6(Math.max(0, c.need - c.supply)))
  }
  assert.equal(yes.components.find(c => c.id === 'glucosinolates').deficit, null)
})
ok('DB 에 없는 성분은 공급 0 + data_missing, 목표 단위(g)로 환산', () => {
  const ft = { targets: [
    { component_id: 'no_such_component', daily_amount: 10, unit: 'mg', upper_limit: null },
    { component_id: 'isoflavones', daily_amount: 0.05, unit: 'g', upper_limit: 0.01 },
  ] }
  const d = $('deficitReport')({ basis: 'meal_plan', targets: t1, ftargets: ft, days: [$('intakeOfMeals')(mealsOf([['약콩두유', 1]]))] })
  assert.equal(d.components[0].data_missing, true)
  assert.equal(d.components[0].supply, 0)
  const iso = $('INGREDIENTS')['약콩두유'].phytos.isoflavones
  assert.equal(d.components[1].supply, r6(iso / 1000))
  assert.equal(d.components[1].excess, r6(Math.max(0, iso / 1000 - 0.01)))
})

console.log('\n── F3 부족분 기반 제품 선정 ──')
const specs = plain($('productSpecs')())
const defOf = (u, extra) => { const ft = F1(u, extra); return { ft, d: $('deficitReport')({ userId: u.id, basis: 'no_meal_plan', targets: $('nutritionTargets')(u.profile), ftargets: ft, days: null }) } }
const sel = (u, extra) => { const { ft, d } = defOf(u); return $('selectProducts')({ userId: u.id, deficit: d, ftargets: ft, allergies: u.allergies, ...extra }) }
ok('제품 규격: 성분 함량 추정값은 모두 needs_review, 1회 가격·알레르기 포함', () => {
  assert.equal(specs.length, $('BOBSNU_CATALOG').length)
  for (const s of specs) { assert.equal(s.needs_review, true); assert.ok(s.price_per_serving > 0); assert.ok(Array.isArray(s.allergens)) }
})
ok('부족분이 다른 두 사용자에게 다른 조합', () => {
  const a = sel(USERS[2]), b = sel(USERS[3])
  assert.notEqual(a.selected.map(s => s.product_id).join(), b.selected.map(s => s.product_id).join())
  assert.ok(a.alternatives.length <= 2)
  assert.ok(a.score.fill >= 0 && a.score.fill <= 1)
})
ok('알레르기 제품은 선정되지 않고 사유가 남는다', () => {
  for (const u of [USERS[1], USERS[3]]) {
    const r = sel(u)
    const bad = new Set(specs.filter(s => s.allergens.some(a => u.allergies.includes(a))).map(s => s.product_id))
    assert.ok(bad.size > 0, u.id)
    for (const s of r.selected.concat(...r.alternatives.map(a => a.selected))) assert.ok(!bad.has(s.product_id), u.id + ' ' + s.product_id)
    for (const id of bad) assert.ok(r.excluded.some(e => e.product_id === id && e.reason.startsWith('알레르기')))
  }
})
ok('성분 총 섭취량이 상한을 넘지 않는다 · 끼니 대체 표시 없는 제품은 1일 1회', () => {
  const u = USERS[2]
  const ft = plain(F1(u))
  const iso = ft.targets.find(t => t.component_id === 'isoflavones')
  iso.upper_limit = iso.daily_amount                       // 상한을 필요량에 딱 맞춰 조여 본다
  const d = $('deficitReport')({ basis: 'no_meal_plan', targets: $('nutritionTargets')(u.profile), ftargets: ft, days: null })
  const r = $('selectProducts')({ deficit: d, ftargets: ft, allergies: [] })
  const total = r.selected.reduce((s, p) => s + ((p.covers.find(c => c.component_id === 'isoflavones') || {}).amount || 0), 0)
  assert.ok(total <= iso.upper_limit + 1e-9, '이소플라본 ' + total + ' > ' + iso.upper_limit)
  for (const p of r.selected) assert.equal(p.servings_per_day, 1)
  assert.ok(r.selected.length <= $('WELLNESS_CONFIG').maxProducts)
})
ok('예산을 넘는 조합은 제외', () => {
  const r = sel(USERS[3], { budget: 30000 })
  assert.ok(r.monthly_cost <= 30000, String(r.monthly_cost))
})
ok('함량 없는 제품·섭취 주의 대상은 사유와 함께 제외', () => {
  const custom = plain(specs)
  custom[0].components = []
  custom[1].contraindications = ['pregnancy']
  const { ft, d } = defOf(USERS[2])
  const r = $('selectProducts')({ deficit: d, ftargets: ft, allergies: [], conditions: ['pregnancy'], specs: custom })
  assert.ok(r.excluded.some(e => e.product_id === custom[0].product_id && e.reason.includes('함량 없음')))
  assert.ok(r.excluded.some(e => e.product_id === custom[1].product_id && e.reason.includes('주의')))
})

console.log('\n── F6 위험도 → 영양 기준 ──')
ok('규칙이 없거나 위험등급을 아직 모르면 기존과 같다', () => {
  const adj = $('applyRiskAdjust')(t1.ranges, gradesOf(u1), [])
  assert.deepEqual(plain(adj.after), plain(t1.ranges))
  assert.equal(adj.applied.length, 0)
  setMode('deficit_based')
  assert.deepEqual(plain($('wellnessAdjustTargets')({ ranges: t1.ranges }).ranges), plain(t1.ranges))
  setMode('legacy')
})
ok('규칙을 넣으면 영양 기준과 식단 최적화 목표가 함께 바뀐다 (겹치면 엄격한 쪽 · 값 없는 규칙은 건너뜀)', () => {
  const adj = $('applyRiskAdjust')(t1.ranges, gradesOf(u1), FIXTURE_RULES)
  assert.equal(adj.after.sodium, 1800)
  assert.equal(adj.after.fiber, Math.max(t1.ranges.fiber, 30))
  assert.equal(adj.after.sugar, t1.ranges.sugar)
  assert.equal(adj.before.sodium, t1.ranges.sodium)
  const pc = $('planConstraints')
  assert.equal(pc({ ...t1, ranges: adj.after }).max.sodium, 1800)
  assert.notEqual(pc(t1).max.sodium, 1800)
  // 안전 등급 사용자에게는 적용되지 않는다 · 질환 제한량이 정한 영양소는 건드리지 않는다
  assert.equal($('applyRiskAdjust')(t1.ranges, gradesOf(USERS[2]), FIXTURE_RULES).applied.length, 0)
  assert.equal($('applyRiskAdjust')(t1.ranges, gradesOf(u1), FIXTURE_RULES, ['sodium']).after.sodium, t1.ranges.sodium)
})

console.log('\n── legacy 모드 (기본값) ──')
ok('기본값은 legacy 이고 파이프라인 연결점이 아무것도 하지 않는다', () => {
  assert.equal($('WELLNESS_CONFIG').PIPELINE_MODE, 'legacy')
  const logN = $('WELLNESS_LOG').length
  assert.equal($('wellnessRecommend')({}, {}), null)
  assert.equal($('wellnessTrigger')(), null)
  const t = { ranges: t1.ranges }
  assert.equal($('wellnessAdjustTargets')(t), t)
  assert.equal($('WELLNESS_LOG').length, logN)
})
const legacyRuns = {}
ok('legacy 전체 흐름: 가상 사용자 4명 — 룰테이블 구독 구성 + 식단 (noProducts 인자 없이 기존 호출 그대로)', () => {
  for (const u of USERS) {
    const a = SURVEY[u.survey]
    const scored = $('scoreDietPatterns')($('buildSurveyDiet')(a), $('surveyServings')(a), u.profile.gender)
    const t = $('nutritionTargets')(u.profile)
    const rec = $('recommendSubscription')({ grade: $('dietGrade')(scored), bmi: t.bmi, age: u.profile.age,
      lacks: $('dietLacks')(scored), goals: new Set(u.goals), allergies: new Set(u.allergies) })
    const p1 = $('generateMealPlan')({ profile: u.profile, targets: t, cart: rec.cart, days: 30, allergies: new Set(u.allergies), seed: 7 })
    const p2 = $('generateMealPlan')({ profile: u.profile, targets: t, cart: rec.cart, days: 30, allergies: new Set(u.allergies), seed: 7 })
    if (!p1.error) assert.deepEqual(plain(p1.days), plain(p2.days), u.id + ' 같은 입력인데 식단이 다름')
    legacyRuns[u.id] = { cart: plain(rec.cart), plan_days: p1.error ? 0 : p1.days.length, plan_error: p1.error || null }
  }
})

console.log('\n── deficit_based 전체 흐름 (가상 사용자 4명) ──')
const runs = {}
ok('F6 → F1 → 식단 → F2 → F3 → 식단 반영 → F2', () => {
  for (const u of USERS) {
    const t0 = Date.now()
    const r = pipe(u)
    assert.ok(!r.error, u.id + ' ' + r.error)
    assert.equal(r.deficit.basis, u.useMealPlan ? 'meal_plan' : 'no_meal_plan')
    if (u.useMealPlan) {
      assert.equal(r.plan.days.length, 30)
      assert.equal(r.finalDeficit.basis, 'meal_plan')
      // 제품을 넣은 최종 식단의 성분 충족률은 음식만 볼 때보다 낮아지지 않는다
      for (const c of r.finalDeficit.components) {
        const f = r.deficit.components.find(x => x.id === c.id)
        if (c.fill_rate != null) assert.ok(c.fill_rate >= f.fill_rate - 1e-9, u.id + ' ' + c.id)
      }
      // 끼니 대체는 하루 1회
      for (const d of r.plan.days) assert.ok(d.meals.filter(m => m.kind === 'product').length <= 1)
    }
    const bad = new Set(specs.filter(s => s.allergens.some(a => u.allergies.includes(a))).map(s => s.product_id))
    for (const s of r.selection.selected) assert.ok(!bad.has(s.product_id))
    runs[u.id] = r
    console.log(`    ${u.id}: 목표 ${r.ftargets.targets.map(t => t.component_id).join('·')} → 제품 ${r.selection.selected.map(s => s.product_id).join('·') || '(없음)'} · 월 ${r.selection.monthly_cost}원 · ${Date.now() - t0}ms`)
  }
  const combos = new Set(USERS.map(u => runs[u.id].selection.selected.map(s => s.product_id).join()))
  assert.ok(combos.size >= 2, '모든 사용자에게 같은 조합')
})
ok('단계 로그에 사용자·시각·단계명·입력·출력·버전이 남는다', () => {
  const log = $('WELLNESS_LOG')
  for (const step of ['F6_risk_adjust', 'F1_functional_targets', 'F2_deficit', 'F3_select_products']) {
    const e = log.find(x => x.step === step && x.user_id === 'U1')
    assert.ok(e && e.at && e.input && e.output, step)
    assert.equal(e.versions.functional_targets, $('WELLNESS_DATA_VERSION').functional_targets)
  }
})

console.log('\n── F4 재추천 · F5 이미지 환산 · F7 원터치 기록 ──')
const TODAY = '2026-11-17'
const r1 = runs.U1
run(`trackerLoad(); tracker.profile = ${JSON.stringify({ ...u1.profile, allergies: [] })}; tracker.goals = ['weight'];
  tracker.startDate = '2026-11-10'; tracker.diary = {}; tracker.weights = [];`)
const seedState = () => {
  $('tracker').plan = r1.plan
  $('tracker').wellness = { last: plain({ grades: r1.grades, ftargets: r1.ftargets, deficit: r1.finalDeficit, selection: r1.selection, cart: r1.cart, phase: null }),
    history: [], proposal: null, lastRunAt: TODAY, sig: null }
}
setMode('deficit_based')
seedState()
const reassess = extra => $('reassess')({ userId: 'U1', today: TODAY, seed: 7, table: FIXTURE_TABLE, ...extra })

ok('기준에 못 미치는 변화에서는 재추천이 일어나지 않는다', () => {
  const r = reassess({ trigger: 'periodic' })       // 기록 없음 → 등급 유지, 목표 동일
  assert.equal(r.rerecommend, false)
  assert.deepEqual(plain(r.reasons), [])
  assert.equal($('tracker').wellness.history.length, 0)
  assert.equal($('tracker').wellness.proposal, null)
  // 충족률 미달이 기준 일수(3일)보다 짧으면 재추천하지 않는다
  run(`tracker.diary = { '2026-11-16': [{ name: '쌀밥', meal: 'lunch', portion: 0.3 }], '2026-11-17': [{ name: '쌀밥', meal: 'lunch', portion: 0.3 }] };`)
  const r2 = reassess({ trigger: 'meal_log' })
  assert.ok(!r2.reasons.some(x => x.startsWith('충족률')), r2.reasons.join())
  // 기록 일수가 gradeMinLogDays(3일)보다 적으면 위험등급을 다시 매기지 않는다
  assert.ok(!r2.reasons.some(x => x.startsWith('위험등급')), r2.reasons.join())
  run('tracker.diary = {};')
})
ok('F7 원터치 기록: 추천 끼니를 그대로(출처 plan) · 절반이면 중량 비례', () => {
  seedState()
  const day1 = r1.plan.days[0], lunch = day1.meals.find(m => m.type === 'lunch')
  const added = $('logPlanMeal')(1, 'lunch', $('WELLNESS_CONFIG').portionRatios.half)
  assert.equal(added.length, $('planMealItems')(lunch).length)
  const diary = $('tracker').diary['2026-11-10']
  assert.ok(diary.every(e => e.source === 'plan' && e.meal === 'lunch'))
  assert.equal(diary[0].portion, r6($('planMealItems')(lunch)[0][1] * 0.5))
  // 「먹었어요」 버튼 연결: 다시 누르면 기록이 지워진다
  run(`renderMealPlan = () => {}; renderMonitor = () => {}; tracker.diary = {};`)
  $('setMealStatus')(1, 'breakfast', 'eaten')
  assert.ok($('tracker').diary['2026-11-10'].some(e => e.source === 'plan' && e.meal === 'breakfast'))
  $('setMealStatus')(1, 'breakfast', 'eaten')
  assert.equal($('tracker').diary['2026-11-10'], undefined)
  // C1: 기본(legacy) 모드에서도 「먹었어요」 = 그 끼니 메뉴 전량이 기록에, 다른 상태로 바꾸면 빠짐
  const mode = $('WELLNESS_CONFIG').PIPELINE_MODE
  setMode('legacy')
  const want = $('planMealItems')($('tracker').plan.days[0].meals.find(m => m.type === 'lunch'))
  $('setMealStatus')(1, 'lunch', 'eaten')
  assert.deepEqual(plain($('tracker').diary['2026-11-10'].map(e => [e.name, e.portion])), plain(want))
  $('setMealStatus')(1, 'lunch', 'skipped')
  assert.equal($('tracker').diary['2026-11-10'], undefined)
  $('setMealStatus')(1, 'lunch', 'skipped')
  setMode(mode)
  // (기록 저장이 F4 를 불러 식단이 다시 설계됐을 수 있으므로 현재 식단에서 이름을 가져온다)
  const one = $('logPlanMeal')(1, 'dinner', 1, $('planMealItems')($('tracker').plan.days[0].meals.find(m => m.type === 'dinner'))[0][0])
  assert.equal(one.length, 1)
  run('tracker.diary = {};')
})
let f5
ok('F5 이미지 환산: 정확 일치·유사 이름·식전−식후·영양소+성분 응답, 기록이 재계산에 반영', () => {
  seedState()
  const baseG = $('estimateDishNutrients')($('analyzeFood')('쌀밥')).weight
  f5 = $('imageToIntake')({ userId: 'U1', date: TODAY, meal: 'lunch',
    foods: [{ name: '쌀밥', grams: baseG, confidence: 0.92 }, { name: '매콤 제육볶음 한접시', grams: 200, confidence: 81 }],
    after: [{ name: '쌀밥', grams: baseG / 2 }] })
  assert.equal(f5.items[0].match, 'exact')
  assert.equal(f5.items[0].portion, 0.5)
  assert.equal(f5.items[1].match, 'similar')
  assert.equal(f5.items[1].confidence, 0.81)
  assert.ok(f5.nutrients.energy > 0 && f5.nutrients.carb > 0)
  assert.ok(f5.components.length > 0)
  assert.equal(f5.saved, true)
  const diary = $('tracker').diary[TODAY]
  assert.equal(diary.length, 2)
  assert.ok(diary.every(e => e.source === 'image'))
  const log = $('intakeLogDays')(14, TODAY)
  assert.equal(log.length, 1)
  assert.ok(Math.abs(log[0].nut.energy - f5.nutrients.energy) < 0.01)
})
ok('F5: 신뢰도 미달·DB 에 없는 음식은 저장하지 않고 확인 요청(후보 반환)', () => {
  const n = $('tracker').diary[TODAY].length
  const low = $('imageToIntake')({ date: TODAY, foods: [{ name: '쌀밥', grams: 200, confidence: 0.4 }] })
  assert.equal(low.saved, false); assert.equal(low.needs_confirmation, true)
  const unk = $('imageToIntake')({ date: TODAY, foods: [{ name: '김치찌게', grams: 300, confidence: 0.9 }] })
  assert.equal(unk.saved, false)
  assert.equal(unk.items[0].matched_name, null)
  assert.ok(unk.items[0].candidates.length > 0, '후보 없음')
  assert.equal($('tracker').diary[TODAY].length, n)
  run('tracker.diary = {};')
})
let f4
ok('F4: 위험등급 변화 → 재추천, 사유·이전/이후가 이력에 남고 제품은 다음 주기 제안으로만 저장', () => {
  seedState()
  // 직전 등급을 「안전」으로 바꿔 두고, 14일 중 5일을 나쁜 식사로 기록
  const w = $('tracker').wellness
  w.last.grades = plain(gradesOf(USERS[2]))
  w.last.ftargets = plain(F1({ ...u1, survey: 'good' }))
  w.last.cart = { soymilk: [], phyto: [], bar: [], addon: [] }
  const bad = $('buildSurveyDiet')(SURVEY.bad).map(m => ({ name: m.name, meal: 'lunch', portion: 1 }))
  for (let i = 0; i < 5; i++) $('tracker').diary[$('dayOffset')(TODAY, -i)] = bad
  const cartBefore = JSON.stringify(w.last.cart)
  f4 = plain(reassess({ trigger: 'meal_log' }))
  assert.equal(f4.rerecommend, true)
  assert.ok(f4.reasons.some(x => x.startsWith('위험등급 변화')), f4.reasons.join(' / '))
  const h = $('tracker').wellness.history
  assert.equal(h.length, 1)
  assert.deepEqual(plain(h[0].reasons), plain(f4.reasons))
  assert.ok(h[0].before.grades && h[0].after.grades && h[0].before.plan && h[0].after.products)
  // 제품은 즉시 바뀌지 않는다
  assert.equal(JSON.stringify($('tracker').wellness.last.cart), cartBefore)
  const p = $('tracker').wellness.proposal
  assert.equal(p.status, 'pending')
  assert.equal(p.effective_from, '2026-12-10')            // 시작일 11-10 + 30일
  $('confirmProposal')()
  assert.equal($('tracker').wellness.proposal.status, 'confirmed')
  assert.deepEqual(plain($('tracker').wellness.last.cart), plain(p.cart))
  console.log('    사유: ' + f4.reasons.join(' / '))
})
ok('F4: 충족률 기준 미만 3일 연속 · 체중 추이 단계 변화도 사유가 된다', () => {
  seedState()
  run('tracker.diary = {}; tracker.weights = [];')
  for (let i = 0; i < 3; i++) $('tracker').diary[$('dayOffset')(TODAY, -i)] = [{ name: '쌀밥', meal: 'lunch', portion: 0.2 }]
  $('tracker').wellness.last.phase = '정체기'
  $('tracker').weights = [{ date: '2026-11-03', kg: 68 }, { date: '2026-11-10', kg: 67.4 }, { date: '2026-11-17', kg: 66.8 }]
  const r = reassess({ trigger: 'meal_log+weight' })
  assert.ok(r.reasons.some(x => x.startsWith('충족률')), r.reasons.join(' / '))
  assert.ok(r.reasons.some(x => x.includes('정체기→감량기')), r.reasons.join(' / '))
})
ok('F4 계기: 식사 기록 저장(trackerSave)만으로 재산출이 돈다 · legacy 에서는 돌지 않는다', () => {
  seedState()
  run('tracker.diary = {}; tracker.weights = [];')
  $('trackerSave')()                                       // 기준 서명
  const n = $('WELLNESS_LOG').filter(e => e.step === 'F4_reassess').length
  $('tracker').diary[$('isoToday')()] = [{ name: '쌀밥', meal: 'lunch', portion: 1 }]
  $('trackerSave')()
  assert.equal($('WELLNESS_LOG').filter(e => e.step === 'F4_reassess').length, n + 1)
  assert.equal($('WELLNESS_LOG').filter(e => e.step === 'F4_reassess').pop().input.trigger, 'meal_log')
  setMode('legacy')
  $('tracker').diary[$('isoToday')()].push({ name: '쌀밥', meal: 'dinner', portion: 1 })
  $('trackerSave')()
  assert.equal($('WELLNESS_LOG').filter(e => e.step === 'F4_reassess').length, n + 1)
})

// ── 변리사 전달용 실시 예 ──
if (process.argv.includes('--emit')) {
  const slim = r => ({
    F6_nutrition_standard: r.targets.ranges, F1_functional_targets: r.ftargets,
    F2_deficit_before_products: r.deficit, F3_selection: r.selection, cart: r.cart,
    F2_deficit_final: r.finalDeficit,
    meal_plan_first_3_days: r.plan ? r.plan.days.slice(0, 3).map(d => ({ day: d.day, meals: d.meals.map(m => ({ type: m.type, kind: m.kind || 'food', items: $('planMealItems')(m).map(x => x[0]) })) })) : null,
  })
  const out = {
    notice: '로직 확인용 가상 실행 예. 질환→성분 대응행·필요 섭취량·상한·조정 규칙은 TEST FIXTURE(가상값)이고, 제품 성분 함량은 원재료 기반 추정값입니다. 임상·실측 수치가 아닙니다.',
    generated_at: new Date().toISOString(), versions: $('WELLNESS_DATA_VERSION'), config: $('WELLNESS_CONFIG'),
    fixture_table_rows: FIXTURE_TABLE.filter(r => r.source === FX), fixture_rules: FIXTURE_RULES,
    users: USERS.map(u => ({ user: { ...u, survey_answers: SURVEY[u.survey] }, grades: runs[u.id].grades,
      legacy: legacyRuns[u.id], deficit_based: slim(runs[u.id]) })),
    F6_example_with_rules: $('applyRiskAdjust')(t1.ranges, gradesOf(u1), FIXTURE_RULES),
    F5_example: f5,
    F4_example: { trigger: 'meal_log', reasons: f4.reasons, proposal: f4.proposal,
      history_entry: { ...f4.history, before: { ...f4.history.before, plan: '(30일 식단 요약 생략)' }, after: { ...f4.history.after, plan: '(30일 식단 요약 생략)' } } },
  }
  mkdirSync(new URL('../docs/', import.meta.url), { recursive: true })
  writeFileSync(new URL('../docs/wellness-example-run.json', import.meta.url), JSON.stringify(out, null, 2))
  console.log('\n  → docs/wellness-example-run.json 저장')
}

console.log('\n✅ ' + pass + '개 검사 통과\n')
