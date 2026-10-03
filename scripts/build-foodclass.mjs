// 음식 분류체계 → public/static/foodclass.js 생성
//
// 입력 (두 파일을 scripts/data/ 에 두고 실행)
//   scripts/data/음식_레시피.xlsx    : 「음식」 시트 — 음식명 · 음식 분류코드 · 등급
//   scripts/data/음식_분류체계.xlsx  : 「음식 분류체계」 시트 — 대분류 / 중분류 / 소분류 이름
//
// 분류코드 = 대분류 문자 + 중분류 2자리 + 소분류 2자리  (예: A0101 = 주식_A / 01 밥류 / 01 쌀밥)
//
//   실행: node scripts/build-foodclass.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const DIR = new URL('./data/', import.meta.url)
const FOOD = new URL('음식_레시피.xlsx', DIR)
const TAXO = new URL('음식_분류체계.xlsx', DIR)

for (const f of [FOOD, TAXO]) {
  if (!existsSync(f)) {
    console.error('입력 파일이 없습니다: ' + decodeURIComponent(f.pathname))
    console.error('scripts/data/ 에 음식_레시피.xlsx · 음식_분류체계.xlsx 를 두고 다시 실행하세요.')
    process.exit(1)
  }
}

// xlsx 파싱은 파이썬 openpyxl 에 위임 (런타임 의존성 추가 없이)
const PY = `
import json, sys, openpyxl

food = openpyxl.load_workbook(sys.argv[1], data_only=True, read_only=True)['음식']
name2code, grade = {}, {}
for i, r in enumerate(food.iter_rows(values_only=True)):
    if i == 0: continue
    _no, g, cls, _code, name, _src = (list(r) + [None]*6)[:6]
    if not name or not cls: continue
    name = str(name).strip(); cls = str(cls).strip()
    if name not in name2code:
        name2code[name] = cls
        grade[name] = str(g).strip() if g else ''

taxo = openpyxl.load_workbook(sys.argv[2], data_only=True, read_only=True)['음식 분류체계']
major = midno = mid = None
mids, subs = {}, {}
MAJOR_LETTER = {}
for i, r in enumerate(taxo.iter_rows(values_only=True)):
    if i == 0: continue
    a, b, c, d, e = (list(r) + [None]*6)[:5]
    if a:
        major = ' '.join(str(a).split())
        # 「주식_A」 「국, 탕류_B」 처럼 이름_대분류문자 형태
        if '_' in major: MAJOR_LETTER[major.rsplit('_', 1)[1].strip()] = major.rsplit('_', 1)[0].strip()
    if b:
        midno, mid = str(b).strip(), (' '.join(str(c).split()) if c else '')
        mids[midno] = mid
    if d and midno:
        subs['%s|%s' % (midno, str(d).strip())] = (' '.join(str(e).split()) if e else '')
json.dump({'name2code': name2code, 'grade': grade, 'mids': mids, 'subs': subs, 'majors': MAJOR_LETTER},
          open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False)
`
const tmp = new URL('./_foodclass.json', import.meta.url)
execFileSync('python', ['-c', PY, pathOf(FOOD), pathOf(TAXO), pathOf(tmp)], { stdio: 'inherit' })
function pathOf(u) { return decodeURIComponent(u.pathname).replace(/^\//, '') }

const raw = JSON.parse(readFileSync(tmp, 'utf8'))

// recipes.js 에 실제로 있는 레시피만 담는다
const recipes = readFileSync(new URL('../public/static/recipes.js', import.meta.url), 'utf8')
const recipeNames = new Set(
  [...recipes.slice(recipes.indexOf('const RECIPES = {')).matchAll(/^\s*'([^']+)':\s*\{\s*cal:/gm)].map(m => m[1])
)

const byCode = {}
let matched = 0, missing = 0
for (const [name, code] of Object.entries(raw.name2code)) {
  if (!recipeNames.has(name)) { missing++; continue }
  matched++
  ;(byCode[code] || (byCode[code] = [])).push(name)
}

// 코드에 쓰인 중분류·소분류 이름만 추린다
const midName = {}, subName = {}
for (const code of Object.keys(byCode)) {
  const midNo = String(Number(code.slice(1, 3)))
  const subNo = String(Number(code.slice(3, 5)))
  midName[code.slice(0, 3)] = raw.mids[midNo] || ''
  subName[code] = raw.subs[midNo + '|' + subNo] || ''
}

const q = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
const lines = []
lines.push(`// ============================================
// 음식 분류체계 (자동 생성 — scripts/build-foodclass.mjs)
// 출처: 「음식·레시피」 엑셀 「음식」 시트 + 「음식 분류체계」 엑셀
// 분류코드 = 대분류 문자 + 중분류 2자리 + 소분류 2자리 (예: A0101 = 주식 / 밥류 / 쌀밥)
// 레시피 ${matched}개 · 분류코드 ${Object.keys(byCode).length}종
// ============================================

// 대분류 문자 → 이름
const FOOD_MAJOR = ${JSON.stringify(raw.majors, null, 0).replace(/"/g, "'")};

// 분류코드 앞 3자리 → 중분류 이름
const FOOD_MID = {`)
for (const k of Object.keys(midName).sort()) lines.push(`  ${q(k)}: ${q(midName[k])},`)
lines.push(`};

// 분류코드 → 소분류 이름
const FOOD_SUB = {`)
for (const k of Object.keys(subName).sort()) lines.push(`  ${q(k)}: ${q(subName[k])},`)
lines.push(`};

// 분류코드 → 음식명 목록
const FOOD_CLASS_NAMES = {`)
for (const code of Object.keys(byCode).sort()) {
  lines.push(`  ${q(code)}: [${byCode[code].sort().map(q).join(',')}],`)
}
lines.push(`};

// 음식명 → 분류코드 (역색인)
const FOOD_CLASS = {};
for (const [code, names] of Object.entries(FOOD_CLASS_NAMES)) {
  for (const n of names) FOOD_CLASS[n] = code;
}

// 분류코드 → '주식 · 밥류 · 잡곡밥' 형태의 읽기용 이름
function foodClassLabel(code) {
  if (!code) return '';
  return [FOOD_MAJOR[code[0]], FOOD_MID[code.slice(0, 3)], FOOD_SUB[code]].filter(Boolean).join(' · ');
}
`)

const outPath = new URL('../public/static/foodclass.js', import.meta.url)
writeFileSync(outPath, lines.join('\n'))
console.log(`foodclass.js 생성: 레시피 ${matched}개 매칭 · ${missing}개는 recipes.js 에 없어 제외`)
console.log(`  크기 ${(lines.join('\n').length / 1024).toFixed(0)} KB · 분류코드 ${Object.keys(byCode).length}종`)
