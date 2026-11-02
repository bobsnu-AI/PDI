// GitHub Pages용 정적 빌드
// src/index.tsx 와 같은 순서로 스크립트를 index.html 에 인라인하여
// 서버 없이 동작하는 단일 index.html 을 dist-static/ 에 생성
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

const SCRIPTS = ['recipes', 'foodclass', 'pfs', 'patterns', 'products', 'mealplan', 'tracker', 'app']
// 줄바꿈(LF/CRLF)에 영향받지 않도록 정규식으로 태그 블록을 찾는다
const tagRe = new RegExp(SCRIPTS.map(n => `<script src="/static/${n}\\.js"></script>`).join('\\s*'))
const html = read('public/index.html')
const found = html.match(tagRe)
if (!found) throw new Error('index.html 의 스크립트 태그를 찾을 수 없습니다 (순서: ' + SCRIPTS.join(' → ') + ')')

const inlined = SCRIPTS
  .map(name => `<script>${read(`public/static/${name}.js`)}</script>`)
  .join('\n')
// 함수형 치환: 스크립트 내 `$` 문자가 치환 패턴으로 해석되지 않도록
const out = html.replace(found[0], () => inlined)

mkdirSync(new URL('../dist-static/', import.meta.url), { recursive: true })
writeFileSync(new URL('../dist-static/index.html', import.meta.url), out)
// 제품 사진 — index.html 이 /static/img/… 로 참조하므로 같은 경로에 둡니다
const img = new URL('../public/static/img/', import.meta.url)
if (existsSync(img)) cpSync(img, new URL('../dist-static/static/img/', import.meta.url), { recursive: true })
// out.length 는 UTF-16 코드 단위라 한글이 섞이면 실제 파일 크기와 다름 → 바이트로 계산
console.log(`dist-static/index.html (${(Buffer.byteLength(out, 'utf8') / 1024 / 1024).toFixed(1)} MB)`)
