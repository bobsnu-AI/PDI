"""14계열 × 데이터 출처 매트릭스 + 엔진용 출처 우선순위표.

출력:
  mapping/component_sources.csv   계열별 출처 우선순위 (엔진이 직접 소비)
  mapping/component_matrix.csv    계열 × 출처 커버리지 매트릭스
  _components.json                모든 수치
"""
import csv, json, os, sys
from collections import defaultdict, Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from family import classify14, FAMILIES14
import openpyxl

csv.field_size_limit(10 ** 8)
DB = sys.argv[1]
MAP = os.path.join(DB, "mapping")
FB = os.path.join(DB, "foodb/foodb_2020_04_07_csv")


def rd(p, **kw):
    return csv.DictReader(open(p, encoding=kw.pop("enc", "utf-8"), errors="replace"), **kw)


def isnum(v):
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


base = list(rd(os.path.join(MAP, "base_foods_rda104.csv"), enc="utf-8-sig"))
matches = list(rd(os.path.join(MAP, "food_matches_all.csv"), enc="utf-8-sig"))
N = len(base)
kn_idx = {m["rda_idx"] for m in matches if m["in_knhanes"] == "Y"}
NKN = len(kn_idx)

inv = defaultdict(lambda: defaultdict(set))     # db -> food_id -> {(compound, family)}
comp = defaultdict(lambda: defaultdict(set))    # db -> family -> {compound}

# ---------- 1) 성분표 본표: 식품명이 곧 키라 매칭이 필요 없는 유일한 출처 ----------
wb = openpyxl.load_workbook(os.path.join(DB, "kr_rda/식품성분표(10개정판).xlsx"), read_only=True)
ws = wb["국가표준식품성분 Database 10.4"]
it = ws.iter_rows(values_only=True)
next(it)
r1 = next(it)
next(it)
FCT_COLS = {35: "β-carotene"}
FCT_COLS.update({i: str(r1[i]).replace("\n", " ").strip() for i in range(55, 63)})  # 토코페롤 8종
PLANT = {b["rda_idx"] for b in base}
for r in it:
    if not r or str(r[0] or "").strip() not in PLANT:
        continue
    fid = str(r[0]).strip()
    for i, nm in FCT_COLS.items():
        v = r[i]
        if isinstance(v, (int, float)) and v > 0:
            fam = "카로티노이드" if i == 35 else "토코페롤류"
            inv["rda_fct"][fid].add((nm, fam))
            comp["rda_fct"][fam].add(nm)
wb.close()

# ---------- 2) Phenol-Explorer ----------
wb = openpyxl.load_workbook(os.path.join(DB, "phenol_explorer/composition-data.xlsx"), read_only=True)
ws = wb.worksheets[0]
it = ws.iter_rows(values_only=True)
h = list(next(it))
ix = {k: h.index(k) for k in ("food", "compound", "compound_group", "compound_sub_group", "mean")}
pe_ids = {r["name"]: r["id"] for r in rd(os.path.join(DB, "phenol_explorer/foods.csv"))}
for r in it:
    if r[ix["food"]] is None or not isnum(r[ix["mean"]]) or float(r[ix["mean"]]) <= 0:
        continue
    fid = str(pe_ids.get(r[ix["food"]], r[ix["food"]]))
    c = str(r[ix["compound"]])
    fam = classify14(c, r[ix["compound_group"]] or "", r[ix["compound_sub_group"]] or "", "phenol_explorer")
    inv["phenol_explorer"][fid].add((c, fam))
    comp["phenol_explorer"][fam].add(c)
wb.close()

# ---------- 3) USDA 3종 ----------
for db, sub, dat, val in (("usda_flavonoid", "flavonoid_csv", "FLAV_DAT", "Flav_Val"),
                          ("usda_isoflavone", "isoflavone_csv", "ISFL_DAT", "Isfl_Val"),
                          ("usda_proanthocyanidin", "proanthocyanidin_csv", "PA_DAT", "Flav_Val")):
    d = os.path.join(DB, "usda", sub)
    nd = {}
    for r in rd(os.path.join(d, "NUTR_DEF.csv")):
        no = r.get("Nutr_no") or r.get("Nutr_No")
        nm = r.get("Nutrient name") or r.get("NutrDesc")
        fam = "프로안토시아니딘" if db == "usda_proanthocyanidin" else classify14(nm, r.get("Flav_Class", "") or "", "", db)
        nd[no] = (nm, fam)
    for r in rd(os.path.join(d, dat + ".csv")):
        no = r.get("Nutr_no") or r.get("Nutr_No")
        fid = r.get("NDB_No") or r.get("NDB No")
        v = r.get(val)
        if no not in nd or not isnum(v) or float(v) <= 0:
            continue
        nm, fam = nd[no]
        inv[db][fid].add((nm, fam))
        comp[db][fam].add(nm)

# ---------- 4) SR Legacy 카로티노이드 ----------
CARO = {"alpha_carotene_ug": "α-carotene", "beta_carotene_ug": "β-carotene",
        "beta_cryptoxanthin_ug": "β-cryptoxanthin", "lutein_zeaxanthin_ug": "lutein+zeaxanthin",
        "lycopene_ug": "lycopene"}
for r in rd(os.path.join(DB, "usda/carotenoids.csv")):
    for c, nm in CARO.items():
        if isnum(r[c]) and float(r[c]) > 0:
            inv["usda_sr_carotenoid"][r["ndb_number"]].add((nm, "카로티노이드"))
            comp["usda_sr_carotenoid"]["카로티노이드"].add(nm)

# ---------- 5) FooDB (정량만) ----------
FB_COLS = ["id", "public_id", "name", "state", "annotation_quality", "description",
           "cas_number", "moldb_smiles", "moldb_inchi", "moldb_mono_mass",
           "moldb_inchikey", "moldb_iupac", "kingdom", "superklass", "klass", "subklass"]
with open(os.path.join(FB, "Compound.csv"), encoding="utf-8", errors="replace", newline="") as fh:
    r = csv.reader(fh)
    next(r)
    fb_cf = {}
    for row in r:
        if len(row) == 16:
            fb_cf[row[0]] = (row[2], classify14(row[2], row[14], row[15], "foodb"))
with open(os.path.join(FB, "Content.csv"), encoding="utf-8", errors="replace", newline="") as fh:
    r = csv.reader(fh)
    hdr = next(r)
    i_st, i_sid, i_fid = hdr.index("source_type"), hdr.index("source_id"), hdr.index("food_id")
    i_std, i_orig = hdr.index("standard_content"), hdr.index("orig_content")
    for row in r:
        if len(row) <= i_orig or row[i_st] != "Compound":
            continue
        nf = fb_cf.get(row[i_sid])
        if not nf:
            continue
        if not (isnum(row[i_std]) or isnum(row[i_orig])):
            continue
        inv["foodb"][row[i_fid]].add(nf)
        comp["foodb"][nf[1]].add(nf[0])

# ---------- 6) RDA 국내 3종 ----------
for r in rd(os.path.join(MAP, "rda_phyto_long.csv"), enc="utf-8-sig"):
    if float(r["value"]) <= 0:
        continue
    fam = classify14(r["compound"], "", "", r["db"])
    inv[r["db"]][r["food_kr"]].add((r["compound"], fam))
    comp[r["db"]][fam].add(r["compound"])

# ---------- 집계: 계열 × 출처 -> 매핑되는 기준 식품 수 ----------
# 성분표는 rda_idx 자체가 키이므로 매칭 테이블을 거치지 않는다
fam_db_foods = defaultdict(lambda: defaultdict(set))
for fid, s in inv["rda_fct"].items():
    for c, fam in s:
        fam_db_foods[fam]["rda_fct"].add(fid)
for m in matches:
    if not m["tier"]:
        continue
    for c, fam in inv[m["db"]].get(m["db_food_id"], ()):
        fam_db_foods[fam][m["db"]].add(m["rda_idx"])

META = {
    "rda_fct":               ("국가표준식품성분표 10.4",   "kr_rda/식품성분표(10개정판).xlsx", "DB10.4 색인(식품코드)", "µg 또는 mg/100g", "신선중량(FW)"),
    "rda_flavonoid":         ("RDA 플라보노이드 DB 1.0",  "kr_rda/플라보노이드 Data Base 1.0.xlsx", "한글 식품명", "mg/100g", "건조중량(DW)"),
    "rda_phenolic_acid":     ("RDA 페놀산 DB",          "kr_rda/공공데이터_페놀산 DB.xlsx", "한글 식품명", "mg/100g", "건조중량(DW)"),
    "rda_saponin":           ("RDA 사포닌 DB 3.0",      "kr_rda/RDA 기능성분 DB 3.0 사포닌 편.xlsx", "한글 식품명", "mg/100g", "건조중량(DW)"),
    "phenol_explorer":       ("Phenol-Explorer 3.6",   "phenol_explorer/composition-data.xlsx", "food (영문명)", "mg/100g 또는 mg/100mL", "신선중량(FW)"),
    "foodb":                 ("FooDB 2020-04-07",      "foodb/foodb_2020_04_07_csv/Content.csv", "food_id", "standard_content (mg/100g)", "신선중량(FW)"),
    "usda_flavonoid":        ("USDA Flavonoid 3.3",    "usda/flavonoid_csv/FLAV_DAT.csv", "NDB_No", "mg/100g", "신선중량(FW)"),
    "usda_isoflavone":       ("USDA Isoflavone 2.1",   "usda/isoflavone_csv/ISFL_DAT.csv", "NDB_No", "mg/100g", "신선중량(FW)"),
    "usda_proanthocyanidin": ("USDA Proanthocyanidin 2", "usda/proanthocyanidin_csv/PA_DAT.csv", "NDB No", "mg/100g", "신선중량(FW)"),
    "usda_sr_carotenoid":    ("USDA SR Legacy 카로티노이드", "usda/carotenoids.csv", "ndb_number", "µg/100g", "신선중량(FW)"),
}
# 출처 우선순위: 한국 식품 실측 > 국제 표준 정량 > 광범위하지만 얕은 것
PRIORITY = ["rda_fct", "rda_flavonoid", "rda_phenolic_acid", "rda_saponin",
            "phenol_explorer", "usda_isoflavone", "usda_flavonoid",
            "usda_proanthocyanidin", "usda_sr_carotenoid", "foodb"]

rows, matrix, report = [], [], {}
for fam in FAMILIES14:
    srcs = [(db, fam_db_foods[fam][db]) for db in PRIORITY if fam_db_foods[fam].get(db)]
    srcs.sort(key=lambda x: PRIORITY.index(x[0]))
    union = set().union(*[s for _, s in srcs]) if srcs else set()
    report[fam] = {
        "union_foods": len(union), "union_pct": round(100 * len(union) / N, 1),
        "knhanes_foods": len(union & kn_idx),
        "knhanes_pct": round(100 * len(union & kn_idx) / NKN, 1),
        "sources": [],
    }
    for rank, (db, s) in enumerate(srcs, 1):
        nm, f, key, unit, basis = META[db]
        ncmp = len(comp[db][fam])
        rows.append({
            "family": fam, "rank": rank, "source_db": db, "source_name": nm,
            "source_file": f, "food_key": key, "unit": unit, "basis": basis,
            "n_compounds": ncmp, "foods_mapped": len(s),
            "coverage_pct": round(100 * len(s) / N, 1),
            "knhanes_pct": round(100 * len(s & kn_idx) / NKN, 1),
        })
        report[fam]["sources"].append({"db": db, "n_compounds": ncmp, "foods": len(s),
                                       "pct": round(100 * len(s) / N, 1)})
    matrix.append({"family": fam, **{db: len(fam_db_foods[fam].get(db, ())) for db in PRIORITY},
                   "union": len(union), "union_pct": report[fam]["union_pct"]})

with open(os.path.join(MAP, "component_sources.csv"), "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.DictWriter(fh, list(rows[0]))
    w.writeheader()
    w.writerows(rows)
with open(os.path.join(MAP, "component_matrix.csv"), "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.DictWriter(fh, list(matrix[0]))
    w.writeheader()
    w.writerows(matrix)
json.dump({"base_foods": N, "knhanes_base": NKN, "families": report},
          open(os.path.join(DB, "_components.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)

print(f"기준 식품 {N} / KNHANES {NKN}\n")
print(f"{'계열':<14}{'union':>7}{'cov%':>7}{'KN%':>7}  출처(순위: 식품수/화합물수)")
for fam in FAMILIES14:
    r = report[fam]
    ss = "  ".join(f"{i+1}.{s['db'].replace('usda_','u.').replace('phenol_explorer','PE').replace('rda_','R.')}"
                   f"({s['foods']}/{s['n_compounds']})" for i, s in enumerate(r["sources"]))
    print(f"{fam:<14}{r['union_foods']:>7}{r['union_pct']:>6.1f}%{r['knhanes_pct']:>6.1f}%  {ss}")
