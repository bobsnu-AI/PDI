// ============================================
// 밥스누 PDI 웰니스 솔루션 - 메인 앱 스크립트
// (레시피 DB 기반 식재료 분해 → PDI 계산 버전)
// ============================================

// ── 식품군 정의 ─────────────────────────────
const FOOD_CATEGORIES = {
  grains:     { name: '통곡물',         icon: '🌾', color: '#D97706', isPRF: true  },
  legumes:    { name: '두류·콩가공품',  icon: '🫘', color: '#8B5CF6', isPRF: true  },
  vegetables: { name: '채소·나물·해조', icon: '🥬', color: '#10B981', isPRF: true  },
  fruits:     { name: '과일',           icon: '🍎', color: '#EF4444', isPRF: true  },
  nuts:       { name: '견과·종실',      icon: '🥜', color: '#92400E', isPRF: true  },
  oils:       { name: '식물성 오일',    icon: '🫙', color: '#EAB308', isPRF: true  },
  tea:        { name: '차·커피·코코아', icon: '🍵', color: '#6B7280', isPRF: true  },
  spices:     { name: '향신료',         icon: '🌶️', color: '#DC2626', isPRF: false },
  protein:    { name: '동물성 단백질',  icon: '🥩', color: '#9CA3AF', isPRF: false },
  dairy:      { name: '유제품',         icon: '🥛', color: '#93C5FD', isPRF: false },
  refined:    { name: '정제 곡물·당류', icon: '🍞', color: '#FCA5A5', isPRF: false },
};

// ── 파이토케미컬 계열 ────────────────────────
const PHYTOCHEMICAL_GROUPS = {
  isoflavones:    { name: '이소플라본',       benefits: ['여성건강', '골건강', '콜레스테롤'],  color: '#8B5CF6', icon: '💜' },
  anthocyanins:   { name: '안토시아닌',       benefits: ['항산화', 'LDL 억제', '시력'],        color: '#6D28D9', icon: '🫐' },
  catechins:      { name: '카테킨',           benefits: ['LDL 억제', '항염', '체지방'],         color: '#059669', icon: '🍃' },
  carotenoids:    { name: '카로티노이드',     benefits: ['항산화', '황반보호', '눈건강'],        color: '#F59E0B', icon: '🟠' },
  phenolicAcids:  { name: '페놀산',           benefits: ['항산화', '저GI', '항염'],             color: '#92400E', icon: '🌰' },
  glucosinolates: { name: '글루코시놀레이트', benefits: ['체지방', '해독효소', '항암'],          color: '#065F46', icon: '🥦' },
  stilbenes:      { name: '스틸벤',           benefits: ['심혈관', '뇌건강', '항산화'],          color: '#7C3AED', icon: '🍇' },
  lignans:        { name: '리그난',           benefits: ['콜레스테롤', '여성건강', '항산화'],    color: '#78350F', icon: '🌻' },
  saponins:       { name: '사포닌',           benefits: ['콜레스테롤', '항산화', '면역'],        color: '#047857', icon: '🫘' },
  gingerols:      { name: '진저롤·커큐민',    benefits: ['항염', '소화', '관절'],               color: '#D97706', icon: '🫚' },
  flavonols:      { name: '플라보놀',         benefits: ['항산화', '항염', '심혈관'],            color: '#B45309', icon: '🌼' },
  thioallyls:     { name: '티오알릴',         benefits: ['항염', '항혈전', '면역'],              color: '#4B5563', icon: '🧄' },
  flavones:       { name: '플라본',           benefits: ['항산화', '항염', '혈당조절'],          color: '#A16207', icon: '🌾' },
  tocopherols:    { name: '토코페롤류',        benefits: ['항산화', '세포보호', '면역'],          color: '#CA8A04', icon: '🌿' },
};

// ── 파이토케미컬 일일 기준량 (DRV) ─────────────
// 출처: 우리 DB(recipes.js 14,714개 레시피) 하루 3끼 시뮬레이션 2,000회 → p75
// 데이터 없는 계열(glucosinolates·gingerols·thioallyls·stilbenes)은
// 점수 계산 대상에서 제외하고 DB값 보유 계열만 사용
const PHYTO_DRV = {
  phenolicAcids:  38,   // p75 37.8 mg/일
  catechins:      16,   // p75 16.0 mg/일
  flavonols:      89,   // p75 88.7 mg/일
  isoflavones:    26,   // p75 25.5 mg/일
  saponins:       75,   // p75 74.8 mg/일
  carotenoids:     2,   // p75  1.9 mg/일
  anthocyanins:    6,   // p75  6.3 mg/일
  lignans:        15,   // p75 15.1 mg/일
  flavones:       26,   // p75 26.0 mg/일
  tocopherols:     6,   // p75  6.3 mg/일
};
// DRV 보유 계열 목록 (점수 계산 대상)
const PHYTO_SCORED_KEYS = Object.keys(PHYTO_DRV);  // 10개 계열

// ──────────────────────────────────────────────
// calculatePhytoScore(phytoMap, selectedGoals)
//   phytoMap : { key: totalMg } — calculatePDI() 반환값
//   selectedGoals : Set<goalId>
// 반환: {
//   total,          // 0~100
//   diversity,      // 0~40  — 커버 계열 수 / 10 × 40
//   sufficiency,    // 0~30  — DRV 달성률 평균 × 30
//   focus,          // 0~30  — 목적 계열 달성률 평균 × 30 (없으면 전체 평균)
//   focusLabel,     // 표시용 라벨
//   perKey,         // { key: { mg, drv, ratio } }
//   goalKeys,       // 목적 계열 배열
// }
// ──────────────────────────────────────────────
function calculatePhytoScore(phytoMap, selectedGoals) {
  // ── 계열별 달성률 ──
  const perKey = {};
  for (const key of PHYTO_SCORED_KEYS) {
    const mg  = phytoMap[key] || 0;
    const drv = PHYTO_DRV[key];
    perKey[key] = { mg, drv, ratio: Math.min(mg / drv, 1.0) };
  }

  // ── 다양성 (0~40) ──
  const coveredCount = PHYTO_SCORED_KEYS.filter(k => perKey[k].mg > 0).length;
  const diversity = Math.round((coveredCount / PHYTO_SCORED_KEYS.length) * 40);

  // ── 충분량 (0~30) ──
  const avgRatio = PHYTO_SCORED_KEYS.reduce((s, k) => s + perKey[k].ratio, 0)
                   / PHYTO_SCORED_KEYS.length;
  const sufficiency = Math.round(avgRatio * 30);

  // ── 목적 집중도 (0~30) ──
  // 목적 계열: 선택된 건강목적의 phytos 중 DRV 있는 것만
  const goalKeys = [...new Set(
    Array.from(selectedGoals)
      .flatMap(gid => (HEALTH_GOALS.find(h => h.id === gid) || {}).phytos || [])
      .filter(k => PHYTO_DRV[k])
  )];

  let focusRatio, focusLabel;
  if (goalKeys.length > 0) {
    focusRatio = goalKeys.reduce((s, k) => s + perKey[k].ratio, 0) / goalKeys.length;
    const goalNames = Array.from(selectedGoals)
      .map(gid => (HEALTH_GOALS.find(h => h.id === gid) || {}).name)
      .filter(Boolean).join('·');
    focusLabel = goalNames;
  } else {
    focusRatio = avgRatio;   // 목적 미선택 → 전체 평균
    focusLabel = '전체 평균';
  }
  const focus = Math.round(focusRatio * 30);

  return {
    total:      diversity + sufficiency + focus,
    diversity,
    sufficiency,
    focus,
    focusLabel,
    perKey,
    goalKeys,
    coveredCount,
  };
}

// ── 건강 목적 ────────────────────────────────
const HEALTH_GOALS = [
  { id: 'diet',          name: '다이어트',   icon: '⚖️', phytos: ['glucosinolates', 'catechins', 'phenolicAcids'] },
  { id: 'blood_sugar',   name: '혈당 관리',  icon: '🩸', phytos: ['phenolicAcids', 'isoflavones', 'lignans'] },
  { id: 'cardiovascular',name: '혈관·심장',  icon: '❤️', phytos: ['catechins', 'anthocyanins', 'stilbenes'] },
  { id: 'brain',         name: '뇌건강',     icon: '🧠', phytos: ['stilbenes', 'anthocyanins', 'catechins'] },
  { id: 'muscle',        name: '근육·시니어',icon: '💪', phytos: ['isoflavones', 'saponins'] },
  { id: 'antioxidant',   name: '항산화',     icon: '✨', phytos: ['carotenoids', 'anthocyanins', 'flavonols'] },
  { id: 'womens',        name: '여성건강',   icon: '👩', phytos: ['isoflavones', 'lignans'] },
  { id: 'gut',           name: '장건강',     icon: '🌿', phytos: ['phenolicAcids', 'saponins', 'gingerols'] },
  { id: 'eye',           name: '눈건강',     icon: '👁️', phytos: ['carotenoids', 'anthocyanins'] },
  { id: 'antiinflam',    name: '항염·면역',  icon: '🛡️', phytos: ['gingerols', 'thioallyls', 'catechins'] },
];

// ── 밥스누 제품 ─────────────────────────────
const BOBSNU_PRODUCTS = [
  { id: 'yakong_soymilk', name: '약콩두유',        desc: '약콩(흑두) 기반 이소플라본·안토시아닌',      icon: '🫘', phytos: ['isoflavones', 'anthocyanins', 'saponins'],            targets: ['여성건강', '골건강', '콜레스테롤'], color: '#8B5CF6' },
  { id: 'phyto100',       name: '파이토100',        desc: '100종 파이토케미컬 통합 블렌드',             icon: '💊', phytos: ['phenolicAcids', 'lignans', 'catechins', 'carotenoids'], targets: ['혈당', '항산화', '종합건강'],       color: '#059669' },
  { id: 'phyto100_s2',    name: '파이토100 시즌2',  desc: '혈관·뇌건강 특화 피세아탄놀',               icon: '🧠', phytos: ['stilbenes', 'anthocyanins', 'catechins'],               targets: ['혈관', '뇌건강', '항산화'],         color: '#2563EB' },
  { id: 'phyto_black',    name: '파이토블랙',        desc: '검은색 식품 파이토케미컬 집중 공급',        icon: '🫐', phytos: ['anthocyanins', 'stilbenes'],                            targets: ['항산화', '혈관'],                  color: '#4F46E5' },
  { id: 'protein_bar',    name: '약콩 프로틴바',     desc: '약콩 단백질 + 이소플라본',                  icon: '💪', phytos: ['isoflavones', 'phenolicAcids', 'saponins'],             targets: ['근육', '시니어', '단백질'],         color: '#EA580C' },
  { id: 'yakong_tea',     name: '약콩차',            desc: '약콩 기반 카테킨·이소플라본 차',            icon: '🍵', phytos: ['catechins', 'isoflavones'],                             targets: ['체지방', '항산화'],                color: '#0D9488' },
  { id: 'diet_soymilk',   name: '다이어트 두유',     desc: '설포라핀(글루코시놀레이트) 특화',           icon: '🥦', phytos: ['glucosinolates', 'isoflavones'],                        targets: ['다이어트', '체지방'],              color: '#16A34A' },
  { id: 'yakong100',      name: '약콩100',           desc: '약콩 100% 순수 파이토케미컬 농축',          icon: '⭐', phytos: ['isoflavones', 'anthocyanins', 'saponins'],             targets: ['시니어', '여성건강'],              color: '#CA8A04' },
];

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let currentStep = 1;
// 추가된 식사: [{ name:'비빔밥', meal:'아침', analysis:{...} }, ...]
let addedMeals = [];
const selectedGoals = new Set();
let pdiResult = null;
let chartInstance = null;
let gender = 'female';

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  renderHealthGoals();
  renderProductGrid();
  renderMealList();
  initAutocomplete();
});

// ══════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════
function scrollToAssessment() {
  document.getElementById('assessment').scrollIntoView({ behavior: 'smooth' });
}

function setGender(g) {
  gender = g;
  document.getElementById('gender-male').classList.toggle('border-emerald-500', g === 'male');
  document.getElementById('gender-male').classList.toggle('bg-emerald-50', g === 'male');
  document.getElementById('gender-male').classList.toggle('border-gray-200', g !== 'male');
  document.getElementById('gender-female').classList.toggle('border-emerald-500', g === 'female');
  document.getElementById('gender-female').classList.toggle('bg-emerald-50', g === 'female');
  document.getElementById('gender-female').classList.toggle('border-gray-200', g !== 'female');
}

function goToStep(n) {
  const cur = document.getElementById('step-' + currentStep);
  const next = document.getElementById('step-' + n);
  if (cur) cur.classList.add('hidden');
  if (next) next.classList.remove('hidden');

  for (let i = 1; i <= 4; i++) {
    const dot   = document.getElementById('step-' + i + '-dot');
    const label = document.getElementById('step-' + i + '-label');
    if (!dot) continue;
    if (i < n) {
      dot.className = 'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold';
      dot.innerHTML = '<i class="fas fa-check text-xs"></i>';
      label.className = 'text-sm font-medium text-emerald-600';
    } else if (i === n) {
      dot.className = 'w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center text-sm font-bold';
      dot.textContent = i;
      label.className = 'text-sm font-medium text-emerald-700';
    } else {
      dot.className = 'w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-bold';
      dot.textContent = i;
      label.className = 'text-sm font-medium text-gray-500';
    }
  }
  currentStep = n;
  document.getElementById('assessment').scrollIntoView({ behavior: 'smooth' });
}

// ══════════════════════════════════════════════
// AUTOCOMPLETE  (자동완성)
// ══════════════════════════════════════════════
function initAutocomplete() {
  const input = document.getElementById('meal-input');
  const dropdown = document.getElementById('autocomplete-list');
  if (!input) return;

  input.addEventListener('input', () => {
    const val = input.value.trim();
    dropdown.innerHTML = '';
    if (!val) { dropdown.classList.add('hidden'); return; }

    const matches = RECIPE_NAMES.filter(n => n.includes(val)).slice(0, 10);
    if (!matches.length) { dropdown.classList.add('hidden'); return; }

    dropdown.classList.remove('hidden');
    matches.forEach(name => {
      const recipe = RECIPES[name];
      const ingCount = Object.keys(recipe.ings).length;
      const li = document.createElement('li');
      li.className = 'px-4 py-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between group';
      li.innerHTML =
        '<div>'
        + '<span class="font-medium text-gray-900">' + name + '</span>'
        + '<span class="ml-2 text-xs text-gray-400">재료 ' + ingCount + '종 · ' + recipe.cal + ' kcal</span>'
        + '</div>'
        + '<i class="fas fa-plus text-emerald-500 opacity-0 group-hover:opacity-100 text-sm"></i>';
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = name;
        dropdown.classList.add('hidden');
      });
      dropdown.appendChild(li);
    });
  });

  input.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 150));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addMeal(); }
  });
}

// ══════════════════════════════════════════════
// MEAL MANAGEMENT  (식사 추가/삭제)
// ══════════════════════════════════════════════
function addMeal() {
  const input    = document.getElementById('meal-input');
  const mealType = document.getElementById('meal-type').value;
  const rawName  = input.value.trim();

  if (!rawName) {
    showInputError('음식 이름을 입력해주세요.');
    return;
  }

  // 레시피 DB에서 정확 매칭
  const recipe = RECIPES[rawName];
  if (!recipe) {
    // 유사 검색
    const close = RECIPE_NAMES.filter(n => n.includes(rawName));
    if (close.length) {
      showInputError('"' + rawName + '"을 찾을 수 없습니다. 혹시 ' + close.slice(0, 3).join(', ') + ' 이신가요?');
    } else {
      showInputError('"' + rawName + '"은 현재 지원되지 않는 음식입니다. 자동완성 목록에서 선택해주세요.');
    }
    return;
  }

  clearInputError();
  const analysis = analyzeRecipe(rawName);
  addedMeals.push({ name: rawName, meal: mealType, analysis });
  input.value = '';
  renderMealList();
}

function removeMeal(idx) {
  addedMeals.splice(idx, 1);
  renderMealList();
}

function renderMealList() {
  const container = document.getElementById('meal-list');
  const emptyMsg  = document.getElementById('meal-empty');
  const mealCount = document.getElementById('meal-count');

  mealCount.textContent = '(' + addedMeals.length + '개)';

  if (!addedMeals.length) {
    container.innerHTML = '';
    emptyMsg.classList.remove('hidden');
    return;
  }
  emptyMsg.classList.add('hidden');

  // 식사 시간별 그룹
  const mealLabels = { breakfast: '아침 🌅', lunch: '점심 ☀️', dinner: '저녁 🌙', snack: '간식 🍪' };
  const grouped = {};
  addedMeals.forEach((item, idx) => {
    if (!grouped[item.meal]) grouped[item.meal] = [];
    grouped[item.meal].push({ ...item, idx });
  });

  container.innerHTML = Object.entries(grouped).map(([mealKey, items]) =>
    '<div class="mb-4">'
    + '<div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">' + (mealLabels[mealKey] || mealKey) + '</div>'
    + items.map(item => renderMealCard(item)).join('')
    + '</div>'
  ).join('');
}

function renderMealCard(item) {
  const { name, analysis, idx } = item;
  // 식재료 상위 4개만 표시
  const topIngs = analysis.ingredients
    .sort((a, b) => b.kcal - a.kcal)
    .slice(0, 4);

  const prfIngs = analysis.ingredients.filter(i => i.prf);
  const prfKcal = prfIngs.reduce((s, i) => s + i.kcal, 0);
  const prfRatio = analysis.totalCal > 0 ? Math.round((prfKcal / analysis.totalCal) * 100) : 0;

  return '<div class="bg-white border border-gray-100 rounded-2xl p-4 mb-2 shadow-sm">'
    + '<div class="flex items-start justify-between">'
    + '<div class="flex-1">'
    + '<div class="flex items-center gap-2 mb-2">'
    + '<span class="font-bold text-gray-900">' + name + '</span>'
    + '<span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">' + analysis.totalCal + ' kcal</span>'
    + '<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">PRF ' + prfRatio + '%</span>'
    + '</div>'
    // 식재료 태그
    + '<div class="flex flex-wrap gap-1">'
    + topIngs.map(i => {
        const cat = FOOD_CATEGORIES[i.cat] || {};
        const badge = i.prf ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-500 border border-gray-200';
        return '<span class="text-xs px-2 py-0.5 rounded-full ' + badge + '">'
          + (cat.icon || '') + ' ' + i.name + ' ' + i.grams + 'g</span>';
      }).join('')
    + (analysis.ingredients.length > 4
        ? '<span class="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">+' + (analysis.ingredients.length - 4) + '가지</span>'
        : '')
    + '</div>'
    + '</div>'
    + '<button onclick="removeMeal(' + idx + ')" class="ml-3 text-gray-300 hover:text-red-400 transition flex-shrink-0 mt-0.5">'
    + '<i class="fas fa-times-circle text-lg"></i></button>'
    + '</div>'
    // 파이토케미컬 미리보기
    + renderPhytoMiniBar(analysis)
    + '</div>';
}

function renderPhytoMiniBar(analysis) {
  const phytoSet = new Set(analysis.ingredients.flatMap(i => Object.keys((typeof i.phytos === 'object' && !Array.isArray(i.phytos)) ? i.phytos : {})));
  if (!phytoSet.size) return '';
  const chips = Array.from(phytoSet).map(key => {
    const g = PHYTOCHEMICAL_GROUPS[key];
    return g ? '<span class="text-xs px-1.5 py-0.5 rounded text-white/90 font-medium" style="background:' + g.color + '">' + g.icon + ' ' + g.name + '</span>' : '';
  }).join('');
  return '<div class="mt-2 pt-2 border-t border-gray-50 flex flex-wrap gap-1">' + chips + '</div>';
}

// 입력 오류 메시지
function showInputError(msg) {
  const el = document.getElementById('meal-input-error');
  if (!el) return;
  const span = el.querySelector('span') || el;
  span.textContent = msg;
  el.classList.remove('hidden');
}
function clearInputError() {
  const el = document.getElementById('meal-input-error');
  if (el) el.classList.add('hidden');
}

// 빠른 추가 (힌트 버튼)
function quickAdd(name) {
  const input = document.getElementById('meal-input');
  if (input) { input.value = name; input.focus(); }
}

// ══════════════════════════════════════════════
// PDI ENGINE  (McCarty 2004 방법론 준수)
// ──────────────────────────────────────────────
// PDI = PRF 식품군에서 온 kcal / 총 kcal × 100
//
// PRF(Phytochemical-Rich Foods) 판정 기준:
//   통곡물 / 두류·콩가공품 / 채소·해조 / 과일 /
//   견과·종실 / 식물성 오일 / 차·커피·코코아
//   → INGREDIENTS[x].prf === true 로 코드화
//
// ※ 차류(tea)는 실제 kcal이 거의 0이므로
//   McCarty 원 공식 그대로 실제 kcal만 산입
//   (별도 보정값 없음)
//
// ※ 파이토케미컬 계열별 커버리지(phytoCoverage)는
//   McCarty 공식 외 참고용 추정 정보입니다.
//   개별 식재료-파이토케미컬 매핑은 식품영양학
//   문헌(Phenol-Explorer, 농촌진흥청 식품성분DB 등)
//   기반의 '존재 여부(binary)' 추정이며,
//   정량 함량(mg/100g) 데이터가 아닙니다.
// ══════════════════════════════════════════════
function calculatePDI() {
  let totalCalories = 0, prfCalories = 0;
  const categoryMap = {};
  const phytoMap    = {};
  const allIngredients = [];

  for (const mealEntry of addedMeals) {
    const { analysis } = mealEntry;
    totalCalories += analysis.totalCal;

    for (const ing of analysis.ingredients) {
      allIngredients.push({ ...ing, dish: mealEntry.name });

      // ── 식품군별 kcal 집계 ──
      if (!categoryMap[ing.cat]) {
        categoryMap[ing.cat] = {
          calories: 0, percentage: 0,
          isPRF: (FOOD_CATEGORIES[ing.cat] || {}).isPRF || false,
          ingredients: []
        };
      }
      categoryMap[ing.cat].calories += ing.kcal;
      categoryMap[ing.cat].ingredients.push(ing.name);

      // ── McCarty PDI: PRF 식품군 kcal 그대로 산입 ──
      // tea(차류)는 실제 kcal(≈0)을 그대로 사용
      // — 별도 보정 없음, 공식 그대로
      if (ing.prf) {
        prfCalories += ing.kcal;
      }

      // ── 파이토케미컬 계열별 mg 합산 ──
      // phytos는 { key: mg_per_100g } 오브젝트
      const phytoObj = (typeof ing.phytos === 'object' && !Array.isArray(ing.phytos))
        ? ing.phytos : {};
      for (const [p, mg] of Object.entries(phytoObj)) {
        phytoMap[p] = (phytoMap[p] || 0) + (mg || 0);
      }
    }
  }

  // 식품군 비율 계산
  for (const k in categoryMap) {
    categoryMap[k].percentage = totalCalories > 0
      ? (categoryMap[k].calories / totalCalories) * 100 : 0;
    categoryMap[k].ingredients = [...new Set(categoryMap[k].ingredients)];
  }

  // ── PDI 점수 (McCarty 2004 공식) ──
  const pdiScore = totalCalories > 0 ? (prfCalories / totalCalories) * 100 : 0;

  // ── 파이토케미컬 커버리지 (실측 mg 기반) ──
  const phytoCoverage = Object.keys(PHYTOCHEMICAL_GROUPS).map(key => {
    const g = PHYTOCHEMICAL_GROUPS[key];
    const totalMg = phytoMap[key] || 0;
    // mg 기준 레벨: 0 / 0~5 / 5~20 / 20+
    let level, levelLabel;
    if (totalMg === 0)     { level = 'none';   levelLabel = '미검출'; }
    else if (totalMg < 5)  { level = 'low';    levelLabel = `${totalMg.toFixed(1)}mg 적음`; }
    else if (totalMg < 20) { level = 'medium'; levelLabel = `${totalMg.toFixed(1)}mg 보통`; }
    else                   { level = 'high';   levelLabel = `${totalMg.toFixed(1)}mg 풍부`; }
    return { key, name: g.name, present: totalMg > 0, totalMg: +totalMg.toFixed(2), level, levelLabel,
             color: g.color, icon: g.icon, benefits: g.benefits };
  });

  const diversityScore = phytoCoverage.filter(p => p.present).length;
  const deficient = phytoCoverage.filter(p => !p.present || p.level === 'low').map(p => p.key);

  // ── 주의사항 (McCarty 원칙 기반) ──
  const warnings = [];
  if (categoryMap['refined'] && categoryMap['refined'].percentage > 40) {
    warnings.push(
      '정제 곡물 비율 ' + categoryMap['refined'].percentage.toFixed(0) +
      '% — 통곡물(현미·잡곡·귀리)로 일부 대체하면 PDI를 높일 수 있습니다'
    );
  }
  // PRF 식품군 중 두류 미섭취 여부 (식품군 수준 경고, McCarty 원칙)
  if (!categoryMap['legumes']) {
    warnings.push('두류·콩가공품 미섭취 — 두류는 핵심 PRF 식품군입니다 (된장찌개·두부·콩밥 등)');
  }
  if (!categoryMap['vegetables']) {
    warnings.push('채소류 미섭취 — 채소는 핵심 PRF 식품군입니다');
  }

  // ── 등급 ──
  let grade, gradeLabel, gradeColor;
  if (pdiScore >= 40)      { grade = 'excellent'; gradeLabel = '🌟 목표 달성 (≥40%)'; gradeColor = '#10B981'; }
  else if (pdiScore >= 30) { grade = 'good';      gradeLabel = '👍 양호 (30–39%)';     gradeColor = '#3B82F6'; }
  else if (pdiScore >= 20) { grade = 'fair';      gradeLabel = '📈 보통 (20–29%)';     gradeColor = '#F59E0B'; }
  else                     { grade = 'poor';      gradeLabel = '⚠️ 개선 필요 (<20%)';  gradeColor = '#EF4444'; }

  // ── 식단 개선 제안 (식품군 수준, McCarty 원칙) ──
  const suggestions = [];
  if (pdiScore < 40) {
    const gap = (40 - pdiScore).toFixed(1);
    suggestions.push(
      '📊 PRF 식품군(통곡물·두류·채소·과일·견과) 칼로리 비중을 높이면 PDI가 올라갑니다. ' +
      '현재 ' + pdiScore.toFixed(1) + '%, 목표까지 약 ' + gap + '%p 필요합니다.'
    );
  }
  // 부족한 PRF 식품군 기반 제안
  if (!categoryMap['grains']) {
    suggestions.push('🌾 흰쌀밥 대신 현미밥·잡곡밥을 선택하면 통곡물 PRF 칼로리가 추가됩니다');
  }
  if (!categoryMap['legumes']) {
    suggestions.push('🫘 된장찌개·두부·콩나물 등 두류 반찬 1가지를 추가해보세요');
  }
  if (!categoryMap['vegetables']) {
    suggestions.push('🥬 나물·김치·채소국 등 채소 반찬은 PRF 칼로리를 높이는 핵심입니다');
  }
  if (!categoryMap['fruits']) {
    suggestions.push('🍎 식후 과일 1회 섭취가 PDI 향상에 효과적입니다');
  }
  if (!categoryMap['nuts']) {
    suggestions.push('🥜 견과류 한 줌(호두·아몬드 등)을 간식으로 추가해보세요');
  }
  if (!categoryMap['tea']) {
    suggestions.push('🍵 식후 녹차·보이차 한 잔은 칼로리 거의 없이 PRF 식품군을 추가하는 방법입니다');
  }
  // 파이토케미컬 다양성 보조 제안 (참고용 표시)
  if (diversityScore < 6) {
    suggestions.push(
      '🌈 [참고] 다양한 색깔의 채소·과일을 포함하면 다양한 계열의 파이토케미컬을 ' +
      '섭취할 수 있습니다 (현재 추정 ' + diversityScore + '/12 계열)'
    );
  }

  return {
    pdiScore, prfCalories, totalCalories,
    categoryMap, phytoCoverage, diversityScore,
    warnings, grade, gradeLabel, gradeColor,
    deficient, suggestions, phytoMap, allIngredients,
  };
}

// ══════════════════════════════════════════════
// DISPLAY RESULTS
// ══════════════════════════════════════════════
function calculateAndShow() {
  if (!addedMeals.length) {
    alert('식사를 1개 이상 추가한 뒤 분석을 진행해주세요.');
    return;
  }
  pdiResult = calculatePDI();
  pdiResult.phytoScore = calculatePhytoScore(pdiResult.phytoMap, selectedGoals);
  goToStep(4);
  displayResults();
}

function displayResults() {
  const r = pdiResult;

  // ─ PDI Ring ─
  const score = Math.min(r.pdiScore, 100);
  const ring = document.getElementById('pdi-ring');
  ring.setAttribute('stroke-dasharray', ((score / 100) * 314) + ' 314');
  ring.setAttribute('stroke', r.gradeColor);
  document.getElementById('pdi-score-display').textContent  = r.pdiScore.toFixed(1) + '%';
  document.getElementById('pdi-score-display').style.color  = r.gradeColor;
  const badge = document.getElementById('pdi-grade-badge');
  badge.textContent = r.gradeLabel;
  badge.style.backgroundColor = r.gradeColor;

  // ─ Summary Stats ─
  document.getElementById('total-cal').textContent     = Math.round(r.totalCalories) + ' kcal';
  document.getElementById('prf-cal').textContent       = Math.round(r.prfCalories) + ' kcal';
  document.getElementById('diversity-score').textContent = r.diversityScore + '/12';
  document.getElementById('food-cat-count').textContent  = Object.keys(r.categoryMap).length + '가지';

  // ─ Warnings ─
  if (r.warnings.length) {
    document.getElementById('warnings-section').classList.remove('hidden');
    document.getElementById('warnings-list').innerHTML = r.warnings.map(w => '<li>' + w + '</li>').join('');
  }

  // ─ Ingredient Breakdown Table ─
  renderIngredientBreakdown(r);

  // ─ Chart ─
  setTimeout(() => renderCategoryChart(r.categoryMap), 150);

  // ─ Products ─
  renderProductRecommendations(r);

  // ─ Phyto Score ─
  renderPhytoScore(r.phytoScore);

  // ─ Suggestions ─
  document.getElementById('diet-suggestions').innerHTML = r.suggestions.map((s, i) =>
    '<div class="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl">'
    + '<div class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">' + (i + 1) + '</div>'
    + '<p class="text-gray-700 text-sm">' + s + '</p></div>'
  ).join('');
}

// ══════════════════════════════════════════════
// 식재료 분해 & 파이토케미컬 매핑 뷰
// ══════════════════════════════════════════════

// ─ 중복 합산된 식재료 목록 반환 (공통 유틸) ─
function getMergedIngredients(r) {
  const merged = {};
  for (const ing of r.allIngredients) {
    const key = ing.name + '|' + ing.cat;
    if (!merged[key]) merged[key] = { ...ing, totalKcal: 0, totalGrams: 0 };
    merged[key].totalKcal  += ing.kcal;
    merged[key].totalGrams += ing.grams;
  }
  return Object.values(merged).sort((a, b) => b.totalKcal - a.totalKcal);
}

// ══════════════════════════════════════════════
// 생키 플로우차트: 음식 → 식재료(식품군) → 파이토케미컬
// ══════════════════════════════════════════════

function renderIngredientBreakdown(r) {
  const container = document.getElementById('ingredient-breakdown');
  if (!container) return;

  const allIng = getMergedIngredients(r);

  // ── 데이터 준비 ──
  // Col 1: 음식(레시피) — addedMeals 에서
  const meals = addedMeals; // [{ name, meal, analysis }]

  // Col 2: 식재료+식품군 (중복 제거됨)
  // Col 3: 파이토케미컬
  const presentPhytoKeys = [...new Set(allIng.flatMap(i => Object.keys((typeof i.phytos === 'object' && !Array.isArray(i.phytos)) ? i.phytos : {})))];

  // 엣지 정의
  // meal → ingredient: 어떤 meal이 어떤 ing를 포함하는지
  const mealToIng = {}; // mealIdx → Set(ingName)
  meals.forEach((m, mi) => {
    mealToIng[mi] = new Set();
    const a = m.analysis;
    if (a && a.ingredients) {
      a.ingredients.forEach(ing => {
        // mergedIngredients 의 key는 name|cat
        const merged = allIng.find(x => x.name === ing.name);
        if (merged) mealToIng[mi].add(merged.name);
      });
    }
  });

  // ing → phyto
  const ingToPhyto = {}; // ingName → [phytoKey]
  allIng.forEach(i => {
    ingToPhyto[i.name] = Object.keys((typeof i.phytos === 'object' && !Array.isArray(i.phytos)) ? i.phytos : {});
  });

  // ── 컨테이너 HTML 생성 ──
  container.innerHTML =
    '<div class="text-xs text-amber-600 mb-4 flex items-center gap-2">'
    + '<i class="fas fa-info-circle"></i>'
    + '<span>노드에 마우스를 올리면 경로가 강조됩니다 · 파이토케미컬 수치는 실측 mg/100g 기반</span>'
    + '</div>'
    + '<div id="sankey-wrap" style="position:relative;overflow:visible">'
    // 3열 그리드
    + '<div id="sankey-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;align-items:start;position:relative">'

    // ── 열1: 음식 ──
    + '<div id="col-meal" style="display:flex;flex-direction:column;gap:10px;align-items:flex-end;padding-right:40px">'
    + '<div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2" style="align-self:flex-end">🍽 음식</div>'
    + meals.map((m, mi) => {
        const mealLabel = { '아침':'🌅','점심':'☀️','저녁':'🌙','간식':'🍪' }[m.meal] || '🍽';
        return '<div id="node-meal-' + mi + '" data-col="meal" data-id="' + mi + '"'
          + ' class="sankey-node flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 cursor-pointer select-none transition-all border-blue-300 bg-blue-50 text-blue-800 text-xs font-semibold whitespace-nowrap"'
          + ' style="max-width:140px">'
          + '<span class="text-base leading-none">' + mealLabel + '</span>'
          + '<div style="overflow:hidden">'
          + '<div class="truncate font-bold" style="max-width:100px">' + m.name + '</div>'
          + '<div class="text-blue-400 font-normal">' + m.meal + ' · ' + Math.round((m.analysis||{}).totalCal||0) + 'kcal</div>'
          + '</div>'
          + '</div>';
      }).join('')
    + '</div>'

    // ── 열2: 식재료(식품군) ──
    + '<div id="col-ing" style="display:flex;flex-direction:column;gap:8px;align-items:center;padding:0 20px">'
    + '<div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">🥬 식재료 (식품군)</div>'
    + allIng.map(ing => {
        const cat  = FOOD_CATEGORIES[ing.cat] || {};
        const isPRF = ing.prf;
        const bg   = isPRF ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-50 text-gray-500';
        return '<div id="node-ing-' + ing.name.replace(/\s/g,'_') + '" data-col="ing" data-id="' + ing.name + '"'
          + ' class="sankey-node flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 cursor-pointer select-none transition-all text-xs font-semibold whitespace-nowrap ' + bg + '">'
          + '<span class="text-sm leading-none">' + (cat.icon||'🔸') + '</span>'
          + '<span>' + ing.name + '</span>'
          + (isPRF ? '<span class="text-emerald-500 font-bold text-xs">PRF</span>' : '')
          + '</div>';
      }).join('')
    + '</div>'

    // ── 열3: 파이토케미컬 ──
    + '<div id="col-phyto" style="display:flex;flex-direction:column;gap:8px;align-items:flex-start;padding-left:40px">'
    + '<div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">🧬 파이토케미컬 <span class="font-normal">(추정)</span></div>'
    + presentPhytoKeys.map(key => {
        const g = PHYTOCHEMICAL_GROUPS[key];
        if (!g) return '';
        return '<div id="node-phyto-' + key + '" data-col="phyto" data-id="' + key + '"'
          + ' class="sankey-node flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer select-none transition-all border-2 text-white text-xs font-semibold whitespace-nowrap"'
          + ' style="background:' + g.color + ';border-color:' + g.color + ';">'
          + '<span class="text-sm leading-none">' + g.icon + '</span>'
          + '<span>' + g.name + '</span>'
          + '</div>';
      }).join('')
    + '</div>'

    + '</div>' // sankey-grid
    + '</div>'; // sankey-wrap

  // ── SVG + 인터랙션 — DOM 완전 안정 후 그리기 ──
  // phytoScore / categoryChart 렌더 후 레이아웃이 확정되어야 좌표가 정확함
  setTimeout(() => {
    drawSankey({ meals, allIng, presentPhytoKeys, mealToIng, ingToPhyto });
  }, 350);
}

// ── 생키 SVG 그리기 ──
function drawSankey({ meals, allIng, presentPhytoKeys, mealToIng, ingToPhyto }) {
  const wrap = document.getElementById('sankey-wrap');
  if (!wrap) return;

  // 기존 SVG 제거
  const old = wrap.querySelector('svg.sankey-svg');
  if (old) old.remove();

  const wRect = wrap.getBoundingClientRect();
  if (!wRect.width) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('sankey-svg');
  svg.setAttribute('width',  wRect.width);
  svg.setAttribute('height', wRect.height);
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;z-index:1';
  wrap.appendChild(svg);

  function mid(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left - wRect.left + r.width / 2, y: r.top - wRect.top + r.height / 2 };
  }
  function right(el) {
    const r = el.getBoundingClientRect();
    return { x: r.right - wRect.left, y: r.top - wRect.top + r.height / 2 };
  }
  function left(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left - wRect.left, y: r.top - wRect.top + r.height / 2 };
  }

  // 엣지 목록 생성
  // A: meal → ing
  const edgesA = [];
  meals.forEach((m, mi) => {
    (mealToIng[mi] || new Set()).forEach(ingName => {
      edgesA.push({ mealIdx: mi, ingName });
    });
  });
  // B: ing → phyto
  const edgesB = [];
  allIng.forEach(ing => {
    (ingToPhyto[ing.name] || []).forEach(phytoKey => {
      edgesB.push({ ingName: ing.name, phytoKey });
    });
  });

  function getNode(col, id) {
    if (col === 'meal') return document.getElementById('node-meal-' + id);
    if (col === 'ing')  return document.getElementById('node-ing-' + String(id).replace(/\s/g,'_'));
    if (col === 'phyto')return document.getElementById('node-phyto-' + id);
    return null;
  }

  function pathD(p1, p2) {
    const cx = (p1.x + p2.x) / 2;
    return 'M'+p1.x+' '+p1.y+' C'+cx+' '+p1.y+','+cx+' '+p2.y+','+p2.x+' '+p2.y;
  }

  function drawAll(highlightMeal, highlightIng, highlightPhyto) {
    svg.innerHTML = '';

    edgesA.forEach(({ mealIdx, ingName }) => {
      const mEl = getNode('meal', mealIdx);
      const iEl = getNode('ing', ingName);
      if (!mEl || !iEl) return;
      const active = highlightMeal === null && highlightIng === null && highlightPhyto === null
        || highlightMeal === mealIdx
        || highlightIng  === ingName;
      const p1 = right(mEl), p2 = left(iEl);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD(p1, p2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', active ? '#3B82F6' : '#E5E7EB');
      path.setAttribute('stroke-width', active ? '2.5' : '1');
      path.setAttribute('opacity', active ? '0.8' : '0.2');
      if (!active) path.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(path);
    });

    edgesB.forEach(({ ingName, phytoKey }) => {
      const iEl = getNode('ing', ingName);
      const pEl = getNode('phyto', phytoKey);
      if (!iEl || !pEl) return;
      const active = highlightMeal === null && highlightIng === null && highlightPhyto === null
        || highlightIng   === ingName
        || highlightPhyto === phytoKey;
      const g   = PHYTOCHEMICAL_GROUPS[phytoKey];
      const col = g ? g.color : '#9CA3AF';
      const p1 = right(iEl), p2 = left(pEl);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD(p1, p2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', active ? col : '#E5E7EB');
      path.setAttribute('stroke-width', active ? '2.5' : '1');
      path.setAttribute('opacity', active ? '0.8' : '0.2');
      if (!active) path.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(path);
    });
  }

  drawAll(null, null, null);

  // 호버 인터랙션
  const allNodes = wrap.querySelectorAll('.sankey-node');

  function highlight(col, id) {
    // 관련 노드 ID 계산
    const relMeals  = new Set();
    const relIngs   = new Set();
    const relPhytos = new Set();

    if (col === 'meal') {
      relMeals.add(id);
      (mealToIng[id] || new Set()).forEach(n => {
        relIngs.add(n);
        (ingToPhyto[n] || []).forEach(p => relPhytos.add(p));
      });
    } else if (col === 'ing') {
      relIngs.add(id);
      meals.forEach((m, mi) => { if ((mealToIng[mi]||new Set()).has(id)) relMeals.add(mi); });
      (ingToPhyto[id] || []).forEach(p => relPhytos.add(p));
    } else if (col === 'phyto') {
      relPhytos.add(id);
      allIng.forEach(ing => {
        if ((ingToPhyto[ing.name]||[]).includes(id)) {
          relIngs.add(ing.name);
          meals.forEach((m, mi) => { if ((mealToIng[mi]||new Set()).has(ing.name)) relMeals.add(mi); });
        }
      });
    }

    // 노드 강조/흐림
    allNodes.forEach(n => {
      const nc = n.getAttribute('data-col');
      const ni = n.getAttribute('data-id');
      let hit = false;
      if (nc === 'meal')  hit = relMeals.has(Number(ni)) || relMeals.has(ni);
      if (nc === 'ing')   hit = relIngs.has(ni);
      if (nc === 'phyto') hit = relPhytos.has(ni);
      n.style.opacity = hit ? '1' : '0.2';
      n.style.transform = hit ? 'scale(1.05)' : '';
    });

    // 엣지 강조
    const hm = col === 'meal'  ? id   : (relMeals.size  === 1 ? [...relMeals][0]  : null);
    const hi = col === 'ing'   ? id   : null;
    const hp = col === 'phyto' ? id   : null;
    // 직접 drawAll 로 전달
    svg.innerHTML = '';
    edgesA.forEach(({ mealIdx, ingName }) => {
      const mEl = getNode('meal', mealIdx);
      const iEl = getNode('ing', ingName);
      if (!mEl || !iEl) return;
      const active = relMeals.has(mealIdx) && relIngs.has(ingName);
      const p1 = right(mEl), p2 = left(iEl);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD(p1, p2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', active ? '#3B82F6' : '#E5E7EB');
      path.setAttribute('stroke-width', active ? '2.5' : '1');
      path.setAttribute('opacity', active ? '0.85' : '0.1');
      if (!active) path.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(path);
    });
    edgesB.forEach(({ ingName, phytoKey }) => {
      const iEl = getNode('ing', ingName);
      const pEl = getNode('phyto', phytoKey);
      if (!iEl || !pEl) return;
      const active = relIngs.has(ingName) && relPhytos.has(phytoKey);
      const g   = PHYTOCHEMICAL_GROUPS[phytoKey];
      const col2 = g ? g.color : '#9CA3AF';
      const p1 = right(iEl), p2 = left(pEl);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD(p1, p2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', active ? col2 : '#E5E7EB');
      path.setAttribute('stroke-width', active ? '2.5' : '1');
      path.setAttribute('opacity', active ? '0.85' : '0.1');
      if (!active) path.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(path);
    });
  }

  function unhighlight() {
    allNodes.forEach(n => { n.style.opacity = '1'; n.style.transform = ''; });
    drawAll(null, null, null);
  }

  allNodes.forEach(n => {
    n.addEventListener('mouseenter', () => highlight(n.getAttribute('data-col'), n.getAttribute('data-id') == parseInt(n.getAttribute('data-id')) ? Number(n.getAttribute('data-id')) : n.getAttribute('data-id')));
    n.addEventListener('mouseleave', unhighlight);
  });
}

// ─ 도넛 차트 ─
function renderCategoryChart(catMap) {
  const ctx = document.getElementById('category-chart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const labels = [], data = [], colors = [];
  for (const [key, val] of Object.entries(catMap)) {
    if (val.calories > 0) {
      const cat = FOOD_CATEGORIES[key];
      if (cat) { labels.push(cat.name); data.push(Math.round(val.calories)); colors.push(cat.color); }
    }
  }

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: ctx => ctx.label + ': ' + ctx.raw + 'kcal (' + ((ctx.raw / pdiResult.totalCalories) * 100).toFixed(1) + '%)'
        }}
      },
      cutout: '60%'
    }
  });

  // 레전드
  const legend = document.getElementById('category-legend');
  legend.innerHTML = labels.map((l, i) => {
    const catEntry = Object.entries(catMap).find(([k]) => (FOOD_CATEGORIES[k] || {}).name === l);
    const catData  = catEntry ? catEntry[1] : {};
    const pct = pdiResult.totalCalories > 0 ? ((data[i] / pdiResult.totalCalories) * 100).toFixed(1) : 0;
    const ingStr = (catData.ingredients || []).slice(0, 4).join(', ');
    return '<div class="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">'
      + '<div class="flex items-start gap-2">'
      + '<div class="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style="background:' + colors[i] + '"></div>'
      + '<div>'
      + '<div class="flex items-center gap-1.5">'
      + '<span class="text-sm text-gray-800 font-medium">' + l + '</span>'
      + (catData.isPRF ? '<span class="text-xs text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">PRF</span>' : '')
      + '</div>'
      + (ingStr ? '<div class="text-xs text-gray-400 mt-0.5">' + ingStr + (catData.ingredients.length > 4 ? ' 외' : '') + '</div>' : '')
      + '</div>'
      + '</div>'
      + '<div class="text-sm font-bold text-gray-900 ml-4 text-right">'
      + data[i] + 'kcal<br><span class="text-xs text-gray-400 font-normal">' + pct + '%</span>'
      + '</div>'
      + '</div>';
  }).join('');
}

// ─ 제품 추천 ─
function renderProductRecommendations(r) {
  const goalPhytos = new Set(
    Array.from(selectedGoals).flatMap(gid => (HEALTH_GOALS.find(h => h.id === gid) || {}).phytos || [])
  );
  const defSet = new Set(r.deficient);

  const scored = BOBSNU_PRODUCTS.map(prod => {
    let score = 0;
    for (const p of prod.phytos) {
      if (defSet.has(p))     score += 3;
      if (goalPhytos.has(p)) score += 2;
    }
    return { ...prod, score };
  }).sort((a, b) => b.score - a.score).slice(0, 6);

  document.getElementById('product-recommendations').innerHTML = scored.map(p => {
    const isTop = p.score > 4;
    return '<div class="border-2 rounded-2xl p-5 bg-white hover:shadow-md transition-shadow" style="border-color:' + (isTop ? p.color : '#E5E7EB') + '">'
      + (isTop ? '<div class="text-xs font-bold mb-2" style="color:' + p.color + '"><i class="fas fa-star mr-1"></i>맞춤 추천</div>' : '')
      + '<div class="flex items-start gap-3 mb-3"><span class="text-3xl">' + p.icon + '</span>'
      + '<div><div class="font-bold text-gray-900">' + p.name + '</div>'
      + '<div class="text-xs text-gray-500 mt-0.5">' + p.desc + '</div></div></div>'
      + '<div class="flex flex-wrap gap-1 mb-2">'
      + p.targets.map(t => '<span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">' + t + '</span>').join('')
      + '</div>'
      + '<div class="flex flex-wrap gap-1">'
      + p.phytos.map(ph => {
          const g = PHYTOCHEMICAL_GROUPS[ph];
          return '<span class="text-xs px-2 py-0.5 rounded-full text-white font-medium" style="background:' + (g ? g.color : '#6B7280') + '">' + (g ? g.name : ph) + '</span>';
        }).join('')
      + '</div></div>';
  }).join('');
}

// ── 파이토 점수 렌더링 ────────────────────────
function renderPhytoScore(ps) {
  const el = document.getElementById('phyto-score-section');
  if (!el) return;

  const total = ps.total;

  // 총점 등급
  let grade, gradeColor;
  if      (total >= 80) { grade = '🌟 우수';   gradeColor = '#10B981'; }
  else if (total >= 60) { grade = '👍 양호';   gradeColor = '#3B82F6'; }
  else if (total >= 40) { grade = '📈 보통';   gradeColor = '#F59E0B'; }
  else                  { grade = '⚠️ 부족';   gradeColor = '#EF4444'; }

  // 막대 하나 생성 헬퍼
  function bar(value, max, color) {
    const pct = Math.round((value / max) * 100);
    return '<div class="flex items-center gap-3">'
      + '<div class="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">'
      + '<div class="h-3 rounded-full transition-all duration-700" style="width:' + pct + '%;background:' + color + '"></div>'
      + '</div>'
      + '<span class="text-xs font-bold text-gray-700 w-14 text-right">' + value + ' / ' + max + '</span>'
      + '</div>';
  }

  // 계열별 달성률 바 (상위 5개 + 하위 표시)
  const keyRows = PHYTO_SCORED_KEYS.map(k => ({
    k,
    ...ps.perKey[k],
    g: PHYTOCHEMICAL_GROUPS[k],
  })).sort((a, b) => b.ratio - a.ratio);

  const keyBars = keyRows.map(row => {
    const pct = Math.round(row.ratio * 100);
    const isGoal = ps.goalKeys.includes(row.k);
    return '<div class="flex items-center gap-2 py-1">'
      + '<span class="text-base w-6 text-center">' + (row.g ? row.g.icon : '') + '</span>'
      + '<span class="text-xs text-gray-600 w-20 truncate' + (isGoal ? ' font-bold text-indigo-700' : '') + '">'
      + (row.g ? row.g.name : row.k)
      + (isGoal ? ' 🎯' : '')
      + '</span>'
      + '<div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">'
      + '<div class="h-2 rounded-full transition-all duration-700" style="width:' + pct + '%;background:' + (row.g ? row.g.color : '#6B7280') + '"></div>'
      + '</div>'
      + '<span class="text-xs text-gray-500 w-12 text-right">'
      + (row.mg < 0.1 ? '0' : row.mg.toFixed(1)) + 'mg'
      + '</span>'
      + '<span class="text-xs font-bold w-10 text-right" style="color:' + (row.g ? row.g.color : '#6B7280') + '">'
      + pct + '%'
      + '</span>'
      + '</div>';
  }).join('');

  el.innerHTML =
    '<div class="flex flex-wrap items-center justify-between gap-4 mb-6">'
    + '<div>'
    + '<h3 class="text-xl font-bold text-gray-900">🌿 파이토케미컬 점수</h3>'
    + '<p class="text-gray-500 text-sm mt-1">우리 DB 기반 일일 기준량(p75) 대비 달성도</p>'
    + '</div>'
    // 총점 뱃지
    + '<div class="flex items-center gap-3">'
    + '<div class="text-center">'
    + '<div class="text-5xl font-black" style="color:' + gradeColor + '">' + total + '</div>'
    + '<div class="text-xs text-gray-400">/ 100점</div>'
    + '</div>'
    + '<div class="text-left">'
    + '<div class="inline-flex items-center px-3 py-1.5 rounded-full text-white text-sm font-bold" style="background:' + gradeColor + '">' + grade + '</div>'
    + '<div class="text-xs text-gray-400 mt-1">' + ps.coveredCount + '/' + PHYTO_SCORED_KEYS.length + '개 계열 검출</div>'
    + '</div>'
    + '</div>'
    + '</div>'

    // 3개 하위 점수
    + '<div class="grid grid-cols-3 gap-4 mb-6">'
    // 다양성
    + '<div class="bg-blue-50 rounded-2xl p-4">'
    + '<div class="flex items-center gap-2 mb-2"><span class="text-lg">🌈</span><span class="text-sm font-bold text-blue-800">다양성</span></div>'
    + bar(ps.diversity, 40, '#3B82F6')
    + '<p class="text-xs text-blue-600 mt-2">' + ps.coveredCount + '개 계열 섭취</p>'
    + '</div>'
    // 충분량
    + '<div class="bg-emerald-50 rounded-2xl p-4">'
    + '<div class="flex items-center gap-2 mb-2"><span class="text-lg">⚖️</span><span class="text-sm font-bold text-emerald-800">충분량</span></div>'
    + bar(ps.sufficiency, 30, '#10B981')
    + '<p class="text-xs text-emerald-600 mt-2">DRV 평균 달성률 ' + Math.round((ps.sufficiency/30)*100) + '%</p>'
    + '</div>'
    // 목적 집중도
    + '<div class="bg-indigo-50 rounded-2xl p-4">'
    + '<div class="flex items-center gap-2 mb-2"><span class="text-lg">🎯</span><span class="text-sm font-bold text-indigo-800">목적 집중도</span></div>'
    + bar(ps.focus, 30, '#6366F1')
    + '<p class="text-xs text-indigo-600 mt-2">' + ps.focusLabel + '</p>'
    + '</div>'
    + '</div>'

    // 계열별 달성률
    + '<div class="bg-gray-50 rounded-2xl p-5">'
    + '<div class="text-sm font-bold text-gray-700 mb-3">계열별 DRV 달성률 <span class="font-normal text-gray-400 text-xs ml-1">🎯 = 선택한 목적 계열</span></div>'
    + '<div class="grid md:grid-cols-2 gap-x-6">' + keyBars + '</div>'
    + '</div>';
}

// ── 건강 목적 렌더링 ─────────────────────────
function renderHealthGoals() {
  const grid = document.getElementById('health-goals-grid');
  if (!grid) return;
  grid.innerHTML = HEALTH_GOALS.map(goal => {
    const sel = selectedGoals.has(goal.id);
    return '<div onclick="toggleGoal(\'' + goal.id + '\')" class="border-2 rounded-2xl p-4 text-center cursor-pointer transition-all ' + (sel ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-white hover:border-gray-300') + '">'
      + '<div class="text-3xl mb-2">' + goal.icon + '</div>'
      + '<div class="text-sm font-medium text-gray-800">' + goal.name + '</div>'
      + (sel ? '<div class="mt-1"><i class="fas fa-check-circle text-emerald-500 text-sm"></i></div>' : '')
      + '</div>';
  }).join('');
}

function toggleGoal(id) {
  if (selectedGoals.has(id)) { selectedGoals.delete(id); }
  else {
    if (selectedGoals.size >= 3) { alert('건강 목적은 최대 3개까지 선택할 수 있습니다'); return; }
    selectedGoals.add(id);
  }
  renderHealthGoals();
}

// ── B2C 제품 그리드 ──────────────────────────
function renderProductGrid() {
  const el = document.getElementById('product-grid');
  if (!el) return;
  el.innerHTML = BOBSNU_PRODUCTS.map(p =>
    '<div class="rounded-3xl border-2 p-6 bg-white hover:shadow-lg transition-shadow" style="border-color:' + p.color + '20">'
    + '<div class="text-4xl mb-4">' + p.icon + '</div>'
    + '<h3 class="text-lg font-bold text-gray-900 mb-1">' + p.name + '</h3>'
    + '<p class="text-sm text-gray-600 mb-4">' + p.desc + '</p>'
    + '<div class="flex flex-wrap gap-1 mb-4">'
    + p.targets.map(t => '<span class="text-xs px-2 py-1 rounded-full font-medium" style="background:' + p.color + '15;color:' + p.color + '">' + t + '</span>').join('')
    + '</div>'
    + '<div class="flex flex-wrap gap-1 mb-4">'
    + p.phytos.slice(0, 3).map(ph => {
        const g = PHYTOCHEMICAL_GROUPS[ph];
        return '<span class="text-xs px-2 py-0.5 rounded-full text-white font-medium" style="background:' + (g ? g.color : '#6B7280') + '">' + (g ? g.name : ph) + '</span>';
      }).join('')
    + '</div>'
    + '<button onclick="alert(\'구독 서비스 준비 중입니다.\\n제품 상담 문의로 연락주세요\')" class="w-full py-2.5 rounded-xl text-white text-sm font-medium transition" style="background:' + p.color + '">구독 신청</button>'
    + '</div>'
  ).join('');
}

// ── 재시작 ───────────────────────────────────
function restartAssessment() {
  addedMeals = [];
  selectedGoals.clear();
  pdiResult = null;
  renderMealList();
  renderHealthGoals();
  goToStep(1);
  document.getElementById('meal-input').value = '';
}
