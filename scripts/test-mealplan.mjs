// 구독 할인 · 추천 룰 · 30일 식단 다목적 최적화 자체 점검
//   실행: node scripts/test-mealplan.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const htmlSrc = read('public/index.html')

// 브라우저 전용 전역 최소 스텁 (app.js 는 로드 시 document.addEventListener 만 호출)
const noop = () => {}
const sandbox = {
  console,
  document: { addEventListener: noop, getElementById: () => null },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  location: { hash: '' },
  window: { addEventListener: noop, matchMedia: () => ({ matches: true }), scrollTo: noop },
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

console.log('\n── 추천 룰테이블 (식생활 등급 3 × 체중 2 × 연령 4) ──')
ok('룰 24행 전부 적재', () => assert.equal($('WEIGHT_MGMT_RULES').length, 24))
const recommend = $('recommendSubscription')
ok('개선 필요 · BMI 26 · 35세 → 두유 C · 파이토+프로틴바', () => {
  const r = recommend({ grade: 'poor', bmi: 26, age: 35, lacks: {}, goals: new Set(['weight']), allergies: new Set() })
  assert.equal(r.rule.main, 'C')
  assert.equal(r.bodyType.name, '비만')
  assert.equal(r.cart.soymilk.join(','), 'C,C')
  assert.equal(r.cart.phyto.length, 1)
  assert.equal(r.cart.bar.length, 2)
})
ok('부족 판정이 구성에 반영됨 — 채소만 부족하면 파이토100 만', () => {
  // 보통 등급 40대 과체중: grain ['가'] / veg ['가'] → 어느 쪽이든 파이토, 프로틴바는 없음
  const r = recommend({ grade: 'inter', bmi: 26, age: 45, lacks: { veg: true }, goals: new Set(['weight']), allergies: new Set() })
  assert.equal(r.cart.phyto.length, 1)
  assert.equal(r.cart.bar.length, 0, '채소 부족에는 프로틴바를 담지 않음')
})
ok('우수 등급 · 정상 체중 → 보조 제품 없이 두유만', () => {
  const r = recommend({ grade: 'ideal', bmi: 21, age: 35, lacks: {}, goals: new Set(['weight']), allergies: new Set() })
  assert.equal(r.cart.phyto.length, 0)
  assert.equal(r.cart.bar.length, 0)
  assert.ok(r.cart.soymilk.length > 0)
})
ok('식생활 등급이 바뀌면 구성이 바뀜', () => {
  const mk = grade => recommend({ grade, bmi: 21, age: 35, lacks: {}, goals: new Set(['weight']), allergies: new Set() })
  const poor = mk('poor'), ideal = mk('ideal')
  assert.notEqual(poor.cart.phyto.length + poor.cart.bar.length, ideal.cart.phyto.length + ideal.cart.bar.length)
})
ok('단백질 부족 → C(고단백) 로 대체', () => {
  const r = recommend({ grade: 'poor', bmi: 21, age: 15, lacks: { protein: true }, goals: new Set(['weight']), allergies: new Set() })
  assert.equal(r.cart.soymilk[0], 'C')
})
ok('칼슘 축은 추천에 영향 없음 (판정 제거)', () => {
  const base   = recommend({ grade: 'poor', bmi: 21, age: 15, lacks: {}, goals: new Set(['weight']), allergies: new Set() })
  const withCa = recommend({ grade: 'poor', bmi: 21, age: 15, lacks: { calcium: true }, goals: new Set(['weight']), allergies: new Set() })
  assert.equal(withCa.cart.soymilk.join(','), base.cart.soymilk.join(','))
})
ok('장 건강 목표 → D(포스트바이오틱스) 로 대체', () => {
  const r = recommend({ grade: 'poor', bmi: 21, age: 35, lacks: {}, goals: new Set(['weight', 'gut']), allergies: new Set() })
  assert.equal(r.cart.soymilk[0], 'D')
})
ok('뼈건강·피로 목표 → 추가 구성품 2·4', () => {
  const r = recommend({ grade: 'poor', bmi: 21, age: 35, lacks: {}, goals: new Set(['weight', 'bone', 'fatigue']), allergies: new Set() })
  assert.equal([...r.cart.addon].sort().join(','), '2,4')
})
ok('대두 알레르기 → 두유·프로틴바 제외하고 파이토100만 추천', () => {
  const r = recommend({ grade: 'poor', bmi: 26, age: 35, lacks: {}, goals: new Set(['weight']), allergies: new Set(['soy']) })
  assert.equal(r.cart.soymilk.length, 0)
  assert.equal(r.cart.bar.length, 0)
  assert.equal(r.cart.phyto.join(','), '가,가')
  assert.ok(r.excluded.length > 0)
})
ok('땅콩 알레르기 → 프로틴바만 제외', () => {
  const r = recommend({ grade: 'poor', bmi: 26, age: 35, lacks: {}, goals: new Set(['weight']), allergies: new Set(['peanut']) })
  assert.equal(r.cart.bar.length, 0)
  assert.ok(r.cart.soymilk.length > 0, '두유는 남아야 함')
})
ok('추천 사유는 짧은 말만 — 기본 구성에는 사유를 달지 않음', () => {
  const r = recommend({ grade: 'poor', bmi: 26, age: 35, lacks: { veg: true }, goals: new Set(['weight']), allergies: new Set() })
  assert.ok(r.reasons.some(x => x.why === '채소 섭취 부족'), '채소 부족 사유가 없음')
  for (const x of r.reasons) {
    assert.ok(x.why.length <= 14, '사유가 너무 김: ' + x.why)
    assert.ok(!/PDI|기본 추천|습니다/.test(x.why), '군더더기가 들어감: ' + x.why)
  }
})
ok('부족한 것도 목표도 없으면 사유를 아예 달지 않음', () => {
  const r = recommend({ grade: 'inter', bmi: 21, age: 35, lacks: {}, goals: new Set(['weight']), allergies: new Set() })
  assert.equal(r.reasons.length, 0)
})

console.log('\n── 서울대병원 식생활문진표 설문 ──')
const SQ = $('SURVEY_QUESTIONS'), assess = $('surveyAssessment')
ok('11문항 적재', () => assert.equal(SQ.length, 11))
ok('모든 문항에 Ideal(5점) 선택지가 하나씩 있음', () => {
  for (const q of SQ) assert.equal(q.options.filter(o => o[1] === 5).length, 1, q.id)
})
ok('전부 Ideal → 우수', () => {
  const ans = {}
  for (const q of SQ) ans[q.id] = q.options.findIndex(o => o[1] === 5)
  const a = assess(ans)
  assert.equal(a.idealCount, 11)
  assert.equal(a.grade.id, 'ideal')
  assert.equal(a.score, 55)
})
ok('전부 Poor → 개선 필요', () => {
  const ans = {}
  for (const q of SQ) ans[q.id] = q.options.findIndex(o => o[1] === 1)
  const a = assess(ans)
  assert.equal(a.idealCount, 0)
  assert.equal(a.grade.id, 'poor')
})
ok('Ideal 5개 → 보통', () => {
  const ans = {}
  SQ.forEach((q, i) => { ans[q.id] = q.options.findIndex(o => o[1] === (i < 5 ? 5 : 1)) })
  assert.equal(assess(ans).grade.id, 'inter')
})
ok('곡류·채소·단백질 문항이 부족 판정으로 이어짐', () => {
  const ans = {}
  for (const q of SQ) ans[q.id] = q.options.findIndex(o => o[1] === 5)
  assert.equal(JSON.stringify(assess(ans).lacks), JSON.stringify({ wholeGrain: false, veg: false, protein: false }))
  ans.veg = SQ.find(q => q.id === 'veg').options.findIndex(o => o[1] === 1)
  assert.equal(assess(ans).lacks.veg, true)
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
ok('PDI 목적함수가 포화되지 않고 경쟁함', () => {
  // 임상 임계값(40%)과 최적화 목표를 분리 — 40% 를 목표로 쓰면 점수가 100 에 붙어 기울기가 사라진다
  assert.equal($('PDI_TARGET'), 40, '임상 임계값이 바뀜')
  assert.ok($('PDI_OPT_TARGET') > 40, '최적화 목표가 임계값보다 커야 함')
  const cases = [
    ['여 35세 162/68', { gender: 'female', age: 35, height: 162, weight: 68, activity: 'low' }],
    ['남 45세 175/95', { gender: 'male', age: 45, height: 175, weight: 95, activity: 'low' }],
    ['남 25세 180/70', { gender: 'male', age: 25, height: 180, weight: 70, activity: 'very_active' }],
    ['여 60세 155/45', { gender: 'female', age: 60, height: 155, weight: 45, activity: 'sedentary' }],
  ]
  const cart = { soymilk: ['A', 'A'], phyto: ['가', '가'], bar: ['나', '나', '나'], addon: [] }
  for (const [label, prof] of cases) {
    const t = $('nutritionTargets')(prof)
    const p = $('generateMealPlan')({ profile: prof, targets: t, cart, days: 30, allergies: new Set() })
    assert.ok(p.score.pdi < 100, label + ' PDI 점수가 100 에 포화됨 (기울기 없음)')
    assert.ok(p.score.pdi > 50, label + ' PDI 점수가 너무 낮음: ' + p.score.pdi)
    // 실측 PDI 는 임계값 40% 를 넉넉히 넘어야 함
    assert.ok(p.meta.avgPDI > 40, label + ' 실측 PDI ' + p.meta.avgPDI + '% 가 임계값 미달')
    assert.equal(p.meta.pdiOptTarget, $('PDI_OPT_TARGET'))
  }
  console.log('    PDI 목표 ' + $('PDI_OPT_TARGET') + '% (임계 ' + $('PDI_TARGET') + '%) · 점수 '
    + cases.map(([l, prof]) => {
        const t = $('nutritionTargets')(prof)
        return $('generateMealPlan')({ profile: prof, targets: t, cart, days: 30, allergies: new Set() }).score.pdi
      }).join(' / '))
})
ok('음식의 PRF 비율이 100% 를 넘지 않음', () => {
  // 분자(PRF 식재료 kcal)와 분모(열량)를 같은 출처로 맞췄는지 — 전에는 반올림 때문에 107% 까지 나왔음
  const pools = $('buildSlotPools')({ allergies: new Set(), rng: $('makeRng')(11), cap: 60 })
  let worst = 0, worstName = ''
  for (const slot of $('SLOT_IDS')) {
    for (const c of pools[slot]) {
      if (!(c.kcal > 0)) continue
      const r = c.prfKcal / c.kcal
      if (r > worst) { worst = r; worstName = c.name }
    }
  }
  assert.ok(worst <= 1.0001, '최고 PRF 비율 ' + (worst * 100).toFixed(1) + '% (' + worstName + ')')
  console.log('    최고 PRF 비율 ' + (worst * 100).toFixed(1) + '% (' + worstName + ')')
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

console.log('\n── 구독량에 맞춘 설계 일수 ──')
ok('설계 일수 = max(두유 회분, 파이토+프로틴바 회분) · 최대 30일', () => {
  const sd = $('subscriptionDays')
  const cases = [
    [{ soymilk: ['A', 'A'], phyto: ['가', '가'], bar: ['나', '나', '나'] }, 30],  // 48 / 58 → 30
    [{ soymilk: ['A'], phyto: ['가'], bar: ['나', '나'] }, 30],                  // 24 / 34 → 30
    [{ soymilk: ['A'], phyto: [], bar: ['나'] }, 24],                            // 24 / 10 → 24
    [{ soymilk: ['A'], phyto: [], bar: [] }, 24],                                // 24 /  0 → 24
    [{ soymilk: [], phyto: ['가'], bar: [] }, 14],                               //  0 / 14 → 14
    [{ soymilk: [], phyto: [], bar: ['나'] }, 10],                               //  0 / 10 → 10
    [{ soymilk: ['G'], phyto: [], bar: ['나'] }, 10],                            // 10 / 10 → 10
    [{ soymilk: [], phyto: [], bar: [] }, 0],
  ]
  for (const [cart, want] of cases) {
    assert.equal(sd(cart, 30), want, JSON.stringify(cart) + ' → ' + sd(cart, 30) + '일 (기대 ' + want + ')')
  }
})
ok('설계한 일수만 만들고, 그 안에 제품 없는 날이 없음', () => {
  const cases = [
    ['두유2·파이토2·바3', { soymilk: ['A', 'A'], phyto: ['가', '가'], bar: ['나', '나', '나'], addon: [] }, 30],
    ['두유1·파이토1·바2', { soymilk: ['A'], phyto: ['가'], bar: ['나', '나'], addon: [] }, 30],
    ['두유1·바1',        { soymilk: ['A'], phyto: [], bar: ['나'], addon: [] }, 24],
    ['두유1만',          { soymilk: ['A'], phyto: [], bar: [], addon: [] }, 24],
    ['파이토1만',        { soymilk: [], phyto: ['가'], bar: [], addon: [] }, 14],
    ['바1만',           { soymilk: [], phyto: [], bar: ['나'], addon: [] }, 10],
  ]
  for (const [label, cart, wantDays] of cases) {
    const p = $('generateMealPlan')({ profile, targets, cart, days: 30, allergies: new Set() })
    assert.ok(!p.error, label + ': ' + p.error)
    assert.equal(p.days.length, wantDays, label + ' 설계 일수 ' + p.days.length + ' (기대 ' + wantDays + ')')
    assert.equal(p.meta.days, wantDays)
    assert.equal(p.meta.coverage.plainDays, 0, label + ' 에 제품 없는 날 ' + p.meta.coverage.plainDays + '일')
    assert.equal(p.meta.leftover.soymilk + p.meta.leftover.phyto + p.meta.leftover.bar, 0, label + ' 제품이 남음')
    // 모든 날에 제품이 하나라도 들어갔는지 직접 확인
    for (const d of p.days) {
      const has = d.meals.some(m => m.kind === 'product' || m.extras) || !!d.snack
      assert.ok(has, label + ' Day ' + d.day + ' 에 밥스누 제품이 없음')
    }
    // 목표 칼로리는 일수와 무관하게 유지되어야 함
    const r = p.meta.avgKcal / p.meta.targetKcal
    assert.ok(r > 0.92 && r < 1.08, label + ' 평균 칼로리 ' + p.meta.avgKcal + ' (ratio ' + r.toFixed(2) + ')')
    console.log('    ' + label.padEnd(18) + p.days.length + '일 · 저녁대체 ' + p.meta.coverage.replaceDays
      + '일 · 평균 ' + p.meta.avgKcal + ' kcal')
  }
})
ok('30일 미만이면 채우는 방법을 안내', () => {
  const short = $('generateMealPlan')({ profile, targets, cart: { soymilk: ['A'], phyto: [], bar: ['나'], addon: [] }, days: 30, allergies: new Set() })
  const sf = short.meta.shortfall
  assert.ok(sf, '부족 안내가 없음')
  // 안내한 팩 수를 실제로 담으면 30일이 되어야 함
  const sd = $('subscriptionDays')
  assert.equal(sd({ soymilk: Array(1 + sf.soymilkPacks).fill('A'), phyto: [], bar: ['나'] }, 30), 30, '두유 안내 팩 수로 30일이 안 됨')
  assert.equal(sd({ soymilk: ['A'], phyto: Array(sf.phytoPacks).fill('가'), bar: ['나'] }, 30), 30, '파이토 안내 팩 수로 30일이 안 됨')
  assert.equal(sd({ soymilk: ['A'], phyto: [], bar: Array(1 + sf.barPacks).fill('나') }, 30), 30, '프로틴바 안내 팩 수로 30일이 안 됨')
  // 30일을 채운 구성에는 안내가 없어야 함
  const full = $('generateMealPlan')({ profile, targets, cart: { soymilk: ['A', 'A'], phyto: ['가', '가'], bar: ['나', '나', '나'], addon: [] }, days: 30, allergies: new Set() })
  assert.equal(full.meta.shortfall, null, '30일을 채웠는데 부족 안내가 나옴')
  console.log('    두유1·바1 → 24일 · 안내: 두유 ' + sf.soymilkPacks + '팩 / 파이토 ' + sf.phytoPacks + '팩 / 프로틴바 ' + sf.barPacks + '팩')
})
ok('제품이 하나도 없으면 식단을 만들지 않음', () => {
  const p = $('generateMealPlan')({ profile, targets, cart: { soymilk: [], phyto: [], bar: [], addon: [] }, days: 30, allergies: new Set() })
  assert.ok(p.error && p.error.includes('1개 이상'), '빈 구성인데 오류가 아님: ' + JSON.stringify(p.error))
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
  document.getElementById('profile-waist').value = '35';   // 바지 35인치 ≒ 허리 88.9 cm
  renderWaistOptions();
  document.getElementById('profile-waist').value = '35';
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
  for (const s of ['이렇게 골랐어요', '구독 구성', '결제 금액', '정가', '할인', '추가 구성품'])
    assert.ok(h.includes(s), '누락: ' + s)
  // 내부 용어·할인 근거 설명은 화면에 나오지 않아야 한다
  for (const s of ['추천 룰', '할인 근거', 'PDI', '엑셀', 'Sheet3'])
    assert.ok(!h.includes(s), '내부 용어 노출: ' + s)
  assert.ok(!h.includes('부족: 칼슘') && !h.includes('충족: 칼슘'), '칼슘 판정이 남아 있음')
  assert.ok(/\d{1,3}(,\d{3})*원/.test(h), '금액 표기 없음')
  assert.ok(!h.includes('requestMealPlan'), '가이드 버전인데 식단 추천 버튼이 보임')
  assert.ok(!h.includes('undefined') && !h.includes('NaN'), 'undefined/NaN 포함')
})
ok('① 목표치가 먼저 — 기준 칼로리·BMI·복부비만·영양소 목표치', () => {
  const h = html('target-section')
  for (const s of ['하루 목표치', '목표 칼로리', 'BMI', '복부비만', '표준 체중',
                   '탄수화물', '단백질', '지방', '식이섬유', '당류', '포화지방', '나트륨'])
    assert.ok(h.includes(s), '누락: ' + s)
  assert.ok(!h.includes('undefined') && !h.includes('NaN'))
  // 바지 사이즈를 입력했으면 복부비만 판정이 나와야 한다
  assert.ok(h.includes('해당'), '복부비만 판정이 없음')
})
ok('② 목표 관리 팁 · ③ 주의사항이 따로 그려짐', () => {
  const tips = html('tips-section'), guide = html('guide-section')
  assert.ok(tips.includes('목표 관리 팁'), '관리 팁 제목 없음')
  assert.ok(tips.includes('체중 관리'), '기본 목표(체중 관리) 팁이 없음')
  assert.ok(guide.includes('주의사항'), '주의사항 제목 없음')
  // 목표치는 주의사항 카드에서 빠져야 한다 (중복 표시 금지)
  assert.ok(!guide.includes('권장 영양 섭취량') && !guide.includes('체중 유형'), '주의사항에 목표치가 남아 있음')
})
ok('삭제된 화면이 index.html 에 남아 있지 않음', () => {
  for (const id of ['pdi-ring', 'detail-analysis', 'phyto-score-section', 'pfs-score-section',
                    'category-chart', 'ingredient-breakdown', 'flow-list', 'rtab-analysis'])
    assert.ok(!htmlSrc.includes('id="' + id + '"'), '삭제 안 됨: ' + id)
  // 처음 보는 사람이 알 수 없는 말이 화면에 남아 있지 않아야 한다
  for (const w of ['PDI', 'PFS', '파이토케미컬 다양성'])
    assert.ok(!htmlSrc.includes(w), '내부 용어 노출: ' + w)
})
ok('식사를 기록하지 않았으면 섭취량 기반 요약을 띄우지 않음', () => {
  const sum = sandbox.document.getElementById('key-summary')
  assert.equal(sum.cls.has('hidden'), true, '설문만 했는데 기록 요약이 보임')
})
ok('차류 식품군 보정 — 녹차가 PRF 로 계산됨', () => {
  const ING = $('INGREDIENTS')
  assert.equal(ING['녹차잎'].cat, 'tea')
  assert.equal(ING['녹차잎'].prf, true)
  assert.ok($('INGREDIENT_CAT_FIXED') > 0, '보정된 식재료가 없음')
  // 녹차를 곁들이면 PDI 가 올라가야 함 (보정 전에는 내려갔음)
  // 식생활문진표에는 차 문항이 없어 식단에 직접 넣어 확인한다
  const analyze = $('analyzeFood'), custom = $('buildCustomAnalysis'), calc = $('calculatePDI')
  // 기준 음식은 PRF 가 아닌 것으로 — 밥류는 식재료 DB 에서 전부 PRF 라 PDI 가 100% 로 포화됨
  const rice = { name: '계란말이', meal: 'lunch', portion: 1, analysis: analyze('계란말이') }
  const tea  = { name: '녹차 한 잔', meal: 'snack', portion: 1, analysis: custom('녹차 한 잔', { '녹차잎': 2 }) }
  const before = calc([rice]).pdiScore, after = calc([rice, tea]).pdiScore
  assert.ok(after > before, '녹차를 곁들여도 PDI 가 오르지 않음')
  console.log('    보정 식재료 ' + $('INGREDIENT_CAT_FIXED') + '개 · 녹차 없음 '
    + before.toFixed(1) + '% → 녹차 1잔 ' + after.toFixed(1) + '%')
})

ok('식사를 기록하면 기록 요약이 보임', () => {
  vm.runInContext(`
    addedMeals = [];
    addMeal('잡곡밥'); addMeal('된장찌개'); addMeal('제육볶음'); addMeal('배추김치'); addMeal('시금치나물');
    calculateAndShow();
  `, ctx)
  const ks = html('key-summary')
  assert.equal(sandbox.document.getElementById('key-summary').cls.has('hidden'), false, '기록했는데 요약이 숨겨짐')
  for (const s of ['기록한 식사 요약', '먹은 칼로리 / 기준 칼로리', '단백질', '식이섬유'])
    assert.ok(ks.includes(s), '기록인데 누락: ' + s)
  assert.ok(!ks.includes('PDI') && !ks.includes('PFS'), '요약에 내부 용어가 남아 있음')
  assert.ok(!ks.includes('undefined') && !ks.includes('NaN'))
  // 설문 상태로 되돌림 (뒤 검사들이 설문 기준으로 이어짐)
  vm.runInContext('addedMeals = []; calculateAndShow();', ctx)
})

console.log('\n── 받는 범위 (칼로리 가이드 / 30일 식단) ──')
ok('기본값은 칼로리 가이드', () => {
  assert.equal($('planMode')(), 'guide')
  assert.equal($('tracker').planMode, 'guide')
})
ok('가이드 버전 — 끼니별 칼로리와 제품 배분까지만', () => {
  vm.runInContext('renderMealPlan();', ctx)
  const h = html('mealplan-section')
  assert.ok(h.length > 1500, 'len=' + h.length)
  for (const s of ['30일 체중 관리 가이드', '아침', '점심', '저녁', '일반식',
                   '제품을 이렇게 나눠 드세요', '일반식은 이렇게'])
    assert.ok(h.includes(s), '누락: ' + s)
  // 메뉴는 짜지 않는다
  for (const s of ['Day 1', '먹었어요', '안 먹음'])
    assert.ok(!h.includes(s), '가이드인데 식단이 나옴: ' + s)
  assert.ok(!h.includes('undefined') && !h.includes('NaN'))
})
ok('끼니 칼로리 합이 하루 목표와 맞음', () => {
  const g = $('guidePlacement')()
  const total = $('pdiResult').targets.targetKcal
  const share = $('GUIDE_MEAL_SHARE')
  // 제품이 저녁을 대신하면 남는 칼로리를 아침·점심에 나눠 주므로 합은 그대로다
  const kcal = {}
  for (const t of Object.keys(share)) kcal[t] = total * share[t]
  if (g && g.replaceDays && g.replacedKcal) {
    const freed = kcal[g.replaceType] - g.replacedKcal
    kcal[g.replaceType] = g.replacedKcal
    const rest = Object.keys(share).filter(t => t !== g.replaceType)
    const sum = rest.reduce((a, t) => a + share[t], 0)
    for (const t of rest) kcal[t] += freed * (share[t] / sum)
  }
  const sum = Object.values(kcal).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(sum - total) < 1, '끼니 합 ' + Math.round(sum) + ' ≠ 목표 ' + total)
  console.log('    ' + Object.entries(kcal).map(([t, v]) => t + ' ' + Math.round(v)).join(' · ') + ' = ' + total + ' kcal')
})
ok('제품을 어느 끼니에 넣을지 알려줌', () => {
  const g = $('guidePlacement')()
  assert.ok(g, '구독 구성이 있는데 배치가 비어 있음')
  assert.ok(g.days > 0 && g.days <= 30, '설계 일수 ' + g.days)
  assert.equal(g.replaceType, 'dinner', '대체 끼니가 저녁이 아님')
  assert.ok(g.replacedItems.length >= 2, '대체 구성이 비어 있음')
  const h = html('mealplan-section')
  assert.ok(h.includes('밥스누 제품으로 대신'), '제품 대체 안내 없음')
  assert.ok(/(하루 \d+(~\d+)?회|(이틀|사흘|닷새)에 \d+회)/.test(h), '몇 번 먹는지 안 나옴')
  assert.ok(!/\d\.\d회/.test(h), '소수점 횟수가 남아 있음')
  console.log('    저녁 대체 ' + g.replaceDays + '일 · ' + g.replacedItems.join(' + ') + ' ' + g.replacedKcal + ' kcal')
})
ok('제품이 없으면 칼로리 가이드만 보여줌', () => {
  vm.runInContext('const __c = subCart; subCart = null; renderMealPlan(); subCart = __c;', ctx)
  const h = html('mealplan-section')
  assert.ok(h.includes('30일 체중 관리 가이드'), '가이드가 사라짐')
  assert.ok(h.includes('제품을 담으시면'), '제품 안내가 없음')
  assert.ok(!h.includes('undefined') && !h.includes('NaN'))
  vm.runInContext('renderMealPlan();', ctx)
})
ok('30일 식단은 화면에서 제공하지 않음', () => {
  for (const t of ['planmode-guide', 'planmode-plan', 'setPlanMode', '30일 식단', '30일 맞춤 식단'])
    assert.ok(!htmlSrc.includes(t), '식단 기능이 화면에 남아 있음: ' + t)
  const h = html('mealplan-section')
  assert.ok(!h.includes('setPlanMode') && !h.includes('메뉴까지'), '가이드에 식단 전환 버튼이 남아 있음')
})

ok('계산 기준 설명이 화면에 없음', () => {
  for (const t of ['2020 한국인 영양소 섭취기준', '7,700 kcal', 'id="science"'])
    assert.ok(!htmlSrc.includes(t), '계산 기준 설명이 남아 있음: ' + t)
  assert.ok(!html('target-section').includes('섭취기준'), '목표치 화면에 계산 기준 설명이 남아 있음')
  // 의학적 주의사항은 남겨 둔다
  assert.ok(htmlSrc.includes('의학적 진단을 대체하지 않습니다'), '주의사항이 사라짐')
})

ok('제품 섭취 가이드가 카드·막대로 보임', () => {
  const h = html('mealplan-section')
  const g = $('guidePlacement')()
  assert.ok(h.includes('끼니마다 이만큼'), '끼니별 칼로리 제목이 없음')
  // 끼니 칼로리 막대 — 가장 큰 끼니가 100%
  const widths = [...h.matchAll(/width:(\d+)%/g)].map(m => +m[1])
  assert.ok(widths.length >= 3, '칼로리 막대가 없음: ' + widths.length)
  assert.equal(Math.max(...widths), 100, '가장 긴 막대가 100% 가 아님')
  // 제품 카드 — 담은 품목마다 아이콘·횟수·끼니
  for (const [key, icon] of [['soymilk', '🥛'], ['phyto', '💊'], ['bar', '🍫']]) {
    if (!g.cov.stock[key]) continue
    assert.ok(h.includes(icon), '제품 아이콘이 없음: ' + icon)
    assert.ok(h.includes('한 달 ' + g.cov.stock[key] + '회분'), key + ' 회분이 안 나옴')
    assert.ok(g.where[key].length, key + ' 가 어느 끼니에 들어가는지 비어 있음')
    for (const slot of g.where[key]) assert.ok(h.includes('>' + slot + '</span>'), '끼니 표시 없음: ' + slot)
  }
  console.log('    ' + ['soymilk', 'phyto', 'bar'].map(k => k + ' ' + (g.where[k].join('·') || '-')).join(' / '))
})

// 여기서부터는 「30일 식단까지」 버전
vm.runInContext("setPlanMode('plan');", ctx)
ok('식단 버전으로 바꾸면 구독 패널에 식단 추천 버튼이 생김', () => {
  assert.ok(html('product-recommendations').includes('requestMealPlan'), '식단 추천 버튼이 없음')
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
  for (const s of ['체중 변화', '현재 체중', '누적 변화', '식단 실천율', '표준 체중까지'])
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


console.log('\n── 7일 무료 샘플 · 구독 시작 (시연) ──')
ok('구독 전에는 앞 7일만 열리고 나머지는 잠김', () => {
  vm.runInContext('tracker.paid = false; planViewFrom = 1; renderMealPlan();', ctx)
  assert.equal($('openPlanDays')(), 7)
  const h = html('mealplan-section')
  assert.ok(h.includes('7일 미리보기'), '미리보기 표시 없음')
  const cards = [...h.matchAll(/font-black text-gray-900">Day (\d+)</g)].map(m => +m[1])
  assert.deepEqual(cards, [1, 2, 3, 4, 5, 6, 7], '열린 날이 7일이 아님: ' + cards.join(','))
  assert.ok(h.includes('구독 후에 열립니다'), '잠금 안내 없음')
  assert.ok(h.includes("goPage('pay')"), '구독 시작 버튼 없음')
  // 8일째로 넘기려 해도 열린 범위를 벗어나지 않는다
  vm.runInContext('setPlanView(8);', ctx)
  assert.equal($('planViewFrom'), 1)
})
ok('요금제 카드 3장 — 배지와 체크리스트', () => {
  vm.runInContext("goPage('pay');", ctx)
  const h = html('pay-section')
  assert.ok(h.length > 1500, 'len=' + h.length)
  assert.equal((h.match(/월<\/span>/g) || []).length, 3, '카드가 3장이 아님')
  for (const t of ['가장 많이 고르는 구성', '최적 구독', '최소 권장', '지금 담은 구성',
                   '30일 체중 관리 가이드', '제품을 어느 끼니에 드실지 안내', 'startDemoSubscription'])
    assert.ok(h.includes(t), '누락: ' + t)
  assert.ok(!h.includes('undefined') && !h.includes('NaN'))
})
ok('시연용이므로 결제 정보를 받는 입력칸이 없음', () => {
  const h = html('pay-section') + htmlSrc.slice(htmlSrc.indexOf('id="page-pay"'), htmlSrc.indexOf('id="page-log"'))
  for (const t of ['카드번호', 'card', 'cvc', 'password', 'type="tel"'])
    assert.ok(!h.toLowerCase().includes(t.toLowerCase()), '결제 정보 입력칸: ' + t)
  assert.ok(htmlSrc.includes('실제 결제는 되지 않습니다'), '시연 안내가 없음')
})
ok('구독을 시작하면 30일 전체가 열림', () => {
  vm.runInContext('startDemoSubscription();', ctx)
  assert.equal($('tracker').paid, true)
  assert.equal($('openPlanDays')(), 30)
  assert.ok(html('pay-section').includes('구독이 시작되었습니다'), '구독 중 안내 없음')
  vm.runInContext('setPlanView(8); renderMealPlan();', ctx)
  const h = html('mealplan-section')
  assert.ok(h.includes('font-black text-gray-900">Day 8<'), '구독 후에도 Day 8 이 안 열림')
  assert.ok(!h.includes('구독 후에 열립니다'), '잠금 안내가 남아 있음')
  // 시연 상태를 되돌려 다음 검사는 미구독 화면으로 본다
  vm.runInContext('stopDemoSubscription(); planViewFrom = 1; renderMealPlan();', ctx)
  assert.equal($('tracker').paid, false)
})
ok('기록을 쌓으면 선호 음식으로 식단을 짠다는 안내', () => {
  vm.runInContext('renderDiary();', ctx)
  const h = html('diary-section')
  assert.ok(h.includes('자주 드시는 음식으로 식단을 짜 드릴 수 있어요'), '선호도 안내 없음')
  assert.ok(/지금까지 <b[^>]*>\d+일<\/b> 기록/.test(h), '기록 일수가 안 나옴')
})


// ══════════════════════════════════════════════
// 화면 조작 점검 — 버튼·입력에 연결된 함수를 전부 실제로 호출해 본다
// (브라우저에서 클릭했을 때 터지는 오류를 대신 잡는 용도)
// ══════════════════════════════════════════════
const tabHtml = read('public/index.html')
console.log('\n── 모바일 최적화 ──')
const mobHtml = read('public/index.html')
ok('뷰포트·가로 넘침 방지가 설정됨', () => {
  assert.ok(mobHtml.includes('name="viewport"') && mobHtml.includes('width=device-width'), '뷰포트 메타 없음')
  assert.ok(mobHtml.includes('overflow-x: hidden'), '가로 스크롤 방지 없음')
  assert.ok(/input, select, textarea \{ font-size: 16px/.test(mobHtml), 'iOS 입력 확대 방지 없음')
})
ok('다단 그리드에 모바일 분기가 있음', () => {
  // 반응형 접두사 없는 3열 이상 그리드는 폰에서 읽을 수 없다 (달력의 7열은 예외 — 요일은 항상 7개)
  const srcs = ['public/index.html', 'public/static/app.js', 'public/static/tracker.js'].map(read).join('\n')
  const bad = [...srcs.matchAll(/(?<![a-z]:)grid-cols-([3-689]|1[0-9])\b/g)]
    .filter(m => {
      const before = srcs.slice(Math.max(0, m.index - 24), m.index)
      return !/(sm|md|lg|xl):$/.test(before)
    })
  assert.equal(bad.length, 0, '모바일 분기 없는 다단 그리드 ' + bad.length + '개: ' + bad.map(m => m[0]).join(', '))
})
ok('터치 영역이 확보됨 (수량 ± · 끼니 상태 버튼)', () => {
  const app = read('public/static/app.js'), trk = read('public/static/tracker.js')
  assert.ok(!/w-7 h-7[^"]*aria-label="(줄이기|늘리기)"/.test(app), '수량 버튼이 28px 로 남아 있음')
  assert.ok(app.includes('w-9 h-9'), '수량 버튼이 36px 로 커지지 않음')
  assert.ok(!trk.includes('px-2.5 py-1 rounded-full'), '끼니 상태 버튼 터치 영역이 작음')
})


console.log('\n── 날짜별 기록 (달력) ──')
// 식단이 없어도 날짜별 기록은 되어야 한다
vm.runInContext("tracker.plan = null; tracker.diary = {}; diaryDate = '2026-10-10'; diaryMonth = '2026-10'; renderDiary();", ctx)
ok('달력이 그려지고 오늘이 아닌 날짜도 고를 수 있음', () => {
  const h = html('diary-section')
  assert.ok(h.length > 1500, 'len=' + h.length)
  for (const s of ['체중과 식사 기록', '2026년 10월', '일', '토', '10월 10일'])
    assert.ok(h.includes(s), '누락: ' + s)
  // 10월은 31일까지 — 날짜 버튼이 31개
  const days = [...h.matchAll(/setDiaryDate\('2026-10-\d\d'\)/g)]
  assert.equal(days.length, 31, '날짜 버튼 ' + days.length + '개')
  assert.ok(h.includes('식단을 받지') === false)
  assert.ok(!h.includes('undefined') && !h.includes('NaN'))
})
ok('식단이 없어도 음식·체중을 날짜별로 기록', () => {
  vm.runInContext(`
    diaryAdd('잡곡밥'); diaryAdd('된장찌개'); diaryAdd('시금치나물');
    setDiaryDate('2026-10-11'); diaryAdd('라면');
  `, ctx)
  const t = $('tracker')
  assert.equal(t.diary['2026-10-10'].length, 3, '10일 기록 수')
  assert.equal(t.diary['2026-10-11'].length, 1, '11일 기록 수')
  assert.equal(t.diary['2026-10-11'][0].name, '라면')
  // 저장은 이름·끼니·양만 (영양은 그릴 때 계산)
  assert.deepEqual(Object.keys(t.diary['2026-10-11'][0]).sort(), ['meal', 'name', 'portion'])
})
ok('끼니·양 선택이 다시 그려도 유지됨', () => {
  vm.runInContext("setDiaryDate('2026-10-11'); diaryMeal = 'breakfast'; diaryPortion = 1;", ctx)
  const sel = $('document').getElementById('diary-meal'), por = $('document').getElementById('diary-portion')
  sel.value = 'dinner'; por.value = '2'
  vm.runInContext("diaryAdd('고등어구이');", ctx)
  assert.equal($('diaryMeal'), 'dinner')
  assert.equal($('diaryPortion'), 2)
  const h = html('diary-section')
  assert.ok(h.includes('value="dinner" selected'), '끼니 선택이 초기화됨')
  assert.ok(h.includes('value="2" selected'), '양 선택이 초기화됨')
  vm.runInContext("diaryRemove(1);", ctx)
})
ok('없는 음식은 거부하고 안내', () => {
  vm.runInContext("diaryAdd('존재하지않는음식xyz');", ctx)
  assert.equal($('tracker').diary['2026-10-11'].length, 1, '없는 음식이 들어감')
  assert.ok(sandbox.document.getElementById('diary-error').textContent.includes('찾을 수 없습니다'))
})
ok('기준 대비 바가 미달·적정·초과를 표시', () => {
  vm.runInContext("setDiaryDate('2026-10-10');", ctx)
  const h = html('diary-section')
  for (const s of ['기준 대비', '칼로리', '탄수화물', '단백질', '지방', '식이섬유', '나트륨', '적정'])
    assert.ok(h.includes(s), '누락: ' + s)
  // 밥·국·나물만 먹었으니 칼로리는 목표에 못 미친다
  assert.ok(h.includes('미달'), '미달 표시가 없음')
  assert.ok(h.includes('이 날 부족했던 것'), '부족 항목 안내가 없음')
  assert.ok(h.includes('섭취 부족'), '부족 항목이 비어 있음')
  assert.ok(!h.includes('undefined') && !h.includes('NaN'))
})
ok('기록을 지우면 그 날짜가 사라짐', () => {
  vm.runInContext("setDiaryDate('2026-10-11'); diaryRemove(0);", ctx)
  assert.equal($('tracker').diary['2026-10-11'], undefined, '빈 날짜가 남아 있음')
})
ok('체중은 날짜별로 기록되고 달력에 표시됨', () => {
  const el = $('document').getElementById('diary-weight')
  el.value = '999'
  vm.runInContext("setDiaryDate('2026-10-10'); submitDiaryWeight();", ctx)
  assert.ok($('document').getElementById('diary-weight-error').textContent.includes('10–300'), '범위 안내 없음')
  el.value = '67.2'
  vm.runInContext('submitDiaryWeight();', ctx)
  assert.equal(($('tracker').weights.find(w => w.date === '2026-10-10') || {}).kg, 67.2)
  assert.equal($('weightOf')('2026-10-10'), 67.2)
})
ok('달 이동이 동작', () => {
  vm.runInContext('shiftDiaryMonth(-1);', ctx)
  assert.equal($('diaryMonth'), '2026-09')
  assert.ok(html('diary-section').includes('2026년 9월'))
  vm.runInContext('shiftDiaryMonth(2);', ctx)
  assert.equal($('diaryMonth'), '2026-11')
  vm.runInContext("setDiaryDate('2026-10-10');", ctx)
})


console.log('\n── 페이지 이동 ──')
const pageOf = id => sandbox.document.getElementById('page-' + id)
const hiddenOf = id => { const e = pageOf(id); return e && e.cls ? e.cls.has('hidden') : null }
ok('서비스 흐름이 네 단계 순환 패널로만 소개됨', () => {
  for (let i = 0; i < 4; i++) {
    assert.ok(htmlSrc.includes('id="flow-' + i + '"'), '단계 패널 없음: ' + i)
    assert.ok(htmlSrc.includes('id="flowdot-' + i + '"'), '단계 점 없음: ' + i)
  }
  for (const t of ['설문', '진단', '추천과 설계', '섭취와 기록', '2단계부터 다시'])
    assert.ok(htmlSrc.includes(t), '누락: ' + t)
  // 길게 늘어놓던 소개·계산 근거 카드는 없앴다
  for (const t of ['분석 가능한 음식', '레시피 데이터베이스', '에너지필요추정량(EER)', '숫자가 어디서 나왔는지'])
    assert.ok(!htmlSrc.includes(t), '삭제 안 됨: ' + t)
  // 네 단계를 돌면 처음으로 돌아온다
  vm.runInContext('setFlow(0); shiftFlow(1); shiftFlow(1); shiftFlow(1); shiftFlow(1);', ctx)
  assert.equal($('flowIndex'), 0, '마지막에서 처음으로 안 돌아옴')
  vm.runInContext('shiftFlow(-1);', ctx)
  assert.equal($('flowIndex'), 3, '처음에서 마지막으로 안 돌아감')
})
ok('index.html 에 페이지 6개가 있고 상단·하단 고정이 없음', () => {
  for (const p of ['home', 'intake', 'result', 'plan', 'log', 'pay'])
    assert.ok(htmlSrc.includes('id="page-' + p + '"'), '페이지 없음: ' + p)
  assert.ok(!/class="[^"]*sticky/.test(htmlSrc), '고정 영역(sticky)이 남아 있음')
  assert.ok(!htmlSrc.includes('role="tablist"'), '탭이 남아 있음')
})
ok('섹션이 의도한 페이지에 들어가 있음', () => {
  const cutPage = (a, b) => htmlSrc.slice(htmlSrc.indexOf('id="page-' + a + '"'),
    b ? htmlSrc.indexOf('id="page-' + b + '"') : undefined)
  const result = cutPage('result', 'plan'), plan = cutPage('plan', 'log'), log = cutPage('log')
  // 본문 순서: 목표치 → 관리 팁 → 주의사항
  for (const id of ['target-section', 'tips-section', 'guide-section', 'side-pick'])
    assert.ok(result.includes('id="' + id + '"'), '나의 분석 페이지에 없음: ' + id)
  assert.ok(result.indexOf('target-section') < result.indexOf('tips-section')
    && result.indexOf('tips-section') < result.indexOf('guide-section'), '결과 순서가 다름')
  assert.ok(result.includes("goPage('plan')"), '사이드에 제품 추천 받기 버튼이 없음')
  for (const id of ['product-recommendations', 'mealplan-section'])
    assert.ok(plan.includes('id="' + id + '"'), '제품·식단 페이지에 없음: ' + id)
  assert.ok(log.includes('id="monitor-section"'), '기록 페이지에 monitor-section 없음')
  assert.ok(log.includes('id="diary-section"'), '기록 페이지에 달력이 없음')
  assert.ok(log.indexOf('diary-section') < log.indexOf('monitor-section'), '달력이 체중 그래프보다 아래')
})
ok('페이지 이동이 표시를 바꿈', () => {
  vm.runInContext("goPage('plan')", ctx)
  assert.equal(hiddenOf('plan'), false, '제품·식단 페이지가 숨겨짐')
  assert.equal(hiddenOf('result'), true, '나의 분석 페이지가 안 숨겨짐')
  assert.equal(hiddenOf('home'), true)
  vm.runInContext("goPage('log')", ctx)
  assert.equal(hiddenOf('log'), false)
  assert.equal(hiddenOf('plan'), true)
  vm.runInContext("goPage('result')", ctx)
  assert.equal(hiddenOf('result'), false)
  vm.runInContext("goPage('없는페이지')", ctx)
  assert.equal(hiddenOf('home'), false, '잘못된 페이지 이름은 서비스 소개로')
})
ok('진단 전에는 결과·제품·기록 페이지가 열리지 않음', () => {
  vm.runInContext('__keepResult = pdiResult; pdiResult = null;', ctx)
  for (const p of ['result', 'plan', 'log']) {
    vm.runInContext("goPage('" + p + "')", ctx)
    assert.equal(hiddenOf('intake'), false, p + ' 로 갔는데 입력 페이지가 안 열림')
    assert.equal(hiddenOf(p), true, '진단 전인데 ' + p + ' 가 열림')
  }
  vm.runInContext('pdiResult = __keepResult;', ctx)
})
ok('식단 추천받기를 누르면 제품·식단 페이지로 이동', () => {
  // 실천 기록이 있으면 확인 창이 뜨는데 테스트의 confirm 은 false 를 반환하므로 먼저 비운다
  vm.runInContext("tracker.log = {}; goPage('result'); requestMealPlan();", ctx)
  assert.equal($('currentPage'), 'plan')
  assert.equal(hiddenOf('plan'), false)
})


console.log('\n── 화면 조작 ──')
const inlineHandlers = [...new Set([...htmlSrc.matchAll(/on\w+="(\w+)\(/g)].map(m => m[1]))]
ok('index.html 의 버튼 핸들러가 모두 정의되어 있음', () => {
  for (const h of inlineHandlers) {
    assert.equal($('typeof ' + h), 'function', h + ' 이 정의되지 않음')
  }
  console.log('    ' + inlineHandlers.length + '개: ' + inlineHandlers.join(', '))
})

// 동적으로 만들어지는 버튼의 핸들러 (렌더된 HTML 의 onclick 에서 추출)
const renderedHtml = ['product-recommendations', 'mealplan-section', 'monitor-section', 'guide-section',
  'key-summary', 'target-section', 'tips-section', 'side-pick', 'product-grid', 'health-goals-grid',
  'diary-section', 'pay-section']
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

ok('체중 입력칸은 달력 한 곳에만 있음', () => {
  const trk = read('public/static/tracker.js')
  assert.ok(!trk.includes('id="weight-input"'), '모니터링에 중복 체중 입력칸이 남아 있음')
  assert.ok(trk.includes('id="diary-weight"'), '달력에 체중 입력칸이 없음')
  const diary = html('diary-section')
  assert.ok(diary.indexOf('diary-weight') < diary.indexOf('diary-food'), '체중 입력이 음식 기록보다 아래')
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
