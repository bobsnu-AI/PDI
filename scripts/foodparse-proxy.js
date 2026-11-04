// 먹은 음식 문장을 읽는 중계 서버 (Cloudflare Workers)
//
// ── 왜 서버가 필요한가 ──
// 이 앱은 GitHub Pages 에 올라가는 정적 파일 한 장입니다. 저장소가 공개라서
// API 키를 앱 안에 두면 누구나 소스를 열어 가져다 씁니다. 키는 서버에 있어야
// 하고, 그 서버가 하는 일은 이 파일 한 장이 전부입니다.
//
// ── 배포 ──
//   1. npm i -g wrangler && wrangler login
//   2. wrangler deploy scripts/foodparse-proxy.js --name bobsnu-foodparse \
//        --compatibility-date 2026-11-03
//   3. wrangler secret put ANTHROPIC_API_KEY --name bobsnu-foodparse
//        → 키를 붙여넣습니다. 저장소에는 절대 넣지 마세요.
//   4. wrangler secret put ALLOWED_ORIGIN --name bobsnu-foodparse
//        → https://bobsnu-ai.github.io
//   5. 앱의 기록 화면 →「문장 읽기 설정」에 배포된 주소를 붙여넣습니다.
//
// 설정하지 않아도 앱은 동작합니다. 이름 맞추기로 떨어집니다 (foodparse.js).
//
// ── 비용 ──
// 한 번 읽을 때 입력 600 토큰·출력 120 토큰 정도입니다. Haiku 기준으로
// 1,000 번에 1 달러가 안 됩니다. 입력 길이는 아래 상한으로 묶어 둡니다.

const MODEL = 'claude-haiku-5-5';
const MAX_TEXT = 500;         // 문장 길이 상한 (글자)
const MAX_CANDIDATES = 80;    // 후보 개수 상한

const SYSTEM =
  '너는 한국어 식사 기록을 구조화하는 도구다. 사용자 문장에서 먹은 음식을 찾아 JSON 으로만 답한다.\n'
  + '규칙:\n'
  + '1. name 은 반드시 주어진 후보 목록에 있는 문자열을 글자 그대로 쓴다. 바꾸거나 줄이지 않는다.\n'
  + '2. 후보 목록에 없는 음식은 결과에서 뺀다. 비슷한 이름을 지어내지 않는다.\n'
  + '3. meal 은 breakfast, lunch, dinner, snack 중 하나다. 문장에 끼니가 없으면 주어진 기본값을 쓴다.\n'
  + '4. portion 은 몇 인분인지 나타내는 숫자다. 알 수 없으면 1 로 둔다.\n'
  + '5. 설명·인사·코드블록 없이 JSON 만 출력한다.\n'
  + '형식: {"entries":[{"name":"후보에 있는 이름","meal":"lunch","portion":1}]}';

// 앱이 보고 있는 주소에서만 받습니다. 아무나 우리 키로 모델을 쓰지 못하게.
function cors(env, origin) {
  const allow = env.ALLOWED_ORIGIN || '';
  const ok = allow && origin === allow;
  return {
    'Access-Control-Allow-Origin': ok ? origin : allow || 'null',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

const json = (body, status, headers) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json', ...(headers || {}) },
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const head = cors(env, origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: head });
    if (request.method !== 'POST') return json({ error: 'POST 만 받습니다' }, 405, head);
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) {
      return json({ error: '허용되지 않은 주소입니다' }, 403, head);
    }
    if (!env.ANTHROPIC_API_KEY) return json({ error: '서버에 키가 설정되지 않았습니다' }, 500, head);

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'JSON 이 아닙니다' }, 400, head); }

    const text = String(body.text || '').slice(0, MAX_TEXT).trim();
    const candidates = (Array.isArray(body.candidates) ? body.candidates : [])
      .filter(c => typeof c === 'string').slice(0, MAX_CANDIDATES);
    const defaultMeal = ['breakfast', 'lunch', 'dinner', 'snack'].includes(body.defaultMeal)
      ? body.defaultMeal : 'lunch';
    if (!text || !candidates.length) return json({ entries: [] }, 200, head);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.MODEL || MODEL,
        max_tokens: 500,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: '문장: ' + text + '\n\n기본 끼니: ' + defaultMeal
            + '\n\n후보 목록 (이 중에서만 고를 것):\n' + candidates.join('\n'),
        }],
      }),
    });

    if (!res.ok) {
      // 모델 쪽 오류 내용은 앱으로 흘리지 않습니다 — 키나 계정 정보가 섞일 수 있습니다
      console.log('anthropic ' + res.status + ' ' + (await res.text()).slice(0, 300));
      return json({ error: '문장을 읽지 못했어요' }, 502, head);
    }

    const data = await res.json();
    const raw = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    // 앱이 다시 DB 로 검증하므로(fpValidate) 여기서는 모양만 맞춰 넘깁니다
    return json({ text: raw }, 200, head);
  },
};
