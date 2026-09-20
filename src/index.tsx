import { Hono } from 'hono'
import recipesScript from '../public/static/recipes.js?raw'
import appScript from '../public/static/app.js?raw'
import htmlTemplate from '../public/index.html?raw'

const app = new Hono()

app.get('*', (c) => {
  // recipes.js → app.js 순서로 인라인 (app.js가 RECIPES, RECIPE_NAMES, analyzeRecipe에 의존)
  const html = htmlTemplate
    .replace(
      '<script src="/static/recipes.js"></script>\n<script src="/static/app.js"></script>',
      `<script>${recipesScript}</script>\n<script>${appScript}</script>`
    )
  return c.html(html)
})

export default app
