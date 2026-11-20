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
//   2) node scripts/build-foodnut.mjs jobs
//      호출하지 않고, 이름으로 찾아야 할 목록만 세어 봅니다.
//   3) node scripts/build-foodnut.mjs index  →  … cands  →  고른 번호 적기  →  … picks
//      이 API 에 코드가 없는 식품을 이름으로 맞춥니다. 아래 「앤트로픽 키 없이 고르는 길」.
//   4) node scripts/build-foodnut.mjs
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
// 한 번에 받을 건수. 상한이 공개돼 있지 않아 큰 쪽부터 넣어 보고 되는 것을 씁니다.
// 1000 으로 부르면 빈 응답이 옵니다.
const ROW_TRY = [500, 200, 100, 50];

// 응답 칸은 AMT_NUM1~157 로 번호만 있습니다. 번호가 무슨 영양소인지는 포털에
// 공개돼 있지 않아 probe 로 확인했습니다 (2026-11-04, 국밥_돼지머리 100 g).
//   1 에너지 137 kcal · 2 수분 71.60 · 3 단백질 6.70 · 4 지방 5.16 ·
//   5 회분 0.63 · 6 탄수화물 15.94  →  합이 100.03 g 이고
//   4×6.70 + 9×5.16 + 4×15.94 = 137 kcal 로 떨어져 1~6 은 확실합니다.
// 7~13 은 국가표준식품성분표 차례(당류·식이섬유·칼슘·철·인·칼륨·나트륨)와 값이 맞습니다.
// 콜레스테롤·포화지방산·트랜스지방산 자리는 아래 CHECK 로 한 번 더 봅니다.
const NUT_FIELD = {
  code:    ['FOOD_CD'],
  protein: ['AMT_NUM3'],
  fat:     ['AMT_NUM4'],
  carb:    ['AMT_NUM6'],
  sugar:   ['AMT_NUM7'],
  fiber:   ['AMT_NUM8'],
  sodium:  ['AMT_NUM13'],
  chol:    ['AMT_NUM23'],
  satfat:  ['AMT_NUM24'],
  trans:   ['AMT_NUM25'],
};

// 받은 값이 말이 되는지 보는 검사. 달걀은 지방이 9 g 쯤인데 콜레스테롤은 370 mg 쯤
// 이라, 두 칸이 바뀌면 바로 드러납니다. 숫자가 엉뚱하면 칸 번호가 밀린 것입니다.
const CHECK = { name: '달걀', fat: [5, 15], satfat: [1, 6], chol: [200, 600] };

// 키를 읽습니다. 환경변수가 없으면 scripts/data/food-api-key.txt 를 봅니다.
// scripts/data 는 .gitignore 에 들어 있어 저장소에 올라가지 않습니다.
function keyOrDie() {
  let raw = (process.env.FOOD_API_KEY || '').trim();
  if (!raw) {
    try { raw = fs.readFileSync(path.join(DATA, 'food-api-key.txt'), 'utf8').trim(); } catch {}
  }
  if (!raw) {
    console.error('FOOD_API_KEY 가 없습니다. 공공데이터포털에서 개발계정 키를 받아 넘기세요.');
    console.error('  https://www.data.go.kr/data/15127578/openapi.do');
    console.error("  PowerShell:  $env:FOOD_API_KEY = '받은키'");
    console.error('  또는 scripts/data/food-api-key.txt 에 키만 한 줄로 저장하세요.');
    process.exit(1);
  }
  // 포털은 같은 키를 Encoding·Decoding 두 가지로 보여 줍니다. 어느 쪽을 붙여넣어도
  // 되게 합니다 — 아래에서 URLSearchParams 가 한 번 더 인코딩하므로, 이미 인코딩된
  // 키(%2F·%3D 가 든 것)는 여기서 풀어 둡니다. 안 풀면 %2F 가 %252F 가 됩니다.
  return /%[0-9A-Fa-f]{2}/.test(raw) ? decodeURIComponent(raw) : raw;
}

// 포털이 키 문제를 400·403 두 가지로 돌려줍니다. 무슨 뜻인지 풀어 적습니다.
function keyError(res, text) {
  const msg = (text.match(/"returnAuthMsg"\s*:\s*"([^"]*)"/) || [])[1];
  if (msg && /서비스키|SERVICE_KEY|인증/.test(msg)) {
    const e = new Error('인증키가 아직 안 먹습니다: ' + msg
      + '\n포털에서 키를 받은 직후라면 1~2시간 뒤에 다시 해보세요.'
      + '\n키는 Encoding·Decoding 어느 쪽이든 됩니다.');
    e.quiet = true;
    return e;
  }
  return new Error('HTTP ' + res.status + ' — ' + text.slice(0, 300));
}

async function fetchPage(key, pageNo, numOfRows) {
  const url = API + '?' + new URLSearchParams({
    serviceKey: key, pageNo: String(pageNo), numOfRows: String(numOfRows), type: 'json',
  });
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw keyError(res, text);
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
out, std = {}, {}
for r in rows:
    if not r:
        continue
    code = str(r[2] or '').strip()
    for i in (1, 3, 0):
        if r[i]:
            out.setdefault(str(r[i]).strip(), code)
    if code and r[3]:
        std.setdefault(code, str(r[3]).strip())   # 식약처 표준 식품명 — 이름으로 찾을 때 씁니다
sys.stdout.write(json.dumps({"map": out, "std": std}))
`;
  // json.dumps 의 ensure_ascii 를 끄면 안 됩니다. 윈도우 파이썬은 표준출력을
  // cp949 로 내보내서 한글 이름이 깨집니다. \uXXXX 로 받으면 JSON.parse 가 되살립니다.
  const raw = execFileSync('python', ['-I', '-c', py], { maxBuffer: 1 << 28 });
  return JSON.parse(raw.toString('utf8'));
}

function pick(row, names) {
  for (const n of names) if (row[n] != null && row[n] !== '') return row[n];
  return null;
}

// 이름으로 찾아 칸이 가장 많이 찬 줄을 돌려줍니다. 이름이 일부만 맞아도 걸리므로
// (「버터」로 찾으면 「기타빵_연유버터라우겐」이 나옵니다) 줄을 골라야 합니다.
async function searchName(key, name) {
  const url = API + '?' + new URLSearchParams({
    serviceKey: key, pageNo: '1', numOfRows: '100', type: 'json', FOOD_NM_KR: name });
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw keyError(res, text);
  const body = JSON.parse(text).body || {};
  const items = body.items || [];
  const rows = (Array.isArray(items) ? items : (items.item || [])).map(r => r.item || r);
  const filled = r => Object.entries(r).filter(([k, v]) =>
    /^AMT_NUM/.test(k) && v != null && String(v).trim() !== '').length;
  return rows.sort((a, b) => filled(b) - filled(a));
}

// 찾을 말들을 만듭니다. 엑셀의 식약처 표준명을 그대로 넣으면
// (「고등어류_고등어_육_생것_부산_3월」) 이 API 는 아무것도 돌려주지 않습니다.
// 뒤 토막을 떼어 가며 찾고, 줄이 나오는 첫 말을 씁니다.
function queriesFor(name) {
  const base = name.replace(/\(.*$/, '').trim();
  const seg = base.split('_');
  const out = [base];
  if (seg.length > 2) out.push(seg.slice(0, 2).join('_'));
  if (seg.length > 1) out.push(seg[0]);
  return [...new Set(out)].filter(Boolean);
}

// 그 말들로 차례로 찾아 줄이 나오는 것을 돌려줍니다.
async function searchAny(key, name) {
  for (const q of queriesFor(name)) {
    const rows = await searchName(key, q);
    if (rows.length) return rows;
  }
  return [];
}

// 그 중 한 줄만 고릅니다 (probe · 칸 번호 검사용).
async function lookup(key, name, want) {
  const rows = await searchName(key, name);
  // 이름이 그대로 맞는 것을 먼저, 없으면 칸이 가장 많이 찬 것
  const exact = rows.filter(r => String(r.FOOD_NM_KR || '').replace(/_.*$/, '') === (want || name));
  return (exact.length ? exact : rows)[0] || null;
}

// 한 줄에서 100 g 기준 영양성분만 뽑습니다. 값이 없는 칸은 넣지 않습니다 —
// 0 으로 넣으면 pfs.js 가 「나트륨 0」을 실측값으로 믿어 버립니다. 간장·육수처럼
// 나트륨 칸이 빈 줄이 많습니다.
function nutOf(row) {
  const nut = {};
  for (const [k, names] of Object.entries(NUT_FIELD)) {
    if (k === 'code') continue;
    const raw = pick(row, names);
    if (raw == null || String(raw).trim() === '') continue;
    const v = Number(raw);
    if (Number.isFinite(v)) nut[k] = Math.round(v * 100) / 100;
  }
  return nut;
}

// 식품코드 꼴. 엑셀 코드 칸에 코드 대신 「DB 없음」이 적힌 이름이 529개 있습니다.
const REAL_CODE = /^[A-Z]\d{3}-/;

// 이름으로 찾아야 할 목록입니다. 코드가 있는 것은 코드마다 한 번만 찾아 같은 코드의
// 다른 이름에도 씁니다 (같은 식품의 다른 표기). 코드가 없는 이름은 서로 다른 식품이니
// 이름마다 따로 찾습니다 — 묶으면 529개에 한 식품의 값이 들어갑니다.
function nameJobs(codes, std, byCode) {
  const aliasOf = {};
  for (const [n, c] of Object.entries(codes)) (aliasOf[c] = aliasOf[c] || []).push(n);
  const jobs = [];
  for (const [c, names] of Object.entries(aliasOf)) {
    if (!REAL_CODE.test(c)) for (const n of names) jobs.push({ q: n, code: null, apply: [n] });
    else if (!byCode[c]) jobs.push({ q: std[c] || names[0], code: c, apply: names });
  }
  return jobs;
}

// 후보가 여럿일 때 어느 것이 같은 식품인지 claude 가 고릅니다. 없는 값을 만들지는
// 않습니다 — 고른 줄의 실측값을 그대로 씁니다.
// 키는 환경변수로 넘깁니다 (공개 저장소이니 넣지 마세요):
//   PowerShell:  $env:ANTHROPIC_API_KEY = '받은키'
const LLM_MODEL = 'claude-sonnet-5-5';
async function llmPick(apiKey, items) {
  const prompt = [
    '레시피에 적힌 식재료 이름과, 식약처 식품영양성분DB 에서 그 이름으로 찾은 후보들입니다.',
    '항목마다 같은 식품을 가리키는 후보 번호를 하나 고르세요.',
    '- 부위 · 조리법 · 상태가 다르면 고르지 마세요. 「돼지고기(다진것)」에 「돼지고기_삼겹살_구운것」은 아닙니다.',
    '- 부위를 안 적은 이름이면 대표 · 평균 후보를, 그것이 없으면 가장 흔히 쓰는 부위의 생것을 고르세요.',
    '- 맞는 것이 없으면 null 로 두세요. 비슷해 보인다고 아무거나 고르면 영양성분이 틀립니다.',
    '답은 JSON 배열만 적으세요: [{"i":0,"pick":3},{"i":1,"pick":null}]',
    '',
    items.map((it, i) => '[' + i + '] ' + it.q + '\n'
      + it.cands.map((c, j) => '   ' + j + '. ' + c).join('\n')).join('\n'),
  ].join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: LLM_MODEL, max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }] }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('claude 를 못 불렀습니다 (' + res.status + ') — ' + text.slice(0, 200));
  const say = (JSON.parse(text).content || []).map(c => c.text || '').join('');
  const m = say.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('고른 답을 못 읽었습니다 — ' + say.slice(0, 200));
  const out = new Map();
  for (const o of JSON.parse(m[0])) out.set(o.i, o.pick);
  return out;
}

async function probe(name) {
  const key = keyOrDie();
  const names = name ? [name] : ['달걀', '버터', '식용유'];
  for (const n of names) {
    const r = await lookup(key, n);
    if (!r) { console.log('\n■ ' + n + ' — 찾은 것이 없습니다'); continue; }
    console.log('\n■ ' + r.FOOD_NM_KR + '  (' + r.SERVING_SIZE + ', 코드 ' + r.FOOD_CD + ')');
    for (const [k, v] of Object.entries(r)) {
      if (!/^AMT_NUM/.test(k)) continue;
      if (v == null || String(v).trim() === '') continue;
      console.log('  ' + k.padEnd(12) + String(v));
    }
  }
  console.log('\n이 숫자로 NUT_FIELD 를 맞춥니다.');
}

async function build() {
  const key = keyOrDie();
  const { map: codes, std } = await nameToCode();
  // 코드가 아닌 것(「DB 없음」)은 묶지 않고 아래에서 이름마다 따로 찾습니다.
  const want = new Set(Object.values(codes).filter(c => REAL_CODE.test(c)));
  console.log('맞출 식품코드', want.size, '개');

  // 한 번에 몇 건까지 주는지 찾습니다
  let ROWS = 0, first = null;
  for (const n of ROW_TRY) {
    const r = await fetchPage(key, 1, n);
    if (r.rows.length) { ROWS = n; first = r; break; }
    console.log('한 번에 ' + n + '건은 안 됩니다 — 줄여서 다시 해봅니다.');
  }
  if (!first) {
    const e = new Error('받은 자료가 없습니다. 하루 호출 한도를 넘었거나 서비스가 잠시 멎었을 수 있습니다.');
    e.quiet = true;
    throw e;
  }
  console.log('한 번에 ' + ROWS + '건씩 받습니다. 전체 ' + first.total + '건.');

  const missing = Object.entries(NUT_FIELD)
    .filter(([, names]) => pick(first.rows[0], names) == null)
    .map(([k]) => k);
  if (missing.length) {
    const e = new Error('응답에서 못 찾은 칸: ' + missing.join(', ')
      + '\nprobe 로 칸 이름을 확인해 NUT_FIELD 를 맞추세요 — 0 을 써 넣지 않습니다.'
      + '\n받은 칸: ' + Object.keys(first.rows[0]).join(', '));
    e.quiet = true;
    throw e;
  }

  // 칸 번호가 밀리지 않았는지 달걀로 한 번 봅니다
  {
    const r = await lookup(key, CHECK.name);
    if (r) {
      const bad = [];
      for (const k of ['fat', 'satfat', 'chol']) {
        const v = Number(pick(r, NUT_FIELD[k]));
        const [lo, hi] = CHECK[k];
        if (!(v >= lo && v <= hi)) bad.push(k + ' = ' + v + ' (' + lo + '~' + hi + ' 이어야 함)');
      }
      if (bad.length) {
        const e = new Error(r.FOOD_NM_KR + ' 값이 말이 안 됩니다 — 칸 번호가 밀렸습니다.\n  '
          + bad.join('\n  ') + '\nprobe 로 다시 보고 NUT_FIELD 를 고치세요.');
        e.quiet = true;
        throw e;
      }
      console.log('칸 번호 확인했습니다 (' + r.FOOD_NM_KR + ').');
    }
  }

  // 받다가 끊겨도 다시 받지 않게 중간에 저장해 둡니다. 하루 10,000번 한도가 있고
  // 3,400번쯤 불러야 해서, 처음부터 다시 받으면 하루치를 날립니다.
  const CACHE = path.join(DATA, 'foodnut-cache.json');
  let byCode = {}, page = 1, got = 0;
  if (fs.existsSync(CACHE)) {
    try {
      const c = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
      byCode = c.byCode || {}; page = c.page || 1; got = c.got || 0;
      console.log('이어서 받습니다 — ' + Object.keys(byCode).length + '개는 이미 받아 뒀습니다.');
    } catch { byCode = {}; }
  }
  const saveCache = () => {
    try { fs.writeFileSync(CACHE, JSON.stringify({ byCode, page, got })); } catch {}
  };
  for (;;) {
    const { rows, total } = page === 1 ? first : await fetchPage(key, page, ROWS);
    if (!rows.length) break;
    if (page % 50 === 0) saveCache();
    for (const r of rows) {
      const code = String(pick(r, NUT_FIELD.code) || '').trim();
      if (!code || !want.has(code) || byCode[code]) continue;
      byCode[code] = nutOf(r);
    }
    got += rows.length;
    const found = Object.keys(byCode).length;
    process.stdout.write('\r받는 중 ' + got + (total ? ' / ' + total : '')
      + ' · 찾은 식품 ' + found + ' / ' + want.size + '   ');
    if (found >= want.size) break;          // 쓸 것을 다 찾으면 그만 받습니다
    if (total && got >= total) break;
    page++;
  }
  console.log('');
  saveCache();

  // 코드로 못 찾은 것은 이름으로 찾습니다. 이 API 에 빠진 식품코드가 있고(달걀 · 고등어 등),
  // 엑셀에 코드가 아예 없는 이름도 있습니다.
  //  · 코드가 있는 것은 코드마다 한 번만 찾아 같은 코드의 다른 이름에도 씁니다 (같은 식품).
  //  · 코드가 없는 것은 이름마다 따로 찾습니다 — 묶으면 서로 다른 식품에 같은 값이 들어갑니다.
  // 후보가 여럿이면 claude 가 고릅니다. 못 고른 것은 비워 두고 pfs.js 의 추정을 씁니다.
  const byName = {};
  // 어떤 이름을 골랐는지 적어 둡니다 — cands·picks 로 미리 채워 두면 묻지 않습니다
  const rec = readJson(REC(), {});
  const saveRec = () => { try { fs.writeFileSync(REC(), JSON.stringify(rec, null, 1)); } catch {} };

  const jobs = nameJobs(codes, std, byCode);

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (jobs.length) {
    console.log('이름으로 찾을 식품 ' + jobs.length + '개 — 이미 골라 둔 것 '
      + jobs.filter(j => j.q in rec).length + '개.');
    if (!apiKey) {
      console.log('ANTHROPIC_API_KEY 가 없어서 이름이 그대로 맞는 것만 채웁니다.');
      console.log("  $env:ANTHROPIC_API_KEY = '받은키' 를 넣고 다시 돌리면 후보를 claude 가 골라 줍니다.");
    }
    let ask = [];
    const flush = async () => {
      if (!ask.length) return;
      let picks;
      try { picks = await llmPick(apiKey, ask); }
      catch (e) { console.log('\n  ' + e.message); ask = []; return; }   // 못 고르면 비워 둡니다
      for (let i = 0; i < ask.length; i++) {
        const it = ask[i], p = picks.get(i);
        const r = Number.isInteger(p) ? it.rows[p] : null;
        rec[it.q] = r
          ? { nm: String(r.FOOD_NM_KR || ''), code: String(r.FOOD_CD || ''), nut: nutOf(r) }
          : null;
      }
      ask = [];
      saveRec();
    };
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      if (!(j.q in rec)) {
        // 앤트로픽 키가 없으면 여기서 찾지 않습니다 — index·cands·picks 로 미리
        // 골라 둔 것만 씁니다. 괜히 포털을 885번 더 부르지 않습니다.
        if (!apiKey) continue;
        let rows = [];
        try { rows = await searchAny(key, j.q); }
        catch (e) { console.log('\n  ' + (e.quiet ? e.message : e)); break; }
        // 코드까지 같거나 이름이 그대로 맞는 줄이 있으면 고를 것이 없습니다
        const same = j.code ? rows.find(r => String(r.FOOD_CD || '').trim() === j.code) : null;
        const exact = rows.find(r => {
          const nm = String(r.FOOD_NM_KR || '');
          return nm === j.q || nm.replace(/_.*$/, '') === j.q;
        });
        if (same || exact) {
          const r = same || exact;
          rec[j.q] = { nm: String(r.FOOD_NM_KR || ''), code: String(r.FOOD_CD || ''), nut: nutOf(r) };
        } else if (!rows.length) {
          rec[j.q] = null;
        } else if (apiKey) {
          const cand = rows.slice(0, 15);
          ask.push({ q: j.q, rows: cand, cands: cand.map(r => String(r.FOOD_NM_KR || '')) });
          if (ask.length >= 20) await flush();
        }
        // 키가 없으면 적어 두지 않습니다 — 키를 넣고 다시 돌리면 그때 고릅니다
      }
      if (i % 10 === 0) {
        process.stdout.write('\r  이름으로 찾는 중 ' + (i + 1) + ' / ' + jobs.length + '   ');
      }
    }
    await flush();
    let hit = 0;
    for (const j of jobs) {
      const r = rec[j.q];
      if (!r) continue;
      for (const n of j.apply) if (!byName[n]) byName[n] = r.nut;
      hit++;
    }
    console.log('\r  이름으로 찾음 ' + hit + ' / ' + jobs.length
      + ' · 고른 이름은 scripts/data/foodnut-llm.json 에 적어 뒀습니다          ');
    saveRec();
  }

  // 식품코드 → 이름으로 바꿔 둡니다. 앱에는 코드가 없고 이름만 있습니다.
  const out = {};
  let nCode = 0, nName = 0;
  for (const [name, code] of Object.entries(codes)) {
    if (byCode[code]) { out[name] = byCode[code]; nCode++; }
    else if (byName[name]) { out[name] = byName[name]; nName++; }
  }
  const keys = Object.keys(out).sort();
  const lines = [
    '// ============================================',
    '// 식재료 영양성분 (자동 생성 — scripts/build-foodnut.mjs)',
    '// 출처: 공공데이터포털 식품의약품안전처_식품영양성분DB정보 (15127578)',
    '// 값은 100 g 기준입니다. pfs.js 가 이름 규칙 추정 대신 이 값을 씁니다.',
    '// 적히지 않은 칸은 원본에 값이 없는 것입니다 — 그 칸만 pfs.js 가 추정합니다.',
    '// 식품 ' + keys.length + '개 (식품코드로 맞춘 것 ' + nCode + '개 · 이름으로 맞춘 것 '
      + nName + '개) · 받은 날 ' + new Date().toISOString().slice(0, 10),
    '// ============================================',
    '',
    'const FOOD_NUT = {',
  ];
  const COL = ['carb', 'protein', 'fat', 'sugar', 'fiber', 'satfat', 'trans', 'chol', 'sodium'];
  for (const n of keys) {
    const v = out[n];
    const body = COL.filter(k => v[k] != null).map(k => k + ':' + v[k]).join(', ');
    lines.push('  ' + JSON.stringify(n) + ': { ' + body + ' },');
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

// ── 이름으로 맞추기: 먼저 전체를 훑어 둡니다 ──
// 이 API 의 이름 찾기(FOOD_NM_KR)는 맞는 줄 중 아무 100개만 돌려줍니다. 「소금」으로
// 찾으면 소금 대신 「취나물무침_소금」 같은 반찬이 올라와 쓸 수 없습니다. 그래서
// 34만 건을 한 번 훑어, 찾을 이름과 앞 토막이 같은 줄만 모아 둡니다.
// 식약처 표준명은 「소금_천일염」처럼 앞 토막이 분류라서 이 걸름이 정확합니다.
//   node scripts/build-foodnut.mjs index
const INDEX = () => path.join(DATA, 'foodnut-index.json');

function wantedKeys(jobs) {
  const keys = new Set();
  for (const j of jobs) {
    for (const q of queriesFor(j.q)) { keys.add(q); keys.add(q.split('_')[0]); }
  }
  return keys;
}

async function buildIndex() {
  const key = keyOrDie();
  const { map: codes, std } = await nameToCode();
  const byCode = readJson(path.join(DATA, 'foodnut-cache.json'), {}).byCode || {};
  const keys = wantedKeys(nameJobs(codes, std, byCode));
  console.log('찾을 앞 토막 ' + keys.size + '가지');
  const idx = readJson(INDEX(), {});
  let page = Number(readJson(INDEX() + '.at', { page: 1 }).page) || 1;
  const save = () => {
    fs.writeFileSync(INDEX(), JSON.stringify(idx));
    fs.writeFileSync(INDEX() + '.at', JSON.stringify({ page }));
  };
  let got = 0, total = 0;
  for (;;) {
    let r;
    try { r = await fetchPage(key, page, 500); }
    catch (e) { console.log('\n' + (e.quiet ? e.message : e)); break; }
    if (!r.rows.length) break;
    total = r.total || total;
    for (const row of r.rows) {
      const nm = String(row.FOOD_NM_KR || '').trim();
      if (!nm) continue;
      const seg = nm.split('_')[0];
      if (!keys.has(seg) && !keys.has(nm)) continue;
      (idx[seg] = idx[seg] || []).push({
        nm, code: String(row.FOOD_CD || '').trim(), nut: nutOf(row) });
    }
    got += r.rows.length;
    page++;
    if (page % 20 === 0) save();
    process.stdout.write('\r훑는 중 ' + got + (total ? ' / ' + total : '')
      + ' · 모은 줄 ' + Object.values(idx).reduce((a, b) => a + b.length, 0) + '   ');
    if (total && got >= total) break;
  }
  save();
  console.log('\n' + INDEX() + ' — 앞 토막 ' + Object.keys(idx).length + '가지 · 줄 '
    + Object.values(idx).reduce((a, b) => a + b.length, 0) + '개');
}

// ── 앤트로픽 키 없이 고르는 길 ──
// claude 를 API 로 부르지 않고, 후보 목록을 파일로 떨어뜨려 사람이나 대화 중의 claude 가
// 고르게 합니다. 포털 키 하나로 끝납니다.
//   1) node scripts/build-foodnut.mjs cands
//      후보를 받아 scripts/data/foodnut-cands.json 과 같은 이름의 .txt 를 씁니다.
//      이름이 그대로 맞는 것은 이 단계에서 바로 foodnut-llm.json 에 넣습니다.
//   2) .txt 를 보고 고른 번호를 scripts/data/foodnut-picks.json 에 적습니다.
//      { "돼지고기(다진것)": 3, "맛술": null }      ← 맞는 것이 없으면 null
//   3) node scripts/build-foodnut.mjs picks
//      고른 번호를 foodnut-llm.json 으로 옮깁니다. 그 뒤 build 는 더 묻지 않습니다.
const CANDS = () => path.join(DATA, 'foodnut-cands.json');
const PICKS = () => path.join(DATA, 'foodnut-picks.json');
const REC   = () => path.join(DATA, 'foodnut-llm.json');

function readJson(file, dflt) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return dflt; }
}

// 훑어 둔 것에서 후보를 뽑습니다 — 호출하지 않습니다.
function candFor(idx, q) {
  const base = q.replace(/\(.*$/, '').trim();
  const seg = base.split('_')[0];
  const pool = (idx[seg] || []).concat(seg === base ? [] : (idx[base] || []));
  const seen = new Set(), out = [];
  for (const r of pool) {
    const k = r.nm + '|' + r.code;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  // 찾던 이름으로 시작하는 줄을 앞에, 그 다음은 이름이 짧은 것부터
  return out.sort((a, b) =>
    (b.nm.startsWith(base) - a.nm.startsWith(base)) || (a.nm.length - b.nm.length));
}

async function dumpCands() {
  const idx = readJson(INDEX(), null);
  if (!idx) { console.error('훑어 둔 것이 없습니다 — index 를 먼저 돌리세요.'); process.exit(1); }
  const { map: codes, std } = await nameToCode();
  const byCode = readJson(path.join(DATA, 'foodnut-cache.json'), {}).byCode || {};
  const jobs = nameJobs(codes, std, byCode);
  const rec = readJson(REC(), {});
  const cands = readJson(CANDS(), {});
  let direct = 0, none = 0;
  for (const j of jobs) {
    const rows = candFor(idx, j.q);
    // 코드까지 같거나 이름이 그대로 맞는 줄이 있으면 고를 것이 없습니다
    const same = j.code ? rows.find(r => r.code === j.code) : null;
    const exact = rows.find(r => r.nm === j.q || r.nm.replace(/_.*$/, '') === j.q);
    if (same || exact) {
      const r = same || exact;
      rec[j.q] = { nm: r.nm, code: r.code, nut: r.nut };
      delete cands[j.q];
      direct++;
    } else if (!rows.length) {
      rec[j.q] = null;
      delete cands[j.q];
      none++;
    } else {
      cands[j.q] = { code: j.code, names: j.apply.length, rows: rows.slice(0, 20) };
    }
  }
  fs.writeFileSync(CANDS(), JSON.stringify(cands));
  fs.writeFileSync(REC(), JSON.stringify(rec, null, 1));
  // 고르기 쉽게 글로도 씁니다. 값은 100 g 기준입니다.
  const txt = [];
  for (const [q, c] of Object.entries(cands)) {
    if (q in rec) continue;
    txt.push('### ' + q + '   [이 이름을 쓰는 식재료 ' + c.names + '개]');
    c.rows.forEach((r, k) => txt.push('  ' + k + '. ' + r.nm
      + '  (단백질 ' + r.nut.protein + ' · 지방 ' + r.nut.fat + ' · 탄수 ' + r.nut.carb + ')'));
    txt.push('');
  }
  const out = CANDS().replace(/\.json$/, '.txt');
  fs.writeFileSync(out, txt.join('\n'));
  console.log('이름이 그대로 맞아 바로 넣은 것 ' + direct + '개 · 아무것도 못 찾은 것 '
    + none + '개 · 골라야 할 것 ' + Object.keys(cands).filter(q => !(q in rec)).length + '개     ');
  console.log('골라야 할 목록: ' + out);
  console.log('고른 번호를 ' + PICKS() + ' 에 { "이름": 번호 } 로 적고 picks 를 돌리세요.');
}

function applyPicks() {
  const cands = readJson(CANDS(), null);
  const picks = readJson(PICKS(), null);
  if (!cands) { console.error('후보 파일이 없습니다 — cands 를 먼저 돌리세요.'); process.exit(1); }
  if (!picks) { console.error('고른 번호 파일이 없습니다: ' + PICKS()); process.exit(1); }
  const rec = readJson(REC(), {});
  let took = 0, left = 0, bad = [];
  for (const [q, pk] of Object.entries(picks)) {
    const c = cands[q];
    if (!c) { bad.push(q + ' — 후보에 없는 이름'); continue; }
    if (pk === null) { rec[q] = null; continue; }
    const r = c.rows[pk];
    if (!r) { bad.push(q + ' — ' + pk + '번 후보가 없음'); continue; }
    rec[q] = { nm: r.nm, code: r.code, nut: r.nut };
    took++;
  }
  for (const q of Object.keys(cands)) if (!(q in rec)) left++;
  fs.writeFileSync(REC(), JSON.stringify(rec, null, 1));
  console.log('고른 것 ' + took + '개를 ' + REC() + ' 에 넣었습니다. 아직 안 고른 것 ' + left + '개.');
  if (bad.length) {
    console.log('맞지 않는 줄 ' + bad.length + '개:');
    for (const b of bad.slice(0, 20)) console.log('  ' + b);
  }
}

// 받으러 가기 전에 목록이 제대로 만들어지는지 봅니다 (호출 없이 엑셀과 캐시만 읽습니다).
//   node scripts/build-foodnut.mjs jobs
async function showJobs() {
  const { map: codes, std } = await nameToCode();
  let byCode = {};
  try {
    byCode = JSON.parse(fs.readFileSync(path.join(DATA, 'foodnut-cache.json'), 'utf8')).byCode || {};
  } catch {}
  const jobs = nameJobs(codes, std, byCode);
  const withCode = jobs.filter(j => j.code);
  console.log('이름 ' + Object.keys(codes).length + '개 · 받아 둔 식품코드 '
    + Object.keys(byCode).length + '개');
  console.log('이름으로 찾을 것 ' + jobs.length + '개 — 코드가 있는 식품 ' + withCode.length
    + '개 · 코드가 없는 이름 ' + (jobs.length - withCode.length) + '개');
  // 코드가 없는 이름은 반드시 하나씩 따로여야 합니다
  const bad = jobs.filter(j => !j.code && j.apply.length !== 1);
  if (bad.length) throw new Error('코드 없는 이름 ' + bad.length + '개가 묶였습니다 — 값이 섞입니다');
  const n = new Set(jobs.flatMap(j => j.apply)).size;
  console.log('이 목록이 채우려는 이름 ' + n + '개. 코드 없는 이름은 1:1 로 떨어집니다.');
  for (const j of withCode.slice(0, 5)) console.log('  ' + j.q + ' → 같은 코드 이름 ' + j.apply.length + '개');
}

const cmd = process.argv[2];
try {
  await (cmd === 'probe' ? probe(process.argv[3] || CHECK.name)
    : cmd === 'jobs'  ? showJobs()
    : cmd === 'index' ? buildIndex()
    : cmd === 'cands' ? dumpCands()
    : cmd === 'picks' ? applyPicks() : build());
} catch (e) {
  // 받는 중이던 요청이 남아 있으면 process.exit 이 윈도우에서 경고를 뱉습니다.
  // 코드만 정해 두고 그냥 끝냅니다.
  console.error(e.quiet ? e.message : e);
  process.exitCode = 1;
}
