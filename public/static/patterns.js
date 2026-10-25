// ============================================
// 식단 점수 엔진 — 논문에서 쓰이는 식단 점수 + 질환 위험도 근거
//
// 점수 종류와 위험도 수치의 출처:
//   Wang P, Song M, Eliassen AH, et al. Optimal dietary patterns for
//   prevention of chronic disease. Nat Med. 2023;29(3):719-728.
//   미국 간호사·의료인 205,852명을 최장 32년 추적한 자료입니다.
//
// 두 가지를 구분합니다.
//   ① 식단 점수 — 사용자가 기록한 식사로 계산합니다.
//   ② 질환 위험도 — 논문에 실린 고정 수치입니다. 사람마다 다시 계산하지 않습니다.
//      (점수 상위 10%와 하위 10%를 비교한 값)
//
// 점수는 성분별로 「가장 나쁜 값 → 가장 좋은 값」 구간에서 어디쯤인지를
// 0~1로 환산해 평균합니다. 성분 기준값은 각 점수의 원 논문 기준을 따랐습니다.
// 설문을 짧게 쓰려고 점수를 5종으로 줄였습니다. 이 5종은 문항을 서로 나눠 쓰기
// 때문에 17문항으로 전부 계산됩니다. 가중치 방식 2종(rEDIH·rEDIP)은 전용 문항이
// 10개나 필요해서 뺐습니다 — 되살리려면 그 문항들을 설문에 다시 넣어야 합니다.
// 아직 빼 둔 성분은 지방산 세부 조성(AHEI·AMED·DRRD)과 혈당지수(DRRD)뿐이고,
// PATTERN_DEFS[].missing 에 적어 화면에 그대로 표시합니다.
// ============================================

// ── 1회 섭취량(g) ─────────────────────────────
// 1회분 정의는 각 논문의 식품군 각주를 따랐습니다
// (EDIH: Br J Nutr 2016 Table 1 각주 · EDIP: J Nutr 2016 Table 1 각주)
const PT_SERVING_G = {
  veg: 70, fruit: 100, juice: 240, refinedGrain: 90, potato: 100,
  nuts: 28, legumes: 80, redMeat: 100, processedMeat: 45, fish: 100,
  poultry: 100, egg: 50, dairyLow: 200, dairyHigh: 200, ssb: 240,
  coffeeTea: 240, sweets: 50, vegOil: 14, animalFat: 14, alcohol: 100,
};

// ── 식재료 이름 → 성분 분류 ───────────────────
// 식재료 DB의 cat 은 12종뿐이고 'refined' 에 달걀·우유·과자·술이 섞여 있어
// 이름 규칙을 먼저 보고, 규칙에 걸리지 않으면 cat 으로 넘깁니다.
const PT_NAME_RULES = [
  ['processedMeat', ['소시지', '햄', '베이컨', '스팸', '런천', '살라미', '핫도그', '프랑크', '육포', '훈제오리', '어묵', '맛살', '크래미', '게맛살']],
  ['poultry',       ['닭', '오리', '칠면조', '메추리고기']],
  ['redMeat',       ['소고기', '쇠고기', '돼지고기', '삼겹', '목살', '등심', '안심', '갈비', '사태', '우둔', '설도', '차돌', '양지', '육우', '한우', '양고기', '곱창', '막창', '족발', '보쌈', '돈육', '우육']],
  ['fish',          ['고등어', '참치', '연어', '명태', '갈치', '조기', '꽁치', '삼치', '가자미', '넙치', '멸치', '오징어', '낙지', '문어', '새우', '꽃게', '대게', '조개', '바지락', '홍합', '전복', '해삼', '미꾸라지', '장어', '붕어', '잉어', '동태', '북어', '황태', '쥐포', '우럭', '도미', '농어', '방어', '전갱이', '멍게', '성게', '소라', '골뱅이', '주꾸미', '쭈꾸미', '가리비', '키조개', '대구', '아귀', '병어', '민어', '숭어', '홍어', '가오리', '다랑어', '날치', '빙어', '뱅어', '청어', '정어리', '학꽁치']],
  ['egg',           ['달걀', '계란', '메추리알', '난황', '난백']],
  ['ssb',           ['콜라', '사이다', '탄산', '에이드', '이온음료', '식혜', '액상요구르트', '유산균음료', '밀크티', '에너지음료']],
  ['juice',         ['주스', '넥타']],
  ['coffeeTea',     ['커피', '녹차', '홍차', '우롱', '보리차', '옥수수수염차', '둥굴레', '메밀차', '현미차', '티백', '에스프레소', '아메리카노']],
  ['sweets',        ['초콜릿', '아이스크림', '과자', '비스킷', '쿠키', '케이크', '도넛', '파이', '사탕', '캔디', '젤리', '약과', '한과', '카스테라', '머핀', '와플', '호떡', '시럽', '설탕', '물엿', '올리고당', '꿀', '잼', '연유', '초코', '빙과', '푸딩']],
  ['alcohol',       ['맥주', '소주', '와인', '막걸리', '청주', '위스키', '사케', '고량주', '보드카', '브랜디', '매실주', '복분자주']],
  ['dairyLow',      ['저지방우유', '무지방우유', '탈지분유', '플레인요구르트', '요구르트(플레인', '호상요구르트(플레인']],
  ['dairyHigh',     ['우유', '치즈', '버터', '생크림', '휘핑', '요구르트', '요거트', '분유', '사워크림']],
  ['wholeGrain',    ['현미', '귀리', '보리', '수수', '기장', '메밀', '통밀', '흑미', '퀴노아', '호밀', '율무', '차조', '발아', '오트', '통곡']],
  ['potato',        ['감자', '고구마', '토란', '야콘']],
  ['vegOil',        ['식용유', '올리브유', '참기름', '들기름', '포도씨유', '카놀라', '해바라기유', '콩기름', '옥수수기름', '아보카도오일', '유채유', '팜유', '쌀기름']],
  ['animalFat',     ['라드', '우지', '돈지', '마가린', '쇼트닝']],
];

// cat 기본 매핑 (이름 규칙에 걸리지 않은 식재료)
const PT_CAT_FALLBACK = {
  vegetables: 'veg', fruits: 'fruit', grains: 'refinedGrain', legumes: 'legumes',
  nuts: 'nuts', dairy: 'dairyHigh', protein: 'fish', tea: 'coffeeTea',
  oils: 'vegOil', refined: 'other', spices: 'other', bobsnu: 'legumes',
};

// 밥스누 제품은 cat 이 모두 'bobsnu' 라 제품명으로 성분을 지정합니다.
// 여기에 없는 제품은 약콩이 원료이므로 콩(legumes)으로 봅니다.
const PT_PRODUCT_COMP = {
  '약콩차': 'coffeeTea',
  '파이토100': 'other', '파이토100 시즌2': 'other', '파이토블랙': 'other',
};

// 밥스누 제품 1회 제공량(g) — pfs.js 영양성분표에 등록된 값
function ptProductWeight(name) {
  const n = typeof PFS_BOBSNU_NUTRITION !== 'undefined' ? PFS_BOBSNU_NUTRITION[name] : null;
  return (n && n.weight) || 0;
}

function ptClassify(name, cat) {
  if (PT_PRODUCT_COMP[name]) return PT_PRODUCT_COMP[name];
  for (const [comp, words] of PT_NAME_RULES) {
    for (const w of words) if (name.includes(w)) return comp;
  }
  return PT_CAT_FALLBACK[cat] || 'other';
}

// ── 성분별 섭취량 ─────────────────────────────
//   meals    : 대표 음식으로 만든 1일 식단 — 나트륨·식이섬유·트랜스지방·칼로리에 씁니다
//   servings : 설문 응답에서 만든 { 성분: 1일 회분 } — 있으면 식품군은 이 값을 그대로 씁니다
//              (설문이 이미 식품군 단위로 묻기 때문에 대표 음식으로 다시 환산하지 않습니다)
//   출력: { serv:{성분: 1회분 수}, grams:{성분: 그램}, sodium, fiber, trans, energy }
function ptComponents(meals, servings) {
  const grams = {};
  for (const k of Object.keys(PT_SERVING_G)) grams[k] = 0;
  grams.wholeGrain = 0; grams.alcohol = 0; grams.other = 0;

  for (const m of meals || []) {
    const ings = (m.analysis && m.analysis.ingredients) || [];
    for (const ing of ings) {
      // 밥스누 제품은 grams 가 '1회' 로 들어오므로 제품 1회 제공량(g)으로 바꿉니다
      const g = typeof ing.grams === 'number' ? ing.grams : ptProductWeight(ing.name);
      if (!(g > 0)) continue;
      grams[ptClassify(ing.name, ing.cat)] += g;
    }
  }

  const serv = {};
  if (servings) {
    for (const k of Object.keys(grams)) serv[k] = 0;
    Object.assign(serv, servings);      // 설문 응답을 그대로
  } else {
    for (const [k, v] of Object.entries(grams)) serv[k] = v / (PT_SERVING_G[k] || 100);
    // 통곡물은 AHEI·DASH 가 그램으로 기준을 정하므로 그램 값을 그대로 씁니다
    serv.wholeGrain = grams.wholeGrain;
  }

  // 묶음 성분
  const sv = (k) => serv[k] || 0;
  serv.nutsLegumes    = sv('nuts') + sv('legumes');
  serv.redProcMeat    = sv('redMeat') + sv('processedMeat');
  serv.ssbAll         = sv('ssb') + sv('juice');
  serv.healthyPlant   = sv('fruit') + sv('veg') + sv('nuts') + sv('legumes')
                      + sv('vegOil') + sv('coffeeTea') + grams.wholeGrain / 90;
  serv.unhealthyPlant = sv('juice') + sv('refinedGrain') + sv('potato')
                      + sv('ssb') + sv('sweets');
  serv.animalFood     = sv('redMeat') + sv('processedMeat') + sv('poultry')
                      + sv('fish') + sv('egg') + sv('dairyLow') + sv('dairyHigh')
                      + sv('animalFat');

  // 영양소는 pfs.js 추정값을 그대로 사용합니다
  let sodium = 0, fiber = 0, trans = 0, energy = 0;
  for (const m of meals || []) {
    if (!m.analysis) continue;
    const n = estimateDishNutrients(m.analysis);
    sodium += n.sodium || 0; fiber += n.fiber || 0;
    trans  += n.trans  || 0; energy += n.energy || 0;
  }
  serv.sodium = sodium;
  serv.fiber  = fiber;
  // 트랜스지방은 섭취 열량 대비 비율(%)로 봅니다
  serv.transPctE = energy > 0 ? (trans * 9 / energy) * 100 : 0;

  return { serv, grams, sodium, fiber, trans, energy };
}

// ── 음주 환산 ─────────────────────────────────
// AHEI-2010 은 적정 음주를 만점, 금주를 10점 중 2.5점, 과음을 0점으로 봅니다.
// 권장이 아니라 논문 기준 그대로입니다 — 개선 제안에서는 이 항목을 빼 둡니다.
function ptAlcoholAHEI(drinks, gender) {
  const lo = 0.5;
  const hi   = gender === 'male' ? 2.0 : 1.5;
  const zero = gender === 'male' ? 3.5 : 2.5;
  if (!(drinks > 0)) return 0.25;
  if (drinks < lo) return 0.25 + (drinks / lo) * 0.75;
  if (drinks <= hi) return 1;
  return Math.max(0, (zero - drinks) / (zero - hi));
}

// 지중해식 점수는 적정 구간이면 1점, 벗어나면 0점입니다 (여 5–15g, 남 10–25g/일)
// 한 잔 = 순알코올 14g 으로 환산합니다.
function ptAlcoholAMED(drinks, gender) {
  const g = (drinks || 0) * 14;
  return (gender === 'male' ? (g >= 10 && g <= 25) : (g >= 5 && g <= 15)) ? 1 : 0;
}

// ── 점수 정의 ─────────────────────────────────
//   range: [가장 나쁜 값, 가장 좋은 값] — 그 사이를 0~1로 환산합니다
const PATTERN_DEFS = [
  {
    key: 'AHEI-2010', name: '건강 식생활 지수', full: 'Alternative Healthy Eating Index-2010',
    comps: [
      { c: 'veg',         label: '채소',             unit: '접시', range: [0, 5] },
      { c: 'fruit',       label: '과일',             unit: '회',   range: [0, 4] },
      { c: 'wholeGrain',  label: '통곡물',           unit: 'g',    range: [0, 90] },
      { c: 'nutsLegumes', label: '견과·콩',          unit: '회',   range: [0, 1] },
      { c: 'fish',        label: '생선',             unit: '회',   range: [0, 0.5] },
      { c: 'ssbAll',      label: '가당음료·주스',     unit: '잔',   range: [1, 0] },
      { c: 'redProcMeat', label: '붉은 고기·가공육',  unit: '회',   range: [1.5, 0] },
      { c: 'sodium',      label: '나트륨',           unit: 'mg',   range: [4000, 1500] },
      { c: 'transPctE',   label: '트랜스지방',        unit: '%',    range: [4, 0.5] },
      { c: 'alcohol',     label: '음주(논문은 하루 1잔 전후를 만점으로 봅니다)',
        unit: '잔', range: [0, 1], score: ptAlcoholAHEI },
    ],
    missing: ['불포화지방 비율'],
  },
  {
    key: 'DASH', name: '혈압 관리 식단 점수', full: 'Dietary Approaches to Stop Hypertension',
    comps: [
      { c: 'fruit',       label: '과일',             unit: '회',   range: [0, 4] },
      { c: 'veg',         label: '채소',             unit: '접시', range: [0, 5] },
      { c: 'nutsLegumes', label: '견과·콩',          unit: '회',   range: [0, 1] },
      { c: 'dairyLow',    label: '저지방 유제품',     unit: '회',   range: [0, 2] },
      { c: 'wholeGrain',  label: '통곡물',           unit: 'g',    range: [0, 90] },
      { c: 'sodium',      label: '나트륨',           unit: 'mg',   range: [4000, 1500] },
      { c: 'redProcMeat', label: '붉은 고기·가공육',  unit: '회',   range: [1.5, 0] },
      { c: 'ssbAll',      label: '가당음료·주스',     unit: '잔',   range: [1, 0] },
    ],
    missing: [],
  },
  {
    key: 'hPDI', name: '건강한 식물성 식단 지수', full: 'Healthful Plant-based Diet Index',
    comps: [
      { c: 'healthyPlant',   label: '몸에 좋은 식물성 식품', unit: '회', range: [0, 8] },
      { c: 'unhealthyPlant', label: '정제·가공 식물성 식품', unit: '회', range: [5, 0] },
      { c: 'animalFood',     label: '동물성 식품',          unit: '회', range: [5, 0] },
    ],
    missing: [],
  },
  {
    key: 'AMED', name: '지중해식 식단 점수', full: 'Alternate Mediterranean Diet score',
    comps: [
      { c: 'veg',         label: '채소',             unit: '접시', range: [0, 5] },
      { c: 'fruit',       label: '과일',             unit: '회',   range: [0, 3] },
      { c: 'nuts',        label: '견과',             unit: '회',   range: [0, 1] },
      { c: 'legumes',     label: '콩류',             unit: '회',   range: [0, 1] },
      { c: 'wholeGrain',  label: '통곡물',           unit: 'g',    range: [0, 90] },
      { c: 'fish',        label: '생선',             unit: '회',   range: [0, 0.5] },
      { c: 'redProcMeat', label: '붉은 고기·가공육',  unit: '회',   range: [1.5, 0] },
      { c: 'alcohol',     label: '음주(논문 기준 하루 1잔 전후)',
        unit: '잔', range: [0, 1], score: ptAlcoholAMED },
    ],
    missing: ['단일불포화지방 대 포화지방 비율'],
  },
  {
    key: 'DRRD', name: '당뇨 위험 감소 식단', full: 'Diabetes Risk Reduction Diet',
    comps: [
      { c: 'fiber',       label: '식이섬유',          unit: 'g',    range: [10, 25] },
      { c: 'coffeeTea',   label: '커피·차',           unit: '잔',   range: [0, 2] },
      { c: 'nuts',        label: '견과',             unit: '회',   range: [0, 1] },
      { c: 'fruit',       label: '과일',             unit: '회',   range: [0, 2] },
      { c: 'ssbAll',      label: '가당음료·주스',     unit: '잔',   range: [1, 0] },
      { c: 'redProcMeat', label: '붉은 고기·가공육',  unit: '회',   range: [1.5, 0] },
      { c: 'transPctE',   label: '트랜스지방',        unit: '%',    range: [4, 0.5] },
    ],
    missing: ['불포화지방 대 포화지방 비율', '혈당지수'],
  },
];

// 계산에 필요한 자료가 없어 점수를 내지 않는 종류
const PATTERN_PENDING = {
  'WCRF/AICR': { name: '암 예방 권고 점수', need: '패스트푸드·음주 기록 필요' },
};

// 점수를 보여주기 위한 최소 기록량 (하루 섭취 열량)
const PT_MIN_KCAL = 500;

// 점수 띠의 구역 — 경계는 NutriSage disease_risk.py 와 같은 0.4 / 0.6
const PT_TIER = [
  { max: 0.4,      key: 'low',  label: '위험', color: '#C0392B', tint: '#F4D7D2' },
  { max: 0.6,      key: 'mid',  label: '보통', color: '#B7950B', tint: '#F8EBC8' },
  { max: Infinity, key: 'high', label: '안전', color: '#1E8449', tint: '#D5E9DA' },
];

function ptTier(position) {
  return PT_TIER.find(t => position < t.max) || PT_TIER[PT_TIER.length - 1];
}

// 성분들의 0~1 값을 가중 평균합니다 (c.w 가 없으면 1 — 범위 방식 점수)
function ptPosition(comps) {
  let num = 0, den = 0;
  for (const c of comps) { const w = c.w == null ? 1 : c.w; num += w * c.sub; den += w; }
  return den > 0 ? num / den : 0;
}

// 성분 하나를 0~1로 환산 (NutriSage tasks.py directional_score 와 같은 방식)
function ptDirectional(value, worst, best) {
  if (worst === best) return 0.5;
  return Math.max(0, Math.min(1, (value - worst) / (best - worst)));
}

// ── 점수 계산 ─────────────────────────────────
//   반환: { patterns:[{key,name,position,score,tier,comps[]}], pending, components }
function scoreDietPatterns(meals, servings, gender) {
  const components = ptComponents(meals, servings);
  const patterns = PATTERN_DEFS.map(def => {
    const comps = def.comps.map(c => {
      const value = components.serv[c.c] || 0;
      return { ...c, value,
               sub: c.score ? c.score(value, gender) : ptDirectional(value, c.range[0], c.range[1]),
               target: c.range[1], good: c.range[1] > c.range[0] };
    });
    const position = ptPosition(comps);
    return {
      key: def.key, name: def.name, full: def.full, missing: def.missing,
      position, score: Math.round(position * 100), tier: ptTier(position), comps,
    };
  });
  // 하루치가 안 되는 기록은 점수를 내지 않습니다.
  // 「줄여야 하는 항목」은 아무것도 안 먹어도 만점이 나와서, 기록이 적으면
  // 점수가 실제보다 높게 보이기 때문입니다.
  return {
    patterns, pending: PATTERN_PENDING, components,
    insufficient: components.energy < PT_MIN_KCAL,
  };
}

// ── 식단 개선 제안 ────────────────────────────
//   모든 점수에서 가장 많이 깎인 성분부터, 기준값까지 맞췄을 때
//   점수가 몇 점 오르는지 함께 돌려줍니다.
const PT_FOOD_HINTS = {
  veg:            '나물·샐러드 같은 채소 반찬을 한 접시 더',
  fruit:          '사과·배 같은 생과일 한 쪽',
  wholeGrain:     '흰쌀밥을 잡곡밥·현미밥으로',
  nutsLegumes:    '두부·콩자반·견과 한 줌',
  nuts:           '아몬드·호두 한 줌(약 28g)',
  legumes:        '두부·콩조림 한 접시',
  fish:           '고등어·연어 같은 생선 반찬',
  dairyLow:       '저지방 우유·플레인 요구르트 한 컵',
  coffeeTea:      '설탕 없는 커피·차 한 잔',
  fiber:          '잡곡·채소·콩으로 식이섬유 늘리기',
  ssbAll:         '가당음료·주스를 물이나 차로',
  redProcMeat:    '붉은 고기·가공육을 생선·두부로',
  sodium:         '국물·젓갈·장류를 덜 짜게',
  transPctE:      '튀김·마가린 들어간 가공식품 줄이기',
  healthyPlant:   '채소·과일·통곡물·콩을 늘리기',
  unhealthyPlant: '정제곡물·과자·가당음료 줄이기',
  animalFood:     '고기·유제품 비중 줄이기',
};

// 성분 → 밥스누 제품 제안 [제품명, 실행 문구]
//   제품이 그 성분을 실제로 채우는 경우만 넣습니다.
//   채소·과일·통곡물처럼 제품으로 대신할 수 없는 항목은 비워 둡니다.
const PT_PRODUCT_SUGGEST = {
  legumes:        ['약콩 두유', '두유 한 팩이 콩 1회분'],
  nutsLegumes:    ['약콩 두유', '두유 한 팩 또는 약콩 프로틴바 한 개'],
  healthyPlant:   ['약콩 두유', '간식·음료를 두유로 바꾸기'],
  animalFood:     ['약콩 두유', '우유 한 컵을 두유 한 팩으로'],
  redProcMeat:    ['약콩 프로틴바', '고기 반찬 한 번을 프로틴바·고단백 두유로'],
  sweets:         ['약콩 프로틴바', '단 간식을 프로틴바로'],
  unhealthyPlant: ['약콩 프로틴바', '과자·흰빵 간식을 프로틴바로'],
  fiber:          ['약콩 프로틴바', '한 개에 식이섬유 3 g'],
  ssbAll:         ['더 건강한 약콩차', '가당음료·주스를 약콩차로'],
  coffeeTea:      ['더 건강한 약콩차', '설탕 없는 약콩차 한 잔'],
};

// 「몸에 좋은 식물성 식품」처럼 여러 식품군을 합친 항목은 제안에서 뺍니다.
// 기준값이 「동물성 식품 0회」라서 그대로 보여주면 실천할 수 없는 말이 됩니다.
const PT_ADVICE_SKIP = ['healthyPlant', 'unhealthyPlant', 'animalFood', 'alcohol'];

function dietAdvice(scored, limit) {
  // 성분별로 깎인 점수를 모읍니다 (여러 점수에서 깎인 성분이 위로 올라옵니다)
  const loss = {};
  for (const p of scored.patterns) {
    for (const c of p.comps) {
      if (!loss[c.c]) loss[c.c] = { c: c.c, label: c.label, unit: c.unit,
        value: c.value, target: c.target, good: c.good, lost: 0, patterns: [] };
      loss[c.c].lost += (1 - c.sub) / p.comps.length;
      if (c.sub < 0.95) loss[c.c].patterns.push(p.key);
    }
  }

  const rounded = (v) => Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  const before = scored.patterns.map(p => p.score);

  // 깎인 순서대로 고르고, 그 안에 밥스누 제품으로 채울 항목이 없으면
  // 제품으로 채울 수 있는 항목 중 가장 많이 깎인 것을 하나 더 붙입니다.
  const ranked = Object.values(loss)
    .filter(x => x.lost > 0.01 && x.patterns.length && !PT_ADVICE_SKIP.includes(x.c))
    .sort((a, b) => b.lost - a.lost);
  const picked = ranked.slice(0, limit || 3);
  if (!picked.some(x => PT_PRODUCT_SUGGEST[x.c])) {
    const extra = ranked.find(x => PT_PRODUCT_SUGGEST[x.c]);
    if (extra) picked.push(extra);
  }

  return picked
    .map(x => {
      // 이 성분만 기준값까지 맞췄을 때 점수가 얼마나 오르는지
      const after = scored.patterns.map(p => {
        const comps = p.comps.map(c => c.c === x.c
          ? { ...c, sub: ptDirectional(x.target, c.range[0], c.range[1]) } : c);
        return Math.round(ptPosition(comps) * 100);
      });
      return {
        comp: x.c, label: x.label, unit: x.unit,
        now: rounded(x.value), target: rounded(x.target),
        direction: x.good ? 'up' : 'down',
        hint: PT_FOOD_HINTS[x.c] || '',
        product: PT_PRODUCT_SUGGEST[x.c] || null,
        affects: [...new Set(x.patterns)],
        gain: Math.max(...after.map((v, i) => v - before[i])),
      };
    });
}

// ══════════════════════════════════════════════
// 화면 그리기
// ══════════════════════════════════════════════
let ptScored = null;        // 마지막 계산 결과

// ── 질환 위험비 (Wang P 외. Nat Med 2023;29:719-728 Table 2, 다변량 보정) ──
// 점수 상위 10%와 하위 10%를 비교한 위험비입니다. 사람마다 다시 계산하는 값이
// 아니고, 「이 점수가 그 질환과 얼마나 강하게 묶이는지」의 세기로만 씁니다.
const PT_DISEASE_HR = {
  'AHEI-2010': { cvd: 0.77, diabetes: 0.62, cancer: 0.94 },
  'DASH':      { cvd: 0.81, diabetes: 0.66, cancer: 0.94 },
  'hPDI':      { cvd: 0.84, diabetes: 0.70, cancer: 0.94 },
  'AMED':      { cvd: 0.80, diabetes: 0.71, cancer: 0.92 },
  'DRRD':      { cvd: 0.73, diabetes: 0.56, cancer: 0.92 },
};

// ── 논문 집단의 점수 분포 (같은 논문 Table 1) ──────
// 1분위 중앙값이 곧 10백분위, 5분위 중앙값이 곧 90백분위입니다.
// min·max 는 Methods 에 적힌 성분 수 × 성분별 배점입니다.
//   AHEI-2010 11성분 × 0~10점 · AMED 9성분 × 0~1점
//   hPDI 18군 × 1~5점 · DASH 8성분 × 1~5점 · DRRD 9성분 × 1~5점
// 이 분포로 우리 0~1 축을 논문 축에 맞춥니다. 한국인 분포가 아니라
// 미국 간호사·의료인 20만 5천여 명의 분포이고, 화면에도 그렇게 적습니다.
const PT_PAPER_SCORE = {
  'AHEI-2010': { p10: 39.0, p90: 65.0, min: 0,  max: 110 },
  'DASH':      { p10: 17.9, p90: 29.1, min: 8,  max: 40  },
  'hPDI':      { p10: 47.2, p90: 62.5, min: 18, max: 90  },
  'AMED':      { p10: 2.3,  p90: 6.4,  min: 0,  max: 9   },
  'DRRD':      { p10: 20.6, p90: 33.4, min: 9,  max: 45  },
};

// 내 점수 위치를 「논문 10백분위 = 0, 90백분위 = 1」 축으로 옮깁니다.
// 논문이 보고한 구간 밖은 양 끝에 붙입니다 — 관측하지 않은 범위로는 늘리지 않습니다.
function ptPaperPos(key, position) {
  const b = PT_PAPER_SCORE[key];
  if (!b) return position;
  const span = b.max - b.min;
  const lo = (b.p10 - b.min) / span, hi = (b.p90 - b.min) / span;
  return Math.max(0, Math.min(1, (position - lo) / (hi - lo)));
}

const PT_DISEASE_LABELS = [
  { key: 'cvd',      name: '심혈관질환',    note: '심근경색·뇌졸중 등' },
  { key: 'diabetes', name: '2형당뇨',       note: '' },
  { key: 'cancer',   name: '암 전체',       note: '' },
];

// ── 질환별 등급과 내 위험비 ───────────────────
// 질환마다 관련이 깊은 점수에 더 큰 몫을 줘서 묶습니다.
//   가중치  w = |ln(위험비)| — 위험비가 1.0 에서 멀수록 큰 값입니다.
//   내 위치 P = Σ(w · 논문축 위치) ÷ Σw        (ptPaperPos 로 옮긴 위치)
//   묶은 위험비 HR = exp( Σ(w·ln 위험비) ÷ Σw )   (가중 기하평균)
//   내 위험비    = HR^P
//     P = 0 이면 1.00(논문 하위 10% 집단), P = 1 이면 논문의 상위 10% 값입니다.
//     논문이 관측한 구간 안에만 머물러서, 1.00 을 넘거나 HR 아래로는 가지 않습니다.
//
// ※ 가정 하나가 들어갑니다 — 구간 안에서 점수와 위험이 로그 직선 관계라고 봅니다.
//   논문은 상위 10%와 하위 10%만 비교해 보고했고, 그 사이는 보고하지 않았습니다.
//   화면에도 이 가정을 적습니다. 진단이나 발병 확률이 아닙니다.
//
// ※ 기준 집단이 한국인이 아닙니다. 논문 집단(미국 간호사·의료인)의 점수 분포를
//   그대로 썼습니다. 한국인 분포 자료가 모이면 PT_PAPER_SCORE 만 바꾸면 됩니다.
function diseaseGrades(scored) {
  const out = [];
  for (const d of PT_DISEASE_LABELS) {
    let sumW = 0, sumP = 0, sumLn = 0, strongest = null;
    for (const p of scored.patterns) {
      const hr = (PT_DISEASE_HR[p.key] || {})[d.key];
      if (!hr) continue;
      const w = Math.abs(Math.log(hr));
      sumW += w; sumP += w * ptPaperPos(p.key, p.position); sumLn += w * Math.log(hr);
      if (!strongest || hr < strongest.hr) strongest = { hr, name: p.name, key: p.key };
    }
    if (!sumW) continue;
    const position = sumP / sumW;
    const groupHr = Math.exp(sumLn / sumW);
    const myHr = Math.pow(groupHr, position);
    out.push({ ...d, position, score: Math.round(position * 100), tier: ptTier(position),
               groupHr, myHr, pct: Math.round((1 - myHr) * 100), strongest });
  }
  return out;
}

// ── 합산 결과 ────────────────────────────────
// 점수 5종의 평균 위치 — 제품 추천의 등급 축에 씁니다.
function ptOverall(scored) {
  const ps = scored.patterns;
  if (!ps.length) return null;
  const position = ps.reduce((a, p) => a + p.position, 0) / ps.length;
  return { position, score: Math.round(position * 100), tier: ptTier(position) };
}

// ── 점수 막대 ────────────────────────────────
// 점수 띠 — 위험·보통·안전 구역을 색으로 나누고 내 점수 위치를 찍습니다
function ptScoreBar(score, color) {
  let from = 0;
  const zones = PT_TIER.map(t => {
    const to = t.max === Infinity ? 100 : t.max * 100;
    const z = { label: t.label, tint: t.tint, w: to - from };
    from = to;
    return z;
  });
  const pos = Math.max(0, Math.min(100, score));
  const align = i => i === 0 ? 'left' : (i === zones.length - 1 ? 'right' : 'center');
  return '<div class="flex h-3 rounded-full overflow-hidden relative">'
    + zones.map(z => '<div style="width:' + z.w + '%;background:' + z.tint + '"></div>').join('')
    + '<div class="absolute top-0 bottom-0" style="left:' + pos + '%;transform:translateX(-50%);'
    + 'width:4px;border-radius:2px;background:' + color + ';box-shadow:0 0 0 2px #fff"></div>'
    + '</div>'
    + '<div class="flex mt-1 text-[10px] font-bold text-gray-400">'
    + zones.map((z, i) => '<span style="width:' + z.w + '%;text-align:' + align(i) + '">' + z.label + '</span>').join('')
    + '</div>';
}

// ── 결과 화면의 「식단 점수」 영역 ────────────
function renderDietScore(meals, servings, gender) {
  const el = document.getElementById('diet-score-section');
  if (!el) return;
  if (meals) ptScored = scoreDietPatterns(meals, servings, gender);
  if (!ptScored) { el.innerHTML = ''; return; }

  if (ptScored.insufficient) {
    el.innerHTML =
      '<h3 class="text-xl font-bold text-gray-900 mb-1">식단 점수</h3>'
      + '<p class="text-gray-500 text-sm mb-4">여러 연구에서 쓰이는 식단 평가 방법으로 채점해 드립니다</p>'
      + '<div class="rounded-2xl p-4 text-sm" style="background:var(--tint);color:var(--deep)">'
      + '하루 먹은 것을 더 기록해 주세요. 지금 기록만으로는 점수가 실제보다 높게 나옵니다.</div>';
    return;
  }

  const s = ptScored;
  const tips = dietAdvice(s, 3);
  const diseases = diseaseGrades(s);

  // ① 점수 카드
  const cards = s.patterns.map(p =>
    '<div class="rounded-2xl border p-4" style="border-color:var(--line)">'
    + '<div class="flex items-baseline justify-between mb-1">'
    + '<span class="text-sm font-bold text-gray-800">' + p.name + '</span>'
    + '<span class="text-2xl font-black" style="color:' + p.tier.color + '">' + p.score + '</span></div>'
    + '<div class="text-xs text-gray-400 mb-2">' + p.key + ' · ' + p.tier.label + '</div>'
    + ptScoreBar(p.score, p.tier.color)
    + (p.missing.length
        ? '<div class="text-xs text-gray-400 mt-2">기록으로 알 수 없어 뺀 항목: ' + p.missing.join(', ') + '</div>'
        : '')
    + '</div>').join('');

  // ② 질환별 등급 카드
  const diseaseCards = diseases.map(d =>
    '<div class="rounded-2xl border p-4" style="border-color:var(--line)">'
    + '<div class="flex items-baseline justify-between mb-1">'
    + '<span class="text-sm font-bold text-gray-800">' + d.name + '</span>'
    + '<span class="text-xl font-black" style="color:' + d.tier.color + '">' + d.tier.label + '</span></div>'
    + '<div class="text-xs text-gray-400 mb-2">' + (d.note || '&nbsp;') + '</div>'
    + ptScoreBar(d.score, d.tier.color)
    + '<div class="flex items-baseline justify-between mt-3">'
    + '<span class="text-xs text-gray-500">내 위험비</span>'
    + '<span class="text-sm font-bold" style="color:' + d.tier.color + '">' + d.myHr.toFixed(2)
    + ' <span class="font-normal text-gray-500">'
    + (d.pct > 0 ? '(' + d.pct + '% 낮음)' : '(차이 없음)') + '</span></span>'
    + '</div>'
    + '<div class="text-xs text-gray-400 mt-1">하위 10% 집단이 1.00, 상위 10% 집단이 '
    + d.groupHr.toFixed(2) + ' · 가장 크게 반영한 점수 ' + d.strongest.name + '</div>'
    + '</div>').join('');

  // ③ 개선 제안
  const tipCards = tips.map(t =>
    '<div class="rounded-2xl p-4" style="background:var(--tint)">'
    + '<div class="flex items-center justify-between gap-2 mb-1">'
    + '<span class="text-sm font-bold" style="color:var(--deep)">' + t.label + '</span>'
    + '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-white" style="color:var(--deep)">최대 +' + t.gain + '점</span></div>'
    + '<div class="text-lg font-black text-gray-900">' + t.now + ' <span class="text-sm font-bold text-gray-400">→ '
    + t.target + t.unit + ' ' + (t.direction === 'up' ? '늘리기' : '줄이기') + '</span></div>'
    + '<div class="text-xs text-gray-600 mt-1">' + t.hint + '</div>'
    + (t.product
        ? '<div class="text-xs font-bold mt-2 px-2 py-1 rounded-lg bg-white">'
          + '<span style="color:var(--deep)">밥스누 ' + t.product[0] + '</span>'
          + ' <span class="font-normal text-gray-500">' + t.product[1] + '</span></div>'
        : '')
    + '</div>').join('');

  el.innerHTML =
    '<h3 class="text-xl font-bold text-gray-900 mb-1">식단 점수</h3>'
    + '<p class="text-gray-500 text-sm mb-5">여러 연구에서 쓰이는 식단 평가 방법으로 채점했습니다. 띠에서 내 위치가 왼쪽이면 위험, 오른쪽이면 안전입니다</p>'
    + '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">' + cards + '</div>'

    + '<h3 class="text-xl font-bold text-gray-900 mb-1">질환별 등급</h3>'
    + '<p class="text-gray-500 text-sm mb-3">논문 집단의 점수 분포에서 내가 어디인지로 냈습니다. '
    + '하위 10% 집단이 1.00 이고, 낮을수록 그 질환이 적었던 쪽입니다</p>'
    + '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">' + diseaseCards + '</div>'
    + '<div class="rounded-2xl p-4 text-xs mb-8" style="background:var(--tint);color:var(--deep)">'
    + '<b>기준 집단이 한국인이 아닙니다.</b> 내 점수가 어디쯤인지는 '
    + '논문이 조사한 집단(미국 간호사·의료인 20만 5천여 명)의 점수 분포에 맞춰 계산했습니다. '
    + '한국인 분포로 보면 위치가 달라질 수 있습니다.'
    + '<br><br><b>가정 하나가 들어갑니다.</b> 근거 논문(Wang P 외. Nat Med. 2023;29:719–728)은 '
    + '점수 상위 10%가 하위 10%보다 그 질환이 얼마나 적었는지만 보고했고 그 사이는 보고하지 '
    + '않았습니다. 그래서 그 구간에서 점수와 위험이 로그 직선 관계라고 보고 「내 위험비 = '
    + '상위 10% 위험비 ^ 내 위치」로 채웠습니다. 발병 확률이나 진단이 아닙니다.'
    + '</div>'

    + '<h3 class="text-xl font-bold text-gray-900 mb-1">이렇게 바꾸면 올라갑니다</h3>'
    + '<p class="text-gray-500 text-sm mb-4">점수를 가장 많이 깎은 항목부터 보여드립니다</p>'
    + '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">' + tipCards + '</div>';
}
