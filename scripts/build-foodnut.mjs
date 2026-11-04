// 식품 영양성분을 받아 public/static/foodnut.js 를 만듭니다.
//
// ── 왜 필요한가 ──
// recipes.js 의 INGREDIENTS 에는 kcal 과 파이토케미컬만 있습니다. 탄수화물·단백질·
// 지방·포화지방·당류·나트륨·식이섬유·콜레스테롤이 없어서, pfs.js 가 식재료 이름을
// 보고 추정하고 있습니다 (「고등어니까 지방 10 g쯤」). 받을 자리는 이미 있습니다 —
// INGREDIENTS[이름].nut 에 100 g 기준 실측값이 있으면 pfs.js 가 추정 대신 그걸 씁니다.
//
// ── 어디서 받는가 ──
// 공공데이터포털 「식품의약품안전처_식품영양성분DB정보」
//   https://www.data.go.kr/data/15127578/openapi.do
//   호출주소 https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03
// 식품안전나라의 옛 I2790 API 는 2024년에 폐기되고 이것으로 바뀌었습니다.
//
// ── 인증키 ──
// 포털에서 받은 개발계정 키를 환경변수로 넘깁니다. 저장소에 넣지 마세요 (공개 저장소).
//   PowerShell:  $env:FOOD_API_KEY = "받은키"
//   Bash:        export FOOD_API_KEY="받은키"
// 개발계정은 자동승인이고 하루 10,000번까지 부를 수 있습니다.
//
// ── 쓰는 법 ──
//   1) node scripts/build-foodnut.mjs probe
//      한 건만 받아 응답 칸 이름을 그대로 찍습니다. 포털 문서에 출력 칸 목록이
//      공개돼 있지 않아서, 아래 NUT_FIELD 를 이 결과로 맞춰야 합니다.
//   2) node scripts/build-foodnut.mjs
//      전부 받아 public/static/foodnut.js 를 씁니다.
//
// 칸 이름이 하나라도 안 맞으면 0 을 쓰지 않고 멈춥니다 — 틀린 값으로 점수를 내면
// 추정보다 나쁩니다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = path.join(ROOT, 'public/static/foodnut.js');
const DATA = path.join(ROOT, 'scripts/data');
// 포털 페이지에는 호출주소까지만 적혀 있고 기능 이름이 없습니다. 키 없이 불러 보고
// 찾았습니다 — 경로가 틀리면 「해당 오픈API 서비스가 없거나 폐기됨」, 맞으면
// 「등록되지 않은 서비스키」가 돌아옵니다.
const API  = 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03';
const ROWS = 1000;   // 한 번에 받을 건수

// 응답 칸 이름 → 우리가 쓰는 이름. probe 로 확인한 뒤 맞춥니다.
// 요청 칸이 FOOD_NM_KR·MAKER_NM 식이라 출력도 같은 꼴일 것으로 보고 적어 뒀습니다.
const NUT_FIELD = {
  code:    ['FOOD_CD', 'FOOD_CODE'],
  carb:    ['AMT_NUM7',  'NUTR_CONT3'],
  protein: ['AMT_NUM4',  'NUTR_CONT2'],
  fat:     ['AMT_NUM5',  'NUTR_CONT4'],
  sugar:   ['AMT_NUM8',  'NUTR_CONT5'],
  fiber:   ['AMT_NUM9',  'NUTR_CONT6'],
  satfat:  ['AMT_NUM23', 'NUTR_CONT7'],
  trans:   ['AMT_NUM24', 'NUTR_CONT8'],
  chol:    ['AMT_NUM22', 'NUTR_CONT9'],
  sodium:  ['AMT_NUM13', 'NUTR_CONT10'],
};

function keyOrDie() {
  const raw = (process.env.FOOD_API_KEY || '').trim();
  if (!raw) {
    console.error('FOOD_API_KEY 가 없습니다. 공공데이터포털에서 개발계정 키를 받아 넘기세요.');
    console.error('  https://www.data.go.kr/data/15127578/openapi.do');
    console.error("  PowerShell:  $env:FOOD_API_KEY = '받은키'");
    process.exit(1);
  }
  // 포털은 같은 키를 Encoding·Decoding 두 가지로 보여 줍니다. 어느 쪽을 붙여넣어도
  // 되게 합니다 — 아래에서 URLSearchParams 가 한 번 더 인코딩하므로, 이미 인코딩된
  // 키(%2F·%3D 가 든 것)는 여기서 풀어 둡니다. 안 풀면 %2F 가 %252F 가 됩니다.
  return /%[0-9A-Fa-f]{2}/.test(raw) ? decodeURIComponent(raw) : raw;
}

async function fetchPage(key, pageNo, numOfRows) {
  const url = API + '?' + new URLSearchParams({
    serviceKey: key, pageNo: String(pageNo), numOfRows: String(numOfRows), type: 'json',
  });
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    const msg = (text.match(/"returnAuthMsg"\s*:\s*"([^"]*)"/) || [])[1];
    if (msg && msg.includes('서비스키')) {
      const e = new Error('인증키가 아직 안 먹습니다: ' + msg
        + '\n포털에서 키를 받은 직후라면 1~2시간 뒤에 다시 해보세요.'
        + '\n키를 「일반 인증키(Encoding)」 쪽으로 넣었는지도 확인하세요.');
      e.quiet = true;
      throw e;
    }
    throw new Error('HTTP ' + res.status + ' — ' + text.slice(0, 300));
  }
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error('JSON 이 아닙니다 (키가 틀렸을 수 있습니다):\n' + text.slice(0, 400)); }
  const body = json.body || (json.response && json.response.body) || {};
  const items = body.items || [];
  const rows = Array.isArray(items) ? items : (items.item || []);
  const total = Number(body.totalCount || body.total_count || 0);
  return { rows: rows.map(r => r.item || r), total };
}

// 이름 → 식품코드. scripts/data 의 레시피 엑셀 「레시피 사용 식품」 시트에서 가져옵니다.
async function nameToCode() {
  const xlsx = fs.existsSync(DATA)
    ? fs.readdirSync(DATA).filter(n => n.endsWith('.xlsx')).map(n => path.join(DATA, n))
    : [];
  if (!xlsx.length) {
    console.error('scripts/data 에 레시피 엑셀이 없습니다 — 이름과 식품코드를 맞출 수 없습니다.');
    console.error('「음식_레시피.xlsx」를 scripts/data 에 두세요 (저장소에는 올라가지 않습니다).');
    process.exit(1);
  }
  const big = xlsx.map(f => [fs.statSync(f).size, f]).sort((a, b) => b[0] - a[0])[0][1];
  // openpyxl 로 뽑습니다 — build-foodclass.mjs 와 같은 방식입니다.
  // 시트 이름을 한글로 적으면 윈도우에서 글자가 깨져서 번호로 찾습니다.
  const { execFileSync } = await import('node:child_process');
  const py = `
import json, sys
from openpyxl import load_workbook
wb = load_workbook(${JSON.stringify(big)}, read_only=True, data_only=True)
ws = wb.worksheets[3]           # 분류 / 음식 / 레시피 / 레시피 사용 식품 / 출처
rows = ws.iter_rows(values_only=True)
hdr = next(rows)                # 원재료명 | 수정통일식품명 | 식품코드 | 식품명
assert len(hdr) >= 4, hdr
out = {}
for r in rows:
    if not r:
        continue
    code = str(r[2] or '').strip()
    for i in (1, 3, 0):
        if r[i]:
            out.setdefault(str(r[i]).strip(), code)
sys.stdout.write(json.dumps(out, ensure_ascii=False))
`;
  const raw = execFileSync('python', ['-I', '-c', py], { maxBuffer: 1 << 28 });
  return JSON.parse(raw.toString('utf8'));
}

function pick(row, names) {
  for (const n of names) if (row[n] != null && row[n] !== '') return row[n];
  return null;
}

async function probe() {
  const { rows, total } = await fetchPage(keyOrDie(), 1, 1);
  if (!rows.length) { console.error('받은 자료가 없습니다.'); process.exit(1); }
  console.log('전체 건수:', total);
  console.log('응답 칸 이름과 값 —');
  for (const [k, v] of Object.entries(rows[0])) console.log('  ' + k.padEnd(22) + String(v).slice(0, 40));
  console.log('\n위 이름을 NUT_FIELD 에 맞춘 뒤 다시 돌리세요.');
}

async function build() {
  const key = keyOrDie();
  const codes = await nameToCode();
  const want = new Set(Object.values(codes).filter(Boolean));
  console.log('맞출 식품코드', want.size, '개');

  const first = await fetchPage(key, 1, ROWS);
  if (!first.rows.length) { console.error('받은 자료가 없습니다.'); process.exit(1); }
  const missing = Object.entries(NUT_FIELD)
    .filter(([, names]) => pick(first.rows[0], names) == null)
    .map(([k]) => k);
  if (missing.length) {
    console.error('응답에서 못 찾은 칸: ' + missing.join(', '));
    console.error('probe 로 칸 이름을 확인해 NUT_FIELD 를 맞추세요 — 0 을 써 넣지 않습니다.');
    console.error('받은 칸: ' + Object.keys(first.rows[0]).join(', '));
    process.exit(1);
  }

  const byCode = {};
  let page = 1, got = 0;
  for (;;) {
    const { rows, total } = page === 1 ? first : await fetchPage(key, page, ROWS);
    if (!rows.length) break;
    for (const r of rows) {
      const code = String(pick(r, NUT_FIELD.code) || '').trim();
      if (!code || !want.has(code) || byCode[code]) continue;
      const nut = {};
      for (const [k, names] of Object.entries(NUT_FIELD)) {
        if (k === 'code') continue;
        const v = Number(pick(r, names));
        nut[k] = Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
      }
      byCode[code] = nut;
    }
    got += rows.length;
    process.stdout.write('\r받는 중 ' + got + (total ? ' / ' + total : ''));
    if (total && got >= total) break;
    page++;
  }
  console.log('');

  // 식품코드 → 이름으로 바꿔 둡니다. 앱에는 코드가 없고 이름만 있습니다.
  const out = {};
  for (const [name, code] of Object.entries(codes)) {
    if (byCode[code]) out[name] = byCode[code];
  }
  const keys = Object.keys(out).sort();
  const lines = [
    '// ============================================',
    '// 식재료 영양성분 (자동 생성 — scripts/build-foodnut.mjs)',
    '// 출처: 공공데이터포털 식품의약품안전처_식품영양성분DB정보 (15127578)',
    '// 값은 100 g 기준입니다. pfs.js 가 이름 규칙 추정 대신 이 값을 씁니다.',
    '// 식품 ' + keys.length + '개 · 받은 날 ' + new Date().toISOString().slice(0, 10),
    '// ============================================',
    '',
    'const FOOD_NUT = {',
  ];
  for (const n of keys) {
    const v = out[n];
    lines.push('  ' + JSON.stringify(n) + ': { carb:' + v.carb + ', protein:' + v.protein
      + ', fat:' + v.fat + ', sugar:' + v.sugar + ', fiber:' + v.fiber
      + ', satfat:' + v.satfat + ', trans:' + v.trans + ', chol:' + v.chol
      + ', sodium:' + v.sodium + ' },');
  }
  lines.push('};', '',
    '// INGREDIENTS 에 붙입니다 — pfs.js 가 ing.nut 을 먼저 봅니다.',
    'for (const [name, nut] of Object.entries(FOOD_NUT)) {',
    '  if (INGREDIENTS[name]) INGREDIENTS[name].nut = nut;',
    '}', '');
  fs.writeFileSync(OUT, lines.join('\n'));
  console.log('public/static/foodnut.js — 식품 ' + keys.length + '개');
  console.log('index.html 의 recipes.js 다음, pfs.js 앞에 <script src="/static/foodnut.js"> 를 넣으세요.');
}

const cmd = process.argv[2];
try {
  await (cmd === 'probe' ? probe() : build());
} catch (e) {
  // 받는 중이던 요청이 남아 있으면 process.exit 이 윈도우에서 경고를 뱉습니다.
  // 코드만 정해 두고 그냥 끝냅니다.
  console.error(e.quiet ? e.message : e);
  process.exitCode = 1;
}
