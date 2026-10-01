import { Hono } from 'hono'
import recipesScript from '../public/static/recipes.js?raw'
import pfsScript from '../public/static/pfs.js?raw'
import appScript from '../public/static/app.js?raw'
import planScript from '../public/static/plan.js?raw'
import htmlTemplate from '../public/index.html?raw'

const app = new Hono()

app.get('*', (c) => {
  // recipes.js → pfs.js → app.js → plan.js 순서로 인라인
  // (pfs.js는 INGREDIENTS에, app.js는 RECIPES·analyzeRecipe·calculateDietPFS에, plan.js는 app.js에 의존)
  const html = htmlTemplate
    .replace(
      '<script src="/static/recipes.js"></script>\n<script src="/static/pfs.js"></script>\n<script src="/static/app.js"></script>\n<script src="/static/plan.js"></script>',
      // 함수형 치환: 스크립트 내 `$` 문자가 치환 패턴($&, $' 등)으로 해석되지 않도록
      () => `<script>${recipesScript}</script>\n<script>${pfsScript}</script>\n<script>${appScript}</script>\n<script>${planScript}</script>`
    )
  return c.html(html)
})

export default app
