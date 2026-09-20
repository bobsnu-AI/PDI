// ============================================
// 밥스누 PDI 웰니스 솔루션 - 메인 앱 스크립트
// ============================================

// ============================================
// DATA
// ============================================
const FOOD_CATEGORIES = {
  grains:     { name: '통곡물',        icon: '🌾', color: '#F59E0B', isPRF: true  },
  legumes:    { name: '두류·콩가공품', icon: '🫘', color: '#8B5CF6', isPRF: true  },
  vegetables: { name: '채소·나물',     icon: '🥬', color: '#10B981', isPRF: true  },
  fruits:     { name: '과일',          icon: '🍎', color: '#EF4444', isPRF: true  },
  nuts:       { name: '견과·종실',     icon: '🥜', color: '#D97706', isPRF: true  },
  oils:       { name: '식물성 오일',   icon: '🫙', color: '#EAB308', isPRF: true  },
  tea:        { name: '차·커피·코코아',icon: '🍵', color: '#6B7280', isPRF: true  },
  spices:     { name: '향신료',        icon: '🌶️', color: '#DC2626', isPRF: false },
  protein:    { name: '동물성 단백질', icon: '🥩', color: '#9CA3AF', isPRF: false },
  dairy:      { name: '유제품',        icon: '🥛', color: '#93C5FD', isPRF: false },
  refined:    { name: '정제 곡물·당류',icon: '🍞', color: '#FCA5A5', isPRF: false },
};

const PHYTOCHEMICAL_GROUPS = {
  isoflavones:    { name: '이소플라본',      benefits: ['여성건강', '골건강', '콜레스테롤'], color: '#8B5CF6', icon: '💜' },
  anthocyanins:   { name: '안토시아닌',      benefits: ['항산화', 'LDL 억제', '시력'],      color: '#6D28D9', icon: '🫐' },
  catechins:      { name: '카테킨',          benefits: ['LDL 억제', '항염', '체지방'],       color: '#059669', icon: '🍃' },
  carotenoids:    { name: '카로티노이드',    benefits: ['항산화', '황반보호', '눈건강'],     color: '#F59E0B', icon: '🟠' },
  phenolicAcids:  { name: '페놀산',          benefits: ['항산화', '저GI', '항염'],           color: '#92400E', icon: '🌰' },
  glucosinolates: { name: '글루코시놀레이트',benefits: ['체지방', '해독효소', '항암'],       color: '#065F46', icon: '🥦' },
  stilbenes:      { name: '스틸벤',          benefits: ['심혈관', '뇌건강', '항산화'],       color: '#7C3AED', icon: '🍇' },
  lignans:        { name: '리그난',          benefits: ['콜레스테롤', '여성건강', '항산화'], color: '#78350F', icon: '🌻' },
  saponins:       { name: '사포닌',          benefits: ['콜레스테롤', '항산화', '면역'],     color: '#047857', icon: '🫘' },
  gingerols:      { name: '진저롤·커큐민',   benefits: ['항염', '소화', '관절'],             color: '#D97706', icon: '🫚' },
  flavonols:      { name: '플라보놀',        benefits: ['항산화', '항염', '심혈관'],         color: '#B45309', icon: '🌼' },
  thioallyls:     { name: '티오알릴',        benefits: ['항염', '항혈전', '면역'],           color: '#4B5563', icon: '🧄' },
};

const FOOD_ITEMS = [
  // 통곡물
  { id: 'brown_rice',  name: '현미밥',   category: 'grains',     calories: 160, serving: '1공기',  prf: true,  phytos: ['phenolicAcids', 'lignans'] },
  { id: 'oats',        name: '오트밀',   category: 'grains',     calories: 150, serving: '1/2컵',  prf: true,  phytos: ['phenolicAcids', 'lignans'] },
  { id: 'whole_bread', name: '통밀빵',   category: 'grains',     calories: 130, serving: '2쪽',    prf: true,  phytos: ['phenolicAcids', 'lignans'] },
  { id: 'multigrain',  name: '잡곡밥',   category: 'grains',     calories: 165, serving: '1공기',  prf: true,  phytos: ['phenolicAcids', 'lignans'] },
  { id: 'white_rice',  name: '흰쌀밥',   category: 'refined',    calories: 160, serving: '1공기',  prf: false, phytos: [] },
  // 두류
  { id: 'black_soy',   name: '약콩(흑두)',category: 'legumes',    calories: 110, serving: '1/2컵',  prf: true,  phytos: ['isoflavones', 'anthocyanins', 'saponins'] },
  { id: 'soybean',     name: '일반 콩',   category: 'legumes',    calories: 110, serving: '1/2컵',  prf: true,  phytos: ['isoflavones', 'saponins'] },
  { id: 'tofu',        name: '두부',      category: 'legumes',    calories: 80,  serving: '1/4모',  prf: true,  phytos: ['isoflavones', 'saponins'] },
  { id: 'soymilk',     name: '두유',      category: 'legumes',    calories: 90,  serving: '1팩',    prf: true,  phytos: ['isoflavones', 'saponins'] },
  { id: 'bean_sprout', name: '콩나물',    category: 'legumes',    calories: 30,  serving: '1컵',    prf: true,  phytos: ['isoflavones'] },
  { id: 'doenjang',    name: '된장찌개',  category: 'legumes',    calories: 80,  serving: '1그릇',  prf: true,  phytos: ['isoflavones', 'saponins'] },
  // 채소
  { id: 'broccoli',    name: '브로콜리',  category: 'vegetables', calories: 35,  serving: '1컵',    prf: true,  phytos: ['glucosinolates', 'carotenoids', 'flavonols'] },
  { id: 'spinach',     name: '시금치',    category: 'vegetables', calories: 25,  serving: '1컵',    prf: true,  phytos: ['carotenoids', 'flavonols', 'phenolicAcids'] },
  { id: 'kimchi',      name: '김치',      category: 'vegetables', calories: 20,  serving: '1접시',  prf: true,  phytos: ['glucosinolates', 'phenolicAcids'] },
  { id: 'namul',       name: '나물 반찬', category: 'vegetables', calories: 50,  serving: '1접시',  prf: true,  phytos: ['carotenoids', 'flavonols', 'phenolicAcids'] },
  { id: 'carrot',      name: '당근',      category: 'vegetables', calories: 30,  serving: '1/2개',  prf: true,  phytos: ['carotenoids'] },
  { id: 'tomato',      name: '토마토',    category: 'vegetables', calories: 20,  serving: '1개',    prf: true,  phytos: ['carotenoids', 'phenolicAcids'] },
  { id: 'onion',       name: '양파',      category: 'vegetables', calories: 40,  serving: '1/2개',  prf: true,  phytos: ['flavonols', 'thioallyls'] },
  { id: 'garlic',      name: '마늘',      category: 'spices',     calories: 15,  serving: '5쪽',    prf: false, phytos: ['thioallyls'] },
  { id: 'sweet_potato',name: '고구마',    category: 'vegetables', calories: 130, serving: '1개',    prf: true,  phytos: ['carotenoids', 'phenolicAcids'] },
  { id: 'cabbage',     name: '양배추',    category: 'vegetables', calories: 25,  serving: '1컵',    prf: true,  phytos: ['glucosinolates', 'phenolicAcids'] },
  // 과일
  { id: 'blueberry',   name: '블루베리',  category: 'fruits',     calories: 85,  serving: '1컵',    prf: true,  phytos: ['anthocyanins', 'flavonols', 'stilbenes'] },
  { id: 'strawberry',  name: '딸기',      category: 'fruits',     calories: 50,  serving: '10개',   prf: true,  phytos: ['anthocyanins', 'flavonols', 'phenolicAcids'] },
  { id: 'apple',       name: '사과',      category: 'fruits',     calories: 80,  serving: '1개',    prf: true,  phytos: ['flavonols', 'phenolicAcids'] },
  { id: 'orange',      name: '귤·오렌지', category: 'fruits',     calories: 60,  serving: '1개',    prf: true,  phytos: ['flavonols', 'carotenoids'] },
  { id: 'grape',       name: '포도',      category: 'fruits',     calories: 90,  serving: '1컵',    prf: true,  phytos: ['stilbenes', 'anthocyanins', 'flavonols'] },
  { id: 'banana',      name: '바나나',    category: 'fruits',     calories: 110, serving: '1개',    prf: true,  phytos: ['phenolicAcids'] },
  // 견과
  { id: 'walnut',      name: '호두',      category: 'nuts',       calories: 200, serving: '한 줌',  prf: true,  phytos: ['lignans', 'stilbenes', 'phenolicAcids'] },
  { id: 'almond',      name: '아몬드',    category: 'nuts',       calories: 180, serving: '한 줌',  prf: true,  phytos: ['flavonols', 'phenolicAcids'] },
  { id: 'sesame',      name: '참깨',      category: 'nuts',       calories: 90,  serving: '1큰술',  prf: true,  phytos: ['lignans'] },
  // 차류
  { id: 'green_tea',   name: '녹차',      category: 'tea',        calories: 5,   serving: '1잔',    prf: true,  phytos: ['catechins', 'flavonols'] },
  { id: 'black_tea',   name: '홍차',      category: 'tea',        calories: 5,   serving: '1잔',    prf: true,  phytos: ['catechins', 'flavonols'] },
  { id: 'coffee',      name: '아메리카노',category: 'tea',        calories: 10,  serving: '1잔',    prf: true,  phytos: ['phenolicAcids'] },
  // 단백질
  { id: 'chicken',     name: '닭가슴살',  category: 'protein',    calories: 165, serving: '100g',   prf: false, phytos: [] },
  { id: 'egg',         name: '계란',      category: 'protein',    calories: 70,  serving: '1개',    prf: false, phytos: [] },
  { id: 'fish',        name: '생선',      category: 'protein',    calories: 150, serving: '100g',   prf: false, phytos: [] },
  // 유제품
  { id: 'milk',        name: '우유',      category: 'dairy',      calories: 130, serving: '1컵',    prf: false, phytos: [] },
  { id: 'yogurt',      name: '요거트',    category: 'dairy',      calories: 100, serving: '1개',    prf: false, phytos: [] },
];

const HEALTH_GOALS = [
  { id: 'diet',         name: '다이어트',  icon: '⚖️', phytos: ['glucosinolates', 'catechins', 'phenolicAcids'] },
  { id: 'blood_sugar',  name: '혈당 관리', icon: '🩸', phytos: ['phenolicAcids', 'isoflavones', 'lignans'] },
  { id: 'cardiovascular',name: '혈관·심장',icon: '❤️', phytos: ['catechins', 'anthocyanins', 'stilbenes'] },
  { id: 'brain',        name: '뇌건강',    icon: '🧠', phytos: ['stilbenes', 'anthocyanins', 'catechins'] },
  { id: 'muscle',       name: '근육·시니어',icon: '💪',phytos: ['isoflavones', 'saponins'] },
  { id: 'antioxidant',  name: '항산화',    icon: '✨', phytos: ['carotenoids', 'anthocyanins', 'flavonols'] },
  { id: 'womens',       name: '여성건강',  icon: '👩', phytos: ['isoflavones', 'lignans'] },
  { id: 'gut',          name: '장건강',    icon: '🌿', phytos: ['phenolicAcids', 'saponins', 'gingerols'] },
  { id: 'eye',          name: '눈건강',    icon: '👁️', phytos: ['carotenoids', 'anthocyanins'] },
  { id: 'antiinflam',   name: '항염·면역', icon: '🛡️', phytos: ['gingerols', 'thioallyls', 'catechins'] },
];

const BOBSNU_PRODUCTS = [
  { id: 'yakong_soymilk', name: '약콩두유',        desc: '약콩(흑두) 기반 이소플라본·안토시아닌',       icon: '🫘', phytos: ['isoflavones', 'anthocyanins', 'saponins'], targets: ['여성건강', '골건강', '콜레스테롤'], color: '#8B5CF6' },
  { id: 'phyto100',       name: '파이토100',        desc: '100종 파이토케미컬 통합 블렌드',              icon: '💊', phytos: ['phenolicAcids', 'lignans', 'catechins', 'carotenoids'], targets: ['혈당', '항산화', '종합건강'], color: '#059669' },
  { id: 'phyto100_s2',    name: '파이토100 시즌2',  desc: '혈관·뇌건강 특화 피세아탄놀',                icon: '🧠', phytos: ['stilbenes', 'anthocyanins', 'catechins'], targets: ['혈관', '뇌건강', '항산화'], color: '#2563EB' },
  { id: 'phyto_black',    name: '파이토블랙',        desc: '검은색 식품 파이토케미컬 집중 공급',         icon: '🫐', phytos: ['anthocyanins', 'stilbenes'], targets: ['항산화', '혈관'], color: '#4F46E5' },
  { id: 'protein_bar',    name: '약콩 프로틴바',     desc: '약콩 단백질 + 이소플라본',                   icon: '💪', phytos: ['isoflavones', 'phenolicAcids', 'saponins'], targets: ['근육', '시니어', '단백질'], color: '#EA580C' },
  { id: 'yakong_tea',     name: '약콩차',            desc: '약콩 기반 카테킨·이소플라본 차',             icon: '🍵', phytos: ['catechins', 'isoflavones'], targets: ['체지방', '항산화'], color: '#0D9488' },
  { id: 'diet_soymilk',   name: '다이어트 두유',     desc: '설포라핀(글루코시놀레이트) 특화',            icon: '🥦', phytos: ['glucosinolates', 'isoflavones'], targets: ['다이어트', '체지방'], color: '#16A34A' },
  { id: 'yakong100',      name: '약콩100',           desc: '약콩 100% 순수 파이토케미컬 농축',           icon: '⭐', phytos: ['isoflavones', 'anthocyanins', 'saponins'], targets: ['시니어', '여성건강'], color: '#CA8A04' },
];

// ============================================
// STATE
// ============================================
let currentStep = 1;
const selectedFoods = new Set();
const selectedGoals = new Set();
let currentCategory = 'all';
let pdiResult = null;
let chartInstance = null;
let gender = 'female';

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  renderFoodGrid(null);
  renderHealthGoals();
  renderProductGrid();
});

// ============================================
// NAVIGATION
// ============================================
function scrollToAssessment() {
  document.getElementById('assessment').scrollIntoView({ behavior: 'smooth' });
}

function setGender(g) {
  gender = g;
  const maleBtn = document.getElementById('gender-male');
  const femaleBtn = document.getElementById('gender-female');
  if (g === 'male') {
    maleBtn.className = maleBtn.className.replace('border-gray-200', 'border-emerald-500').replace(/bg-\w+-50/g, '') + ' bg-emerald-50';
    femaleBtn.className = femaleBtn.className.replace('border-emerald-500', 'border-gray-200').replace('bg-emerald-50', '');
  } else {
    femaleBtn.className = femaleBtn.className.replace('border-gray-200', 'border-emerald-500').replace(/bg-\w+-50/g, '') + ' bg-emerald-50';
    maleBtn.className = maleBtn.className.replace('border-emerald-500', 'border-gray-200').replace('bg-emerald-50', '');
  }
}

function goToStep(n) {
  document.getElementById('step-' + currentStep).classList.add('hidden');
  document.getElementById('step-' + n).classList.remove('hidden');
  
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('step-' + i + '-dot');
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

// ============================================
// FOOD GRID
// ============================================
function renderFoodGrid(cat) {
  const grid = document.getElementById('food-grid');
  const items = FOOD_ITEMS.filter(f => !cat || f.category === cat);
  
  grid.innerHTML = items.map(food => {
    const catData = FOOD_CATEGORIES[food.category] || {};
    const isSelected = selectedFoods.has(food.id);
    const borderClass = isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-white hover:border-gray-300';
    const prfDot = food.prf ? '<span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500"></span>' : '';
    const checkIcon = isSelected ? '<div class="absolute top-1.5 left-1.5"><i class="fas fa-check-circle text-emerald-500 text-sm"></i></div>' : '';
    
    return '<div onclick="toggleFood(\'' + food.id + '\')" class="relative border-2 rounded-2xl p-3 text-center cursor-pointer transition-all ' + borderClass + '">'
      + prfDot + checkIcon
      + '<div class="text-2xl mb-1">' + (catData.icon || '🍽️') + '</div>'
      + '<div class="text-xs font-medium text-gray-800 leading-tight">' + food.name + '</div>'
      + '<div class="text-xs text-gray-400 mt-0.5">' + food.serving + '</div>'
      + '<div class="text-xs font-bold mt-1 ' + (food.prf ? 'text-emerald-600' : 'text-gray-400') + '">' + food.calories + ' kcal</div>'
      + '</div>';
  }).join('');
}

function toggleFood(id) {
  if (selectedFoods.has(id)) selectedFoods.delete(id);
  else selectedFoods.add(id);
  renderFoodGrid(currentCategory === 'all' ? null : currentCategory);
  updateSelectedFoodsDisplay();
}

function updateSelectedFoodsDisplay() {
  const section = document.getElementById('selected-foods-section');
  const list = document.getElementById('selected-foods-list');
  const count = document.getElementById('selected-count');
  count.textContent = '(' + selectedFoods.size + ')';
  
  if (selectedFoods.size > 0) {
    section.classList.remove('hidden');
    list.innerHTML = Array.from(selectedFoods).map(id => {
      const food = FOOD_ITEMS.find(f => f.id === id);
      if (!food) return '';
      const cat = FOOD_CATEGORIES[food.category] || {};
      return '<span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium">'
        + (cat.icon || '') + ' ' + food.name
        + '<button onclick="toggleFood(\'' + id + '\')" class="ml-1 text-emerald-500 hover:text-red-500 font-bold">×</button>'
        + '</span>';
    }).join('');
  } else {
    section.classList.add('hidden');
  }
}

function filterCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.className = btn.className.replace('bg-emerald-700', 'bg-white').replace('text-white', 'text-gray-700').replace('border-emerald-600', 'border-gray-200');
  });
  const activeBtn = document.getElementById('cat-' + cat);
  if (activeBtn) {
    activeBtn.className = activeBtn.className.replace('bg-white', 'bg-emerald-700').replace('text-gray-700', 'text-white').replace('border-gray-200', 'border-emerald-600');
  }
  renderFoodGrid(cat === 'all' ? null : cat);
}

// ============================================
// HEALTH GOALS
// ============================================
function renderHealthGoals() {
  const grid = document.getElementById('health-goals-grid');
  grid.innerHTML = HEALTH_GOALS.map(goal => {
    const isSelected = selectedGoals.has(goal.id);
    const borderClass = isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-white hover:border-gray-300';
    const check = isSelected ? '<div class="mt-1"><i class="fas fa-check-circle text-emerald-500 text-sm"></i></div>' : '';
    return '<div onclick="toggleGoal(\'' + goal.id + '\')" class="border-2 rounded-2xl p-4 text-center cursor-pointer transition-all ' + borderClass + '">'
      + '<div class="text-3xl mb-2">' + goal.icon + '</div>'
      + '<div class="text-sm font-medium text-gray-800">' + goal.name + '</div>'
      + check + '</div>';
  }).join('');
}

function toggleGoal(id) {
  if (selectedGoals.has(id)) {
    selectedGoals.delete(id);
  } else {
    if (selectedGoals.size >= 3) { alert('건강 목적은 최대 3개까지 선택할 수 있습니다'); return; }
    selectedGoals.add(id);
  }
  renderHealthGoals();
}

// ============================================
// PDI CALCULATION
// ============================================
function calculatePDI() {
  const meals = Array.from(selectedFoods).map(id => {
    return FOOD_ITEMS.find(f => f.id === id);
  }).filter(Boolean);
  
  let totalCalories = 0, prfCalories = 0;
  const categoryMap = {};
  const phytoMap = {};
  
  for (const food of meals) {
    const cal = food.calories;
    totalCalories += cal;
    
    if (!categoryMap[food.category]) {
      categoryMap[food.category] = {
        calories: 0, percentage: 0,
        isPRF: (FOOD_CATEGORIES[food.category] || {}).isPRF || false,
        foodCount: 0
      };
    }
    categoryMap[food.category].calories += cal;
    categoryMap[food.category].foodCount++;
    
    if (food.prf) {
      prfCalories += (food.category === 'tea') ? 50 : cal;
    }
    for (const p of food.phytos) {
      phytoMap[p] = (phytoMap[p] || 0) + 1;
    }
  }
  
  for (const k in categoryMap) {
    categoryMap[k].percentage = totalCalories > 0 ? (categoryMap[k].calories / totalCalories) * 100 : 0;
  }
  
  const pdiScore = totalCalories > 0 ? (prfCalories / totalCalories) * 100 : 0;
  
  const phytoCoverage = Object.keys(PHYTOCHEMICAL_GROUPS).map(key => {
    const g = PHYTOCHEMICAL_GROUPS[key];
    const count = phytoMap[key] || 0;
    let level, levelLabel;
    if (count === 0)      { level = 'none';   levelLabel = '미섭취'; }
    else if (count < 1)   { level = 'low';    levelLabel = '부족'; }
    else if (count < 2)   { level = 'medium'; levelLabel = '적정'; }
    else                  { level = 'high';   levelLabel = '충분'; }
    return { key, name: g.name, present: count > 0, count, level, levelLabel, color: g.color, icon: g.icon, benefits: g.benefits };
  });
  
  const diversityScore = phytoCoverage.filter(p => p.present).length;
  const deficient = phytoCoverage.filter(p => p.level === 'none' || p.level === 'low').map(p => p.key);
  
  const warnings = [];
  if (categoryMap['refined'] && pdiScore < 30) warnings.push('정제 곡물 비율이 높습니다. 통곡물로 대체를 권장합니다');
  if (!phytoMap['isoflavones']) warnings.push('이소플라본 미섭취 - 두류 식품을 추가해보세요');
  if (selectedFoods.size === 0) warnings.push('음식을 선택하지 않으셨습니다. 오늘 드신 음식을 추가해 보세요');
  
  let grade, gradeLabel, gradeColor;
  if (pdiScore >= 40)      { grade = 'excellent'; gradeLabel = '🌟 우수 (목표 달성!)'; gradeColor = '#10B981'; }
  else if (pdiScore >= 30) { grade = 'good';      gradeLabel = '👍 양호';              gradeColor = '#3B82F6'; }
  else if (pdiScore >= 20) { grade = 'fair';      gradeLabel = '📈 보통';              gradeColor = '#F59E0B'; }
  else                     { grade = 'poor';      gradeLabel = '⚠️ 개선 필요';         gradeColor = '#EF4444'; }
  
  const suggestions = [];
  if (pdiScore < 40) suggestions.push('파이토케미컬 풍부 식품(PRF) 섭취를 늘려 PDI 목표 40%를 달성하세요 (현재 ' + pdiScore.toFixed(1) + '%)');
  if (!phytoMap['isoflavones'])    suggestions.push('🫘 두부, 두유, 콩 요리로 이소플라본을 보충하세요 - 여성건강·골건강에 효과적');
  if (!phytoMap['carotenoids'])    suggestions.push('🥕 당근, 고구마, 토마토로 카로티노이드를 보충하세요 - 항산화·눈건강에 도움');
  if (!phytoMap['catechins'])      suggestions.push('🍵 녹차 한 잔으로 카테킨을 쉽게 보충할 수 있습니다 - 체지방 감소·항염 효과');
  if (!phytoMap['glucosinolates']) suggestions.push('🥦 브로콜리, 김치로 글루코시놀레이트를 보충하세요 - 체지방 감소 지원');
  if (!phytoMap['anthocyanins'])   suggestions.push('🫐 블루베리, 약콩(흑두)으로 안토시아닌을 보충하세요 - 항산화·시력 보호');
  if (diversityScore < 6)          suggestions.push('🌈 다양한 색깔의 채소·과일로 파이토케미컬 다양성을 높이세요 (현재 ' + diversityScore + '/12)');
  
  return { pdiScore, prfCalories, totalCalories, categoryMap, phytoCoverage, diversityScore, warnings, grade, gradeLabel, gradeColor, deficient, suggestions, phytoMap };
}

// ============================================
// DISPLAY RESULTS
// ============================================
function calculateAndShow() {
  pdiResult = calculatePDI();
  goToStep(4);
  displayResults();
}

function displayResults() {
  const r = pdiResult;
  
  // PDI Ring
  const score = Math.min(r.pdiScore, 100);
  const circumference = 314;
  const ring = document.getElementById('pdi-ring');
  ring.setAttribute('stroke-dasharray', ((score / 100) * circumference) + ' ' + circumference);
  ring.setAttribute('stroke', r.gradeColor);
  
  document.getElementById('pdi-score-display').textContent = r.pdiScore.toFixed(1) + '%';
  document.getElementById('pdi-score-display').style.color = r.gradeColor;
  
  const badge = document.getElementById('pdi-grade-badge');
  badge.textContent = r.gradeLabel;
  badge.style.backgroundColor = r.gradeColor;
  
  document.getElementById('total-cal').textContent = Math.round(r.totalCalories) + ' kcal';
  document.getElementById('prf-cal').textContent = Math.round(r.prfCalories) + ' kcal';
  document.getElementById('diversity-score').textContent = r.diversityScore + '/12';
  document.getElementById('food-cat-count').textContent = Object.keys(r.categoryMap).length + '가지';
  
  // Warnings
  if (r.warnings.length > 0) {
    document.getElementById('warnings-section').classList.remove('hidden');
    document.getElementById('warnings-list').innerHTML = r.warnings.map(w => '<li>' + w + '</li>').join('');
  }
  
  // Phyto Analysis Grid
  const levelBg = { high: 'bg-emerald-50 border-emerald-200', medium: 'bg-blue-50 border-blue-200', low: 'bg-amber-50 border-amber-200', none: 'bg-gray-50 border-gray-200' };
  const levelText = { high: 'text-emerald-700', medium: 'text-blue-700', low: 'text-amber-700', none: 'text-gray-400' };
  
  document.getElementById('phyto-analysis-grid').innerHTML = r.phytoCoverage.map(p => {
    const barWidth = Math.min(p.count * 50, 100);
    const barHtml = p.count > 0
      ? '<div class="mt-2 h-1.5 bg-gray-200 rounded-full"><div class="h-1.5 rounded-full" style="width:' + barWidth + '%;background-color:' + p.color + '"></div></div>'
      : '<div class="mt-2 h-1.5 bg-gray-100 rounded-full"></div>';
    return '<div class="border-2 rounded-2xl p-4 ' + levelBg[p.level] + '">'
      + '<div class="flex items-center justify-between mb-2">'
      + '<span class="text-xl">' + p.icon + '</span>'
      + '<span class="text-xs font-bold px-2 py-0.5 rounded-full ' + levelText[p.level] + '">' + p.levelLabel + '</span>'
      + '</div>'
      + '<div class="text-sm font-bold text-gray-800">' + p.name + '</div>'
      + '<div class="text-xs text-gray-500 mt-0.5">' + p.benefits.slice(0, 2).join(' · ') + '</div>'
      + barHtml + '</div>';
  }).join('');
  
  // Chart
  setTimeout(() => renderCategoryChart(r.categoryMap), 150);
  
  // Products
  renderProductRecommendations(r);
  
  // Suggestions
  document.getElementById('diet-suggestions').innerHTML = r.suggestions.map((s, i) =>
    '<div class="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl">'
    + '<div class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">' + (i + 1) + '</div>'
    + '<p class="text-gray-700 text-sm">' + s + '</p></div>'
  ).join('');
}

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
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: (ctx) => ctx.label + ': ' + ctx.raw + 'kcal (' + ((ctx.raw / pdiResult.totalCalories) * 100).toFixed(1) + '%)'
      }}},
      cutout: '60%'
    }
  });
  
  // Legend
  const legend = document.getElementById('category-legend');
  legend.innerHTML = labels.map((l, i) => {
    const catEntry = Object.entries(catMap).find(([k]) => (FOOD_CATEGORIES[k] || {}).name === l);
    const isPRF = catEntry ? catEntry[1].isPRF : false;
    const pct = pdiResult.totalCalories > 0 ? ((data[i] / pdiResult.totalCalories) * 100).toFixed(1) : 0;
    return '<div class="flex items-center justify-between py-1">'
      + '<div class="flex items-center gap-2">'
      + '<div class="w-3 h-3 rounded-full flex-shrink-0" style="background:' + colors[i] + '"></div>'
      + '<span class="text-sm text-gray-700">' + l + '</span>'
      + (isPRF ? '<span class="text-xs text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">PRF</span>' : '')
      + '</div>'
      + '<div class="text-sm font-bold text-gray-900 ml-4">' + data[i] + 'kcal <span class="text-gray-400 font-normal text-xs">(' + pct + '%)</span></div>'
      + '</div>';
  }).join('');
}

function renderProductRecommendations(r) {
  const goalPhytos = new Set(Array.from(selectedGoals).flatMap(gid => {
    const g = HEALTH_GOALS.find(h => h.id === gid);
    return g ? g.phytos : [];
  }));
  const deficientSet = new Set(r.deficient);
  
  const scored = BOBSNU_PRODUCTS.map(prod => {
    let score = 0;
    for (const p of prod.phytos) {
      if (deficientSet.has(p)) score += 3;
      if (goalPhytos.has(p)) score += 2;
    }
    return Object.assign({}, prod, { score });
  }).sort((a, b) => b.score - a.score).slice(0, 6);
  
  document.getElementById('product-recommendations').innerHTML = scored.map(p => {
    const isTop = p.score > 4;
    return '<div class="border-2 rounded-2xl p-5 bg-white hover:shadow-md transition-shadow" style="border-color:' + (isTop ? p.color : '#E5E7EB') + '">'
      + (isTop ? '<div class="text-xs font-bold mb-2" style="color:' + p.color + '"><i class="fas fa-star mr-1"></i>맞춤 추천</div>' : '')
      + '<div class="flex items-start gap-3 mb-3">'
      + '<span class="text-3xl">' + p.icon + '</span>'
      + '<div><div class="font-bold text-gray-900">' + p.name + '</div><div class="text-xs text-gray-500 mt-0.5">' + p.desc + '</div></div>'
      + '</div>'
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

// ============================================
// PRODUCT GRID (B2C Section)
// ============================================
function renderProductGrid() {
  document.getElementById('product-grid').innerHTML = BOBSNU_PRODUCTS.map(p =>
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
    + '<button onclick="alert(\'구독 서비스 준비 중입니다.\\n제품 상담 문의로 연락주세요\')" class="w-full py-2.5 rounded-xl text-white text-sm font-medium transition" style="background:' + p.color + '">'
    + '구독 신청</button></div>'
  ).join('');
}

// ============================================
// UTILS
// ============================================
function restartAssessment() {
  selectedFoods.clear();
  selectedGoals.clear();
  currentCategory = 'all';
  pdiResult = null;
  goToStep(1);
  renderFoodGrid(null);
  renderHealthGoals();
  // reset tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.className = btn.className.replace('bg-emerald-700', 'bg-white').replace('text-white', 'text-gray-700').replace('border-emerald-600', 'border-gray-200');
  });
  const allBtn = document.getElementById('cat-all');
  if (allBtn) allBtn.className = allBtn.className.replace('bg-white', 'bg-emerald-700').replace('text-gray-700', 'text-white').replace('border-gray-200', 'border-emerald-600');
}
