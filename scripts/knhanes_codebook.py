"""KNHANES 원시자료 > 이용지침서 > 영양조사 코드자료집 + 원시자료이용지침서 다운로드."""
import os, re, sys
from playwright.sync_api import sync_playwright

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
WANT = re.compile(r"코드\s*자료집|원시자료이용지침서")

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(user_agent=UA, accept_downloads=True)
    reqs = []
    pg.on("request", lambda r: reqs.append((r.method, r.url, (r.post_data or "")[:200])))
    pg.on("dialog", lambda d: (print("  DIALOG:", d.message), d.accept()))

    pg.goto("https://knhanes.kdca.go.kr/knhanes/main.do", wait_until="networkidle", timeout=90_000)
    pg.wait_for_timeout(1500)
    pg.click("a:text-is('원시자료')")
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(2000)
    for e in [x for x in pg.query_selector_all("a") if (x.inner_text() or "").strip() == "이용지침서"]:
        e.evaluate("x=>x.click()")
        pg.wait_for_load_state("networkidle", timeout=30_000)
        pg.wait_for_timeout(2500)
        if "utztnGd" in pg.url:
            break
    print("on:", pg.url)

    rows = pg.query_selector_all("table tbody tr, ul li")
    targets = []
    for tr in rows:
        txt = re.sub(r"\s+", " ", tr.inner_text() or "").strip()
        if not WANT.search(txt):
            continue
        for a in tr.query_selector_all("a, button"):
            at = re.sub(r"\s+", " ", (a.inner_text() or "")).strip()
            title = a.get_attribute("title") or ""
            if re.search(r"다운|download|hwp|pdf|zip|xls", at + title, re.I) or a.query_selector("img"):
                targets.append((txt[:60], a))
    print("targets:", [t[0] for t in targets][:12])

    if not targets:
        print("no explicit download control; dumping first matching row html")
        for tr in rows:
            txt = re.sub(r"\s+", " ", tr.inner_text() or "").strip()
            if WANT.search(txt):
                print(tr.evaluate("x=>x.outerHTML")[:1200])
                break

    for label, a in targets[:6]:
        try:
            with pg.expect_download(timeout=180_000) as di:
                a.evaluate("x=>x.click()")
            d = di.value
            path = os.path.join(OUT, d.suggested_filename)
            d.save_as(path)
            print(f"  OK [{label}] -> {d.suggested_filename} {os.path.getsize(path):,} bytes")
        except Exception as e:
            print(f"  FAIL [{label}]: {type(e).__name__}: {str(e)[:130]}")
        pg.wait_for_timeout(1200)

    print("=== file-ish requests ===")
    for m, u, d in dict.fromkeys(reqs):
        if re.search(r"file|down|atch", u, re.I):
            print(" ", m, u[:150], d[:120])
    b.close()
