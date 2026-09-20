import { Hono } from 'hono'
import appScript from '../public/static/app.js?raw'
import htmlTemplate from '../public/index.html?raw'

const app = new Hono()

app.get('*', (c) => {
  // Inline the app.js into the HTML
  const html = htmlTemplate.replace(
    '<script src="/static/app.js"></script>',
    `<script>${appScript}</script>`
  )
  return c.html(html)
})

export default app
