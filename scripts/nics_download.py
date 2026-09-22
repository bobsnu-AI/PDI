"""농식품올바로 (nics.go.kr/food) 국가표준식품성분 DB downloads.

No login required; the popup only asks for 사용목적 / 직업군.
  usepurps 704009 = 앱, 웹, 프로그램 등 개발 활용
  occpgrupp 704015 = 식품관련 기업 종사자
"""
import os, re, sys
from playwright.sync_api import sync_playwright

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
OUT = sys.argv[1]
PAGE = "https://www.nics.go.kr/food/kfi/fct/fctIntro/list?menuId=PS03562"
os.makedirs(OUT, exist_ok=True)


def grab(pg, btn, label):
    pg.goto(PAGE, wait_until="networkidle", timeout=90_000)
    pg.click(btn)
    pg.wait_for_timeout(3500)
    fr = next(f for f in pg.frames if "downPop" in f.url)
    fr.select_option("#usepurps", "704009")
    fr.select_option("#occpgrupp", "704015")
    # the 확인 button lives in the parent jqxWindow, not the iframe
    cands = [e for e in pg.query_selector_all("a, button, input[type=button], span")
             if (e.inner_text() or "").strip() in ("확인", "다운로드")]
    print(f"  [{label}] confirm candidates: {len(cands)}")
    if not cands:
        print("  !! no confirm button; dumping parent controls")
        for e in pg.query_selector_all(".jqx-window a, .jqx-window button, .jqx-window input"):
            print("    ", e.evaluate("x=>x.outerHTML")[:160])
        return None
    try:
        with pg.expect_download(timeout=180_000) as di:
            cands[0].click()
        d = di.value
    except Exception as e:
        print(f"  !! no download: {type(e).__name__}: {e}")
        pg.screenshot(path=os.path.join(OUT, f"_fail_{label}.png"), full_page=True)
        return None
    name = d.suggested_filename
    path = os.path.join(OUT, name)
    d.save_as(path)
    print(f"  [{label}] -> {name}  {os.path.getsize(path):,} bytes")
    return path


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(user_agent=UA, accept_downloads=True)
    pg.on("dialog", lambda d: d.accept())
    for btn, label in (("#btnExcelDown", "EXCEL"), ("#btnPdfDown", "PDF")):
        grab(pg, btn, label)
    b.close()
