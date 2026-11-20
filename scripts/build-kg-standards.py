"""「식이설계 KG」(Kùzu 그래프)에서 건강 목표별 영양 기준을 뽑아 public/static/pfs.js 의 KG 구간에 써 넣는다.

  경로: (HealthTopic)-[:CONCERNS_DISEASE]->(Disease)-[:HAS_GUIDELINE | HAS_STANDARD]->(Nutrient)
  실행: npm run build:kg-standards      (python + kuzu 필요. 그래프는 ~/dietkg/kuzu_db, 읽기 전용으로 엶)
  기준을 고치려면 KG 쪽 kg/build_guideline.py 를 고치고 다시 돌린다.
"""
import json
import os
import sys

import kuzu

sys.stdout.reconfigure(encoding="utf-8")
DB = os.path.join(os.environ.get("DIETKG_HOME") or os.path.expanduser("~/dietkg"), "kuzu_db")
PFS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "static", "pfs.js")
BEGIN, END = "// <<KG:goal-standards", "// KG>>"

# 앱의 주요 건강 목표 -> KG 건강주제
GOAL_TOPICS = {"cvd": ["혈압개선", "지질개선"], "blood_sugar": ["혈당"]}
# KG 영양소 이름 -> PFS 키 (PFS 9개 영양소에 없는 에너지·칼륨 등은 빠진다)
PFS_KEY = {"나트륨": "sodium", "식이섬유": "fiber", "당류": "sugar", "콜레스테롤": "chol", "탄수화물": "carb", "단백질": "protein",
           "지방": "fat", "지질": "fat", "포화지방": "satfat", "포화지방산": "satfat", "트랜스지방": "trans", "트랜스지방산": "trans"}
UNIT = {"sodium": "mg", "chol": "mg"}  # 나머지는 g
STD_SOURCE = "식약처 식단형 식사관리식품 기준 (식품공전 제5. 11. 11-3)"


def main():
    c = kuzu.Connection(kuzu.Database(DB, read_only=True))

    def q(s, p):
        r = c.execute(s, p)
        out = []
        while r.has_next():
            out.append(r.get_next())
        return out

    result, dropped = {}, []
    for goal, topics in GOAL_TOPICS.items():
        rows = q("""MATCH (h:HealthTopic)-[:CONCERNS_DISEASE]->(d:Disease)-[g:HAS_GUIDELINE]->(n:Nutrient), (r:Regulation {id: g.regulation})
                    WHERE h.name IN $t RETURN d.name, n.name, g.op, g.value, g.unit, g.basis, r.title + ' ' + g.cite, g.raw""", {"t": topics})
        rows += q("""MATCH (h:HealthTopic)-[:CONCERNS_DISEASE]->(d:Disease)-[g:HAS_STANDARD]->(n:Nutrient)
                     WHERE h.name IN $t RETURN d.name, n.name, g.op, g.value, g.unit, g.basis, $s, g.raw""", {"t": topics, "s": STD_SOURCE})
        out = []
        for d, n, op, v, unit, basis, src, raw in rows:
            key = PFS_KEY.get(n)
            basis = "per_meal" if basis == "absolute" else basis  # HAS_STANDARD 의 절대량은 한 끼 기준
            want = "%" if basis == "pct_energy" else UNIT.get(key, "g")
            if not key or basis not in ("per_day", "per_meal", "pct_energy") or op[0] not in "<>" or (unit or "").strip() != want:
                dropped.append("%s: %s %s %s %s%s (%s)" % (goal, d, n, op, v, unit, basis))
                continue
            out.append({"key": key, "op": op, "value": v, "basis": basis, "disease": d, "source": src, "raw": raw})
        assert out, "KG 에서 %s 기준을 하나도 못 뽑음 — kg/build_guideline.py 를 돌렸는지 확인" % goal
        result[goal] = sorted(out, key=lambda r: (r["key"], r["disease"], r["value"]))

    s = open(PFS, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in s else "\n"
    i, j = s.index(BEGIN) + len(BEGIN), s.index(END)
    body = "const KG_GOAL_STANDARDS = {" + nl + "".join(
        "  %s: [%s%s  ],%s" % (g, nl, "".join("    %s,%s" % (json.dumps(r, ensure_ascii=False), nl) for r in rs), nl)
        for g, rs in result.items()) + "};"
    open(PFS, "w", encoding="utf-8", newline="").write(s[:i] + nl + body + nl + s[j:])

    for g, rs in result.items():
        print("%s: %d건" % (g, len(rs)))
        for r in rs:
            print("  %-8s %s %g (%s) ← %s" % (r["key"], r["op"], r["value"], r["basis"], r["disease"]))
    print("PFS 에 없어 뺀 것 %d건:" % len(dropped))
    for d in dropped:
        print("  " + d)


if __name__ == "__main__":
    main()
