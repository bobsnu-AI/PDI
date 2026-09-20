// ============================================
// 밥스누 PDI 웰니스 솔루션 - 레시피 & 식재료 데이터베이스
// ============================================

// ---------- 식재료(원재료) DB ----------
// 각 식재료는 식품군 + 칼로리(100g당) + 파이토케미컬 보유 정보
const INGREDIENTS = {
  // ── 통곡물 ─────────────────────────
  현미:      { cat:'grains',     kcal:100, prf:true,  phytos:['phenolicAcids','lignans'] },
  보리:      { cat:'grains',     kcal:88,  prf:true,  phytos:['phenolicAcids','lignans'] },
  귀리:      { cat:'grains',     kcal:97,  prf:true,  phytos:['phenolicAcids','lignans'] },
  통밀:      { cat:'grains',     kcal:98,  prf:true,  phytos:['phenolicAcids','lignans'] },
  흑미:      { cat:'grains',     kcal:100, prf:true,  phytos:['phenolicAcids','anthocyanins','lignans'] },
  수수:      { cat:'grains',     kcal:99,  prf:true,  phytos:['phenolicAcids','lignans'] },
  조:        { cat:'grains',     kcal:101, prf:true,  phytos:['phenolicAcids','lignans'] },
  콩나물밥재료현미: { cat:'grains', kcal:100, prf:true, phytos:['phenolicAcids','lignans'] },

  // ── 정제 곡물 ─────────────────────
  흰쌀:      { cat:'refined',    kcal:100, prf:false, phytos:[] },
  밀가루:    { cat:'refined',    kcal:127, prf:false, phytos:[] },
  흰빵:      { cat:'refined',    kcal:136, prf:false, phytos:[] },
  떡:        { cat:'refined',    kcal:118, prf:false, phytos:[] },
  국수:      { cat:'refined',    kcal:100, prf:false, phytos:[] },
  라면:      { cat:'refined',    kcal:120, prf:false, phytos:[] },

  // ── 두류·콩 가공품 ─────────────────
  두부:      { cat:'legumes',    kcal:76,  prf:true,  phytos:['isoflavones','saponins'] },
  순두부:    { cat:'legumes',    kcal:46,  prf:true,  phytos:['isoflavones','saponins'] },
  콩:        { cat:'legumes',    kcal:143, prf:true,  phytos:['isoflavones','saponins'] },
  검은콩:    { cat:'legumes',    kcal:139, prf:true,  phytos:['isoflavones','anthocyanins','saponins'] },
  약콩:      { cat:'legumes',    kcal:139, prf:true,  phytos:['isoflavones','anthocyanins','saponins'] },
  된장:      { cat:'legumes',    kcal:90,  prf:true,  phytos:['isoflavones','saponins'] },
  청국장:    { cat:'legumes',    kcal:97,  prf:true,  phytos:['isoflavones','saponins'] },
  간장:      { cat:'legumes',    kcal:52,  prf:true,  phytos:['isoflavones'] },
  두유:      { cat:'legumes',    kcal:45,  prf:true,  phytos:['isoflavones','saponins'] },
  콩나물:    { cat:'legumes',    kcal:30,  prf:true,  phytos:['isoflavones'] },
  숙주:      { cat:'legumes',    kcal:25,  prf:true,  phytos:['isoflavones'] },
  팥:        { cat:'legumes',    kcal:143, prf:true,  phytos:['isoflavones','saponins','phenolicAcids'] },
  렌틸콩:   { cat:'legumes',    kcal:116, prf:true,  phytos:['isoflavones','saponins','phenolicAcids'] },
  완두콩:   { cat:'legumes',    kcal:81,  prf:true,  phytos:['isoflavones','saponins'] },

  // ── 채소류 ────────────────────────
  배추:      { cat:'vegetables', kcal:13,  prf:true,  phytos:['glucosinolates','phenolicAcids'] },
  양배추:    { cat:'vegetables', kcal:25,  prf:true,  phytos:['glucosinolates','phenolicAcids'] },
  브로콜리:  { cat:'vegetables', kcal:34,  prf:true,  phytos:['glucosinolates','carotenoids','flavonols'] },
  콜리플라워:{ cat:'vegetables', kcal:25,  prf:true,  phytos:['glucosinolates','phenolicAcids'] },
  시금치:    { cat:'vegetables', kcal:23,  prf:true,  phytos:['carotenoids','flavonols','phenolicAcids'] },
  깻잎:      { cat:'vegetables', kcal:35,  prf:true,  phytos:['carotenoids','flavonols','phenolicAcids'] },
  상추:      { cat:'vegetables', kcal:17,  prf:true,  phytos:['carotenoids','phenolicAcids'] },
  케일:      { cat:'vegetables', kcal:49,  prf:true,  phytos:['glucosinolates','carotenoids','flavonols'] },
  당근:      { cat:'vegetables', kcal:41,  prf:true,  phytos:['carotenoids'] },
  고구마:    { cat:'vegetables', kcal:86,  prf:true,  phytos:['carotenoids','phenolicAcids'] },
  단호박:    { cat:'vegetables', kcal:91,  prf:true,  phytos:['carotenoids'] },
  애호박:    { cat:'vegetables', kcal:15,  prf:true,  phytos:['carotenoids','phenolicAcids'] },
  늙은호박:  { cat:'vegetables', kcal:26,  prf:true,  phytos:['carotenoids'] },
  토마토:    { cat:'vegetables', kcal:18,  prf:true,  phytos:['carotenoids','phenolicAcids'] },
  방울토마토:{ cat:'vegetables', kcal:20,  prf:true,  phytos:['carotenoids','phenolicAcids'] },
  파프리카:  { cat:'vegetables', kcal:28,  prf:true,  phytos:['carotenoids','flavonols'] },
  고추:      { cat:'vegetables', kcal:27,  prf:true,  phytos:['carotenoids','flavonols'] },
  피망:      { cat:'vegetables', kcal:20,  prf:true,  phytos:['carotenoids','flavonols'] },
  오이:      { cat:'vegetables', kcal:12,  prf:true,  phytos:['flavonols'] },
  가지:      { cat:'vegetables', kcal:20,  prf:true,  phytos:['anthocyanins','phenolicAcids'] },
  버섯:      { cat:'vegetables', kcal:22,  prf:true,  phytos:['phenolicAcids'] },
  표고버섯:  { cat:'vegetables', kcal:34,  prf:true,  phytos:['phenolicAcids'] },
  느타리버섯:{ cat:'vegetables', kcal:27,  prf:true,  phytos:['phenolicAcids'] },
  팽이버섯:  { cat:'vegetables', kcal:37,  prf:true,  phytos:['phenolicAcids'] },
  무:        { cat:'vegetables', kcal:18,  prf:true,  phytos:['glucosinolates','phenolicAcids'] },
  열무:      { cat:'vegetables', kcal:16,  prf:true,  phytos:['glucosinolates','phenolicAcids'] },
  도라지:    { cat:'vegetables', kcal:32,  prf:true,  phytos:['saponins','phenolicAcids'] },
  더덕:      { cat:'vegetables', kcal:43,  prf:true,  phytos:['saponins','phenolicAcids'] },
  연근:      { cat:'vegetables', kcal:74,  prf:true,  phytos:['phenolicAcids','flavonols'] },
  우엉:      { cat:'vegetables', kcal:65,  prf:true,  phytos:['phenolicAcids','lignans'] },
  고사리:    { cat:'vegetables', kcal:29,  prf:true,  phytos:['phenolicAcids'] },
  취나물:    { cat:'vegetables', kcal:40,  prf:true,  phytos:['flavonols','phenolicAcids'] },
  고들빼기:  { cat:'vegetables', kcal:38,  prf:true,  phytos:['flavonols','phenolicAcids'] },
  씀바귀:    { cat:'vegetables', kcal:30,  prf:true,  phytos:['flavonols','phenolicAcids'] },
  미나리:    { cat:'vegetables', kcal:17,  prf:true,  phytos:['flavonols','phenolicAcids'] },
  부추:      { cat:'vegetables', kcal:28,  prf:true,  phytos:['thioallyls','flavonols'] },
  쪽파:      { cat:'vegetables', kcal:30,  prf:true,  phytos:['thioallyls','flavonols'] },
  대파:      { cat:'vegetables', kcal:29,  prf:true,  phytos:['thioallyls','flavonols'] },
  양파:      { cat:'vegetables', kcal:40,  prf:true,  phytos:['flavonols','thioallyls'] },
  김:        { cat:'vegetables', kcal:35,  prf:true,  phytos:['carotenoids','phenolicAcids'] },
  미역:      { cat:'vegetables', kcal:14,  prf:true,  phytos:['phenolicAcids'] },
  다시마:    { cat:'vegetables', kcal:15,  prf:true,  phytos:['phenolicAcids'] },
  파래:      { cat:'vegetables', kcal:30,  prf:true,  phytos:['carotenoids','phenolicAcids'] },
  고춧가루:  { cat:'vegetables', kcal:30,  prf:true,  phytos:['carotenoids'] },

  // ── 과일류 ────────────────────────
  사과:      { cat:'fruits',     kcal:52,  prf:true,  phytos:['flavonols','phenolicAcids'] },
  배:        { cat:'fruits',     kcal:51,  prf:true,  phytos:['flavonols','phenolicAcids'] },
  복숭아:    { cat:'fruits',     kcal:40,  prf:true,  phytos:['phenolicAcids','carotenoids'] },
  포도:      { cat:'fruits',     kcal:67,  prf:true,  phytos:['stilbenes','anthocyanins','flavonols'] },
  귤:        { cat:'fruits',     kcal:53,  prf:true,  phytos:['flavonols','carotenoids'] },
  오렌지:    { cat:'fruits',     kcal:47,  prf:true,  phytos:['flavonols','carotenoids'] },
  자몽:      { cat:'fruits',     kcal:42,  prf:true,  phytos:['flavonols','carotenoids'] },
  레몬:      { cat:'fruits',     kcal:29,  prf:true,  phytos:['flavonols','phenolicAcids'] },
  딸기:      { cat:'fruits',     kcal:33,  prf:true,  phytos:['anthocyanins','flavonols','phenolicAcids'] },
  블루베리:  { cat:'fruits',     kcal:57,  prf:true,  phytos:['anthocyanins','flavonols','stilbenes'] },
  아로니아:  { cat:'fruits',     kcal:47,  prf:true,  phytos:['anthocyanins','stilbenes','flavonols'] },
  체리:      { cat:'fruits',     kcal:63,  prf:true,  phytos:['anthocyanins','flavonols'] },
  수박:      { cat:'fruits',     kcal:30,  prf:true,  phytos:['carotenoids','phenolicAcids'] },
  참외:      { cat:'fruits',     kcal:31,  prf:true,  phytos:['carotenoids'] },
  감:        { cat:'fruits',     kcal:70,  prf:true,  phytos:['carotenoids','flavonols'] },
  석류:      { cat:'fruits',     kcal:83,  prf:true,  phytos:['anthocyanins','stilbenes','flavonols'] },
  키위:      { cat:'fruits',     kcal:61,  prf:true,  phytos:['flavonols','phenolicAcids'] },
  바나나:    { cat:'fruits',     kcal:89,  prf:true,  phytos:['phenolicAcids'] },
  망고:      { cat:'fruits',     kcal:60,  prf:true,  phytos:['carotenoids','phenolicAcids'] },

  // ── 견과·종실 ─────────────────────
  호두:      { cat:'nuts',       kcal:654, prf:true,  phytos:['lignans','stilbenes','phenolicAcids'] },
  아몬드:    { cat:'nuts',       kcal:579, prf:true,  phytos:['flavonols','phenolicAcids'] },
  땅콩:      { cat:'nuts',       kcal:567, prf:true,  phytos:['stilbenes','phenolicAcids'] },
  참깨:      { cat:'nuts',       kcal:573, prf:true,  phytos:['lignans'] },
  들깨:      { cat:'nuts',       kcal:534, prf:true,  phytos:['lignans','phenolicAcids'] },
  해바라기씨:{ cat:'nuts',       kcal:584, prf:true,  phytos:['lignans','phenolicAcids'] },
  잣:        { cat:'nuts',       kcal:673, prf:true,  phytos:['lignans'] },
  캐슈넛:   { cat:'nuts',       kcal:553, prf:true,  phytos:['phenolicAcids'] },
  밤:        { cat:'nuts',       kcal:245, prf:true,  phytos:['phenolicAcids'] },
  은행:      { cat:'nuts',       kcal:182, prf:true,  phytos:['flavonols','phenolicAcids'] },

  // ── 식물성 오일 ───────────────────
  들기름:    { cat:'oils',       kcal:884, prf:true,  phytos:['lignans'] },
  참기름:    { cat:'oils',       kcal:884, prf:true,  phytos:['lignans'] },
  올리브유:  { cat:'oils',       kcal:884, prf:true,  phytos:['flavonols'] },
  콩기름:    { cat:'oils',       kcal:884, prf:true,  phytos:['isoflavones'] },

  // ── 차·음료류 ─────────────────────
  녹차:      { cat:'tea',        kcal:0,   prf:true,  phytos:['catechins','flavonols'] },
  홍차:      { cat:'tea',        kcal:0,   prf:true,  phytos:['catechins','flavonols'] },
  보이차:    { cat:'tea',        kcal:0,   prf:true,  phytos:['catechins','flavonols'] },
  커피:      { cat:'tea',        kcal:2,   prf:true,  phytos:['phenolicAcids'] },
  아메리카노:{ cat:'tea',        kcal:8,   prf:true,  phytos:['phenolicAcids'] },
  코코아:    { cat:'tea',        kcal:20,  prf:true,  phytos:['catechins','flavonols'] },
  약콩차:    { cat:'tea',        kcal:5,   prf:true,  phytos:['catechins','isoflavones'] },
  새싹보리차:{ cat:'tea',        kcal:5,   prf:true,  phytos:['phenolicAcids','glucosinolates'] },

  // ── 향신료류 ─────────────────────
  마늘:      { cat:'spices',     kcal:149, prf:false, phytos:['thioallyls'] },
  생강:      { cat:'spices',     kcal:80,  prf:false, phytos:['gingerols'] },
  강황:      { cat:'spices',     kcal:312, prf:false, phytos:['gingerols'] },
  계피:      { cat:'spices',     kcal:247, prf:false, phytos:['phenolicAcids'] },
  고추냉이:  { cat:'spices',     kcal:109, prf:false, phytos:['glucosinolates'] },
  겨자:      { cat:'spices',     kcal:66,  prf:false, phytos:['glucosinolates'] },

  // ── 동물성 단백질 ─────────────────
  닭고기:    { cat:'protein',    kcal:165, prf:false, phytos:[] },
  닭가슴살:  { cat:'protein',    kcal:165, prf:false, phytos:[] },
  돼지고기:  { cat:'protein',    kcal:242, prf:false, phytos:[] },
  삼겹살:    { cat:'protein',    kcal:518, prf:false, phytos:[] },
  소고기:    { cat:'protein',    kcal:250, prf:false, phytos:[] },
  계란:      { cat:'protein',    kcal:155, prf:false, phytos:[] },
  달걀:      { cat:'protein',    kcal:155, prf:false, phytos:[] },
  생선:      { cat:'protein',    kcal:130, prf:false, phytos:[] },
  연어:      { cat:'protein',    kcal:208, prf:false, phytos:[] },
  고등어:    { cat:'protein',    kcal:205, prf:false, phytos:[] },
  참치:      { cat:'protein',    kcal:130, prf:false, phytos:[] },
  오징어:    { cat:'protein',    kcal:92,  prf:false, phytos:[] },
  새우:      { cat:'protein',    kcal:99,  prf:false, phytos:[] },
  조개:      { cat:'protein',    kcal:86,  prf:false, phytos:[] },
  굴:        { cat:'protein',    kcal:68,  prf:false, phytos:[] },
  멸치:      { cat:'protein',    kcal:131, prf:false, phytos:[] },

  // ── 유제품 ───────────────────────
  우유:      { cat:'dairy',      kcal:61,  prf:false, phytos:[] },
  요거트:    { cat:'dairy',      kcal:100, prf:false, phytos:[] },
  치즈:      { cat:'dairy',      kcal:402, prf:false, phytos:[] },
  버터:      { cat:'dairy',      kcal:717, prf:false, phytos:[] },
};

// ---------- 레시피 DB ----------
// 각 레시피: 음식명, 재료 목록 (재료명: g 기준 비율), 1인분 총 칼로리
const RECIPES = {
  // ══ 밥류 ══════════════════════════════════════
  '현미밥':    { cal:310, ings:{ 현미:200 } },
  '잡곡밥':    { cal:320, ings:{ 현미:100, 보리:40, 흑미:30, 조:20, 수수:10 } },
  '흰쌀밥':   { cal:300, ings:{ 흰쌀:200 } },
  '콩밥':      { cal:330, ings:{ 현미:150, 콩:40, 흑미:10 } },
  '흑미밥':    { cal:315, ings:{ 현미:150, 흑미:50 } },
  '보리밥':    { cal:300, ings:{ 현미:120, 보리:80 } },
  '귀리밥':    { cal:310, ings:{ 현미:150, 귀리:50 } },

  // ══ 죽·리조또류 ═══════════════════════════════
  '전복죽':    { cal:200, ings:{ 흰쌀:80, 생선:30 } },
  '호박죽':    { cal:180, ings:{ 흰쌀:60, 단호박:80, 팥:20 } },
  '팥죽':      { cal:240, ings:{ 흰쌀:50, 팥:60 } },
  '흑임자죽':  { cal:250, ings:{ 흰쌀:70, 참깨:30 } },
  '야채죽':    { cal:160, ings:{ 현미:60, 당근:20, 애호박:20, 양파:15 } },
  '잣죽':      { cal:280, ings:{ 흰쌀:70, 잣:20 } },
  '오트밀죽':  { cal:180, ings:{ 귀리:60, 우유:100 } },

  // ══ 국·찌개류 ════════════════════════════════
  '된장찌개':  { cal:120, ings:{ 된장:20, 두부:80, 호박:40, 양파:30, 마늘:5, 대파:10 } },
  '순두부찌개':{ cal:140, ings:{ 순두부:150, 양파:30, 대파:10, 마늘:5, 고춧가루:5 } },
  '청국장찌개':{ cal:130, ings:{ 청국장:30, 두부:80, 양파:30, 마늘:5 } },
  '김치찌개':  { cal:140, ings:{ 배추:100, 돼지고기:50, 두부:50, 대파:10 } },
  '부대찌개':  { cal:250, ings:{ 돼지고기:50, 두부:40, 배추:40, 양파:30 } },
  '미역국':    { cal:60,  ings:{ 미역:30, 소고기:30, 마늘:5 } },
  '콩나물국':  { cal:50,  ings:{ 콩나물:100, 대파:10, 마늘:5 } },
  '북엇국':    { cal:80,  ings:{ 생선:30, 두부:40, 대파:10, 마늘:5 } },
  '감자국':    { cal:90,  ings:{ 고구마:80, 대파:10, 마늘:5 } },
  '시금치국':  { cal:40,  ings:{ 시금치:80, 대파:10, 마늘:5 } },
  '무국':      { cal:45,  ings:{ 무:100, 소고기:20, 대파:10 } },
  '아욱국':    { cal:55,  ings:{ 시금치:80, 된장:10, 마늘:5 } },
  '선지국':    { cal:100, ings:{ 소고기:40, 양파:30, 대파:10 } },
  '동태찌개':  { cal:120, ings:{ 생선:100, 무:50, 두부:40, 대파:10, 고춧가루:5 } },
  '알탕':      { cal:130, ings:{ 생선:80, 두부:50, 무:30, 대파:10 } },
  '참치김치찌개': { cal:160, ings:{ 배추:80, 참치:60, 두부:40, 대파:10 } },
  '두부찌개':  { cal:110, ings:{ 두부:120, 양파:30, 고춧가루:5, 대파:10, 마늘:5 } },

  // ══ 구이·볶음류 ══════════════════════════════
  '삼겹살':    { cal:480, ings:{ 삼겹살:150, 상추:30, 마늘:10, 대파:10 } },
  '불고기':    { cal:280, ings:{ 소고기:130, 양파:40, 대파:15, 마늘:5 } },
  '제육볶음':  { cal:310, ings:{ 돼지고기:120, 양파:50, 대파:20, 마늘:10, 고추:10, 고춧가루:5 } },
  '닭갈비':    { cal:260, ings:{ 닭고기:130, 양배추:50, 대파:20, 마늘:10, 고춧가루:5 } },
  '오징어볶음':{ cal:200, ings:{ 오징어:120, 양파:40, 대파:15, 마늘:10, 고춧가루:5 } },
  '두부조림':  { cal:160, ings:{ 두부:150, 양파:30, 대파:10, 마늘:5, 고춧가루:3 } },
  '가지볶음':  { cal:90,  ings:{ 가지:120, 마늘:5, 대파:10, 참기름:5 } },
  '애호박볶음':{ cal:70,  ings:{ 애호박:120, 양파:20, 마늘:5, 들기름:5 } },
  '버섯볶음':  { cal:80,  ings:{ 표고버섯:80, 느타리버섯:60, 마늘:5, 참기름:5 } },
  '시금치나물':{ cal:60,  ings:{ 시금치:100, 마늘:5, 참기름:5, 참깨:3 } },
  '콩나물무침':{ cal:55,  ings:{ 콩나물:100, 마늘:5, 참기름:3, 참깨:2 } },
  '도라지나물':{ cal:70,  ings:{ 도라지:80, 마늘:5, 들기름:5, 참깨:3 } },
  '고사리나물':{ cal:65,  ings:{ 고사리:80, 마늘:5, 들기름:5, 참깨:2 } },
  '취나물무침':{ cal:55,  ings:{ 취나물:80, 마늘:5, 들기름:5 } },
  '무나물':    { cal:50,  ings:{ 무:100, 마늘:5, 들기름:5 } },
  '연근조림':  { cal:110, ings:{ 연근:100, 들깨:5, 들기름:5 } },
  '우엉조림':  { cal:100, ings:{ 우엉:80, 참깨:5, 들기름:5 } },
  '더덕구이':  { cal:90,  ings:{ 더덕:80, 고추냉이:5, 들기름:5 } },
  '북어무침':  { cal:95,  ings:{ 생선:50, 마늘:5, 참기름:5, 참깨:3 } },
  '멸치볶음':  { cal:130, ings:{ 멸치:40, 땅콩:20, 마늘:5 } },

  // ══ 찜·탕류 ═══════════════════════════════
  '갈비찜':    { cal:350, ings:{ 소고기:150, 당근:30, 밤:20, 은행:10, 대파:10, 마늘:10 } },
  '닭찜':      { cal:280, ings:{ 닭고기:150, 감자:50, 당근:30, 양파:30, 마늘:10 } },
  '아귀찜':    { cal:200, ings:{ 생선:120, 콩나물:60, 미나리:30, 대파:15, 마늘:10 } },
  '두부찜':    { cal:150, ings:{ 두부:150, 대파:15, 마늘:5, 고추:5, 참깨:3 } },
  '순두부찜':  { cal:130, ings:{ 순두부:200, 계란:30, 대파:10 } },
  '삼계탕':    { cal:380, ings:{ 닭고기:200, 현미:40, 마늘:20, 대추:10 } },
  '설렁탕':    { cal:200, ings:{ 소고기:80, 대파:15, 마늘:5 } },
  '갈비탕':    { cal:320, ings:{ 소고기:150, 무:40, 대파:15, 마늘:10 } },
  '해장국':    { cal:180, ings:{ 소고기:80, 배추:60, 무:40, 대파:15, 마늘:10 } },
  '육개장':    { cal:200, ings:{ 소고기:80, 고사리:50, 대파:30, 숙주:40, 마늘:10 } },

  // ══ 김치류 ═══════════════════════════════
  '배추김치':  { cal:18,  ings:{ 배추:80, 고춧가루:5, 마늘:5, 대파:5, 생강:3 } },
  '깍두기':    { cal:20,  ings:{ 무:80, 고춧가루:5, 마늘:5, 대파:5 } },
  '열무김치':  { cal:15,  ings:{ 열무:80, 고춧가루:5, 마늘:5 } },
  '오이소박이':{ cal:15,  ings:{ 오이:80, 부추:20, 마늘:5, 고춧가루:3 } },
  '깻잎김치':  { cal:25,  ings:{ 깻잎:60, 마늘:5, 고춧가루:3, 참깨:2 } },
  '파김치':    { cal:20,  ings:{ 쪽파:70, 마늘:5, 고춧가루:3, 참깨:2 } },
  '무생채':    { cal:30,  ings:{ 무:100, 고춧가루:5, 마늘:5, 참깨:2 } },
  '겉절이':    { cal:20,  ings:{ 배추:80, 상추:20, 고춧가루:5, 마늘:5 } },

  // ══ 비빔밥·덮밥류 ════════════════════════════
  '비빔밥':    { cal:560, ings:{ 현미:200, 시금치:30, 당근:20, 콩나물:30, 고사리:20, 취나물:20, 계란:55, 참기름:5, 고추:5 } },
  '돌솥비빔밥':{ cal:580, ings:{ 현미:200, 시금치:30, 당근:20, 콩나물:30, 고사리:20, 계란:55, 참기름:5 } },
  '나물비빔밥':{ cal:520, ings:{ 잡곡밥:200, 시금치:40, 당근:25, 취나물:25, 고사리:25, 참기름:5 } },
  '덮밥':      { cal:480, ings:{ 현미:200, 두부:80, 버섯:50, 양파:30, 마늘:5, 참기름:5 } },
  '카레라이스':{ cal:480, ings:{ 현미:200, 감자:60, 당근:40, 양파:50, 닭고기:60 } },
  '볶음밥':    { cal:430, ings:{ 흰쌀:180, 계란:55, 당근:20, 양파:30, 대파:10 } },
  '영양밥':    { cal:380, ings:{ 현미:150, 콩:30, 밤:20, 대추:10, 은행:10 } },
  '취나물밥':  { cal:370, ings:{ 현미:180, 취나물:60, 참기름:5 } },

  // ══ 면류 ══════════════════════════════════
  '비빔국수':  { cal:410, ings:{ 국수:150, 오이:40, 당근:20, 상추:20, 참깨:5, 참기름:5 } },
  '잔치국수':  { cal:380, ings:{ 국수:150, 호박:30, 당근:20, 달걀:30, 대파:10, 김:2 } },
  '콩국수':    { cal:380, ings:{ 국수:130, 두유:200, 오이:30, 참깨:5 } },
  '비빔냉면':  { cal:430, ings:{ 국수:140, 오이:40, 배:30, 당근:20 } },
  '물냉면':    { cal:340, ings:{ 국수:130, 오이:40, 배:30, 달걀:30 } },
  '칼국수':    { cal:420, ings:{ 밀가루:140, 호박:40, 양파:30, 대파:10 } },
  '수제비':    { cal:370, ings:{ 밀가루:120, 감자:50, 양파:30, 호박:30, 대파:10 } },
  '쫄면':      { cal:400, ings:{ 국수:130, 오이:40, 당근:20, 상추:20, 콩나물:30 } },
  '라볶이':    { cal:350, ings:{ 라면:100, 배추:50, 양파:30, 대파:15 } },

  // ══ 구이·튀김류 ══════════════════════════════
  '생선구이':  { cal:200, ings:{ 생선:150, 마늘:5 } },
  '고등어구이':{ cal:270, ings:{ 고등어:150, 마늘:5 } },
  '갈치구이':  { cal:190, ings:{ 생선:150, 마늘:5 } },
  '두부부침':  { cal:180, ings:{ 두부:150, 들기름:8, 대파:10 } },
  '감자전':    { cal:230, ings:{ 고구마:130, 대파:20, 양파:20 } },
  '파전':      { cal:260, ings:{ 밀가루:60, 대파:80, 쪽파:30, 계란:30, 참기름:5 } },
  '녹두전':    { cal:280, ings:{ 콩:80, 밀가루:30, 고사리:20, 김치:30, 돼지고기:30 } },
  '부침개':    { cal:250, ings:{ 밀가루:60, 당근:20, 양파:30, 부추:30, 계란:30 } },
  '탕수육':    { cal:350, ings:{ 돼지고기:100, 밀가루:40, 당근:20, 양파:20 } },
  '잡채':      { cal:290, ings:{ 당근:30, 시금치:30, 양파:30, 버섯:40, 소고기:60, 참기름:5, 참깨:3 } },

  // ══ 샐러드·냉채 ═══════════════════════════
  '야채샐러드':{ cal:80,  ings:{ 상추:40, 양배추:40, 당근:20, 토마토:40, 오이:30 } },
  '콩샐러드':  { cal:150, ings:{ 콩:60, 상추:30, 토마토:40, 양파:20, 올리브유:10 } },
  '두부샐러드':{ cal:140, ings:{ 두부:100, 상추:40, 토마토:30, 오이:30, 들기름:5 } },
  '과일샐러드':{ cal:110, ings:{ 사과:60, 딸기:50, 키위:40, 블루베리:30 } },
  '미역냉채':  { cal:50,  ings:{ 미역:40, 오이:40, 당근:20, 참깨:3, 식초:5 } },

  // ══ 빵·간식류 ════════════════════════════
  '통밀빵':    { cal:240, ings:{ 통밀:80 } },
  '단호박스프':{ cal:160, ings:{ 단호박:120, 우유:60 } },
  '두유':      { cal:90,  ings:{ 두유:200 } },
  '약콩두유':  { cal:95,  ings:{ 약콩:30, 두유:170 } },

  // ══ 기타 한식 ════════════════════════════
  '쌈밥':      { cal:380, ings:{ 현미:180, 상추:40, 깻잎:20, 배추:20, 된장:15, 마늘:5 } },
  '보쌈':      { cal:320, ings:{ 돼지고기:120, 배추:50, 마늘:10, 상추:30 } },
  '족발':      { cal:380, ings:{ 돼지고기:150, 마늘:10, 상추:30, 부추:20 } },
  '순대':      { cal:290, ings:{ 돼지고기:100, 당면:30, 시금치:20, 대파:10 } },
  '떡볶이':    { cal:310, ings:{ 떡:150, 배추:50, 대파:20, 고춧가루:10 } },
  '김밥':      { cal:360, ings:{ 현미:160, 김:4, 시금치:25, 당근:25, 우엉:20, 달걀:30, 참깨:3, 참기름:5 } },
  '주먹밥':    { cal:300, ings:{ 현미:160, 김:3, 참깨:3, 참기름:5 } },
  '유부초밥':  { cal:350, ings:{ 현미:180, 콩:20, 당근:15, 참깨:5 } },
  '초밥':      { cal:320, ings:{ 현미:150, 생선:60, 김:3 } },
  '계란말이':  { cal:160, ings:{ 달걀:110, 당근:15, 대파:10, 시금치:15 } },
  '계란찜':    { cal:120, ings:{ 달걀:110, 대파:10, 당근:10 } },
  '호박볶음':  { cal:65,  ings:{ 애호박:120, 마늘:5, 들기름:5 } },
  '미역줄기볶음':{ cal:50, ings:{ 미역:80, 참기름:5, 마늘:5 } },
  '무침나물':  { cal:55,  ings:{ 시금치:60, 콩나물:40, 마늘:5, 들기름:5, 참깨:3 } },
};

// 검색용 자동완성 목록
const RECIPE_NAMES = Object.keys(RECIPES);

// 레시피명 → 식재료 분해 → 식품군/파이토케미컬 집계
function analyzeRecipe(recipeName) {
  const recipe = RECIPES[recipeName];
  if (!recipe) return null;

  const ingredientDetails = [];
  for (const [ingName, grams] of Object.entries(recipe.ings)) {
    const ing = INGREDIENTS[ingName];
    if (!ing) continue;
    const kcal = (ing.kcal / 100) * grams;
    ingredientDetails.push({
      name: ingName,
      grams,
      kcal: Math.round(kcal),
      cat: ing.cat,
      prf: ing.prf,
      phytos: ing.phytos,
    });
  }
  return { name: recipeName, totalCal: recipe.cal, ingredients: ingredientDetails };
}
