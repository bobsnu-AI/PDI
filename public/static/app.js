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
// PDI ENGINE  (식재료 집계 → 점수 계산)
// ══════════════════════════════════════════════
function calculatePDI() {
  // 모든 식사의 식재료를 합산
  let totalCalories = 0, prfCalories = 0;
  const categoryMap = {};
  const phytoMap    = {};
  const allIngredients = [];

  for (const mealEntry of addedMeals) {
    const { analysis } = mealEntry;
    totalCalories += analysis.totalCal;

    for (const ing of analysis.ingredients) {
      allIngredients.push({ ...ing, dish: mealEntry.name });

      // 카테고리 집계
      if (!categoryMap[ing.cat]) {
        categoryMap[ing.cat] = {
          calories: 0, percentage: 0,
          isPRF: (FOOD_CATEGORIES[ing.cat] || {}).isPRF || false,
          ingredients: []
        };
      }
      categoryMap[ing.cat].calories += ing.kcal;
      categoryMap[ing.cat].ingredients.push(ing.name);

      // PRF 칼로리
      if (ing.prf) {
        prfCalories += (ing.cat === 'tea') ? 50 : ing.kcal;
      }

      // 파이토케미컬 집계 (재료 개수 기준)
      for (const p of ing.phytos) {
        phytoMap[p] = (phytoMap[p] || 0) + 1;
      }
    }
  }

  // 카테고리 % 계산
  for (const k in categoryMap) {
    categoryMap[k].percentage = totalCalories > 0
      ? (categoryMap[k].calories / totalCalories) * 100 : 0;
    // 중복 제거
    categoryMap[k].ingredients = [...new Set(categoryMap[k].ingredients)];
  }

  // PDI 점수
  const pdiScore = totalCalories > 0 ? (prfCalories / totalCalories) * 100 : 0;

  // 파이토케미컬 커버리지
  const phytoCoverage = Object.keys(PHYTOCHEMICAL_GROUPS).map(key => {
    const g = PHYTOCHEMICAL_GROUPS[key];
    const count = phytoMap[key] || 0;
    let level, levelLabel;
    if (count === 0)     { level = 'none';   levelLabel = '미섭취'; }
    else if (count < 2)  { level = 'low';    levelLabel = '부족'; }
    else if (count < 4)  { level = 'medium'; levelLabel = '적정'; }
    else                 { level = 'high';   levelLabel = '충분'; }
    return { key, name: g.name, present: count > 0, count, level, levelLabel, color: g.color, icon: g.icon, benefits: g.benefits };
  });

  const diversityScore = phytoCoverage.filter(p => p.present).length;
  const deficient = phytoCoverage.filter(p => !p.present || p.level === 'low').map(p => p.key);

  // 영양 경고
  const warnings = [];
  if (addedMeals.length === 0) warnings.push('식사를 추가하지 않으셨습니다.');
  if (!phytoMap['isoflavones']) warnings.push('이소플라본 미섭취 — 두류(두부·된장·콩나물) 식품을 추가해보세요');
  if (categoryMap['refined'] && categoryMap['refined'].percentage > 40) {
    warnings.push('정제 곡물 비율 ' + categoryMap['refined'].percentage.toFixed(0) + '% — 통곡물로 일부 대체를 권장합니다');
  }

  // 등급
  let grade, gradeLabel, gradeColor;
  if (pdiScore >= 40)      { grade = 'excellent'; gradeLabel = '🌟 우수 (목표 달성!)'; gradeColor = '#10B981'; }
  else if (pdiScore >= 30) { grade = 'good';      gradeLabel = '👍 양호';              gradeColor = '#3B82F6'; }
  else if (pdiScore >= 20) { grade = 'fair';      gradeLabel = '📈 보통';              gradeColor = '#F59E0B'; }
  else                     { grade = 'poor';      gradeLabel = '⚠️ 개선 필요';         gradeColor = '#EF4444'; }

  // 개선 제안
  const suggestions = [];
  if (pdiScore < 40) suggestions.push('PRF 식재료(통곡물·두류·채소·과일) 비중을 높여 PDI 40% 목표를 달성하세요 (현재 ' + pdiScore.toFixed(1) + '%)');
  if (!phytoMap['isoflavones'])    suggestions.push('🫘 두부·된장찌개·콩밥 등을 추가하면 이소플라본을 보충할 수 있습니다');
  if (!phytoMap['carotenoids'])    suggestions.push('🥕 당근·고구마·단호박이 들어간 반찬이나 국을 추가해 카로티노이드를 보충하세요');
  if (!phytoMap['catechins'])      suggestions.push('🍵 식후 녹차·홍차 한 잔으로 카테킨을 쉽게 보충할 수 있습니다');
  if (!phytoMap['glucosinolates']) suggestions.push('🥦 배추김치·브로콜리·무가 들어간 국이나 나물로 글루코시놀레이트를 보충하세요');
  if (!phytoMap['anthocyanins'])   suggestions.push('🫐 흑미밥·검은콩·블루베리 등 보라색 식품으로 안토시아닌을 보충하세요');
  if (diversityScore < 6) suggestions.push('🌈 다양한 색깔의 채소·과일을 포함한 반찬으로 파이토케미컬 다양성을 높이세요 (현재 ' + diversityScore + '/12)');

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
      + '<div class="text-xs text-gray-400 mt-1">재료 ' + p.count + '개에서 검출</div>'
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

// ─ 식재료 분해 테이블 ─
function renderIngredientBreakdown(r) {
  const container = document.getElementById('ingredient-breakdown');
  if (!container) return;

  // 카테고리별로 묶기
  const byCategory = {};
  for (const ing of r.allIngredients) {
    if (!byCategory[ing.cat]) byCategory[ing.cat] = [];
    byCategory[ing.cat].push(ing);
  }

  // 같은 재료 중복 합산
  const merged = {};
  for (const ing of r.allIngredients) {
    const key = ing.name + '|' + ing.cat;
    if (!merged[key]) merged[key] = { ...ing, totalKcal: 0, totalGrams: 0 };
    merged[key].totalKcal  += ing.kcal;
    merged[key].totalGrams += ing.grams;
  }

  // PRF / non-PRF 분리 후 kcal 내림차순
  const allIng = Object.values(merged).sort((a, b) => b.totalKcal - a.totalKcal);
  const prfList = allIng.filter(i => i.prf);
  const nonPrf  = allIng.filter(i => !i.prf);

  function ingRow(i) {
    const cat = FOOD_CATEGORIES[i.cat] || {};
    const phytoChips = i.phytos.map(p => {
      const g = PHYTOCHEMICAL_GROUPS[p];
      return g ? '<span class="text-xs px-1.5 py-0.5 rounded text-white" style="background:' + g.color + '">' + g.name + '</span>' : '';
    }).join('');
    return '<tr class="border-b border-gray-50 hover:bg-gray-50">'
      + '<td class="py-2 px-3 text-sm font-medium text-gray-900">' + (cat.icon || '') + ' ' + i.name + '</td>'
      + '<td class="py-2 px-3 text-xs text-gray-500">' + cat.name + '</td>'
      + '<td class="py-2 px-3 text-xs text-right text-gray-600">' + i.totalGrams + 'g</td>'
      + '<td class="py-2 px-3 text-xs text-right font-medium ' + (i.prf ? 'text-emerald-600' : 'text-gray-400') + '">' + i.totalKcal + ' kcal</td>'
      + '<td class="py-2 px-3"><div class="flex flex-wrap gap-1">' + phytoChips + '</div></td>'
      + '</tr>';
  }

  container.innerHTML =
    '<div class="overflow-x-auto">'
    + '<table class="w-full text-sm">'
    + '<thead><tr class="bg-emerald-50 text-emerald-800">'
    + '<th class="py-2 px-3 text-left text-xs font-bold">식재료</th>'
    + '<th class="py-2 px-3 text-left text-xs font-bold">식품군</th>'
    + '<th class="py-2 px-3 text-right text-xs font-bold">섭취량</th>'
    + '<th class="py-2 px-3 text-right text-xs font-bold">칼로리</th>'
    + '<th class="py-2 px-3 text-left text-xs font-bold">파이토케미컬</th>'
    + '</tr></thead>'
    + '<tbody>'
    + (prfList.length ? '<tr class="bg-emerald-50/50"><td colspan="5" class="py-1 px-3 text-xs font-bold text-emerald-700">● PRF 식재료 (파이토케미컬 풍부)</td></tr>' + prfList.map(ingRow).join('') : '')
    + (nonPrf.length  ? '<tr class="bg-gray-50"><td colspan="5" class="py-1 px-3 text-xs font-bold text-gray-500">○ 기타 식재료</td></tr>' + nonPrf.map(ingRow).join('') : '')
    + '</tbody></table></div>';
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
