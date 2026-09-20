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
};

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
  const phytoSet = new Set(analysis.ingredients.flatMap(i => i.phytos));
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

      // ── 파이토케미컬 계열 추정 (참고용) ──
      // prf:true 식품에서 어떤 계열이 검출되는지
      // binary 추정 (함량 아님)
      for (const p of ing.phytos) {
        phytoMap[p] = (phytoMap[p] || 0) + 1;
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

  // ── 파이토케미컬 커버리지 (참고용 추정) ──
  const phytoCoverage = Object.keys(PHYTOCHEMICAL_GROUPS).map(key => {
    const g = PHYTOCHEMICAL_GROUPS[key];
    const count = phytoMap[key] || 0;
    // count = 해당 계열이 보고된 식재료 수 (binary 추정)
    let level, levelLabel;
    if (count === 0)    { level = 'none';   levelLabel = '미검출'; }
    else if (count < 2) { level = 'low';    levelLabel = '적음'; }
    else if (count < 4) { level = 'medium'; levelLabel = '보통'; }
    else                { level = 'high';   levelLabel = '풍부'; }
    return { key, name: g.name, present: count > 0, count, level, levelLabel,
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

  // ─ Phyto Analysis Grid ─
  const levelBg   = { high: 'bg-emerald-50 border-emerald-200', medium: 'bg-blue-50 border-blue-200', low: 'bg-amber-50 border-amber-200', none: 'bg-gray-50 border-gray-200' };
  const levelText  = { high: 'text-emerald-700', medium: 'text-blue-700', low: 'text-amber-700',   none: 'text-gray-400' };
  document.getElementById('phyto-analysis-grid').innerHTML = r.phytoCoverage.map(p => {
    const barW = Math.min(p.count * 20, 100);
    return '<div class="border-2 rounded-2xl p-4 ' + levelBg[p.level] + '">'
      + '<div class="flex items-center justify-between mb-2">'
      + '<span class="text-xl">' + p.icon + '</span>'
      + '<span class="text-xs font-bold px-2 py-0.5 rounded-full ' + levelText[p.level] + '">' + p.levelLabel + '</span>'
      + '</div>'
      + '<div class="text-sm font-bold text-gray-800">' + p.name + '</div>'
      + '<div class="text-xs text-gray-500 mt-0.5">' + p.benefits.slice(0, 2).join(' · ') + '</div>'
      + '<div class="mt-2 h-1.5 bg-gray-200 rounded-full">'
      + '<div class="h-1.5 rounded-full transition-all duration-700" style="width:' + barW + '%;background:' + p.color + '"></div>'
      + '</div>'
      + '<div class="text-xs text-gray-400 mt-1">추정 ' + p.count + '개 식재료에서 보고됨</div>'
      + '</div>';
  }).join('');

  // ─ Chart ─
  setTimeout(() => renderCategoryChart(r.categoryMap), 150);

  // ─ Products ─
  renderProductRecommendations(r);

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

// ─ 탭 전환 ─
function switchBreakdownTab(tab) {
  const mapView   = document.getElementById('breakdown-map-view');
  const tableView = document.getElementById('breakdown-table-view');
  const tabMap    = document.getElementById('tab-map');
  const tabTable  = document.getElementById('tab-table');
  if (!mapView) return;

  if (tab === 'map') {
    mapView.classList.remove('hidden');
    tableView.classList.add('hidden');
    tabMap.classList.add('bg-emerald-700', 'text-white');
    tabMap.classList.remove('bg-white', 'text-gray-600');
    tabTable.classList.add('bg-white', 'text-gray-600');
    tabTable.classList.remove('bg-emerald-700', 'text-white');
    // SVG 연결선 렌더링 (레이아웃이 보인 뒤 실행)
    setTimeout(drawMappingLines, 80);
  } else {
    tableView.classList.remove('hidden');
    mapView.classList.add('hidden');
    tabTable.classList.add('bg-emerald-700', 'text-white');
    tabTable.classList.remove('bg-white', 'text-gray-600');
    tabMap.classList.add('bg-white', 'text-gray-600');
    tabMap.classList.remove('bg-emerald-700', 'text-white');
  }
}

// ─ SVG 연결선 그리기 ─
function drawMappingLines() {
  const svg = document.getElementById('mapping-svg');
  const wrap = document.getElementById('mapping-wrap');
  if (!svg || !wrap) return;

  const wRect = wrap.getBoundingClientRect();
  svg.setAttribute('width',  wRect.width);
  svg.setAttribute('height', wRect.height);
  svg.innerHTML = '';

  const ingNodes   = wrap.querySelectorAll('[data-ing]');
  const phytoNodes = wrap.querySelectorAll('[data-phyto]');

  // 활성(하이라이트) 상태
  let activeIng = null, activePhyto = null;

  function getCenter(el) {
    const r = el.getBoundingClientRect();
    return {
      x: r.left - wRect.left + r.width / 2,
      y: r.top  - wRect.top  + r.height / 2,
    };
  }

  function drawAll(filterIng, filterPhyto) {
    svg.innerHTML = '';
    ingNodes.forEach(ingEl => {
      const ingName   = ingEl.getAttribute('data-ing');
      const ingPhytos = (ingEl.getAttribute('data-phytos') || '').split(',').filter(Boolean);
      if (!ingPhytos.length) return;

      const dimIng = filterIng && filterIng !== ingName;
      ingPhytos.forEach(phytoKey => {
        const phytoEl = wrap.querySelector('[data-phyto="' + phytoKey + '"]');
        if (!phytoEl) return;

        const dimPhyto = filterPhyto && filterPhyto !== phytoKey;
        const active   = (!filterIng && !filterPhyto)
                      || filterIng   === ingName
                      || filterPhyto === phytoKey;

        const p1 = getCenter(ingEl);
        const p2 = getCenter(phytoEl);
        const mx = (p1.x + p2.x) / 2;

        const g = PHYTOCHEMICAL_GROUPS[phytoKey];
        const col = g ? g.color : '#9CA3AF';

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d',
          'M ' + p1.x + ' ' + p1.y +
          ' C ' + mx + ' ' + p1.y + ', ' + mx + ' ' + p2.y + ', ' + p2.x + ' ' + p2.y
        );
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', active ? col : '#E5E7EB');
        path.setAttribute('stroke-width', active ? '2' : '1');
        path.setAttribute('opacity', active ? '0.85' : '0.3');
        path.setAttribute('stroke-dasharray', active ? 'none' : '4 3');
        svg.appendChild(path);
      });
    });
  }

  // 초기 렌더
  drawAll(null, null);

  // 호버: 식재료 노드
  ingNodes.forEach(ingEl => {
    ingEl.addEventListener('mouseenter', () => {
      activeIng = ingEl.getAttribute('data-ing');
      drawAll(activeIng, null);
      // 해당 파이토케미컬 노드 강조
      const phytos = (ingEl.getAttribute('data-phytos') || '').split(',');
      phytoNodes.forEach(p => {
        p.classList.toggle('ring-2', phytos.includes(p.getAttribute('data-phyto')));
        p.classList.toggle('scale-105', phytos.includes(p.getAttribute('data-phyto')));
      });
    });
    ingEl.addEventListener('mouseleave', () => {
      activeIng = null;
      drawAll(null, null);
      phytoNodes.forEach(p => { p.classList.remove('ring-2', 'scale-105'); });
    });
  });

  // 호버: 파이토케미컬 노드
  phytoNodes.forEach(phytoEl => {
    phytoEl.addEventListener('mouseenter', () => {
      activePhyto = phytoEl.getAttribute('data-phyto');
      drawAll(null, activePhyto);
      // 해당 식재료 노드 강조
      ingNodes.forEach(ing => {
        const phytos = (ing.getAttribute('data-phytos') || '').split(',');
        const hit = phytos.includes(activePhyto);
        ing.classList.toggle('ring-2', hit);
        ing.classList.toggle('ring-emerald-400', hit);
      });
    });
    phytoEl.addEventListener('mouseleave', () => {
      activePhyto = null;
      drawAll(null, null);
      ingNodes.forEach(ing => { ing.classList.remove('ring-2', 'ring-emerald-400'); });
    });
  });
}

// ─ 매핑 뷰 렌더 ─
function renderMappingView(allIng) {
  const container = document.getElementById('breakdown-map-view');
  if (!container) return;

  // 오늘 식단에서 실제 등장한 파이토케미컬 계열만
  const presentPhytoKeys = [...new Set(allIng.flatMap(i => i.phytos))];
  // PRF / non-PRF 분리
  const prfIngs  = allIng.filter(i => i.prf);
  const otherIngs = allIng.filter(i => !i.prf && i.phytos.length > 0); // phyto 있는 것만

  function ingNode(ing) {
    const cat  = FOOD_CATEGORIES[ing.cat] || {};
    const ring = ing.prf ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-gray-50';
    const txt  = ing.prf ? 'text-emerald-800' : 'text-gray-500';
    return '<div data-ing="' + ing.name + '" data-phytos="' + ing.phytos.join(',') + '"'
      + ' class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 cursor-pointer select-none transition-transform ' + ring + ' ' + txt + '"'
      + ' title="' + ing.name + ' ' + ing.totalGrams + 'g · ' + ing.totalKcal + 'kcal">'
      + '<span class="text-base leading-none">' + (cat.icon || '🔸') + '</span>'
      + '<span class="text-xs font-semibold whitespace-nowrap">' + ing.name + '</span>'
      + (ing.prf
        ? '<span class="text-xs text-emerald-500 font-bold ml-0.5">PRF</span>'
        : '')
      + '</div>';
  }

  function phytoNode(key) {
    const g = PHYTOCHEMICAL_GROUPS[key];
    if (!g) return '';
    return '<div data-phyto="' + key + '"'
      + ' class="flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer select-none transition-transform border-2 text-white font-semibold text-xs whitespace-nowrap"'
      + ' style="background:' + g.color + '; border-color:' + g.color + ';"'
      + ' title="' + g.name + ': ' + g.benefits.join(', ') + '">'
      + '<span class="text-sm leading-none">' + g.icon + '</span>'
      + '<span>' + g.name + '</span>'
      + '</div>';
  }

  // 미등장 파이토케미컬 (회색으로 표시)
  const absentPhytoKeys = Object.keys(PHYTOCHEMICAL_GROUPS).filter(k => !presentPhytoKeys.includes(k));

  container.innerHTML =
    // 범례
    '<div class="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-5 pb-4 border-b border-gray-100">'
    + '<span><span class="inline-block w-3 h-3 rounded-full bg-emerald-400 mr-1"></span>PRF 식재료 (PDI 산입)</span>'
    + '<span><span class="inline-block w-3 h-3 rounded-full bg-gray-300 mr-1"></span>기타 식재료</span>'
    + '<span class="text-amber-600"><i class="fas fa-info-circle mr-1"></i>호버하면 연결선이 강조됩니다 · 파이토케미컬 매핑은 추정 정보</span>'
    + '</div>'

    // 매핑 래퍼 (상대 위치 — SVG 오버레이용)
    + '<div id="mapping-wrap" class="relative">'

    // ── 3-column 레이아웃 ──
    + '<div class="grid grid-cols-[1fr_60px_1fr] gap-0 items-start">'

    // 왼쪽: 식재료
    + '<div class="flex flex-col gap-2 items-end pr-2">'
    + '<div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 self-end">식재료</div>'
    + prfIngs.map(ingNode).join('')
    + (otherIngs.length
        ? '<div class="text-xs text-gray-300 mt-3 mb-1 self-end">기타</div>' + otherIngs.map(ingNode).join('')
        : '')
    + '</div>'

    // 가운데: SVG 캔버스
    + '<div class="relative"><svg id="mapping-svg" class="absolute inset-0 pointer-events-none overflow-visible" style="left:-120px;width:calc(100%+240px);top:0"></svg></div>'

    // 오른쪽: 파이토케미컬 계열
    + '<div class="flex flex-col gap-2 items-start pl-2">'
    + '<div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">파이토케미컬 계열 <span class="font-normal">(추정)</span></div>'
    + presentPhytoKeys.map(phytoNode).join('')
    + (absentPhytoKeys.length
        ? '<div class="text-xs text-gray-300 mt-3 mb-1">미등장 계열</div>'
          + absentPhytoKeys.map(k => {
              const g = PHYTOCHEMICAL_GROUPS[k];
              return g
                ? '<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-gray-200 text-gray-300 text-xs font-semibold opacity-50">'
                  + g.icon + ' ' + g.name + '</div>'
                : '';
            }).join('')
        : '')
    + '</div>'

    + '</div>' // grid
    + '</div>'; // mapping-wrap
}

// ─ 식재료 분해 테이블 ─
function renderIngredientBreakdown(r) {
  const container = document.getElementById('ingredient-breakdown');
  if (!container) return;

  const allIng = getMergedIngredients(r);
  const prfList = allIng.filter(i => i.prf);
  const nonPrf  = allIng.filter(i => !i.prf);

  // ── 탭 헤더 ──
  const tabsHtml =
    '<div class="flex gap-2 mb-5">'
    + '<button id="tab-map" onclick="switchBreakdownTab(\'map\')"'
    + '  class="px-4 py-2 rounded-xl text-sm font-medium border border-emerald-700 bg-emerald-700 text-white transition">'
    + '  <i class="fas fa-project-diagram mr-1.5"></i>식재료 → 파이토케미컬 매핑'
    + '</button>'
    + '<button id="tab-table" onclick="switchBreakdownTab(\'table\')"'
    + '  class="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition">'
    + '  <i class="fas fa-table mr-1.5"></i>상세 테이블'
    + '</button>'
    + '</div>';

  // ── 매핑 뷰 HTML (기본 표시) ──
  const mapViewHtml = '<div id="breakdown-map-view"></div>';

  // ── 테이블 뷰 HTML ──
  function ingRow(i) {
    const cat = FOOD_CATEGORIES[i.cat] || {};
    const phytoChips = i.phytos.map(p => {
      const g = PHYTOCHEMICAL_GROUPS[p];
      return g ? '<span class="text-xs px-1.5 py-0.5 rounded text-white" style="background:' + g.color + '">' + g.name + '</span>' : '';
    }).join('');
    return '<tr class="border-b border-gray-50 hover:bg-gray-50 transition">'
      + '<td class="py-2 px-3 text-sm font-medium text-gray-900">' + (cat.icon || '') + ' ' + i.name + '</td>'
      + '<td class="py-2 px-3 text-xs text-gray-500">' + cat.name + '</td>'
      + '<td class="py-2 px-3 text-xs text-right text-gray-600">' + i.totalGrams + 'g</td>'
      + '<td class="py-2 px-3 text-xs text-right font-medium ' + (i.prf ? 'text-emerald-600' : 'text-gray-400') + '">' + i.totalKcal + ' kcal</td>'
      + '<td class="py-2 px-3"><div class="flex flex-wrap gap-1">' + phytoChips + '</div></td>'
      + '</tr>';
  }
  const tableViewHtml =
    '<div id="breakdown-table-view" class="hidden overflow-x-auto">'
    + '<table class="w-full text-sm">'
    + '<thead><tr class="bg-emerald-50 text-emerald-800">'
    + '<th class="py-2 px-3 text-left text-xs font-bold">식재료</th>'
    + '<th class="py-2 px-3 text-left text-xs font-bold">식품군</th>'
    + '<th class="py-2 px-3 text-right text-xs font-bold">섭취량</th>'
    + '<th class="py-2 px-3 text-right text-xs font-bold">칼로리</th>'
    + '<th class="py-2 px-3 text-left text-xs font-bold">파이토케미컬 <span class="font-normal text-gray-400">(추정)</span></th>'
    + '</tr></thead>'
    + '<tbody>'
    + (prfList.length
        ? '<tr class="bg-emerald-50/50"><td colspan="5" class="py-1 px-3 text-xs font-bold text-emerald-700">● PRF 식재료</td></tr>'
          + prfList.map(ingRow).join('')
        : '')
    + (nonPrf.length
        ? '<tr class="bg-gray-50"><td colspan="5" class="py-1 px-3 text-xs font-bold text-gray-500">○ 기타 식재료</td></tr>'
          + nonPrf.map(ingRow).join('')
        : '')
    + '</tbody></table></div>';

  container.innerHTML = tabsHtml + mapViewHtml + tableViewHtml;

  // 매핑 뷰 내용 채우고 연결선 그리기
  renderMappingView(allIng);
  setTimeout(drawMappingLines, 120);
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
