"""MFDS K-FIND DB download — fills the "시스템 개선을 위한 활용정보" survey (no login/signup).

Submitted values (reported to the user verbatim):
  소속 = 서울대학교 식의학유전체실
  부서 = 밥스누 AI 맞춤추천 프로젝트
  기관유형 = 연구기관 (agencyType02)
  활용목적 = 앱 등 시스템 개발 DB로 활용 (usePurpose02)
"""
import os, re, sys
from playwright.sync_api import sync_playwright

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
URL = "https://various.foodsafetykorea.go.kr/nutrient/general/down/historyList.do"
# gubun -> label; small ones first so a failure is cheap to diagnose
WANT = [("02", "음식DB"), ("12", "건강기능식품DB"), ("01", "가공식품DB")]


def grab(pg, gubun, label):
    pg.goto(URL, wait_until="networkidle", timeout=90_000)
    pg.wait_for_timeout(2000)
    links = [x for x in pg.query_selector_all("a[onclick*=fnDetail]")
             if f"'{gubun}'" in (x.get_attribute("onclick") or "")]
    if not links:
        print(f"  [{label}] no link for gubun={gubun}")
        return
    links[0].evaluate("x=>x.click()")
    pg.wait_for_load_state("networkidle", timeout=60_000)
    pg.wait_for_timeout(4000)
    fr = next((f for f in pg.frames if "filePop" in f.url), None)
    if fr is None:
        print(f"  [{label}] survey iframe not found")
        return
    fr.fill("#sosok", "서울대학교 식의학유전체실")
    fr.fill("#depart", "밥스누 AI 맞춤추천 프로젝트")
    fr.check("#agencyType02")     # 연구기관
    fr.check("#usePurpose02")     # 앱 등 시스템 개발 DB로 활용
    # 활용DB radio: dbGubun0/1/2 = 가공식품/음식/건강기능식품
    idx = {"01": "#dbGubun0", "02": "#dbGubun1", "12": "#dbGubun2"}[gubun]
    try:
        fr.check(idx)
    except Exception as e:
        print(f"  [{label}] dbGubun check: {e}")
    btn = next(e for e in fr.query_selector_all("a")
               if "등록 후 다운로드" in (e.inner_text() or ""))
    try:
        with pg.expect_download(timeout=1_500_000) as di:
            btn.evaluate("x=>x.click()")
        d = di.value
        path = os.path.join(OUT, d.suggested_filename)
        d.save_as(path)
        print(f"  [{label}] OK -> {d.suggested_filename}  {os.path.getsize(path):,} bytes")
    except Exception as e:
        print(f"  [{label}] FAIL {type(e).__name__}: {str(e)[:200]}")
        pg.screenshot(path=os.path.join(OUT, f"_fail_{label}.png"), full_page=True)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(user_agent=UA, accept_downloads=True)
    pg.on("dialog", lambda d: (print("  DIALOG:", d.message), d.accept()))
    for gubun, label in WANT:
        print(f"-- {label}")
        try:
            grab(pg, gubun, label)
        except Exception as e:
            print(f"  [{label}] ERROR {type(e).__name__}: {str(e)[:200]}")
    b.close()
