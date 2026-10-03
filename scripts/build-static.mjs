// GitHub Pages용 정적 빌드
// src/index.tsx 와 같은 순서로 스크립트를 index.html 에 인라인하여
// 서버 없이 동작하는 단일 index.html 을 dist-static/ 에 생성
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

const SCRIPTS = ['recipes', 'foodclass', 'pfs', 'products', 'mealplan', 'tracker', 'app']
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
console.log(`dist-static/index.html (${(out.length / 1024 / 1024).toFixed(1)} MB)`)
