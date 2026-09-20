// 파이토케미컬 데이터베이스 - 식품군별 파이토케미컬 매핑

export const FOOD_CATEGORIES = {
  grains: { name: '통곡물', icon: '🌾', color: '#F59E0B', isPRF: true },
  legumes: { name: '두류·콩가공품', icon: '🫘', color: '#8B5CF6', isPRF: true },
  vegetables: { name: '채소·나물', icon: '🥬', color: '#10B981', isPRF: true },
  fruits: { name: '과일', icon: '🍎', color: '#EF4444', isPRF: true },
  nuts: { name: '견과·종실', icon: '🥜', color: '#D97706', isPRF: true },
  oils: { name: '식물성 오일', icon: '🫙', color: '#F3C600', isPRF: true },
  tea: { name: '차·커피·코코아', icon: '🍵', color: '#6B7280', isPRF: true },
  spices: { name: '향신료', icon: '🌶️', color: '#DC2626', isPRF: false },
  protein: { name: '동물성 단백질', icon: '🥩', color: '#9CA3AF', isPRF: false },
  dairy: { name: '유제품', icon: '🥛', color: '#BFDBFE', isPRF: false },
  refined: { name: '정제 곡물·당류', icon: '🍞', color: '#FCA5A5', isPRF: false },
  alcohol: { name: '알코올', icon: '🍺', color: '#6EE7B7', isPRF: false },
} as const;

export type FoodCategoryKey = keyof typeof FOOD_CATEGORIES;

export const PHYTOCHEMICAL_GROUPS = {
  isoflavones: {
    name: '이소플라본',
    nameEn: 'Isoflavones',
    foods: ['legumes'],
    benefits: ['여성건강', '골건강', '콜레스테롤 저하', '피토에스트로겐'],
    products: ['약콩두유', '약콩100', '프로틴바'],
    color: '#8B5CF6',
    icon: '💜',
  },
  anthocyanins: {
    name: '안토시아닌',
    nameEn: 'Anthocyanins',
    foods: ['legumes', 'fruits'],
    benefits: ['항산화', 'LDL 산화 억제', '시력 보호'],
    products: ['파이토100 시즌2', '파이토블랙'],
    color: '#6D28D9',
    icon: '🫐',
  },
  catechins: {
    name: '카테킨',
    nameEn: 'Catechins',
    foods: ['tea'],
    benefits: ['LDL 산화 억제', '항염', '체지방 감소'],
    products: ['약콩차', '파이토100'],
    color: '#059669',
    icon: '🍃',
  },
  carotenoids: {
    name: '카로티노이드',
    nameEn: 'Carotenoids',
    foods: ['vegetables', 'fruits'],
    benefits: ['항산화', '황반 보호', '눈건강'],
    products: ['파이토100'],
    color: '#F59E0B',
    icon: '🟠',
  },
  phenolicAcids: {
    name: '페놀산',
    nameEn: 'Phenolic Acids',
    foods: ['grains', 'fruits', 'vegetables'],
    benefits: ['항산화', '저GI', '항염'],
    products: ['파이토100', '프로틴바'],
    color: '#92400E',
    icon: '🌰',
  },
  glucosinolates: {
    name: '글루코시놀레이트',
    nameEn: 'Glucosinolates',
    foods: ['vegetables'],
    benefits: ['체지방 감소', '해독 효소 조절', '항암'],
    products: ['다이어트 두유'],
    color: '#065F46',
    icon: '🥦',
  },
  stilbenes: {
    name: '스틸벤',
    nameEn: 'Stilbenes',
    foods: ['fruits'],
    benefits: ['심혈관 건강', '뇌건강', '항산화'],
    products: ['파이토100 시즌2', '파이토블랙'],
    color: '#7C3AED',
    icon: '🍇',
  },
  lignans: {
    name: '리그난',
    nameEn: 'Lignans',
    foods: ['grains', 'nuts', 'oils'],
    benefits: ['콜레스테롤 저하', '여성건강', '항산화'],
    products: ['파이토100', '프로틴바'],
    color: '#92400E',
    icon: '🌻',
  },
  saponins: {
    name: '사포닌',
    nameEn: 'Saponins',
    foods: ['legumes'],
    benefits: ['콜레스테롤 저하', '항산화', '면역'],
    products: ['약콩100', '프로틴바'],
    color: '#047857',
    icon: '🫘',
  },
  gingerols: {
    name: '진저롤·커큐민',
    nameEn: 'Gingerols/Curcumin',
    foods: ['spices'],
    benefits: ['항염', '소화 촉진', '관절 건강'],
    products: ['특허 소재'],
    color: '#D97706',
    icon: '🫚',
  },
  flavonols: {
    name: '플라보놀',
    nameEn: 'Flavonols',
    foods: ['vegetables', 'fruits', 'tea'],
    benefits: ['항산화', '항염', '심혈관 보호'],
    products: ['파이토100'],
    color: '#F59E0B',
    icon: '🌼',
  },
  thioallyls: {
    name: '티오알릴 화합물',
    nameEn: 'Thioallyls',
    foods: ['vegetables'],
    benefits: ['항염', '항혈전', '면역 강화'],
    products: ['식단 추천'],
    color: '#6B7280',
    icon: '🧄',
  },
} as const;

export type PhytochemicalKey = keyof typeof PHYTOCHEMICAL_GROUPS;

export const FOOD_ITEMS: FoodItem[] = [
  // 통곡물
  { id: 'brown_rice', name: '현미밥', category: 'grains', calories: 160, serving: '1공기(200g)', prf: true, phytos: ['phenolicAcids', 'lignans'] },
  { id: 'oats', name: '오트밀', category: 'grains', calories: 150, serving: '1/2컵(40g)', prf: true, phytos: ['phenolicAcids', 'lignans'] },
  { id: 'whole_bread', name: '통밀빵', category: 'grains', calories: 130, serving: '2쪽(60g)', prf: true, phytos: ['phenolicAcids', 'lignans'] },
  { id: 'multigrain', name: '잡곡밥', category: 'grains', calories: 165, serving: '1공기(200g)', prf: true, phytos: ['phenolicAcids', 'lignans'] },
  { id: 'white_rice', name: '흰쌀밥', category: 'refined', calories: 160, serving: '1공기(200g)', prf: false, phytos: [] },
  
  // 두류
  { id: 'black_soybean', name: '약콩(흑두)', category: 'legumes', calories: 110, serving: '1/2컵(80g)', prf: true, phytos: ['isoflavones', 'anthocyanins', 'saponins'] },
  { id: 'soybean', name: '콩', category: 'legumes', calories: 110, serving: '1/2컵(80g)', prf: true, phytos: ['isoflavones', 'saponins'] },
  { id: 'tofu', name: '두부', category: 'legumes', calories: 80, serving: '1/4모(100g)', prf: true, phytos: ['isoflavones', 'saponins'] },
  { id: 'soymilk', name: '두유', category: 'legumes', calories: 90, serving: '1팩(190ml)', prf: true, phytos: ['isoflavones', 'saponins'] },
  { id: 'bean_sprout', name: '콩나물', category: 'legumes', calories: 30, serving: '1컵(100g)', prf: true, phytos: ['isoflavones'] },
  { id: 'doenjang', name: '된장찌개', category: 'legumes', calories: 80, serving: '1그릇(200g)', prf: true, phytos: ['isoflavones', 'saponins'] },
  
  // 채소
  { id: 'broccoli', name: '브로콜리', category: 'vegetables', calories: 35, serving: '1컵(90g)', prf: true, phytos: ['glucosinolates', 'carotenoids', 'flavonols'] },
  { id: 'spinach', name: '시금치', category: 'vegetables', calories: 25, serving: '1컵(30g)', prf: true, phytos: ['carotenoids', 'flavonols', 'phenolicAcids'] },
  { id: 'kimchi', name: '김치', category: 'vegetables', calories: 20, serving: '1접시(50g)', prf: true, phytos: ['glucosinolates', 'phenolicAcids'] },
  { id: 'namul', name: '나물 반찬', category: 'vegetables', calories: 50, serving: '1접시(80g)', prf: true, phytos: ['carotenoids', 'flavonols', 'phenolicAcids'] },
  { id: 'carrot', name: '당근', category: 'vegetables', calories: 30, serving: '1/2개(60g)', prf: true, phytos: ['carotenoids'] },
  { id: 'tomato', name: '토마토', category: 'vegetables', calories: 20, serving: '1개(150g)', prf: true, phytos: ['carotenoids', 'phenolicAcids'] },
  { id: 'onion', name: '양파', category: 'vegetables', calories: 40, serving: '1/2개(80g)', prf: true, phytos: ['flavonols', 'thioallyls'] },
  { id: 'garlic', name: '마늘', category: 'spices', calories: 15, serving: '5쪽(15g)', prf: false, phytos: ['thioallyls'] },
  { id: 'sweet_potato', name: '고구마', category: 'vegetables', calories: 130, serving: '1개(130g)', prf: true, phytos: ['carotenoids', 'phenolicAcids'] },
  
  // 과일
  { id: 'blueberry', name: '블루베리', category: 'fruits', calories: 85, serving: '1컵(150g)', prf: true, phytos: ['anthocyanins', 'flavonols', 'stilbenes'] },
  { id: 'strawberry', name: '딸기', category: 'fruits', calories: 50, serving: '10개(150g)', prf: true, phytos: ['anthocyanins', 'flavonols', 'phenolicAcids'] },
  { id: 'apple', name: '사과', category: 'fruits', calories: 80, serving: '1개(180g)', prf: true, phytos: ['flavonols', 'phenolicAcids'] },
  { id: 'orange', name: '귤·오렌지', category: 'fruits', calories: 60, serving: '1개(130g)', prf: true, phytos: ['flavonols', 'carotenoids'] },
  { id: 'grape', name: '포도', category: 'fruits', calories: 90, serving: '1컵(150g)', prf: true, phytos: ['stilbenes', 'anthocyanins', 'flavonols'] },
  { id: 'banana', name: '바나나', category: 'fruits', calories: 110, serving: '1개(120g)', prf: true, phytos: ['phenolicAcids'] },
  
  // 견과
  { id: 'walnut', name: '호두', category: 'nuts', calories: 200, serving: '한 줌(30g)', prf: true, phytos: ['lignans', 'stilbenes', 'phenolicAcids'] },
  { id: 'almond', name: '아몬드', category: 'nuts', calories: 180, serving: '한 줌(30g)', prf: true, phytos: ['flavonols', 'phenolicAcids'] },
  { id: 'sesame', name: '참깨', category: 'nuts', calories: 90, serving: '1큰술(10g)', prf: true, phytos: ['lignans'] },
  
  // 차류
  { id: 'green_tea', name: '녹차', category: 'tea', calories: 5, serving: '1잔(200ml)', prf: true, phytos: ['catechins', 'flavonols'] },
  { id: 'black_tea', name: '홍차', category: 'tea', calories: 5, serving: '1잔(200ml)', prf: true, phytos: ['catechins', 'flavonols'] },
  { id: 'coffee', name: '아메리카노', category: 'tea', calories: 10, serving: '1잔(200ml)', prf: true, phytos: ['phenolicAcids'] },
  
  // 동물성
  { id: 'chicken', name: '닭가슴살', category: 'protein', calories: 165, serving: '100g', prf: false, phytos: [] },
  { id: 'egg', name: '계란', category: 'protein', calories: 70, serving: '1개', prf: false, phytos: [] },
  { id: 'fish', name: '생선', category: 'protein', calories: 150, serving: '100g', prf: false, phytos: [] },
  
  // 유제품
  { id: 'milk', name: '우유', category: 'dairy', calories: 130, serving: '1컵(200ml)', prf: false, phytos: [] },
  { id: 'yogurt', name: '요거트', category: 'dairy', calories: 100, serving: '1개(100g)', prf: false, phytos: [] },
];

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategoryKey;
  calories: number;
  serving: string;
  prf: boolean; // Phytochemical Rich Food
  phytos: PhytochemicalKey[];
}

export const BOBSNU_PRODUCTS = [
  {
    id: 'yakong_soymilk',
    name: '약콩두유',
    description: '약콩(흑두) 기반 이소플라본·안토시아닌 풍부',
    targets: ['여성건강', '골건강', '콜레스테롤'],
    phytos: ['isoflavones', 'anthocyanins', 'saponins'] as PhytochemicalKey[],
    category: 'B2C',
    icon: '🫘',
  },
  {
    id: 'phyto100',
    name: '파이토100',
    description: '100종 파이토케미컬 소재 통합 블렌드',
    targets: ['혈당', '항산화', '종합건강'],
    phytos: ['phenolicAcids', 'lignans', 'catechins', 'carotenoids'] as PhytochemicalKey[],
    category: 'B2C',
    icon: '💊',
  },
  {
    id: 'phyto100_season2',
    name: '파이토100 시즌2',
    description: '혈관·뇌건강 특화 피세아탄놀·안토시아닌',
    targets: ['혈관건강', '뇌건강', '항산화'],
    phytos: ['stilbenes', 'anthocyanins', 'catechins'] as PhytochemicalKey[],
    category: 'B2C',
    icon: '🧠',
  },
  {
    id: 'phyto_black',
    name: '파이토블랙',
    description: '검은색 식품 파이토케미컬 집중 공급',
    targets: ['항산화', '혈관건강'],
    phytos: ['anthocyanins', 'stilbenes'] as PhytochemicalKey[],
    category: 'B2C',
    icon: '🫐',
  },
  {
    id: 'yakong_protein_bar',
    name: '약콩 프로틴바',
    description: '약콩 단백질 + 이소플라본 + 통곡물 페놀산',
    targets: ['근감소예방', '시니어건강', '단백질 보충'],
    phytos: ['isoflavones', 'phenolicAcids', 'saponins'] as PhytochemicalKey[],
    category: 'B2C',
    icon: '💪',
  },
  {
    id: 'yakong_tea',
    name: '약콩차',
    description: '약콩 기반 카테킨·이소플라본 차',
    targets: ['체지방감소', '항산화'],
    phytos: ['catechins', 'isoflavones'] as PhytochemicalKey[],
    category: 'B2C',
    icon: '🍵',
  },
  {
    id: 'diet_soymilk',
    name: '다이어트 두유',
    description: '설포라핀(글루코시놀레이트) 특화 다이어트 지원',
    targets: ['체지방감소', '다이어트'],
    phytos: ['glucosinolates', 'isoflavones'] as PhytochemicalKey[],
    category: 'B2C',
    icon: '🥦',
  },
  {
    id: 'yakong100',
    name: '약콩100',
    description: '약콩 100% 순수 파이토케미컬 농축',
    targets: ['시니어건강', '근감소예방', '여성건강'],
    phytos: ['isoflavones', 'anthocyanins', 'saponins'] as PhytochemicalKey[],
    category: 'B2C',
    icon: '⭐',
  },
];

export const HEALTH_GOALS = [
  { id: 'diet', name: '다이어트·체지방 감소', icon: '⚖️', phytos: ['glucosinolates', 'catechins', 'phenolicAcids'] as PhytochemicalKey[] },
  { id: 'blood_sugar', name: '혈당 관리', icon: '🩸', phytos: ['phenolicAcids', 'isoflavones', 'lignans'] as PhytochemicalKey[] },
  { id: 'cardiovascular', name: '혈관·심장 건강', icon: '❤️', phytos: ['catechins', 'anthocyanins', 'stilbenes', 'flavonols'] as PhytochemicalKey[] },
  { id: 'brain', name: '뇌건강·인지기능', icon: '🧠', phytos: ['stilbenes', 'anthocyanins', 'catechins'] as PhytochemicalKey[] },
  { id: 'muscle', name: '근육·시니어 건강', icon: '💪', phytos: ['isoflavones', 'saponins'] as PhytochemicalKey[] },
  { id: 'antioxidant', name: '항산화·노화방지', icon: '✨', phytos: ['carotenoids', 'anthocyanins', 'flavonols', 'catechins'] as PhytochemicalKey[] },
  { id: 'womens', name: '여성건강·골건강', icon: '👩', phytos: ['isoflavones', 'lignans'] as PhytochemicalKey[] },
  { id: 'gut', name: '장건강·소화', icon: '🌿', phytos: ['phenolicAcids', 'saponins', 'gingerols'] as PhytochemicalKey[] },
  { id: 'eye', name: '눈건강', icon: '👁️', phytos: ['carotenoids', 'anthocyanins', 'flavonols'] as PhytochemicalKey[] },
  { id: 'antiinflam', name: '항염·면역', icon: '🛡️', phytos: ['gingerols', 'thioallyls', 'catechins', 'flavonols'] as PhytochemicalKey[] },
];
