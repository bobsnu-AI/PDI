// PDI(Phytoceutical Dietary Index) 계산 엔진
// McCarty (2004) 원식 기반, 한국형 수정 버전

import type { FoodItem, PhytochemicalKey } from './phytochemicals';
import { PHYTOCHEMICAL_GROUPS, FOOD_CATEGORIES } from './phytochemicals';

export interface MealEntry {
  foodId: string;
  servings: number; // 인분 수 (1 = 1 serving)
  food: FoodItem;
}

export interface PDIResult {
  // 기본 PDI 점수
  pdiScore: number; // % (목표 40%)
  prfCalories: number; // PRF 유래 칼로리
  totalCalories: number; // 총 칼로리
  
  // 식품군별 기여도
  categoryContribution: Record<string, CategoryContrib>;
  
  // 파이토케미컬 분석
  phytochemicalCoverage: PhytoScore[];
  diversityScore: number; // 12개 계열 중 커버 수
  
  // 영양 분석
  nutritionWarnings: string[];
  
  // 등급
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  gradeLabel: string;
  gradeColor: string;
  
  // 부족한 파이토케미컬
  deficientPhytos: PhytochemicalKey[];
  
  // 권장사항
  suggestions: string[];
}

export interface CategoryContrib {
  calories: number;
  percentage: number; // 총 칼로리 대비
  isPRF: boolean;
  foodCount: number;
}

export interface PhytoScore {
  key: PhytochemicalKey;
  name: string;
  present: boolean;
  servingCount: number; // 해당 파이토케미컬 포함 서빙 수
  level: 'high' | 'medium' | 'low' | 'none';
  levelLabel: string;
  color: string;
  icon: string;
}

export function calculatePDI(meals: MealEntry[]): PDIResult {
  let totalCalories = 0;
  let prfCalories = 0;
  const categoryMap: Record<string, CategoryContrib> = {};
  const phytoMap: Record<string, number> = {}; // phyto key -> serving count
  
  // 각 식품별 계산
  for (const meal of meals) {
    const calories = meal.food.calories * meal.servings;
    totalCalories += calories;
    
    // 카테고리별 집계
    const catKey = meal.food.category;
    if (!categoryMap[catKey]) {
      categoryMap[catKey] = {
        calories: 0,
        percentage: 0,
        isPRF: FOOD_CATEGORIES[catKey]?.isPRF ?? false,
        foodCount: 0,
      };
    }
    categoryMap[catKey].calories += calories;
    categoryMap[catKey].foodCount += 1;
    
    // PRF 칼로리 집계 (알코올 제외, 차류는 가점)
    if (meal.food.prf) {
      if (meal.food.category === 'tea') {
        // 차류: 칼로리가 거의 없어 특별 가점 (컵당 50kcal 상당으로 계산)
        prfCalories += 50 * meal.servings;
      } else {
        prfCalories += calories;
      }
    }
    
    // 파이토케미컬 집계
    for (const phyto of meal.food.phytos) {
      phytoMap[phyto] = (phytoMap[phyto] || 0) + meal.servings;
    }
  }
  
  // 카테고리 % 계산
  for (const key in categoryMap) {
    categoryMap[key].percentage = totalCalories > 0
      ? (categoryMap[key].calories / totalCalories) * 100
      : 0;
  }
  
  // PDI 점수 계산 (목표 40%)
  const pdiScore = totalCalories > 0 ? (prfCalories / totalCalories) * 100 : 0;
  
  // 파이토케미컬 커버리지 계산
  const allPhytoKeys = Object.keys(PHYTOCHEMICAL_GROUPS) as PhytochemicalKey[];
  const phytochemicalCoverage: PhytoScore[] = allPhytoKeys.map(key => {
    const group = PHYTOCHEMICAL_GROUPS[key];
    const count = phytoMap[key] || 0;
    let level: PhytoScore['level'];
    let levelLabel: string;
    
    if (count === 0) { level = 'none'; levelLabel = '미섭취'; }
    else if (count < 1) { level = 'low'; levelLabel = '부족'; }
    else if (count < 2) { level = 'medium'; levelLabel = '적정'; }
    else { level = 'high'; levelLabel = '충분'; }
    
    return {
      key,
      name: group.name,
      present: count > 0,
      servingCount: count,
      level,
      levelLabel,
      color: group.color,
      icon: group.icon,
    };
  });
  
  const diversityScore = phytochemicalCoverage.filter(p => p.present).length;
  const deficientPhytos = phytochemicalCoverage
    .filter(p => p.level === 'none' || p.level === 'low')
    .map(p => p.key);
  
  // 영양 경고
  const nutritionWarnings: string[] = [];
  const kimchiCalories = meals.filter(m => m.food.id === 'kimchi').reduce((s, m) => s + m.servings, 0);
  if (kimchiCalories > 3) nutritionWarnings.push('나트륨 과다: 김치 섭취량이 많습니다');
  
  const alcoholItems = meals.filter(m => m.food.category === 'alcohol');
  if (alcoholItems.length > 0) nutritionWarnings.push('알코올은 PDI 계산에서 제외됩니다');
  
  const refinedItems = meals.filter(m => m.food.category === 'refined');
  if (refinedItems.length > 0 && prfCalories < totalCalories * 0.3) {
    nutritionWarnings.push('정제 곡물 비율이 높습니다. 통곡물로 대체를 권장합니다');
  }
  
  // 등급 결정
  let grade: PDIResult['grade'];
  let gradeLabel: string;
  let gradeColor: string;
  
  if (pdiScore >= 40) { grade = 'excellent'; gradeLabel = '우수 (목표 달성!)'; gradeColor = '#10B981'; }
  else if (pdiScore >= 30) { grade = 'good'; gradeLabel = '양호'; gradeColor = '#3B82F6'; }
  else if (pdiScore >= 20) { grade = 'fair'; gradeLabel = '보통'; gradeColor = '#F59E0B'; }
  else { grade = 'poor'; gradeLabel = '개선 필요'; gradeColor = '#EF4444'; }
  
  // 권장사항
  const suggestions: string[] = [];
  if (pdiScore < 40) {
    const gap = 40 - pdiScore;
    suggestions.push(`PDI 목표 40% 달성을 위해 파이토케미컬 풍부 식품을 ${gap.toFixed(0)}% 더 섭취하세요`);
  }
  if (!phytoMap['isoflavones']) suggestions.push('두류(콩, 두부, 두유) 섭취로 이소플라본을 보충하세요');
  if (!phytoMap['carotenoids']) suggestions.push('당근, 고구마, 토마토로 카로티노이드를 보충하세요');
  if (!phytoMap['catechins']) suggestions.push('녹차나 홍차 한 잔으로 카테킨을 보충하세요');
  if (diversityScore < 6) suggestions.push('다양한 색깔의 식품으로 파이토케미컬 다양성을 높이세요');
  
  return {
    pdiScore,
    prfCalories,
    totalCalories,
    categoryContribution: categoryMap,
    phytochemicalCoverage,
    diversityScore,
    nutritionWarnings,
    grade,
    gradeLabel,
    gradeColor,
    deficientPhytos,
    suggestions,
  };
}

export function getProductRecommendations(
  pdiResult: PDIResult,
  healthGoals: string[]
) {
  return {
    deficientPhytos: pdiResult.deficientPhytos,
    healthGoals,
    pdiScore: pdiResult.pdiScore,
    grade: pdiResult.grade,
  };
}
