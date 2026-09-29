// ============================================
// 밥스누 PFS 식단 점수 엔진
// diet_food_scoring.py (FoodRecommendationSystem.PFS_function) JS 포팅
// PDI·파이토 점수와 독립적으로 계산되는 영양 기반 식단 점수
// ──────────────────────────────────────────────
//   Basic_score : 9개 영양소 부분점수 합 (탄수화물·단백질·지방·식이섬유 +,
//                 콜레스테롤·당류·포화지방·트랜스지방·나트륨 −)  · 최대 4.0
//   ED_score    : 에너지 밀도 = kcal × 100 / 중량(g)
//   SI_score    : 포만 지수 = 41.6·지방 + 23.3·단백질 + 18.9·탄수화물
//                 + 6.42·식이섬유 + 0.449·중량 − 405·kcal/239
//   total_score : 체중 추세별 합산
//                 감량기(loss) = Basic + ED
//                 증가(gain)   = Basic + ED + SI
//                 유지기       = Basic
// ※ recipes.js 식재료 DB에는 kcal만 있으므로 영양성분은
//   식재료명 키워드 규칙 + 식품군 기본 프로필로 추정합니다.
//   INGREDIENTS[x].nut 에 실측값(100g 기준)이 있으면 그것을 우선 사용합니다.
// ============================================

// ── 활동량 (KDRI 2020 신체활동계수) ─────────────
const PFS_ACTIVITY_LEVELS = {
  sedentary:   { name: '비활동적',   desc: '운동 거의 안 함' },
  low:         { name: '저활동적',   desc: '주 1–3회 운동' },
  active:      { name: '활동적',     desc: '주 3–5회 운동' },
  very_active: { name: '매우 활동적', desc: '고강도·육체노동' },
};

// PA 계수 [성인 남, 성인 여, 아동·청소년 남, 아동·청소년 여]
const PFS_PA_COEF = {
  sedentary:   { adultM: 1.00, adultF: 1.00, childM: 1.00, childF: 1.00 },
  low:         { adultM: 1.11, adultF: 1.12, childM: 1.13, childF: 1.16 },
  active:      { adultM: 1.25, adultF: 1.27, childM: 1.26, childF: 1.31 },
  very_active: { adultM: 1.48, adultF: 1.45, childM: 1.42, childF: 1.56 },
};

const PFS_TREND_LABELS = {
  loss:        { name: '감량기', formula: 'Basic + ED',      color: '#0EA5E9' },
  gain:        { name: '증가기', formula: 'Basic + ED + SI', color: '#F97316' },
  maintenance: { name: '유지기', formula: 'Basic',           color: '#10B981' },
};

// 식사 분류별 1일 기준 대비 비율 (diet_food_scoring.py calculate_recommendations)
const PFS_MEAL_ROLES = {
  meal:  { name: '본식', per: 0.3 },
  side:  { name: '반찬', per: 0.2 },
  snack: { name: '간식', per: 0.1 },
};

// ──────────────────────────────────────────────
// calculateEER(profile)
//   profile: { gender:'male'|'female', age, height(cm), weight(kg), activity }
//   KDRI 2020 에너지필요추정량 공식 (3–18세는 성장 에너지 가산)
// ──────────────────────────────────────────────
function calculateEER(profile) {
  if (!profile) return null;
  const { gender, age, height, weight, activity } = profile;
  if (!(age >= 3) || !(height > 0) || !(weight > 0)) return null;
  const pa = PFS_PA_COEF[activity] || PFS_PA_COEF.low;
  const ht = height / 100;
  let eer;
  if (age >= 19) {
    eer = gender === 'male'
      ? 662 - 9.53 * age + pa.adultM * (15.91 * weight + 539.6 * ht)
      : 354 - 6.91 * age + pa.adultF * (9.36 * weight + 726 * ht);
  } else {
    const deposit = age >= 9 ? 25 : 20;
    eer = gender === 'male'
      ? 88.5 - 61.9 * age + pa.childM * (26.7 * weight + 903 * ht) + deposit
      : 135.3 - 30.8 * age + pa.childF * (10.0 * weight + 934 * ht) + deposit;
  }
  return Math.round(eer);
}

// ──────────────────────────────────────────────
// calculateNutrientStandards(eer)
//   diet_food_scoring.py 의 nutrient_ranges 에 대응 (1일 기준)
//   탄수화물·단백질·지방: [하한, 상한] (KDRI 에너지적정비율)
// ──────────────────────────────────────────────
function calculateNutrientStandards(eer) {
  return {
    carb:    [eer * 0.55 / 4, eer * 0.65 / 4],  // 탄수화물 55–65 %E
    protein: [eer * 0.07 / 4, eer * 0.20 / 4],  // 단백질 7–20 %E
    fat:     [eer * 0.15 / 9, eer * 0.30 / 9],  // 지방 15–30 %E
    fiber:   eer / 1000 * 12,                   // 식이섬유 12 g/1,000kcal
    chol:    300,                               // 콜레스테롤 300 mg 미만
    sugar:   eer * 0.10 / 4,                    // 당류 10 %E 미만
    satfat:  eer * 0.07 / 9,                    // 포화지방 7 %E 미만
    trans:   eer * 0.01 / 9,                    // 트랜스지방 1 %E 미만
    sodium:  2300,                              // 나트륨 만성질환위험감소섭취량
  };
}

// ══════════════════════════════════════════════
// 영양성분 추정
// ══════════════════════════════════════════════
// 프로필 필드 (energy fraction 기반 → 식재료 실제 kcal 로 스케일)
//   c,p,f   : 탄수화물·단백질·지방이 차지하는 에너지 비율
//   sug     : 탄수화물 중 당류 비율
//   sat,tr  : 지방 중 포화지방·트랜스지방 비율
//   fib,chol,na : 100g 당 식이섬유(g)·콜레스테롤(mg)·나트륨(mg)
const PFS_CATEGORY_PROFILES = {
  grains:     { c: 0.87, p: 0.09, f: 0.04, sug: 0.03, sat: 0.20, fib: 1.5, na: 3 },
  legumes:    { c: 0.60, p: 0.27, f: 0.13, sug: 0.05, sat: 0.15, fib: 15,  na: 5 },
  vegetables: { c: 0.75, p: 0.18, f: 0.07, sug: 0.40, sat: 0.15, fib: 2.5, na: 15 },
  fruits:     { c: 0.92, p: 0.04, f: 0.04, sug: 0.80, sat: 0.15, fib: 2,   na: 2 },
  nuts:       { c: 0.15, p: 0.13, f: 0.72, sug: 0.10, sat: 0.12, fib: 8,   na: 5 },
  oils:       { c: 0,    p: 0,    f: 1,    sat: 0.15 },
  spices:     { c: 0.70, p: 0.15, f: 0.15, sug: 0.40, sat: 0.15, fib: 1,   na: 1500 },
  protein:    { c: 0,    p: 0.65, f: 0.35, sat: 0.30, chol: 65, na: 100 },
  dairy:      { c: 0.30, p: 0.20, f: 0.50, sug: 0.90, sat: 0.62, chol: 30, na: 100 },
  tea:        { c: 0.95, p: 0.03, f: 0.02, sug: 0.85, sat: 0.20, na: 10 },
  refined:    { c: 0.85, p: 0.10, f: 0.05, sug: 0.30, sat: 0.20, fib: 1,   na: 50 },
};

// 식재료명 키워드 규칙 (위에서부터 첫 매칭 적용, cats 지정 시 해당 식품군에서만)
const PFS_NAME_RULES = [
  { re: /깨소금/,                                   prof: { c: 0.15, p: 0.13, f: 0.72, sug: 0.05, sat: 0.14, fib: 10, na: 1500 } },
  { re: /소금|천일염|허브솔트/,                        prof: { c: 1, p: 0, f: 0, na: 38000 } },
  { re: /분말조미료|다시다|조미료|스톡|치킨파우더/,          prof: { c: 0.6, p: 0.2, f: 0.2, sug: 0.2, sat: 0.3, na: 18000 } },
  { re: /명란/,                                     prof: { c: 0.05, p: 0.75, f: 0.20, sat: 0.25, chol: 350, na: 4000 } },
  { re: /새우젓|젓갈|멸치젓|까나리젓|어리굴젓|창난젓|오징어젓/, prof: { c: 0.1, p: 0.75, f: 0.15, sat: 0.3, chol: 150, na: 16000 } },
  { re: /액젓|참치액|어간장/,                          prof: { c: 0.2, p: 0.8, f: 0, na: 8000 } },
  { re: /저염.*간장|간장.*저염/,                       prof: { c: 0.6, p: 0.4, f: 0, sug: 0.5, na: 4000 } },
  { re: /간장|쯔유/,                                 prof: { c: 0.6, p: 0.4, f: 0, sug: 0.5, na: 6000 } },
  { re: /된장|청국장|미소/,                            prof: { c: 0.35, p: 0.35, f: 0.30, sug: 0.2, sat: 0.15, fib: 6, na: 4000 } },
  { re: /고추장/,                                   prof: { c: 0.85, p: 0.08, f: 0.07, sug: 0.5, sat: 0.2, fib: 4, na: 2500 } },
  { re: /쌈장|춘장|두반장|짜장|초장/,                    prof: { c: 0.6, p: 0.2, f: 0.2, sug: 0.4, sat: 0.2, fib: 3, na: 3000 } },
  { re: /김치|묵은지|깍두기|김칫|섞박지|총각무/,             prof: { c: 0.6, p: 0.25, f: 0.15, sug: 0.4, sat: 0.2, fib: 2.5, na: 650 } },
  { re: /굴소스/,                                   prof: { c: 0.8, p: 0.15, f: 0.05, sug: 0.5, na: 4500 } },
  { re: /케첩|케찹/,                                 prof: { c: 0.95, p: 0.04, f: 0.01, sug: 0.8, na: 900 } },
  { re: /마요네즈/,                                  prof: { c: 0.02, p: 0.01, f: 0.97, sug: 0.5, sat: 0.16, chol: 60, na: 600 } },
  { re: /카레/,                                     prof: { c: 0.6, p: 0.1, f: 0.3, sug: 0.1, sat: 0.4, fib: 5, na: 2500 } },
  { re: /식초|비네거/,                                prof: { c: 1, p: 0, f: 0, sug: 0.3, na: 5 } },
  { re: /맛술|미림|미향/,                              prof: { c: 1, p: 0, f: 0, sug: 0.6, na: 5 } },
  { re: /청주|소주|포도주|와인|맥주|막걸리|럼$|럼\(|위스키|생강술/, prof: { c: 0.1, p: 0, f: 0, sug: 0.5, na: 5 } },
  { re: /소스|드레싱/,                                prof: { c: 0.7, p: 0.1, f: 0.2, sug: 0.5, sat: 0.2, na: 1500 } },
  { re: /베이킹파우더|베이킹소다/,                       prof: { c: 1, p: 0, f: 0, na: 10000 } },
  { re: /설탕|올리고당|물엿|꿀|조청|시럽|잼$|잼\(|청$|청\(|농축액|앙금/, prof: { c: 1, p: 0, f: 0, sug: 0.95 } },
  { re: /고춧가루|후춧가루|후추|파슬리|월계수|계피|시나몬|강황|울금|큐민|오레가노|바질|로즈마리|타임|넛맥|생강\(분말\)/,
                                                   prof: { c: 0.65, p: 0.12, f: 0.23, sug: 0.1, sat: 0.15, fib: 30, na: 30 } },
  { re: /땅콩버터|땅콩잼/,                              prof: { c: 0.15, p: 0.15, f: 0.70, sug: 0.4, sat: 0.2, fib: 6, na: 400 } },
  { re: /견과|호두|아몬드|땅콩|잣|캐슈|피스타치오|마카다미아|참깨|들깨|깨$|깨\(|흑임자|해바라기씨|호박씨|치아|아마씨|햄프/,
                                                   prof: { c: 0.15, p: 0.13, f: 0.72, sug: 0.05, sat: 0.12, fib: 9, na: 5 } },
  { re: /도토리묵|청포묵|녹두묵|묵$|묵\(/,                 prof: { c: 0.92, p: 0.05, f: 0.03, fib: 0.5, na: 60 } },
  { re: /버터/,                                     prof: { c: 0, p: 0.01, f: 0.99, sat: 0.63, tr: 0.03, chol: 215, na: 500 } },
  { re: /생크림|휘핑크림|사워크림/,                      prof: { c: 0.04, p: 0.03, f: 0.93, sug: 1, sat: 0.62, tr: 0.03, chol: 110, na: 35 } },
  { re: /파마산|그라나파다노/,                          prof: { c: 0.03, p: 0.35, f: 0.62, sat: 0.62, tr: 0.03, chol: 90, na: 1600 } },
  { re: /치즈/,                                     prof: { c: 0.03, p: 0.27, f: 0.70, sug: 0.5, sat: 0.62, tr: 0.03, chol: 90, na: 800 } },
  { re: /연유/,                                     prof: { c: 0.68, p: 0.10, f: 0.22, sug: 0.95, sat: 0.62, chol: 30, na: 130 } },
  { re: /요구르트|요거트/,                             prof: { c: 0.55, p: 0.20, f: 0.25, sug: 0.8, sat: 0.62, chol: 10, na: 50 } },
  { re: /우유/,                                     prof: { c: 0.30, p: 0.21, f: 0.49, sug: 1, sat: 0.65, tr: 0.02, chol: 11, na: 40 } },
  { re: /두유|콩국물|콩물/,                            prof: { c: 0.35, p: 0.35, f: 0.30, sug: 0.4, sat: 0.15, fib: 0.5, na: 50 } },
  { re: /기름|유$|유\(|오일|마가린|쇼트닝|라드/,           prof: { c: 0, p: 0, f: 1, sat: 0.15, tr: 0.005 } },
  { re: /난황|노른자/,                                prof: { c: 0.02, p: 0.18, f: 0.80, sat: 0.33, chol: 1100, na: 50 } },
  { re: /달걀|계란|메추리알|난백|흰자/,                  prof: { c: 0.02, p: 0.35, f: 0.63, sat: 0.32, chol: 400, na: 140 } },
  { re: /아보카도|올리브/,                             prof: { c: 0.17, p: 0.04, f: 0.79, sug: 0.1, sat: 0.14, fib: 6, na: 300 } },
  { re: /라면/,                                     prof: { c: 0.55, p: 0.08, f: 0.37, sug: 0.05, sat: 0.45, tr: 0.005, fib: 2, na: 900 } },
  { re: /소면|국수|칼국수|우동|냉면|쫄면|수제비/,           prof: { c: 0.85, p: 0.12, f: 0.03, sug: 0.03, sat: 0.2, fib: 2, na: 1000 } },
  { re: /떡/,                                       prof: { c: 0.90, p: 0.08, f: 0.02, sug: 0.05, sat: 0.2, fib: 0.8, na: 250 } },
  { re: /빵|또띠아|튀김가루|부침가루|만두|피자도우|크래커|과자/, prof: { c: 0.72, p: 0.13, f: 0.15, sug: 0.15, sat: 0.35, tr: 0.01, fib: 2.5, na: 500 } },
  { re: /밤|은행/,                          prof: { c: 0.85, p: 0.07, f: 0.08, sug: 0.2, sat: 0.2, fib: 4, na: 5 }, cats: ['nuts'] },
  { re: /현미|흑미|보리|귀리|오트|통밀|수수|기장|율무|메밀|잡곡|퀴노아|^조$|^조\(/,
                                                   prof: { c: 0.82, p: 0.11, f: 0.07, sug: 0.02, sat: 0.2, fib: 8, na: 3 }, cats: ['grains'] },
  { re: /두부|유부|비지/,                              prof: { c: 0.10, p: 0.40, f: 0.50, sug: 0.1, sat: 0.15, fib: 0.8, na: 10 }, cats: ['legumes'] },
  // ── 동물성 단백질 (protein 식품군 한정) ──
  { re: /베이컨|햄(?!프)|소시지|스팸|살라미|페퍼로니/,       prof: { c: 0.03, p: 0.30, f: 0.67, sug: 0.5, sat: 0.37, tr: 0.01, chol: 60, na: 1100 }, cats: ['protein'] },
  { re: /어묵|맛살/,                                  prof: { c: 0.45, p: 0.35, f: 0.20, sug: 0.2, sat: 0.25, chol: 20, na: 900 }, cats: ['protein'] },
  { re: /참치\(통조림\)|참치캔|참치통조림/,               prof: { c: 0, p: 0.60, f: 0.40, sat: 0.25, chol: 40, na: 400 }, cats: ['protein'] },
  { re: /멸치|황태|북어|쥐포/,                          prof: { c: 0.02, p: 0.85, f: 0.13, sat: 0.3, chol: 200, na: 1800 }, cats: ['protein'] },
  { re: /삼겹|차돌|갈비|목살|항정|껍데기|대창|곱창|족발/,    prof: { c: 0, p: 0.20, f: 0.80, sat: 0.38, tr: 0.01, chol: 70, na: 60 }, cats: ['protein'] },
  { re: /가슴살|안심|닭가슴/,                           prof: { c: 0, p: 0.88, f: 0.12, sat: 0.30, chol: 65, na: 50 }, cats: ['protein'] },
  { re: /쇠고기|소고기|한우|돼지|닭|오리|양고기|칠면조/,     prof: { c: 0, p: 0.55, f: 0.45, sat: 0.40, tr: 0.01, chol: 70, na: 60 }, cats: ['protein'] },
  { re: /새우|오징어|낙지|주꾸미|쭈꾸미|문어|한치|꼴뚜기/,   prof: { c: 0.07, p: 0.85, f: 0.08, sat: 0.25, chol: 170, na: 250 }, cats: ['protein'] },
  { re: /바지락|홍합|굴|전복|꼬막|조개|가리비|게|소라|골뱅이|관자|멍게|해삼/,
                                                   prof: { c: 0.15, p: 0.70, f: 0.15, sat: 0.25, chol: 60, na: 400 }, cats: ['protein'] },
];

// 밥스누 제품 1회 제공량 영양성분 (추정치 · kcal 는 INGREDIENTS 와 일치)
const PFS_BOBSNU_NUTRITION = {
  '약콩두유':        { weight: 190, carb: 7,   protein: 5,   fat: 3.5, fiber: 1,   sugar: 4, satfat: 0.5, trans: 0, chol: 0, sodium: 90 },
  '파이토100':       { weight: 10,  carb: 4,   protein: 0.5, fat: 0.2, fiber: 1.5, sugar: 1, satfat: 0,   trans: 0, chol: 0, sodium: 5 },
  '파이토100 시즌2': { weight: 10,  carb: 4,   protein: 0.5, fat: 0.2, fiber: 1.5, sugar: 1, satfat: 0,   trans: 0, chol: 0, sodium: 5 },
  '파이토블랙':      { weight: 10,  carb: 4.5, protein: 1,   fat: 0.3, fiber: 2,   sugar: 1.5, satfat: 0, trans: 0, chol: 0, sodium: 5 },
  '약콩 프로틴바':   { weight: 40,  carb: 18,  protein: 10,  fat: 7.5, fiber: 3,   sugar: 7, satfat: 1.5, trans: 0, chol: 0, sodium: 90 },
  '약콩차':          { weight: 200, carb: 1,   protein: 0.2, fat: 0,   fiber: 0,   sugar: 0, satfat: 0,   trans: 0, chol: 0, sodium: 5 },
  '다이어트 두유':   { weight: 190, carb: 5,   protein: 5.5, fat: 3,   fiber: 1.5, sugar: 2, satfat: 0.5, trans: 0, chol: 0, sodium: 80 },
  '약콩100':         { weight: 5,   carb: 1.5, protein: 1.5, fat: 0.3, fiber: 0.8, sugar: 0, satfat: 0,   trans: 0, chol: 0, sodium: 1 },
};

const PFS_NUTRIENT_KEYS = ['energy', 'carb', 'protein', 'fat', 'fiber', 'chol', 'sugar', 'satfat', 'trans', 'sodium', 'weight'];

function emptyNutrients() {
  const o = {};
  for (const k of PFS_NUTRIENT_KEYS) o[k] = 0;
  return o;
}

function findNutrientProfile(name, cat) {
  for (const rule of PFS_NAME_RULES) {
    if (rule.cats && !rule.cats.includes(cat)) continue;
    if (rule.re.test(name)) return rule.prof;
  }
  return PFS_CATEGORY_PROFILES[cat] || PFS_CATEGORY_PROFILES.refined;
}

// ──────────────────────────────────────────────
// estimateIngredientNutrients(name, grams)
//   반환: { energy, carb, protein, fat, fiber, chol, sugar, satfat, trans, sodium, weight }
// ──────────────────────────────────────────────
function estimateIngredientNutrients(name, grams) {
  const ing = INGREDIENTS[name];
  if (!ing) return null;

  if (ing.cat === 'bobsnu') {
    const b = PFS_BOBSNU_NUTRITION[name] || {};
    return Object.assign(emptyNutrients(), b, { energy: ing.kcal || 0 });
  }

  const g = Number(grams) || 0;
  const energy = (ing.kcal || 0) * g / 100;

  // 실측 영양성분(100g 기준)이 DB에 있으면 우선 사용
  if (ing.nut) {
    const out = emptyNutrients();
    for (const k of PFS_NUTRIENT_KEYS) {
      if (k === 'energy' || k === 'weight') continue;
      out[k] = (ing.nut[k] || 0) * g / 100;
    }
    out.energy = energy;
    out.weight = g;
    return out;
  }

  const pr = findNutrientProfile(name, ing.cat);
  const carb = energy * (pr.c || 0) / 4;
  const fat  = energy * (pr.f || 0) / 9;
  return {
    energy,
    carb,
    protein: energy * (pr.p || 0) / 4,
    fat,
    fiber:   (pr.fib  || 0) * g / 100,
    chol:    (pr.chol || 0) * g / 100,
    sugar:   carb * (pr.sug || 0),
    satfat:  fat * (pr.sat || 0),
    trans:   fat * (pr.tr || 0),
    sodium:  (pr.na   || 0) * g / 100,
    weight:  g,
  };
}

// analysis(analyzeRecipe/analyzeIngredient 결과) → 음식 1회분 영양성분 합계
function estimateDishNutrients(analysis) {
  const total = emptyNutrients();
  for (const ing of analysis.ingredients) {
    const n = estimateIngredientNutrients(ing.name, ing.grams);
    if (!n) continue;
    for (const k of PFS_NUTRIENT_KEYS) total[k] += n[k] || 0;
  }
  return total;
}

// 음식 분류: 간식(0.1) / 본식(0.3) / 반찬(0.2)
const PFS_STAPLE_RE = /밥|죽|국수|면|라면|떡국|덮밥|볶음밥|김밥|주먹밥|리조또|파스타|스파게티|우동|피자|버거|샌드위치|토스트|빵/;
function classifyMealRole(mealEntry) {
  const { name, meal, analysis } = mealEntry;
  if (meal === 'snack') return 'snack';
  if (analysis.isSingleFood) {
    const cat = (analysis.ingredients[0] || {}).cat;
    return (cat === 'grains') ? 'meal' : (['vegetables', 'protein', 'legumes'].includes(cat) ? 'side' : 'snack');
  }
  if (PFS_STAPLE_RE.test(name)) return 'meal';
  // 곡류 칼로리 비중이 절반 이상이면 본식
  const grainKcal = analysis.ingredients
    .filter(i => i.cat === 'grains')
    .reduce((s, i) => s + (i.kcal || 0), 0);
  return analysis.totalCal > 0 && grainKcal / analysis.totalCal >= 0.5 ? 'meal' : 'side';
}

// ──────────────────────────────────────────────
// pfsScore(n, ranges, per, trend)
//   PFS_function 1행 계산 — 수식은 diet_food_scoring.py 와 동일
// ──────────────────────────────────────────────
function pfsRange(v) {
  return Array.isArray(v) ? v : [v * 0.5, v * 1.5];
}

function pfsScore(n, ranges, per, trend) {
  per = per == null ? 1.0 : per;
  const num = k => { const v = Number(n[k]); return Number.isFinite(v) ? v : 0; };
  const sub = {};

  // 탄수화물·단백질·지방: 범위 [A, B] 안이면 1, 벗어나면 이차 감점
  const band = (x, key) => {
    let [A, B] = pfsRange(ranges[key]);
    A *= per; B *= per;
    if (x < A) return 1 - ((x - A) / A) ** 2;
    if (x > B) return 1 - ((x - B) / A) ** 2;
    return 1.0;
  };
  sub.carb    = band(num('carb'),    'carb');
  sub.protein = band(num('protein'), 'protein');
  sub.fat     = band(num('fat'),     'fat');

  // 식이섬유: 기준 미만이면 이차 감점
  const FiberA = ranges.fiber * per;
  const fiber  = num('fiber');
  sub.fiber = fiber < FiberA ? 1 - ((fiber - FiberA) / FiberA) ** 2 : 1.0;

  // 콜레스테롤: 0 → 0점, 기준 이상 → −1
  const CholeA = ranges.chol * per;
  const chol   = num('chol');
  sub.chol = chol < CholeA ? -1 + ((chol - CholeA) / CholeA) ** 2 : -1.0;

  // 당류·포화지방·트랜스지방·나트륨: 기준 대비 비율만큼 선형 감점
  sub.sugar  = -num('sugar')  / Math.max(0.1, ranges.sugar  * per);
  sub.satfat = -num('satfat') / Math.max(0.1, ranges.satfat * per);
  sub.trans  = -num('trans')  / Math.max(0.1, ranges.trans  * per);
  sub.sodium = -num('sodium') / Math.max(0.1, ranges.sodium * per);

  const basic = Object.values(sub).reduce((s, v) => s + v, 0);

  const weight = num('weight');
  const energy = num('energy');
  const ed = energy * 100 / (weight === 0 ? 1 : weight);
  const si = (41.6 * num('fat')) + (23.3 * num('protein')) + (18.9 * num('carb'))
           + (6.42 * num('fiber')) + (0.449 * weight) - (405 * energy / 239);

  let total;
  if (trend === 'loss')      total = basic + ed;
  else if (trend === 'gain') total = basic + ed + si;
  else                       total = basic;

  return { sub, basic, ed, si, total };
}

// 체중 추세 — 최근 체중이 이전보다 낮으면 감량기, 높으면 증가, 같거나 기록 없으면 유지기
function determineWeightTrend(currentWeight, previousWeight) {
  if (!(currentWeight > 0) || !(previousWeight > 0)) return 'maintenance';
  if (currentWeight < previousWeight) return 'loss';
  if (currentWeight > previousWeight) return 'gain';
  return 'maintenance';
}

// ──────────────────────────────────────────────
// calculateDietPFS(meals, profile)
//   meals   : addedMeals ([{ name, meal, analysis }])
//   profile : { gender, age, height, weight, prevWeight, activity }
// 반환: null(프로필 부족) | {
//   eer, ranges, trend,
//   daily: { nutrients, sub, basic, ed, si, total },   // 1일 식단 전체 (per 1.0)
//   dishes: [{ name, meal, role, per, nutrients, sub, basic, ed, si, total }],
// }
// ──────────────────────────────────────────────
function calculateDietPFS(meals, profile) {
  const eer = calculateEER(profile);
  if (!eer) return null;
  const ranges = calculateNutrientStandards(eer);
  const trend  = determineWeightTrend(profile.weight, profile.prevWeight);

  const daily = emptyNutrients();
  const dishes = meals.map(m => {
    const nutrients = estimateDishNutrients(m.analysis);
    for (const k of PFS_NUTRIENT_KEYS) daily[k] += nutrients[k];
    const role = classifyMealRole(m);
    const per  = PFS_MEAL_ROLES[role].per;
    return { name: m.name, meal: m.meal, role, per, nutrients, ...pfsScore(nutrients, ranges, per, trend) };
  });

  return {
    eer, ranges, trend,
    daily: { nutrients: daily, ...pfsScore(daily, ranges, 1.0, trend) },
    dishes,
  };
}
