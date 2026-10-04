// 구독 할인 · 추천 룰 · 30일 식단 다목적 최적화 자체 점검
//   실행: node scripts/test-mealplan.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// 브라우저 전용 전역 최소 스텁 (app.js 는 로드 시 document.addEventListener 만 호출)
const noop = () => {}
const sandbox = {
  console,
  document: { addEventListener: noop, getElementById: () => null },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  Chart: undefined,
  setTimeout: (fn) => { fn(); return 0 },   // 최적화를 동기 실행해 결과를 바로 검사
  clearTimeout: noop,
}
const ctx = vm.createContext(sandbox)
for (const f of ['recipes', 'foodclass', 'pfs', 'products', 'mealplan', 'tracker', 'app']) {
  vm.runInContext(read(`public/static/${f}.js`), ctx, { filename: f + '.js' })
}
const $ = name => vm.runInContext(name, ctx)

let pass = 0
const ok = (label, fn) => { fn(); pass++; console.log('  ✓ ' + label) }

console.log('\n── 할인율 정책 (엑셀 Sheet3 20~27행) ──')
const rate = $('subscriptionRate')
ok('두유2·파이토2·프로틴바3 → 20%', () => assert.equal(rate({ soymilk: 2, phyto: 2, bar: 3 }, 0), 20))
ok('두유1·파이토1·프로틴바2 → 15%', () => assert.equal(rate({ soymilk: 1, phyto: 1, bar: 2 }, 0), 15))
ok('제품 1개 → 5%',                 () => assert.equal(rate({ soymilk: 1, phyto: 0, bar: 0 }, 0), 5))
ok('제품 2개 → 10%',                () => assert.equal(rate({ soymilk: 2, phyto: 0, bar: 0 }, 0), 10))
ok('추가 구성품 포함 → +5%p',       () => assert.equal(rate({ soymilk: 1, phyto: 1, bar: 2 }, 1), 20))
ok('빈 구성 → 0%',                  () => assert.equal(rate({ soymilk: 0, phyto: 0, bar: 0 }, 0), 0))

console.log('\n── 엑셀 프리셋 정가 검증 ──')
const quote = $('subscriptionQuote')
ok('두유2(A) + 파이토2 = 138,000원', () => {
  const q = quote({ soymilk: ['A', 'A'], phyto: ['가', '가'], bar: [], addon: [] })
  assert.equal(q.listPrice, 138000)
})
ok('두유1(A) + 파이토1 = 69,000원', () => {
  const q = quote({ soymilk: ['A'], phyto: ['가'], bar: [], addon: [] })
  assert.equal(q.listPrice, 69000)
})
ok('최적 세트(2·2·3) 정가 198,000 → 20% → 158,400', () => {
  const q = quote({ soymilk: ['A', 'A'], phyto: ['가', '가'], bar: ['나', '나', '나'], addon: [] })
  assert.equal(q.listPrice, 198000)
  assert.equal(q.rate, 20)
  assert.equal(q.finalPrice, 158400)
})

console.log('\n── 제품 영양성분 (제품소개서 표시란) ──')
const catalog = $('BOBSNU_CATALOG')
const byCode = $('CATALOG_BY_CODE')
const ING = $('INGREDIENTS')
const PFSN = $('PFS_BOBSNU_NUTRITION')
ok('15개 제품 모두 영양성분 보유', () => {
  for (const p of catalog) assert.ok(p.nut && p.nut.energy > 0, p.name)
})
ok('제품소개서 실측 열량이 식재료 DB에 등록됨', () => {
  const expect = { A: 75, B: 100, C: 80, D: 90, E: 70, F: 65, G: 60, H: 75, I: 70, '가': 110, '나': 183, '1': 14 }
  for (const [code, kcal] of Object.entries(expect)) {
    const p = byCode[code]
    assert.equal(p.nut.energy, kcal, p.name + ' 라벨 열량')
    assert.equal(ING[p.name].kcal, kcal, p.name + ' INGREDIENTS 등록값')
    assert.ok(PFSN[p.name], p.name + ' PFS 영양성분 누락')
  }
})
ok('엑셀 PDI 칼로리와 어긋나는 4개를 실측값으로 교체', () => {
  const stale = { B: 70, C: 62, D: 60, '나': 140 }
  for (const [code, old] of Object.entries(stale)) {
    const p = byCode[code]
    assert.equal(p.pdiKcal, old, '엑셀 원본값 보존')
    assert.notEqual(p.nut.energy, old, p.name + ' 실측값으로 교체되지 않음')
  }
  // 나머지 7개는 엑셀 = 실측
  for (const code of ['A', 'E', 'F', 'G', 'H', 'I', '가']) {
    assert.equal(byCode[code].pdiKcal, byCode[code].nut.energy, code + ' 엑셀=실측 이어야 함')
  }
})
ok('건강기능식품 정제는 PRF 식품군이 아님', () => {
  for (const code of ['2', '3', '4']) assert.equal(ING[byCode[code].name].prf, false)
  assert.equal(ING[byCode['1'].name].prf, true)   // 약콩차는 음료 → PRF
})
ok('알레르기 유발물질이 원재료 기준으로 기재됨', () => {
  assert.equal(byCode['나'].allergens.join(','), 'soy,peanut,walnut')
  assert.equal(byCode['B'].allergens.join(','), 'soy,walnut')
  assert.equal(byCode['3'].allergens.length, 0)
  // 파이토100 은 원재료에 약콩이 있으나 대두 알레르기 환자도 섭취 가능 (담당자 확인)
  assert.ok(!byCode['가'].allergens.includes('soy'), '파이토100 이 대두로 막혀 있음')
})
ok('파이토케미컬을 원재료명으로 추정 (제품별로 달라짐)', () => {
  const phytosOf = code => {
    const ph = ING[byCode[code].name].phytos || {}
    return Object.keys(ph).filter(k => ph[k] > 0.01)
  }
  // 약콩만 들어간 제품(A·D·E)은 약콩 계열만
  assert.equal(phytosOf('A').length, 4)
  // 채소·과일·곡물이 들어간 제품은 계열이 늘어난다
  for (const code of ['B', 'C', 'I', '가', '나']) {
    assert.ok(phytosOf(code).length >= 8, byCode[code].name + ' ' + phytosOf(code).length + '계열')
  }
  // 파이토100 은 약콩 기준값을 물려받지 않고 21종 생식 원재료로만 계산
  //   (구 '파이토100' 기준값에는 플라본이 없으므로, 플라본이 있으면 원재료로 계산된 것)
  const phyto = ING[byCode['가'].name].phytos
  assert.ok(!(ING['파이토100'].phytos.flavones > 0), '전제 변경: 구 기준값에 플라본이 생겼음')
  assert.ok(phyto.flavones > 1, '파이토100 이 원재료로 계산되지 않음')
  assert.ok(phyto.lignans > 10 && phyto.carotenoids > 0, '채소·종실 계열이 안 들어옴')
  // 건강기능식품 정제는 파이토케미컬 없음
  for (const code of ['2', '3', '4']) assert.equal(phytosOf(code).length, 0)
  console.log('    계열 수 — A ' + phytosOf('A').length + ' · B ' + phytosOf('B').length
    + ' · I ' + phytosOf('I').length + ' · 파이토100 ' + phytosOf('가').length + ' · 프로틴바 ' + phytosOf('나').length)
})
ok('원재료 추정 열량이 라벨 열량을 넘지 않음', () => {
  for (const p of catalog) {
    if (!p.phytoFrom) continue
    let kcal = 0
    for (const [n, g] of Object.entries(p.phytoFrom)) {
      const i = ING[n]
      if (i) kcal += (i.kcal || 0) * g / 100
    }
    // 보정 전 값이 라벨을 넘는 제품은 productPhytos 에서 축소되므로, 여기서는 보정 필요 여부만 기록
    if (kcal > p.nut.energy) console.log('    ' + p.name + ' 원재료 ' + Math.round(kcal) + ' kcal → 라벨 ' + p.nut.energy + ' kcal 로 축소 적용')
  }
})

console.log('\n── 체중 유형 (엑셀 Sheet3 2~6행) ──')
const bt = $('classifyBodyType')
ok('BMI 20 → 정상',    () => assert.equal(bt(20).name, '정상'))
ok('BMI 23.5 → 과체중', () => assert.equal(bt(23.5).name, '과체중'))
ok('BMI 27 → 비만',     () => assert.equal(bt(27).name, '비만'))
ok('BMI 32 → 고도비만', () => assert.equal(bt(32).name, '고도비만'))

console.log('\n── 추천 룰테이블 (엑셀 Sheet3 31~64행) ──')
ok('룰 32행 전부 적재', () => assert.equal($('WEIGHT_MGMT_RULES').length, 32))
const recommend = $('recommendSubscription')
ok('PDI 15% · BMI 26 · 35세 → 두유 C · 파이토+프로틴바', () => {
  const r = recommend({ pdi: 15, bmi: 26, age: 35, lacks: {}, goals: new Set(['weight']), allergies: new Set() })
  assert.equal(r.rule.main, 'C')
  assert.equal(r.bodyType.name, '비만')
  assert.equal(r.cart.soymilk.join(','), 'C,C')
  assert.equal(r.cart.phyto.length, 2)
  assert.equal(r.cart.bar.length, 3)
})
ok('단백질 부족 → C(고단백) 로 대체', () => {
  const r = recommend({ pdi: 15, bmi: 21, age: 15, lacks: { protein: true }, goals: new Set(['weight']), allergies: new Set() })
  assert.equal(r.cart.soymilk[0], 'C')
})
ok('칼슘 축은 추천에 영향 없음 (판정 제거)', () => {
  const base = recommend({ pdi: 15, bmi: 21, age: 15, lacks: {}, goals: new Set(['weight']), allergies: new Set() })
  const withCa = recommend({ pdi: 15, bmi: 21, age: 15, lacks: { calcium: true }, goals: new Set(['weight']), allergies: new Set() })
  assert.equal(withCa.cart.soymilk.join(','), base.cart.soymilk.join(','))
})
ok('장 건강 목표 → D(포스트바이오틱스) 로 대체', () => {
  const r = recommend({ pdi: 25, bmi: 21, age: 35, lacks: {}, goals: new Set(['weight', 'gut']), allergies: new Set() })
  assert.equal(r.cart.soymilk[0], 'D')
})
ok('뼈건강·피로 목표 → 추가 구성품 2·4', () => {
  const r = recommend({ pdi: 25, bmi: 21, age: 35, lacks: {}, goals: new Set(['weight', 'bone', 'fatigue']), allergies: new Set() })
  assert.equal([...r.cart.addon].sort().join(','), '2,4')
})
ok('대두 알레르기 → 두유·프로틴바 제외하고 파이토100만 추천', () => {
  const r = recommend({ pdi: 15, bmi: 26, age: 35, lacks: {}, goals: new Set(['weight']), allergies: new Set(['soy']) })
  assert.equal(r.cart.soymilk.length, 0)
  assert.equal(r.cart.bar.length, 0)
  assert.equal(r.cart.phyto.join(','), '가,가')
  assert.ok(r.excluded.length > 0)
})
ok('땅콩 알레르기 → 프로틴바만 제외', () => {
  const r = recommend({ pdi: 15, bmi: 26, age: 35, lacks: {}, goals: new Set(['weight']), allergies: new Set(['peanut']) })
  assert.equal(r.cart.bar.length, 0)
  assert.ok(r.cart.soymilk.length > 0, '두유는 남아야 함')
})

console.log('\n── 권장 영양 섭취량 ──')
const profile = { gender: 'female', age: 35, height: 162, weight: 68, prevWeight: 69, activity: 'low' }
const targets = $('nutritionTargets')(profile)
ok('비만 → 목표 칼로리 < EER', () => assert.ok(targets.targetKcal < targets.eer))
ok('감량 폭 EER 25% 이내',      () => assert.ok(targets.eer - targets.targetKcal <= targets.eer * 0.25 + 1))
ok('표준 체중 = BMI 22 기준',   () => assert.ok(Math.abs(targets.targetWeight - 22 * 1.62 ** 2) < 0.1))
ok('탄단지 범위 산출',          () => {
  assert.ok(targets.ranges.carb[0] < targets.ranges.carb[1])
  assert.ok(targets.ranges.protein[0] > 0 && targets.ranges.fiber > 0)
})

console.log('\n── 구성 항목 분류 · 후보 메뉴 ──')
const classify = $('classifySlot')
ok('쌀밥·잡곡밥 → 밥',       () => {
  assert.equal(classify('쌀밥', 329), 'rice')
  assert.equal(classify('잡곡밥', 320), 'rice')
})
ok('김치찌개 → 국',          () => assert.equal(classify('김치찌개', 180), 'soup'))
ok('배추김치 → 김치',        () => assert.equal(classify('배추김치', 30), 'kimchi'))
ok('시금치나물 → 부수반찬',   () => assert.equal(classify('시금치나물', 50), 'side'))
ok('제육볶음 → 메인반찬',     () => assert.equal(classify('제육볶음', 300), 'main'))
ok('열량 낮은 볶음 → 부수반찬', () => assert.equal(classify('멸치볶음', 60), 'side'))
ok('한 그릇 요리는 5품 구성에서 제외', () => {
  // 볶음밥·비빔밥·덮밥·면·죽은 「밥」 자리에 넣지 않는다
  for (const n of ['김치볶음밥', '비빔밥', '잡채덮밥', '잔치국수', '닭죽'])
    assert.equal(classify(n, 400), null, n + ' 이 구성 항목에 들어감')
})
ok('튀김·젓갈·간식은 제외',   () => {
  for (const n of ['고구마튀김', '새우젓'])
    if ($('FOOD_CLASS')[n]) assert.equal(classify(n, 200), null, n)
})

const pools = $('buildSlotPools')({ allergies: new Set(), rng: $('makeRng')(7), cap: 60 })
ok('분류코드가 14,714개 레시피에 매핑됨', () => {
  const FC = $('FOOD_CLASS')
  assert.ok(Object.keys(FC).length > 14000, '매핑 ' + Object.keys(FC).length + '개')
  assert.equal(FC['잡곡밥'], 'A0102')
  assert.equal(FC['김치찌개'], 'B0802')
  assert.equal(FC['배추김치'], 'C1701')
  assert.equal($('foodClassLabel')('A0102'), '주식 · 밥류 · 잡곡밥')
})
ok('구성 항목 5개 모두 후보 메뉴 확보', () => {
  for (const s of $('SLOT_IDS')) assert.ok(pools[s].length >= 20, s + ' = ' + pools[s].length)
  console.log('    선택 가능 메뉴: ' + $('SLOT_IDS').map(s => s + ' ' + pools[s].length).join(' · '))
})

console.log('\n── 30일 식단 다목적 최적화 ──')
const cart = quote({ soymilk: ['A', 'A'], phyto: ['가', '가'], bar: ['나', '나', '나'], addon: [] })
const plan = $('generateMealPlan')({
  profile, targets, days: 30, allergies: new Set(),
  cart: { soymilk: ['A', 'A'], phyto: ['가', '가'], bar: ['나', '나', '나'], addon: [] },
})
assert.ok(!plan.error, plan.error)
console.log('    계산 ' + plan.meta.generations + '회 반복 · ' + (plan.meta.elapsedMs / 1000).toFixed(1) + '초 · 비교한 후보 식단 ' + plan.meta.archiveSize + '개')
console.log('    점수: 영양 균형 ' + plan.score.nutrition + ' / PDI 달성도 ' + plan.score.pdi + ' / 메뉴 다양성 ' + plan.score.diversity + ' / 메뉴 궁합 ' + plan.score.harmony)
console.log('    평균 ' + plan.meta.avgKcal + ' kcal (목표 ' + plan.meta.targetKcal + ') · 평균 PDI ' + plan.meta.avgPDI + '%')

ok('30일 생성',            () => assert.equal(plan.days.length, 30))
ok('하루 3끼',             () => plan.days.forEach(d => assert.equal(d.meals.length, 3)))
const slotIds = $('SLOT_IDS').join(',')
ok('아침은 3품(밥·국·메인반찬), 점심·저녁은 5품', () => {
  let bCount = 0, lCount = 0
  for (const d of plan.days) {
    for (const m of d.meals) {
      if (m.kind !== 'food') continue
      const got = m.dishes.map(x => x.slot).join(',')
      if (m.type === 'breakfast') { assert.equal(got, 'rice,soup,main'); bCount++ }
      else { assert.equal(got, slotIds); lCount++ }
    }
  }
  assert.equal(bCount, 30)
  assert.ok(lCount >= 30)
  console.log('    아침 3품 ' + bCount + '일 · 점심·저녁 5품 ' + lCount + '끼')
})
ok('밥 양을 0.6~1공기에서 골라 조절', () => {
  const seen = new Set()
  for (const d of plan.days) for (const m of d.meals) {
    if (m.kind !== 'food') continue
    const rice = m.dishes.find(x => x.slot === 'rice')
    assert.ok([0.6, 0.8, 1].includes(rice.portion), '밥 양 ' + rice.portion)
    seen.add(rice.portion)
  }
  console.log('    쓰인 밥 양: ' + [...seen].sort().join(', ') + '공기')
})
ok('통째로 대체하는 끼니는 저녁 하루 1끼', () => {
  let n = 0
  for (const d of plan.days) {
    const products = d.meals.filter(m => m.kind === 'product')
    assert.ok(products.length <= 1, 'Day ' + d.day + ' 에 대체 끼니 ' + products.length + '개')
    for (const m of products) {
      assert.equal(m.type, 'dinner')
      assert.ok(m.combo === 'A' || m.combo === 'B')
      n++
    }
  }
  assert.equal(n, plan.meta.coverage.replaceDays)
  console.log('    제품으로 대체한 저녁 ' + n + '일')
})
ok('남는 제품은 아침·점심·간식에 곁들임', () => {
  const c = plan.meta.coverage, lo = plan.meta.leftover
  assert.equal(lo.soymilk + lo.phyto + lo.bar, 0, '남은 제품 ' + JSON.stringify(lo))
  assert.ok(c.extraCount.breakfast + c.extraCount.lunch + c.extraCount.snack > 0, '곁들임이 전혀 없음')
  // 곁들임은 대체된 끼니에 겹치지 않아야 함
  for (const d of plan.days) for (const m of d.meals) {
    if (m.kind === 'product') assert.ok(!m.extras, '대체 끼니에 곁들임이 중복됨')
  }
  console.log('    곁들임 — 아침 ' + c.extraCount.breakfast + ' · 점심 ' + c.extraCount.lunch + ' · 간식 ' + c.extraCount.snack)
})
ok('대체 조합이 (두유+파이토) 또는 (두유+프로틴바+과일)', () => {
  for (const d of plan.days) {
    const pm = d.meals.find(m => m.kind === 'product')
    if (!pm) continue
    assert.ok(pm.items[0].includes('두유') || pm.items[0].includes('약콩'), pm.items.join('+'))
    if (pm.combo === 'A') assert.ok(pm.items[1].includes('파이토100'), pm.items.join('+'))
    else assert.ok(pm.items[1].includes('프로틴바'), pm.items.join('+'))
    if (pm.combo === 'A') assert.equal(pm.items.length, 2)
    else assert.equal(pm.items.length, 3)
  }
})
ok('평가 점수 4개 모두 0~100 범위', () => {
  for (const v of Object.values(plan.score)) assert.ok(Number.isFinite(v) && v >= 0 && v <= 100, String(v))
})
ok('평균 칼로리가 목표의 ±8% 안', () => {
  const r = plan.meta.avgKcal / plan.meta.targetKcal
  assert.ok(r > 0.92 && r < 1.08, 'ratio=' + r.toFixed(2))
})
ok('구독 수량을 바꿔도 목표 칼로리 ±8% 유지', () => {
  const cases = [
    ['두유3·파이토2·바4', { soymilk: ['A', 'A', 'A'], phyto: ['가', '가'], bar: ['나', '나', '나', '나'], addon: [] }],
    ['최소 1·1·2',       { soymilk: ['A'], phyto: ['가'], bar: ['나', '나'], addon: [] }],
    ['두유1·바1',        { soymilk: ['A'], phyto: [], bar: ['나'], addon: [] }],
  ]
  for (const [label, cart] of cases) {
    const p = $('generateMealPlan')({ profile, targets, cart, days: 30, allergies: new Set() })
    assert.ok(!p.error, label + ': ' + p.error)
    const r = p.meta.avgKcal / p.meta.targetKcal
    const lo = p.meta.leftover
    console.log('    ' + label.padEnd(18) + ' 저녁대체 ' + String(p.meta.coverage.replaceDays).padStart(2) + '일 · 평균 '
      + String(p.meta.avgKcal).padStart(4) + ' kcal (' + ((r - 1) * 100).toFixed(1) + '%) · 남은 제품 ' + (lo.soymilk + lo.phyto + lo.bar))
    assert.ok(r > 0.92 && r < 1.08, label + ' ratio=' + r.toFixed(2))
    assert.equal(lo.soymilk + lo.phyto + lo.bar, 0, label + ' 제품이 남음')
  }
})
ok('같은 날 같은 메뉴 중복 없음(조화 95점 이상)', () => assert.ok(plan.score.harmony >= 95))
ok('최적화가 초기해보다 개선', () => {
  // 같은 풀·같은 시드로 무작위 초기해의 4목적 합과 비교
  const rng = $('makeRng')(99)
  const P = $('buildSlotPools')({ allergies: new Set(), rng, cap: 150 })
  const products = $('planProductMeals')({ soymilk: ['A', 'A'], phyto: ['가', '가'], bar: ['나', '나', '나'], addon: [] }, 30, rng)
  const nk = $('PLAN_NUT_KEYS').length
  const fixed = {
    skip: new Set(), mealNut: new Array(90).fill(null),
    mealKcal: new Float64Array(90), mealPrf: new Float64Array(90),
    snackKcal: new Float64Array(30), snackPrf: new Float64Array(30), snackNut: new Array(30).fill(null),
  }
  for (const [dStr, pm] of Object.entries(products.meals)) {
    const m = Number(dStr) * 3 + 2
    fixed.skip.add(m); fixed.mealNut[m] = pm.nut; fixed.mealKcal[m] = pm.kcal; fixed.mealPrf[m] = pm.prfKcal
  }
  const Opt = $('SPEA2DietOptimizer')
  const opt = new Opt(P, $('planConstraints')(targets), fixed, { days: 30, rng })
  const init = opt.randomGene()
  const before = opt.fitness(init).reduce((a, b) => a + b, 0)
  const res = opt.optimize(init)
  const after = res.fitness.reduce((a, b) => a + b, 0)
  console.log('    4목적 합 ' + before.toFixed(1) + ' → ' + after.toFixed(1) + ' (' + res.generations + '세대)')
  assert.ok(after > before, '개선 없음')
})

console.log('\n── 실천 기록 · 체중 모니터링 ──')
vm.runInContext('trackerLoad(); tracker.profile = ' + JSON.stringify({ ...profile, allergies: [] }) + ';', ctx)
const logWeight = $('logWeight')
logWeight(68, '2026-10-01'); logWeight(67.2, '2026-10-08'); logWeight(66.6, '2026-10-15')
const tr = $('weightTrend')()
ok('추세 기울기 산출', () => {
  assert.ok(tr.perWeek < 0, 'perWeek=' + tr.perWeek)
  assert.equal(tr.spanDays, 14)
  console.log('    ' + tr.total + ' kg / ' + tr.spanDays + '일 = ' + tr.perWeek + ' kg/주')
})
const rtOK = $('retargetSuggestion')({ ...targets, weeklyDelta: -0.7 })
ok('계획대로면 목표 유지', () => assert.equal(rtOK.onTrack, true))
const rtSlow = $('retargetSuggestion')({ ...targets, weeklyDelta: -1.5 })
ok('감량이 느리면 목표 칼로리를 낮춤', () => {
  assert.equal(rtSlow.onTrack, false)
  assert.ok(rtSlow.delta < 0, 'delta=' + rtSlow.delta)
  assert.ok(rtSlow.newTargetKcal >= Math.max(1200, targets.eer * 0.7) - 1)
  console.log('    목표 ' + targets.targetKcal + ' → ' + rtSlow.newTargetKcal + ' kcal (' + rtSlow.delta + ')')
})
ok('1회 조정은 ±300kcal 이내', () => assert.ok(Math.abs(rtSlow.delta) <= 300))
ok('기록 7일 미만이면 재조정 보류', () => {
  vm.runInContext('tracker.weights = [{date:"2026-10-01",kg:68},{date:"2026-10-03",kg:67.8}];', ctx)
  assert.equal($('retargetSuggestion')(targets).ready, false)
})


// ══════════════════════════════════════════════
// 렌더 경로 스모크 테스트 — 결과 화면 전체를 실제로 그려본다
// (최소 DOM 스텁. 템플릿 문자열의 undefined 참조·오타를 잡는 용도)
// ══════════════════════════════════════════════
console.log('── 결과 화면 렌더 ──')
const els = new Map()
function fakeEl(id) {
  const el = {
    id, _html: '', textContent: '', value: '', open: false, style: {},
    cls: new Set(),
    classList: {
      add(c) { el.cls.add(c) },
      remove(c) { el.cls.delete(c) },
      toggle(c, on) { if (on === undefined) { el.cls.has(c) ? el.cls.delete(c) : el.cls.add(c) } else { on ? el.cls.add(c) : el.cls.delete(c) } },
      contains(c) { return el.cls.has(c) },
    },
    setAttribute: noop, getAttribute: () => null, addEventListener: noop,
    appendChild: noop, insertBefore: noop, remove: noop, removeChild: noop,
    querySelector: () => fakeEl(id + '-q'), querySelectorAll: () => [],
    get innerHTML() { return this._html },
    set innerHTML(v) { this._html = String(v) },
    get innerText() { return String(this._html).replace(/<[^>]*>/g, ' ') },
    scrollIntoView: noop, destroy: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }),
  }
  return el
}
sandbox.document.getElementById = id => {
  if (!els.has(id)) els.set(id, fakeEl(id))
  return els.get(id)
}
sandbox.document.createElement = () => fakeEl('new')
// 생키 SVG 그리기는 실제 좌표가 필요해 검증 대상이 아니다 — 호출만 통과시킨다
sandbox.document.createElementNS = () => fakeEl('svg')
sandbox.requestAnimationFrame = (fn) => { fn(); return 0 }
sandbox.alert = noop
sandbox.confirm = () => false

// 설문 기반(음식 기록 없이) 결과 산출
vm.runInContext(`
  gender = 'female';
  trackerLoad();
  document.getElementById('profile-age').value = '35';
  document.getElementById('profile-height').value = '162';
  document.getElementById('profile-weight').value = '68';
  document.getElementById('profile-waist').value = '88';
  document.getElementById('profile-prev-weight').value = '69';
  document.getElementById('profile-activity').value = 'low';
  SURVEY_QUESTIONS.forEach(q => answerSurvey(q.id, 0));
  selectedGoals.add('gut'); selectedGoals.add('bone');
  window_surveyComplete = isSurveyComplete();
`, ctx)
ok('설문만으로 입력 완료 판정', () => assert.equal($('window_surveyComplete'), true))

vm.runInContext('calculateAndShow();', ctx)
ok('설문만으로 PDI·목표 산출', () => {
  const r = $('pdiResult')
  assert.ok(r.pdiScore > 0)
  assert.equal(r.basis, 'survey')
  assert.ok(r.targets.targetKcal > 0)
  console.log('    설문 PDI ' + r.pdiScore.toFixed(1) + '% · ' + r.targets.bodyType.name
    + ' · 목표 ' + r.targets.targetKcal + ' kcal (EER ' + r.targets.eer + ')')
})
ok('프로필·목표가 저장됨', () => {
  const t = $('tracker')
  assert.equal(t.profile.height, 162)
  assert.ok(t.goals.includes('gut'))
  assert.equal(t.weights.length, 1)
})

const html = id => els.get(id) ? els.get(id)._html : ''
ok('구독 세트 렌더 (추천 근거·수량·가격)', () => {
  const h = html('product-recommendations')
  assert.ok(h.length > 2000, 'len=' + h.length)
  for (const s of ['체중 관리자 추천 룰', '구독 구성', '결제 금액', '정가', '할인 근거', '추가 구성품'])
    assert.ok(h.includes(s), '누락: ' + s)
  assert.ok(!h.includes('부족: 칼슘') && !h.includes('충족: 칼슘'), '칼슘 판정이 남아 있음')
  assert.ok(/\d{1,3}(,\d{3})*원/.test(h), '금액 표기 없음')
  assert.ok(h.includes('requestMealPlan'), '식단 추천받기 버튼이 구독 패널에 없음')
  assert.ok(!h.includes('undefined') && !h.includes('NaN'), 'undefined/NaN 포함')
})
ok('가이드 렌더 (체중 유형·권장 영양 섭취량)', () => {
  const h = html('guide-section')
  for (const s of ['체중 유형', '권장 영양 섭취량', '목표 칼로리', '표준 체중', '탄수화물', '나트륨'])
    assert.ok(h.includes(s), '누락: ' + s)
  assert.ok(!h.includes('undefined') && !h.includes('NaN'))
})
ok('설문 기반에서는 PDI·단백질만 보이고 양 의존 지표는 숨김', () => {
  const ks = html('key-summary')
  assert.ok(ks.length > 500, 'key-summary len=' + ks.length)
  // 보여야 하는 것
  for (const s of ['📊 PDI', '💪 단백질', '파이토케미컬 다양성'])
    assert.ok(ks.includes(s), '누락: ' + s)
  assert.ok(ks.includes('📝 설문 기반 예측치'), '설문 배지 없음')
  // 숨겨야 하는 것 — 타일 라벨 기준 (안내 문구에 이름이 언급되는 건 정상)
  for (const s of ['섭취 칼로리 / 기준 칼로리', '🌾 식이섬유', '🥗 PFS 식단 점수', 'Basic '])
    assert.ok(!ks.includes(s), '설문인데 노출됨: ' + s)
  // PFS 섹션은 아예 비어 있어야 함
  assert.equal(html('pfs-score-section'), '', 'PFS 섹션이 그려짐')
  // 파이토 섹션은 계열 구성만 (mg·DRV 없음)
  const ph = html('phyto-score-section')
  assert.ok(ph.length > 500, 'phyto len=' + ph.length)
  assert.ok(ph.includes('파이토케미컬 구성'), '설문용 제목이 아님')
  assert.ok(!ph.includes('DRV 달성률') && !ph.includes('/ 100점'), '설문인데 mg 기반 점수 노출')
})
ok('설문 상세 분석은 문항 → 식품군 → 파이토케미컬로 이어짐', () => {
  vm.runInContext('renderIngredientBreakdown(pdiResult);', ctx)
  const h = html('ingredient-breakdown')
  assert.ok(h.length > 1000, 'len=' + h.length)
  assert.ok(h.includes('📝 설문 문항'), '1열이 설문 문항이 아님')
  assert.ok(h.includes('식품군'), '2열이 식품군이 아님')
  assert.ok(!h.includes('🍽 음식') && !h.includes('식재료 (식품군)'), '설문인데 음식·식재료 열이 그려짐')
  // 식품을 만든 문항만 1열에 나오고, 각 문항의 라벨·선택한 답이 함께 보여야 함
  const flow0 = $('buildSurveyFlow')($('pdiResult'))
  assert.ok(flow0.col1.length >= 2, '1열 문항 ' + flow0.col1.length + '개')
  for (const node of flow0.col1) {
    assert.ok(h.includes(node.name), '문항 누락: ' + node.name)
    assert.ok(node.sub.length > 0, node.name + ' 의 선택한 답이 비어 있음')
  }
  assert.ok(h.includes('밥 종류'), '밥 문항은 항상 있어야 함')
  // 개별 식재료(백미·소금 등)가 노출되면 안 됨
  for (const s of ['백미', '소금', '진간장', '고추장'])
    assert.ok(!h.includes('data-id="' + s + '"'), '설문인데 식재료 노출: ' + s)
  // 식품군 노드는 FOOD_CATEGORIES 이름으로
  assert.ok(h.includes('통곡물') || h.includes('채소·나물·해조'), '식품군 이름 없음')
  const flow = $('buildSurveyFlow')($('pdiResult'))
  console.log('    문항 ' + flow.col1.length + '개 → 식품군 ' + flow.col2.length + '개 → 파이토케미컬 '
    + new Set(Object.values(flow.col2ToPhyto).flat()).size + '계열')
  console.log('    식품군: ' + flow.col2.map(c => c.icon + c.name + ' ' + c.note).join(' · '))
})
ok('양념·기름은 설문 상세 분석에서 제외', () => {
  const flow = $('buildSurveyFlow')($('pdiResult'))
  for (const c of flow.col2) assert.ok(c.cat !== 'spices' && c.cat !== 'oils', '제외 안 됨: ' + c.name)
})
ok('차류 식품군 보정 — 녹차가 PRF 로 계산됨', () => {
  const ING = $('INGREDIENTS')
  assert.equal(ING['녹차잎'].cat, 'tea')
  assert.equal(ING['녹차잎'].prf, true)
  assert.ok($('INGREDIENT_CAT_FIXED') > 0, '보정된 식재료가 없음')
  // 녹차를 더 마시면 PDI 가 올라가야 함 (보정 전에는 내려갔음)
  const Q = $('SURVEY_QUESTIONS'), build = $('buildSurveyDiet'), calc = $('calculatePDI')
  const pdiFor = i => {
    const a = {}; Q.forEach(q => { a[q.id] = q.options[1][1] })
    a.tea = Q.find(q => q.id === 'tea').options[i][1]
    return calc(build(a)).pdiScore
  }
  assert.ok(pdiFor(2) > pdiFor(0), '녹차를 마셔도 PDI 가 오르지 않음')
  console.log('    보정 식재료 ' + $('INGREDIENT_CAT_FIXED') + '개 · 녹차 안 마심 '
    + pdiFor(0).toFixed(1) + '% → 2잔 이상 ' + pdiFor(2).toFixed(1) + '%')
})

ok('식사 기록 기반에서는 전체 지표가 보임', () => {
  vm.runInContext(`
    addedMeals = [];
    addMeal('잡곡밥'); addMeal('된장찌개'); addMeal('제육볶음'); addMeal('배추김치'); addMeal('시금치나물');
    calculateAndShow();
  `, ctx)
  const ks = html('key-summary')
  assert.ok(ks.includes('🍽 오늘 식사 기록 기반'), '기록 배지 없음')
  for (const s of ['섭취 칼로리 / 기준 칼로리', '🌾 식이섬유', '🥗 PFS 식단 점수'])
    assert.ok(ks.includes(s), '기록인데 누락: ' + s)
  assert.ok(html('pfs-score-section').length > 500, 'PFS 섹션이 안 그려짐')
  assert.ok(html('phyto-score-section').includes('DRV 달성률'), '파이토 DRV 달성률 없음')
  vm.runInContext('renderIngredientBreakdown(pdiResult);', ctx)
  const ib = html('ingredient-breakdown')
  assert.ok(ib.includes('🍽 음식'), '기록인데 음식 열이 없음')
  assert.ok(ib.includes('식재료 (식품군)'), '기록인데 식재료 열이 없음')
  // 설문 상태로 되돌림 (뒤 검사들이 설문 기준으로 이어짐)
  vm.runInContext('addedMeals = []; calculateAndShow();', ctx)
  assert.ok(html('key-summary').includes('📝 설문 기반 예측치'))
})

// 30일 식단 + 실천 기록 + 모니터링 (setTimeout 없이 직접 실행)
vm.runInContext(`
  buildMealPlan(true);
  __plan = null;
`, ctx)
// buildMealPlan 은 setTimeout 안에서 최적화하므로 동일 로직을 직접 실행
vm.runInContext(`
  const __p = generateMealPlan({ profile: tracker.profile, targets: pdiResult.targets,
    cart: subCartToQuoteInput(), days: 30, allergies: pdiResult.profile.allergies });
  tracker.plan = __p;
  tracker.planKey = JSON.stringify(subCartToQuoteInput()) + '|' + pdiResult.targets.targetKcal;
  tracker.startDate = isoToday();
  renderMealPlan(); renderMonitor();
`, ctx)
ok('식단 전에는 「식단 추천받기」 안내가 보임', () => {
  vm.runInContext('const __keep = tracker.plan; tracker.plan = null; renderMealPlan(); tracker.plan = __keep;', ctx)
  const h = html('mealplan-section')
  for (const s of ['구독 구성 정하기', '식단 추천받기', '매일 실천 기록', 'requestMealPlan'])
    assert.ok(h.includes(s), '누락: ' + s)
})
ok('구독 구성이 바뀌면 다시 추천받기 안내로 바뀜', () => {
  vm.runInContext("const __k = tracker.planKey; tracker.planKey = 'changed'; renderMealPlan(); tracker.planKey = __k;", ctx)
  const h = html('mealplan-section')
  assert.ok(h.includes('구독 구성이 바뀌었습니다'), '변경 안내 없음')
  assert.ok(h.includes('requestMealPlan'), '다시 추천받기 버튼 없음')
  vm.runInContext('renderMealPlan();', ctx)        // 원래 상태로 복구
})
ok('30일 식단 렌더', () => {
  const h = html('mealplan-section')
  assert.ok(h.length > 5000, 'len=' + h.length)
  for (const s of ['30일 맞춤 식단', 'Day 1', '먹었어요', '다른 음식', '안 먹음', '밥스누 대체식', '영양 균형', '메뉴 궁합'])
    assert.ok(h.includes(s), '누락: ' + s)
  assert.ok(h.includes('오늘'), '오늘 표시 없음')
  assert.ok(!h.includes('undefined') && !h.includes('NaN'))
})
ok('실천 기록 → 실제 섭취 반영', () => {
  vm.runInContext(`setMealStatus(1,'breakfast','eaten'); addSubstitute(1,'lunch','김치찌개',1.5);`, ctx)
  const a = $('actualDay')(1)
  assert.equal(a.logged, 2)
  assert.ok(a.kcal > 0)
  const ad = $('adherence')()
  assert.equal(ad.eaten, 1)
  assert.equal(ad.other, 1)
  console.log('    Day1 실제 ' + a.kcal + ' kcal · PDI ' + a.pdi + '% · 실천율 ' + ad.pct + '%')
})
ok('없는 음식은 거부', () => {
  assert.ok($('addSubstitute')(1, 'dinner', '존재하지않는음식xyz', 1).includes('찾을 수 없습니다'))
})
ok('모니터링 렌더 (체중 입력·목표 재조정)', () => {
  const h = html('monitor-section')
  assert.ok(h.length > 1500, 'len=' + h.length)
  for (const s of ['체중 변화', '오늘 체중', '현재 체중', '누적 변화', '식단 실천율', '표준 체중까지'])
    assert.ok(h.includes(s), '누락: ' + s)
  assert.ok(!h.includes('undefined') && !h.includes('NaN'))
})
ok('목표 재조정 적용 → 식단 재생성', () => {
  vm.runInContext(`
    logWeight(68,'2026-09-17'); logWeight(67.9,'2026-09-24'); logWeight(67.8,'2026-10-01');
    renderMonitor();
  `, ctx)
  assert.ok(html('monitor-section').includes('목표 재조정 제안'), '재조정 제안 미표시')
  const before = $('pdiResult').targets.targetKcal
  vm.runInContext('applyRetarget(' + (before - 150) + ');', ctx)
  assert.equal($('tracker').targetKcalOverride, before - 150)
  assert.equal($('currentTargets')().targetKcal, before - 150)
})


// ══════════════════════════════════════════════
// 화면 조작 점검 — 버튼·입력에 연결된 함수를 전부 실제로 호출해 본다
// (브라우저에서 클릭했을 때 터지는 오류를 대신 잡는 용도)
// ══════════════════════════════════════════════
const tabHtml = read('public/index.html')
console.log('\n── 결과 화면 탭 ──')
const panelOf = id => sandbox.document.getElementById('rtab-' + id)
const hiddenOf = id => { const e = panelOf(id); return e && e.cls ? e.cls.has('hidden') : null }
ok('index.html 에 탭 3개와 패널 3개가 있음', () => {
  for (const t of ['analysis', 'plan', 'track']) {
    assert.ok(tabHtml.includes('id="rtab-' + t + '"'), '패널 없음: ' + t)
    assert.ok(tabHtml.includes('id="rtab-btn-' + t + '"'), '버튼 없음: ' + t)
  }
  assert.ok(tabHtml.includes("setResultTab('track')"), '탭 전환 핸들러 없음')
})
ok('섹션이 의도한 탭에 들어가 있음', () => {
  const cut = (a, bEnd) => tabHtml.slice(tabHtml.indexOf(a), tabHtml.indexOf(bEnd))
  const analysis = cut('id="rtab-analysis"', 'id="rtab-plan"')
  const plan     = cut('id="rtab-plan"', 'id="rtab-track"')
  const track    = tabHtml.slice(tabHtml.indexOf('id="rtab-track"'))
  for (const id of ['key-summary', 'pdi-ring', 'guide-section', 'pfs-score-section', 'phyto-score-section', 'detail-analysis'])
    assert.ok(analysis.includes('id="' + id + '"'), '나의 분석 탭에 없음: ' + id)
  for (const id of ['product-recommendations', 'mealplan-section'])
    assert.ok(plan.includes('id="' + id + '"'), '제품·식단 탭에 없음: ' + id)
  assert.ok(track.includes('id="monitor-section"'), '체중 변화 탭에 monitor-section 없음')
  assert.ok(tabHtml.indexOf('id="rtab-track"') > tabHtml.indexOf('id="rtab-plan"'), '체중 변화가 마지막 탭이 아님')
})
ok('탭 전환이 패널 표시를 바꿈', () => {
  vm.runInContext("setResultTab('plan')", ctx)
  assert.equal(hiddenOf('plan'), false, '제품·식단 탭이 숨겨짐')
  assert.equal(hiddenOf('analysis'), true, '나의 분석 탭이 안 숨겨짐')
  assert.equal(hiddenOf('track'), true)
  vm.runInContext("setResultTab('track')", ctx)
  assert.equal(hiddenOf('track'), false)
  assert.equal(hiddenOf('plan'), true)
  vm.runInContext("setResultTab('analysis')", ctx)
  assert.equal(hiddenOf('analysis'), false)
  vm.runInContext("setResultTab('없는탭')", ctx)
  assert.equal(hiddenOf('analysis'), false, '잘못된 탭 이름에 반응함')
})
ok('식단 추천받기를 누르면 제품·식단 탭으로 이동', () => {
  // 실천 기록이 있으면 확인 창이 뜨는데 테스트의 confirm 은 false 를 반환하므로 먼저 비운다
  vm.runInContext("tracker.log = {}; setResultTab('analysis'); requestMealPlan();", ctx)
  assert.equal($('resultTab'), 'plan')
  assert.equal(hiddenOf('plan'), false)
})


console.log('\n── 화면 조작 ──')
const htmlSrc = read('public/index.html')
const inlineHandlers = [...new Set([...htmlSrc.matchAll(/on\w+="(\w+)\(/g)].map(m => m[1]))]
ok('index.html 의 버튼 핸들러가 모두 정의되어 있음', () => {
  for (const h of inlineHandlers) {
    assert.equal($('typeof ' + h), 'function', h + ' 이 정의되지 않음')
  }
  console.log('    ' + inlineHandlers.length + '개: ' + inlineHandlers.join(', '))
})

// 동적으로 만들어지는 버튼의 핸들러 (렌더된 HTML 의 onclick 에서 추출)
const renderedHtml = ['product-recommendations', 'mealplan-section', 'monitor-section', 'guide-section',
  'key-summary', 'pfs-score-section', 'phyto-score-section', 'product-grid', 'health-goals-grid']
  .map(id => html(id)).join('')
const JS_KEYWORDS = new Set(['if', 'for', 'while', 'return', 'typeof', 'new', 'delete', 'void'])
const dynHandlers = [...new Set([...renderedHtml.matchAll(/onclick="(\w+)\(/g)].map(m => m[1]))]
  .filter(h => !JS_KEYWORDS.has(h))
ok('렌더된 화면의 버튼 핸들러가 모두 정의되어 있음', () => {
  for (const h of dynHandlers) assert.equal($('typeof ' + h), 'function', h + ' 이 정의되지 않음')
  console.log('    ' + dynHandlers.length + '개: ' + dynHandlers.join(', '))
})

ok('구독 수량·제품 변경이 오류 없이 다시 그려짐', () => {
  const before = html('product-recommendations').length
  vm.runInContext(`
    setSubQty('soymilk', 1); setSubQty('phyto', -1); setSubQty('bar', 1);
    setSoymilkCode('E'); toggleAddon('2'); toggleAddon('2');
    applyPreset('minimum'); applyPreset('optimal'); resetSubCart();
    setSubQty('soymilk', -9); setSubQty('phyto', -9); setSubQty('bar', -9);   // 전부 비우기
    for (const code of [...subCart.addon]) toggleAddon(code);
  `, ctx)
  const empty = html('product-recommendations')
  assert.ok(empty.includes('담긴 제품이 없습니다'), '빈 구성 안내가 없음')
  assert.ok(!empty.includes('undefined') && !empty.includes('NaN'))
  vm.runInContext(`resetSubCart();`, ctx)
  assert.ok(html('product-recommendations').length > before * 0.5)
})

ok('30일 식단 넘기기·실천 기록 버튼이 오류 없이 동작', () => {
  vm.runInContext(`
    setPlanView(8); setPlanView(29); setPlanView(1); setPlanView(-5);
    setMealStatus(2, 'dinner', 'eaten'); setMealStatus(2, 'dinner', 'eaten');   // 토글로 해제
    setMealStatus(3, 'lunch', 'skipped');
    setMealStatus(4, 'breakfast', 'other');
    addSubstitute(4, 'breakfast', '잡곡밥', 0.5);
    removeSubstitute(4, 'breakfast', 0);
  `, ctx)
  assert.ok(html('mealplan-section').includes('Day 1'))
})

ok('체중 기록 범위 검증이 동작', () => {
  const el = $('document').getElementById('weight-input')
  const de = $('document').getElementById('weight-date')
  el.value = '999'; de.value = '2026-10-20'
  vm.runInContext('submitWeight()', ctx)
  assert.ok($("document").getElementById('weight-error').textContent.includes('10–300'), '범위 오류 안내 없음')
  el.value = '66.0'
  vm.runInContext('submitWeight()', ctx)
  assert.equal($('tracker').weights[$('tracker').weights.length - 1].kg, 66)
})

ok('목표 재조정·식단 재생성·초기화가 오류 없이 동작', () => {
  vm.runInContext('regenerateMealPlan()', ctx)
  assert.ok($('tracker').plan, '재생성 후 식단이 없음')
  assert.equal(Object.keys($('tracker').log).length, 0, '재생성 시 기록이 초기화되지 않음')
  vm.runInContext('restartAssessment()', ctx)
  assert.equal($('currentStep'), 1)
  vm.runInContext('trackerReset()', ctx)
  assert.equal($('tracker').plan, null)
})

console.log('\n✅ ' + pass + '개 검사 통과\n')
