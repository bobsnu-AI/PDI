import { Hono } from 'hono'
import recipesScript from '../public/static/recipes.js?raw'
import foodclassScript from '../public/static/foodclass.js?raw'
import pfsScript from '../public/static/pfs.js?raw'
import productsScript from '../public/static/products.js?raw'
import mealplanScript from '../public/static/mealplan.js?raw'
import trackerScript from '../public/static/tracker.js?raw'
import appScript from '../public/static/app.js?raw'
import htmlTemplate from '../public/index.html?raw'

const app = new Hono()

// 의존 순서: recipes(INGREDIENTS·RECIPES) → foodclass(음식 분류체계) → pfs(영양 추정)
//           → products(제품·가격·룰) → mealplan(식단 최적화) → tracker(기록·모니터링) → app(UI)
const SCRIPTS: [string, string][] = [
  ['recipes', recipesScript],
  ['foodclass', foodclassScript],
  ['pfs', pfsScript],
  ['products', productsScript],
  ['mealplan', mealplanScript],
  ['tracker', trackerScript],
  ['app', appScript],
]

app.get('*', (c) => {
  // 줄바꿈(LF/CRLF)에 영향받지 않도록 정규식으로 태그 블록을 찾는다
  const tagRe = new RegExp(SCRIPTS.map(([n]) => `<script src="/static/${n}\\.js"></script>`).join('\\s*'))
  const found = htmlTemplate.match(tagRe)
  if (!found) throw new Error('index.html 의 스크립트 태그를 찾을 수 없습니다')
  // 함수형 치환: 스크립트 내 `$` 문자가 치환 패턴($&, $' 등)으로 해석되지 않도록
  const html = htmlTemplate.replace(
    found[0],
    () => SCRIPTS.map(([, src]) => `<script>${src}</script>`).join('\n')
  )
  return c.html(html)
})

export default app
