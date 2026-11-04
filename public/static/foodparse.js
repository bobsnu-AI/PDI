// ══════════════════════════════════════════════
// 먹은 음식 — 문장 한 줄로 기록
// ══════════════════════════════════════════════
// "어제 저녁에 삼겹살 2인분이랑 공깃밥 하나" → [{name, meal, portion}] 로 바꿉니다.
//
// 음식 이름은 반드시 우리 DB(RECIPES·INGREDIENTS)에 있는 키여야 합니다.
// 칼로리·파이토케미컬·질환 등급이 전부 analyzeFood(이름) 을 거쳐 나오기 때문에,
// 모델이 없는 이름을 지어내면 점수가 아예 계산되지 않습니다. 그래서 순서를 둡니다.
//
//   ① 후보 추리기   (규칙)  15,000여 개 → 60개. 문장의 두 글자 조각으로 걸러냅니다.
//   ② 고르고 나누기 (모델)  문장과 후보를 주고 음식·끼니·인분을 뽑게 합니다.
//   ③ DB 로 검증    (규칙)  후보 밖의 이름이나 DB 에 없는 이름은 버립니다.
//
// ②를 쓸 수 없으면(주소 미설정·기기 모델 없음·호출 실패) ①의 결과를 그대로
// ③으로 보냅니다. 규칙만으로도 동작합니다 — 느슨하지만 멈추지는 않습니다.
//
// 모델은 영양을 계산하지 않습니다. 문장을 우리 DB 이름으로 옮기는 일만 합니다.
// 숫자는 전부 종전과 같은 경로로 나오므로 근거를 그대로 짚을 수 있습니다.

// ── 공통 ───────────────────────────────────────
// 띄어쓰기는 사람마다 달라서("김치 찌개" / "김치찌개") 비교 전에 없앱니다
function fpNorm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }

// ── 기록용 이름 목록 ──────────────────────────
// 이 DB 는 급식·병원 식단 레시피 모음입니다. 「게맛살청양고추볶음밥」처럼 기관
// 식단의 변형이 대부분이라(볶음밥만 448가지), 18,126개를 그대로 검색창에
// 내보내면 쓸 수가 없습니다. 그래서 기록용으로 내보낼 이름만 따로 추립니다.
//
// RECIPES·INGREDIENTS 자체는 건드리지 않습니다. 지우면 안 되는 이유 —
//   · 레시피들이 「마늘(다진것)」 같은 재료를 참조해 영양을 계산합니다
//   · 이미 기록한 음식은 이름 문자열로 저장돼 있어 조용히 사라집니다
//   · 식단 추천(mealplan.js)이 레시피 전체에서 고릅니다
// analyzeFood 도 그대로 둡니다. 긴 이름을 정확히 적으면 여전히 기록됩니다.
// 여기서 추리는 것은 「검색창·후보·제안에 보일 이름」입니다.

// 수식어를 몇 글자까지 허용할지. 「갓김치볶음밥」(수식어 3) 은 남고
// 「간장계란볶음밥」(수식어 4)·「아스파라거스소고기김치볶음밥」(수식어 11) 은 빠집니다.
//
// 3 으로 둔 근거 — 2 로 내리면 「삼겹살구이」·「콩나물국」이 사라집니다(수식어가 3글자).
// 4 로 올리면 볶음밥이 187가지로 늘어 다시 읽기 어려워집니다.
// 3 에서 볶음밥 85가지, 흔한 음식 50가지 표본은 전부 남습니다.
const FP_MAX_MODIFIER = 3;
// 꼬리말을 못 맞춘 이름의 길이 상한. 흔한 음식은 모두 12글자 안에 들어갑니다
const FP_MAX_NAME = 12;

// 흔한 요리 꼬리말 — 긴 것부터 맞춰 봅니다
const FP_DISH_TAILS = [
  '카레라이스', '스파게티', '샌드위치', '스테이크', '볶음우동', '순두부찌개', '고추장찌개',
  '김치찌개', '된장찌개', '두부찌개', '부대찌개', '아이스크림', '파스타', '비빔밥', '볶음밥',
  '콩나물국', '미역국', '샐러드', '토스트', '떡볶이', '제육볶음', '멸치볶음', '어묵볶음',
  '덮밥', '초밥', '김밥', '만두', '볶음', '무침', '구이', '조림', '튀김', '전골', '찌개',
  '찜', '국', '탕', '면', '밥',
];

// ① 기관 급식 표기 — 학교·산업체용으로 따로 올린 것
const FP_INSTITUTION = /_(중고등학교|초등학교|유치원|산업체|음식업소|공장|군대)/;
// ② 반찬 조합형 — 급식 식단의 한 칸을 그대로 옮긴 이름
const FP_COMBO = /[+,]/;
// ③ 꼬리말이 조리 용도·손질 상태인 것 (단품에만 적용 — 요리 이름의 일부일 수 있어서)
const FP_COMPONENT = /(용|재료|다진것|간것|썬것|채썬|빻은것|양념|고명|만두소|반죽|속재료|조림장|육수|시판|슬라이스)/;
// ④ 꼬리말이 조리 상태인 것 — 「맨 이름」이 따로 있을 때만 뺍니다
const FP_STATE = /^(생것|말린것|삶은것|데친것|볶은것|구운것|찐것|냉동|생|건조|조리된것|불린것|자숙|반건조)$/;

// 괄호 안·밑줄 뒤의 「꼬리말」만 떼어 봅니다. 요리 이름 본문과 섞지 않으려고요.
//   「콩나물밥과양념장」은 꼬리말이 없으니 그대로 둡니다 (실제 음식)
//   「마늘(다진것)」은 꼬리말이 "다진것" 이니 조리 재료입니다
function fpAnnots(n) {
  const out = [];
  const re = /\(([^()]*)\)/g;
  let m;
  while ((m = re.exec(n))) out.push(m[1]);
  const u = n.indexOf('_');
  if (u >= 0) out.push(n.slice(u + 1).replace(/\)$/, ''));
  return out;
}

function fpBaseName(n) { return n.replace(/\(.*$/, '').replace(/_.*$/, '').trim(); }

let FP_LOG_NAMES = null;

function logFoodNames() {
  if (FP_LOG_NAMES) return FP_LOG_NAMES;
  const recipes = new Set(RECIPE_NAMES);
  // 「차조(생것)」을 가리려면 「차조」가 DB 에 있는지만 보면 됩니다. 기록 목록으로 보면
  // 차조처럼 단품에서 막은 이름이 빠져서, 가려야 할 「(생것)」이 되살아납니다.
  // 괄호를 떼어 새로 붙인 이름(RAW_ALIAS)은 빼고 셉니다 — 넣으면 「블루베리」가
  // 생겼다는 이유로 「블루베리(말린것)」까지 가려집니다.
  const known = new Set(RECIPE_NAMES.concat(Object.keys(INGREDIENTS).filter(n => !RAW_ALIAS[n])));
  FP_LOG_NAMES = [];
  for (const n of RECIPE_NAMES.concat(INGREDIENT_NAMES)) {
    // 직접 고른 단품은 꼬리말이 무엇이든 그대로 둡니다. 「갈비탕(시판)」·「돈까스(시판)」은
    // 아래 조리 재료 규칙이 「시판」을 보고 가려 버리는데, 사람이 고른 이름이 규칙보다 앞섭니다.
    if (Object.prototype.hasOwnProperty.call(SINGLE_FOOD_EXTRA, n)) { FP_LOG_NAMES.push(n); continue; }
    if (FP_INSTITUTION.test(n) || FP_COMBO.test(n)) continue;
    // (생것) 은 괄호 뗀 이름을 따로 붙여 뒀으니 언제나 가립니다.
    if (RAW_ALIASED.has(n)) continue;
    const annots = fpAnnots(n);
    if (!recipes.has(n) && annots.some(a => FP_COMPONENT.test(a))) continue;
    if (annots.some(a => FP_STATE.test(a)) && known.has(fpBaseName(n))) continue;
    // 요리 변형은 수식어 길이로 걸러냅니다.
    // 꼬리말이 목록에 없어도(「…참깨드레싱」) 이름이 길면 기관 식단의 조합입니다.
    if (recipes.has(n)) {
      const tail = FP_DISH_TAILS.find(t => n.endsWith(t) && n.length > t.length);
      if (tail && n.length - tail.length > FP_MAX_MODIFIER) continue;
      if (!tail && n.length > FP_MAX_NAME) continue;
    }
    FP_LOG_NAMES.push(n);
  }
  return FP_LOG_NAMES;
}

// 검색·후보·제안에 쓰는 이름 목록 — 정규화한 키를 한 번만 만들어 둡니다
let FP_NAMES = null;
function fpNames() {
  if (!FP_NAMES) {
    FP_NAMES = [];
    // single — 단품 식재료. 「삼겹살」처럼 요리 이름이 아닌 것을 물었을 때
    // 「삼겹살김밥」보다 「삼겹살(조리된것)」을 먼저 내밀기 위해 표시해 둡니다.
    const singles = new Set(INGREDIENT_NAMES);
    for (const name of logFoodNames()) {
      const key = fpNorm(name);
      if (key.length >= 2) FP_NAMES.push({ name, key, single: singles.has(name) });
    }
  }
  return FP_NAMES;
}

const FP_MEAL_WORDS = [
  ['breakfast', ['아침', '조식']],
  ['lunch',     ['점심', '중식']],
  ['dinner',    ['저녁', '석식']],
  ['snack',     ['간식', '야식', '후식', '디저트', '새참']],
];

const FP_NUM_WORDS = { '반': 0.5, '한': 1, '하나': 1, '두': 2, '둘': 2, '세': 3, '셋': 3, '네': 4, '넷': 4, '다섯': 5 };
const FP_UNITS = '인분|공기|그릇|접시|개|병|잔|컵|조각|쪽|봉지|캔|팩|판|마리|줄|스푼|숟갈|큰술|작은술';

// 인분은 0.25~10 사이로만 둡니다. 0.25 단위로 맞춰 화면에 떨어지게 합니다
function fpClamp(n) {
  if (!(n > 0)) return 1;
  return Math.min(10, Math.max(0.25, Math.round(n * 4) / 4));
}

// 「2인분」「한 공기」「반 그릇」 — 단위가 붙어 있을 때만 수로 읽습니다.
// 단위를 요구하지 않으면 「한우」의 "한" 같은 것을 수로 잘못 읽습니다.
function fpPortion(text) {
  const t = String(text || '');
  let m = t.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:' + FP_UNITS + ')'));
  if (m) return fpClamp(Number(m[1]));
  m = t.match(new RegExp('(' + Object.keys(FP_NUM_WORDS).join('|') + ')\\s*(?:' + FP_UNITS + ')'));
  if (m) return fpClamp(FP_NUM_WORDS[m[1]]);
  return 0;
}

// 이 음식 앞에 가장 가까이 나온 끼니 말을 씁니다
//   "아침에 토스트, 점심은 김치찌개" → 토스트=아침, 김치찌개=점심
function fpMealAt(t, pos) {
  let best = null;
  for (const [id, words] of FP_MEAL_WORDS) {
    for (const w of words) {
      let i = -1;
      while ((i = t.indexOf(w, i + 1)) >= 0) {
        if (i <= pos && (!best || i > best.at)) best = { id, at: i };
      }
    }
  }
  return best ? best.id : null;
}

// ── ① 후보 추리기 ─────────────────────────────
// 문장에서 DB 이름을 그대로 찾습니다. 긴 이름을 먼저 집어 겹치지 않게 골라냅니다.
//   "김치찌개" 와 "김치" 가 모두 DB 에 있으면 "김치찌개" 를 고릅니다.
function fpExact(text) {
  const t = fpNorm(text);
  const hits = [];
  for (const e of fpNames()) {
    const at = t.indexOf(e.key);
    if (at >= 0) hits.push({ name: e.name, at, len: e.key.length });
  }
  hits.sort((a, b) => b.len - a.len || a.at - b.at);
  const taken = [];
  const out = [];
  for (const h of hits) {
    if (taken.some(r => h.at < r.end && h.at + h.len > r.at)) continue;
    taken.push({ at: h.at, end: h.at + h.len });
    out.push(h);
  }
  return out.sort((a, b) => a.at - b.at);
}

// 모델에게 줄 후보. 문장의 두 글자 조각이 몇 개나 겹치는지로 추립니다.
// 글자가 그대로 들어 있지 않아도("제육" → "제육볶음") 고를 수 있게 넉넉히 담습니다.
function fpCandidates(text, limit) {
  const t = fpNorm(text);
  const grams = new Set();
  for (let i = 0; i + 2 <= t.length; i++) {
    const g = t.slice(i, i + 2);
    if (/^[가-힣]{2}$/.test(g)) grams.add(g);
  }
  if (!grams.size) return [];
  const scored = [];
  for (const e of fpNames()) {
    let hit = 0;
    for (const g of grams) if (e.key.includes(g)) hit++;
    if (hit) scored.push({ name: e.name, hit, len: e.key.length });
  }
  // 많이 겹치는 것 먼저, 같으면 짧은 이름 먼저 (짧은 쪽이 보통 흔한 음식입니다)
  scored.sort((a, b) => b.hit - a.hit || a.len - b.len);
  return scored.slice(0, limit || 60).map(s => s.name);
}

// 시간·끼니·수량 같은 군말을 자리표시자로 바꿉니다.
// 지우지 않고 바꾸는 이유 — 지우면 앞뒤가 들러붙습니다.
//   "삼겹살에 소주" → 지우면 "삼겹살소주"(한 덩어리), 바꾸면 "삼겹살|소주"(두 덩어리)
const FP_NOISE = /(어제|오늘|그제|내일|아침|점심|저녁|간식|야식|조식|중식|석식|후식|디저트|새참|먹었어요|먹었어|먹었다|먹음|먹고|마시고|마셨어|하나|정도|약간|조금|많이|으로|에서)/g;
// 한 글자 조사는 음식 이름 안에도 들어 있습니다(「오이」의 "이"). 끊을 때와
// 안 끊을 때를 모두 만들어 둘 다 찾아봅니다.
const FP_PARTICLE = /[은는이가을를에와과랑로도만]/g;
const FP_TAIL = /[은는이가을를에와과랑로도만]$/;

function fpNoiseStrip(n, cutParticles) {
  let out = String(n || '')
    .replace(new RegExp('(?:' + FP_UNITS + ')', 'g'), '|')
    .replace(/\d+(?:\.\d+)?/g, '|')
    .replace(FP_NOISE, '|');
  if (cutParticles) out = out.replace(FP_PARTICLE, '|');
  return out;
}

// 군말만 남은 조각은 「못 찾았다」고 알리지 않습니다
function fpIsNoise(n) {
  return fpNoiseStrip(n, false).replace(/[^가-힣]/g, '').length <= 1;
}

// 음식일 만한 두 글자 이상 덩어리.
// 조사를 끊은 쪽을 먼저 담고, 끊지 않은 쪽도 담습니다 — 「에그마요」처럼
// 조사로 쓰이는 글자로 시작하는 이름이 사라지지 않게.
function fpTokens(chunk) {
  const n = fpNorm(chunk);
  const out = [];
  for (const cut of [true, false]) {
    for (let w of fpNoiseStrip(n, cut).match(/[가-힣]{2,}/g) || []) {
      w = w.replace(FP_TAIL, '');
      if (w.length >= 2 && out.indexOf(w) < 0) out.push(w);
    }
  }
  return out;
}

// 못 찾은 말에 대해 DB 에서 비슷한 이름을 집어 줍니다.
//
// 사람은 「삼겹살」이라고 적지만 DB 에는 「삼겹살구이」·「삼겹살(조리된것)」·
// 「돼지고기(삼겹살)」로 들어 있습니다. 글자 포함 방향이 반대라서 fpExact 로는
// 못 찾습니다. 어느 것인지는 규칙으로 정할 수 없으니 몇 개 보여주고 사람이 고릅니다.
// 모델을 쓸 수 있으면 이 단계까지 오지 않고 모델이 골라 줍니다.
function fpSuggest(chunk, limit) {
  const cap = limit || 6;
  const out = [];
  const seen = new Set();
  for (const w of fpTokens(chunk)) {
    const hit = [];
    for (const e of fpNames()) {
      const at = e.key.indexOf(w);
      if (at < 0) continue;
      // 이름 가운데에 우연히 든 것은 버립니다. 그 말이 이름의 절반은 되어야 합니다.
      //   「소주」가 「채소주먹밥」을 물고 오는 것을 막습니다 (2글자 < 5글자의 절반).
      //   「토스트」가 「대파토스트」를 찾는 것은 남습니다 (3글자 ≥ 5글자의 절반).
      if (at > 0 && w.length * 2 < e.key.length) continue;
      hit.push({ name: e.name, at, len: e.key.length, single: e.single });
    }
    // 그 말로 시작하는 것 → 단품 → 짧은 이름 순.
    // 「삼겹살」이면 삼겹살(조리된것) 이 삼겹살김밥 보다 먼저 옵니다.
    hit.sort((a, b) => a.at - b.at || Number(b.single) - Number(a.single) || a.len - b.len);
    // 말마다 두 개씩 — 모르는 음식이 둘이면 둘 다 보여야 합니다
    for (const e of hit.slice(0, 2)) {
      if (seen.has(e.name)) continue;
      seen.add(e.name);
      out.push(e.name);
    }
  }
  return out.slice(0, cap);
}

// 쉼표·줄바꿈·접속사로 끊습니다. 「와/과/랑」은 음식 이름 안에도 들어갈 수 있어
// (예: 과일) 앞뒤에 공백이 있을 때만 끊습니다.
function fpChunks(text) {
  return String(text || '')
    .replace(/[,·;\n]+/g, '|')
    .replace(/\s+(?:그리고|하고|이랑|랑|와|과|에다가|에다|플러스)\s+/g, '|')
    .split('|').map(s => s.trim()).filter(Boolean);
}

// 규칙만으로 읽기 — 모델을 못 쓸 때 쓰고, 모델에게 줄 후보의 바탕이 됩니다
function fpRules(text, defaultMeal) {
  const t = fpNorm(text);
  const hits = fpExact(text);

  // 수량은 보통 음식 뒤에 옵니다("밥 두 공기"). 뒤에 없으면 앞을 봅니다("2인분 삼겹살").
  // 단, 앞의 수량을 이미 앞 음식이 가져갔으면 다시 쓰지 않습니다.
  //   "흰쌀밥 반 공기, 계란후라이" → 계란후라이까지 0.5인분이 되어 버립니다
  const entries = [];
  let prevTookAfter = false;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const stop = hits[i + 1] ? hits[i + 1].at : Math.min(t.length, h.at + h.len + 12);
    const gapFrom = i > 0 ? hits[i - 1].at + hits[i - 1].len : 0;
    const fromAfter  = fpPortion(t.slice(h.at + h.len, stop));
    const fromBefore = prevTookAfter ? 0 : fpPortion(t.slice(gapFrom, h.at));
    entries.push({
      name: h.name,
      meal: fpMealAt(t, h.at) || defaultMeal,
      portion: fromAfter || fromBefore || 1,
    });
    prevTookAfter = fromAfter > 0;
  }
  // 한 덩어리에서 찾은 이름을 지우고, 남는 말이 있으면 그것도 알립니다.
  //   "삼겹살에 소주 한 병" → 소주만 찾고 삼겹살을 말없이 버리면 안 됩니다.
  // 「두 개」·「한 병」처럼 수량만 남은 것은 알리지 않습니다 (두 글자 이름이 없으면 건너뜀).
  const found = entries.map(e => fpNorm(e.name));
  const unmatched = [];
  for (const c of fpChunks(text)) {
    const norm = fpNorm(c);
    let rest = norm;
    for (const f of found) rest = rest.split(f).join('|');
    const left = rest === norm ? c : rest.replace(/\|+/g, ' ').trim();
    if (!fpTokens(left).length || fpIsNoise(left)) continue;
    unmatched.push({ text: left, suggestions: fpSuggest(left, 6) });
  }
  return { entries, unmatched };
}

// ── ③ DB 로 검증 ──────────────────────────────
// analyzeFood 를 통과하지 못하는 이름은 버립니다. 여기가 마지막 문입니다.
function fpValidate(entries, defaultMeal) {
  const okMeals = new Set(DIARY_MEALS.map(m => m.id));
  const out = [];
  const bad = [];
  for (const e of entries || []) {
    const name = String((e && e.name) || '').trim();
    if (!name) continue;
    if (!analyzeFood(name)) { bad.push({ text: name, suggestions: fpSuggest(name, 6) }); continue; }
    out.push({
      name,
      meal: okMeals.has(e && e.meal) ? e.meal : defaultMeal,
      portion: fpClamp(Number(e && e.portion)),
    });
  }
  return { entries: out, bad };
}

// ── ② 모델 ────────────────────────────────────
const FP_ENDPOINT_KEY = 'bobsnu-foodparse-endpoint';

function fpEndpoint() {
  try { return localStorage.getItem(FP_ENDPOINT_KEY) || ''; } catch (e) { return ''; }
}
function fpSetEndpoint(url) {
  try {
    const u = String(url || '').trim();
    if (u) localStorage.setItem(FP_ENDPOINT_KEY, u);
    else localStorage.removeItem(FP_ENDPOINT_KEY);
  } catch (e) { /* 저장이 막힌 기기에서는 이번 방문에만 규칙으로 동작합니다 */ }
}

const FP_SYSTEM =
  '너는 한국어 식사 기록을 구조화하는 도구다. 사용자 문장에서 먹은 음식을 찾아 JSON 으로만 답한다.\n'
  + '규칙:\n'
  + '1. name 은 반드시 주어진 후보 목록에 있는 문자열을 글자 그대로 쓴다. 바꾸거나 줄이지 않는다.\n'
  + '2. 후보 목록에 없는 음식은 결과에서 뺀다. 비슷한 이름을 지어내지 않는다.\n'
  + '3. meal 은 breakfast, lunch, dinner, snack 중 하나다. 문장에 끼니가 없으면 주어진 기본값을 쓴다.\n'
  + '4. portion 은 몇 인분인지 나타내는 숫자다. 알 수 없으면 1 로 둔다.\n'
  + '5. 설명·인사·코드블록 없이 JSON 만 출력한다.\n'
  + '형식: {"entries":[{"name":"후보에 있는 이름","meal":"lunch","portion":1}]}';

function fpUserPrompt(text, candidates, defaultMeal) {
  return '문장: ' + text + '\n\n'
    + '기본 끼니: ' + defaultMeal + '\n\n'
    + '후보 목록 (이 중에서만 고를 것):\n' + candidates.join('\n');
}

// 모델이 코드블록이나 군말을 붙여 보내도 JSON 만 건져냅니다
function fpJson(raw) {
  const s = String(raw || '');
  const at = s.indexOf('{');
  const to = s.lastIndexOf('}');
  if (at < 0 || to <= at) return null;
  try {
    const data = JSON.parse(s.slice(at, to + 1));
    return Array.isArray(data && data.entries) ? data.entries : null;
  } catch (e) { return null; }
}

// 백엔드 ㉮ — 중계 서버. 키는 서버에 있고 앱에는 주소만 둡니다.
// 저장소가 공개라서 키를 앱에 두면 누구나 가져다 씁니다. scripts/foodparse-proxy.js 참고.
async function fpAskProxy(text, candidates, defaultMeal) {
  const url = fpEndpoint();
  if (!url || typeof fetch === 'undefined') return null;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, candidates, defaultMeal }),
  });
  if (!res.ok) throw new Error('문장 읽기 서버가 ' + res.status + ' 를 보냈어요');
  const data = await res.json();
  if (Array.isArray(data && data.entries)) return data.entries;
  return fpJson(data && data.text);
}

// 백엔드 ㉯ — 기기 안에 있는 모델(Chrome 내장). 키도 서버도 필요 없지만 Chrome 에만 있습니다.
// 버전마다 이름이 달라서 있는 것을 찾아 쓰고, 없으면 조용히 넘어갑니다.
async function fpAskDevice(text, candidates, defaultMeal) {
  const LM = (typeof LanguageModel !== 'undefined' && LanguageModel)
    || (typeof window !== 'undefined' && window.ai && window.ai.languageModel)
    || null;
  if (!LM) return null;
  if (LM.availability) {
    const a = await LM.availability();
    if (!a || a === 'unavailable') return null;
  } else if (LM.capabilities) {
    const c = await LM.capabilities();
    if (!c || c.available === 'no') return null;
  }
  const session = await LM.create({ initialPrompts: [{ role: 'system', content: FP_SYSTEM }] });
  try {
    return fpJson(await session.prompt(fpUserPrompt(text, candidates, defaultMeal)));
  } finally {
    if (session && session.destroy) session.destroy();
  }
}

// ── 한 줄 문장 → 일지에 넣을 항목 ─────────────
// 쓸 수 있는 것부터 차례로 시도하고, 어느 것으로 읽었는지 함께 돌려줍니다.
async function parseFoodText(text, defaultMeal) {
  const t = String(text || '').trim();
  const meal = defaultMeal || 'lunch';
  if (!t) return { entries: [], unmatched: [], via: 'none', warn: '' };

  const rules = fpRules(t, meal);
  const candidates = fpCandidates(t, 60);
  // 글자가 그대로 맞은 이름은 후보 맨 앞에 둡니다
  for (const e of rules.entries.slice().reverse()) {
    const at = candidates.indexOf(e.name);
    if (at >= 0) candidates.splice(at, 1);
    candidates.unshift(e.name);
  }

  let warn = '';
  for (const [via, ask] of [['proxy', fpAskProxy], ['device', fpAskDevice]]) {
    if (!candidates.length) break;
    let got = null;
    try {
      got = await ask(t, candidates, meal);
    } catch (e) {
      warn = (e && e.message) || '문장 읽기에 실패했어요';
      continue;
    }
    if (!got || !got.length) continue;
    const v = fpValidate(got, meal);
    if (v.entries.length) return { entries: v.entries, unmatched: v.bad, via, warn };
  }

  const v = fpValidate(rules.entries, meal);
  return { entries: v.entries, unmatched: rules.unmatched.concat(v.bad), via: 'rules', warn };
}

const FP_VIA_LABEL = { proxy: '문장 읽기', device: '기기 안에서 문장 읽기', rules: '이름 맞추기', none: '' };
