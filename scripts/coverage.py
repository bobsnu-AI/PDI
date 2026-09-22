"""Step D/E/F: coverage %, per-family compound counts, FooDB quant vs detected-only,
Korean-native failures, BOBSNU ingredient lookup. Writes mapping/*.csv + _coverage.json."""
import csv, json, os, re, sys
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from family import classify, is_saponin, FAMILIES
from norm import head_en

csv.field_size_limit(10 ** 8)
DB = sys.argv[1]
MAP = os.path.join(DB, "mapping")
FB = os.path.join(DB, "foodb/foodb_2020_04_07_csv")
rep = {}


def rd(p, **kw):
    return csv.DictReader(open(p, encoding=kw.pop("enc", "utf-8"), errors="replace"), **kw)


def isnum(v):
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


WB = chr(92) + "b"
PLUR = "(?:e?s)?" + chr(92) + "b"
HANGUL_LB = "(?<![가-힣])"


def kr_hit(text, pattern):
    """Korean match that will not fire mid-word (무순 inside 엄나무순)."""
    return bool(re.search(HANGUL_LB + "(?:" + pattern + ")", text))


base = list(rd(os.path.join(MAP, "base_foods_rda104.csv"), enc="utf-8-sig"))
matches = list(rd(os.path.join(MAP, "food_matches.csv"), enc="utf-8-sig"))
N = len(base)
# in_knhanes lives in food_matches.csv (added by match.py), not in the base csv
kn_idx = {m["rda_idx"] for m in matches if m.get("in_knhanes") == "Y"}
kn_flag = {m["rda_idx"]: m.get("in_knhanes", "") for m in matches}
for b in base:
    b["in_knhanes"] = kn_flag.get(b["rda_idx"], "")

# =========== 1. per-DB compound inventory: food_id -> {(compound, family)} ===========
inv = defaultdict(lambda: defaultdict(set))      # db -> food_id -> {(compound, fam)}
inv_det = defaultdict(lambda: defaultdict(set))  # FooDB detected-but-not-quantified
comp_fam = defaultdict(dict)                     # db -> compound -> family

# --- Phenol-Explorer: composition-data.xlsx (food name keyed) ---
import openpyxl
wb = openpyxl.load_workbook(os.path.join(DB, "phenol_explorer/composition-data.xlsx"), read_only=True)
ws = wb.worksheets[0]
it = ws.iter_rows(values_only=True)
h = list(next(it))
ix = {k: h.index(k) for k in ("food", "compound", "compound_group", "compound_sub_group", "mean")}
pe_food_ids = {r["name"]: r["id"] for r in rd(os.path.join(DB, "phenol_explorer/foods.csv"))}
for r in it:
    if r[ix["food"]] is None or not isnum(r[ix["mean"]]):
        continue
    fid = pe_food_ids.get(r[ix["food"]], r[ix["food"]])
    cmp_ = str(r[ix["compound"]])
    fam = classify(cmp_, r[ix["compound_group"]] or "", r[ix["compound_sub_group"]] or "")
    inv["phenol_explorer"][str(fid)].add((cmp_, fam))
    comp_fam["phenol_explorer"][cmp_] = fam
wb.close()

# --- USDA Flavonoid / Isoflavone / Proanthocyanidin ---
for db, sub, dat, valcol in (("usda_flavonoid", "flavonoid_csv", "FLAV_DAT", "Flav_Val"),
                             ("usda_isoflavone", "isoflavone_csv", "ISFL_DAT", "Isfl_Val"),
                             ("usda_proanthocyanidin", "proanthocyanidin_csv", "PA_DAT", "Flav_Val")):
    d = os.path.join(DB, "usda", sub)
    nd = {}
    for r in rd(os.path.join(d, "NUTR_DEF.csv")):
        no = r.get("Nutr_no") or r.get("Nutr_No")
        nm = r.get("Nutrient name") or r.get("NutrDesc")
        cls = r.get("Flav_Class", "") or ""
        nd[no] = (nm, classify(nm, cls))
    for r in rd(os.path.join(d, dat + ".csv")):
        no = r.get("Nutr_no") or r.get("Nutr_No")
        fid = r.get("NDB_No") or r.get("NDB No")
        v = r.get(valcol)
        if no not in nd or not isnum(v) or float(v) <= 0:
            continue
        nm, fam = nd[no]
        if db == "usda_proanthocyanidin":
            fam = "프로안토시아니딘"
        inv[db][fid].add((nm, fam))
        comp_fam[db][nm] = fam

# --- SR Legacy carotenoids ---
CARO = {"alpha_carotene_ug": "α-carotene", "beta_carotene_ug": "β-carotene",
        "beta_cryptoxanthin_ug": "β-cryptoxanthin", "lutein_zeaxanthin_ug": "lutein+zeaxanthin",
        "lycopene_ug": "lycopene"}
for r in rd(os.path.join(DB, "usda/carotenoids.csv")):
    for c, nm in CARO.items():
        if isnum(r[c]) and float(r[c]) > 0:
            inv["usda_sr_carotenoid"][r["ndb_number"]].add((nm, "카로티노이드"))
            comp_fam["usda_sr_carotenoid"][nm] = "카로티노이드"

# --- FooDB: quantified vs detected-only ---
FB_COLS = ["id", "public_id", "name", "state", "annotation_quality", "description",
           "cas_number", "moldb_smiles", "moldb_inchi", "moldb_mono_mass",
           "moldb_inchikey", "moldb_iupac", "kingdom", "superklass", "klass", "subklass"]
with open(os.path.join(FB, "Compound.csv"), encoding="utf-8", errors="replace", newline="") as fh:
    r = csv.reader(fh)
    next(r)
    fbc = {row[0]: dict(zip(FB_COLS, row)) for row in r if len(row) == 16}
# classify once per compound, not once per Content row (5.1M rows)
fb_cf = {cid: (c["name"], classify(c["name"], c["klass"], c["subklass"])) for cid, c in fbc.items()}
comp_fam["foodb"].update({nm: fam for nm, fam in fb_cf.values()})
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
        q = isnum(row[i_std]) or isnum(row[i_orig])
        (inv if q else inv_det)["foodb"][row[i_fid]].add(nf)

# --- RDA Korean DBs (Korean-name keyed) ---
rda_long = list(rd(os.path.join(MAP, "rda_phyto_long.csv"), enc="utf-8-sig"))
for r in rda_long:
    if float(r["value"]) <= 0:
        continue
    fam = classify(r["compound"])
    if r["db"] == "rda_saponin":
        fam = "기타"
    inv[r["db"]][r["food_kr"]].add((r["compound"], fam))
    comp_fam[r["db"]][r["compound"]] = fam

# =========== 2. Korean-name matching for the RDA Korean DBs ===========
# stable tie-break: sorting by length alone is non-deterministic across runs
# (set iteration order depends on string hash randomisation)
kr_heads = sorted({b["name_kr"].split(",")[0].strip() for b in base}, key=lambda s: (-len(s), s))
def kr_match(name):
    n = re.sub(r"\(.*?\)", "", name).strip()
    for kh in kr_heads:
        if kh and (kh in n or kh in name):
            return kh
    return ""

kr_rows = []
for db in ("rda_flavonoid", "rda_phenolic_acid", "rda_saponin"):
    for food in sorted(inv[db]):
        kr_rows.append({"db": db, "rda_phyto_food": food, "matched_kr_head": kr_match(food),
                        "n_compounds": len(inv[db][food])})
with open(os.path.join(MAP, "rda_phyto_food_matches.csv"), "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.DictWriter(fh, ["db", "rda_phyto_food", "matched_kr_head", "n_compounds"])
    w.writeheader()
    w.writerows(kr_rows)

kr_head_to_base = defaultdict(list)
for b in base:
    kr_head_to_base[b["name_kr"].split(",")[0].strip()].append(b)

# extend `matches` with the three Korean DBs
for db in ("rda_flavonoid", "rda_phenolic_acid", "rda_saponin"):
    hit = {r["matched_kr_head"]: r["rda_phyto_food"] for r in kr_rows if r["db"] == db and r["matched_kr_head"]}
    for b in base:
        kh = b["name_kr"].split(",")[0].strip()
        matches.append({"rda_idx": b["rda_idx"], "rda_code": b["rda_code"], "group": b["group_short"],
                        "name_kr": b["name_kr"], "kr_head": kh, "name_en": b["name_en"],
                        "sci_name": b["sci_name"], "in_knhanes": b.get("in_knhanes", ""),
                        "db": db, "tier": "T0_kr_name" if kh in hit else "",
                        "db_food_id": hit.get(kh, ""), "db_food_name": hit.get(kh, ""), "db_sci_name": ""})

with open(os.path.join(MAP, "food_matches_all.csv"), "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.DictWriter(fh, list(matches[0]))
    w.writeheader()
    w.writerows(matches)

# =========== 3. coverage + family breakdown ===========
DBS = ["phenol_explorer", "usda_flavonoid", "usda_isoflavone", "usda_proanthocyanidin",
       "usda_sr_carotenoid", "foodb", "rda_flavonoid", "rda_phenolic_acid", "rda_saponin"]
cov = {}
for db in DBS:
    rows = [m for m in matches if m["db"] == db and m["tier"]]
    # only count a match as "usable" if the matched DB food actually has quantified compounds
    usable = [m for m in rows if inv[db].get(m["db_food_id"])]
    fam_c = defaultdict(set)
    comps = set()
    for m in usable:
        for cmp_, fam in inv[db][m["db_food_id"]]:
            comps.add(cmp_)
            fam_c[fam].add(cmp_)
    cov[db] = {
        "matched_foods": len(rows), "matched_pct": round(100 * len(rows) / N, 1),
        "usable_foods": len(usable), "usable_pct": round(100 * len(usable) / N, 1),
        "matched_knhanes": len({m["rda_idx"] for m in usable} & kn_idx),
        "knhanes_pct": round(100 * len({m["rda_idx"] for m in usable} & kn_idx) / max(1, len(kn_idx)), 1),
        "distinct_compounds": len(comps),
        "by_family": {f: len(fam_c[f]) for f in FAMILIES if fam_c[f]},
        "tiers": dict(Counter(m["tier"] for m in rows)),
        "phyto_compounds": sum(len(fam_c[f]) for f in FAMILIES if f != "기타"),
        # rda_saponin is a saponin DB by construction; its systematic triterpene names
        # do not contain the word "saponin", so count by provenance there.
        "saponins_in_기타": len(comps) if db == "rda_saponin" else len({c for c in comps if is_saponin(c)}),
    }

union_usable = {m["rda_idx"] for m in matches if m["tier"] and inv[m["db"]].get(m["db_food_id"])}
# T3 is a genus-level substitute (부추 -> garlic powder, 제비쑥 -> tarragon): report a
# strict figure that excludes it, so the headline number is not inflated.
STRICT = {"T0_kr_name", "T1_exact_en", "T2_sci_species", "T4_rule"}
strict_usable = {m["rda_idx"] for m in matches
                 if m["tier"] in STRICT and inv[m["db"]].get(m["db_food_id"])}
with open(os.path.join(MAP, "db_food_has_quant.csv"), "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.writer(fh)
    w.writerow(["db", "db_food_id", "n_quant_compounds"])
    for db in inv:
        for fid, s in inv[db].items():
            w.writerow([db, fid, len(s)])
union_fam = defaultdict(set)
for m in matches:
    if not m["tier"]:
        continue
    for cmp_, fam in inv[m["db"]].get(m["db_food_id"], ()):
        union_fam[fam].add((m["db"], cmp_))
rep["coverage"] = cov
rep["union"] = {
    "base_foods": N, "knhanes_base": len(kn_idx),
    "usable_foods": len(union_usable), "usable_pct": round(100 * len(union_usable) / N, 1),
    "knhanes_usable": len(union_usable & kn_idx),
    "knhanes_pct": round(100 * len(union_usable & kn_idx) / max(1, len(kn_idx)), 1),
    "strict_usable_foods": len(strict_usable),
    "strict_usable_pct": round(100 * len(strict_usable) / N, 1),
    "strict_knhanes_usable": len(strict_usable & kn_idx),
    "strict_knhanes_pct": round(100 * len(strict_usable & kn_idx) / max(1, len(kn_idx)), 1),
    "tier_totals": dict(Counter(m["tier"] for m in matches if m["tier"])),
    "by_family_db_compound_pairs": {f: len(union_fam[f]) for f in FAMILIES if union_fam[f]},
    "phyto_db_compound_pairs": sum(len(union_fam[f]) for f in FAMILIES if f != "기타"),
}
# how many BASE FOODS have >=1 quantified compound in each family (the number the
# 계열별 섭취량 추정 feature actually depends on)
fam_foods = defaultdict(set)
for m in matches:
    if not m["tier"]:
        continue
    for _, fam in inv[m["db"]].get(m["db_food_id"], ()):
        fam_foods[fam].add(m["rda_idx"])
rep["union"]["foods_by_family"] = {
    f: {"foods": len(fam_foods[f]), "pct": round(100 * len(fam_foods[f]) / N, 1),
        "knhanes_foods": len(fam_foods[f] & kn_idx),
        "knhanes_pct": round(100 * len(fam_foods[f] & kn_idx) / max(1, len(kn_idx)), 1)}
    for f in FAMILIES if fam_foods[f]}

# group-level coverage
grp = defaultdict(lambda: {"n": 0, "cov": 0})
for b in base:
    grp[b["group_short"]]["n"] += 1
    if b["rda_idx"] in union_usable:
        grp[b["group_short"]]["cov"] += 1
rep["by_group"] = {g: {**v, "pct": round(100 * v["cov"] / v["n"], 1)} for g, v in
                   sorted(grp.items(), key=lambda x: -x[1]["n"])}

# =========== 4. FooDB quant vs detected-only ===========
q_foods = {f for f in inv["foodb"]}
d_foods = {f for f in inv_det["foodb"]}
det_only_matched = [m for m in matches if m["db"] == "foodb" and m["tier"]
                    and not inv["foodb"].get(m["db_food_id"]) and inv_det["foodb"].get(m["db_food_id"])]
rep["foodb_detail"] = {
    "foods_with_quant": len(q_foods), "foods_with_detected_only": len(d_foods - q_foods),
    "compounds_quant": len({c for f in q_foods for c, _ in inv["foodb"][f]}),
    "compounds_detected_only": len({c for f in d_foods for c, _ in inv_det["foodb"][f]}
                                   - {c for f in q_foods for c, _ in inv["foodb"][f]}),
    "matched_base_foods_quant": cov["foodb"]["usable_foods"],
    "matched_base_foods_detected_only": len({m["rda_idx"] for m in det_only_matched}),
    "quant_by_family": {f: n for f, n in cov["foodb"]["by_family"].items()},
    "detected_only_by_family": {},
}
dof = defaultdict(set)
qc = {c for f in q_foods for c, _ in inv["foodb"][f]}
for f in d_foods:
    for c, fam in inv_det["foodb"][f]:
        if c not in qc:
            dof[fam].add(c)
rep["foodb_detail"]["detected_only_by_family"] = {f: len(dof[f]) for f in FAMILIES if dof[f]}

# =========== 5. Korean-native failures ===========
# ordered most-specific-first: 도라지차 must land in 차류, not 나물류
KOREAN_NATIVE = {
    "차류": r"차$|차,|녹차|홍차|우롱|보이차|둥굴레|결명자|감잎|구절초|쌍화|두충|상지|계피차|녹차라테",
    "장류": r"된장|고추장|간장|청국장|메주|쌈장|춘장|막장|초장|짜장|수끼",
    "김치류": r"김치|장아찌|절임|짠지|단무지",
    "떡류": r"떡|묵$|묵,|절편|인절미|가래떡|송편|빈대떡",
    "나물류": (r"나물|고사리|취나물|수리취|참취|곰취|수리취|(?<!강)냉이|씀바귀|아욱|미나리|두릅|달래|"
             r"원추리|더덕|도라지|우거지|시래기|돌나물|참죽|갯기름|파드득|는쟁이"),
}
fails, tot, cats = defaultdict(list), defaultdict(int), {}
for b in base:
    for cat, rx in KOREAN_NATIVE.items():
        if re.search(rx, b["name_kr"]):   # plain: 멥쌀떡/배추김치도 잡아야 함
            cats[b["rda_idx"]] = cat
            tot[cat] += 1
            if b["rda_idx"] not in union_usable:
                fails[cat].append(b)
            break

# family-level view: a 김치 row that only matches SR-carotenoid is NOT flavonoid-mapped
cat_fam = defaultdict(lambda: defaultdict(set))
for m in matches:
    cat = cats.get(m["rda_idx"])
    if not cat or not m["tier"]:
        continue
    for cmp_, fam in inv[m["db"]].get(m["db_food_id"], ()):
        cat_fam[cat][fam].add(m["rda_idx"])
rep["korean_native"] = {
    cat: {"total": tot[cat], "failed": len(fails[cat]),
          "fail_pct": round(100 * len(fails[cat]) / max(1, tot[cat]), 1),
          "failed_knhanes": sum(1 for b in fails[cat] if b.get("in_knhanes") == "Y"),
          "mapped_items_by_family": {f: len(cat_fam[cat][f]) for f in FAMILIES if cat_fam[cat][f]}}
    for cat in KOREAN_NATIVE}
with open(os.path.join(MAP, "korean_native_unmatched.csv"), "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.writer(fh)
    w.writerow(["category", "rda_idx", "rda_code", "group", "name_kr", "name_en", "sci_name", "in_knhanes"])
    for cat, rows in fails.items():
        for b in rows:
            w.writerow([cat, b["rda_idx"], b["rda_code"], b["group_short"], b["name_kr"],
                        b["name_en"], b["sci_name"], b.get("in_knhanes", "")])

# =========== 6. BOBSNU ingredients ===========
# Two alias tiers per ingredient:
#   specific = the ingredient itself (rice germ, barley grass, radish seed, ...)
#   parent   = the species-level food it comes from (rice, barley, radish, ...)
# Word-boundary matched, so "rice" no longer hits "Licorice"/"Rice-A-Roni".
BOBSNU = {
    "약콩/검정콩(쥐눈이콩)": {
        "kr": r"쥐눈이|검정콩|서리태|서목태|흑태|약콩",
        "specific": ["small black bean", "black soybean", "soybeans, black", "rhynchosia"],
        "parent": ["soybean", "soy bean", "glycine max", "soybeans"]},
    "쌀눈(쌀 배아)": {
        "kr": r"쌀\s*눈|미강|배아|쌀겨",
        "specific": ["rice germ", "rice bran", "rice embryo"],
        "parent": ["rice", "oryza sativa"]},
    "새싹삼(인삼 묘삼)": {
        "kr": r"새싹삼|묘삼",
        "specific": ["ginseng sprout", "ginseng seedling", "ginseng leaf", "ginseng leaves"],
        "parent": ["ginseng", "panax ginseng"]},
    "무씨(무 종자)": {
        "kr": r"무씨|무\s*씨|무순",
        "specific": ["radish seed", "radish sprout", "daikon sprout"],
        "parent": ["radish", "daikon radish", "raphanus sativus"]},
    "대마씨(햄프씨드)": {
        "kr": r"대마|삼씨|햄프",
        "specific": ["hemp seed", "hempseed", "hemp seeds"],
        "parent": ["hemp", "cannabis sativa"]},
    "새싹보리": {
        "kr": r"보리순|새싹보리|보리\s*싹",
        "specific": ["barley grass", "barley sprout", "barley leaf", "barley leaves"],
        "parent": ["barley", "hordeum vulgare"]},
    "카카오": {
        "kr": r"카카오|코코아|초콜릿",
        "specific": ["cacao bean", "cocoa powder", "cacao", "cocoa bean"],
        "parent": ["cocoa", "chocolate", "theobroma cacao"]},
}
rost = list(rd(os.path.join(MAP, "db_food_rosters.csv"), enc="utf-8-sig"))
rost_by_db = defaultdict(list)
for r in rost:
    rost_by_db[r["db"]].append(r)


def alias_hit(text, aliases):
    # word boundary + optional plural, so "rice" does not hit "Licorice"
    return any(re.search(WB + re.escape(a) + PLUR, text) for a in aliases)


bob = {}
for label, spec in BOBSNU.items():
    krx = spec["kr"]
    rda_hits = [b for b in base if re.search(krx, b["name_kr"])]
    per_db = {}
    for db in DBS:
        res = {}
        for lvl in ("specific", "parent"):
            found = []
            if db.startswith("rda_"):
                pat = krx if lvl == "specific" else krx
                for food in inv[db]:
                    if kr_hit(food, pat):
                        found.append((food, len(inv[db][food]), food))
                if lvl == "parent":      # RDA Korean DBs: also try the parent species word
                    PAR_KR = {"약콩/검정콩(쥐눈이콩)": r"^콩|대두", "쌀눈(쌀 배아)": r"^멥쌀|^쌀|현미|백미",
                              "새싹삼(인삼 묘삼)": r"인삼|홍삼|수삼", "무씨(무 종자)": r"^무|무$|가을무|봄무",
                              "대마씨(햄프씨드)": r"대마|삼씨", "새싹보리": r"보리", "카카오": r"카카오|코코아"}
                    for food in inv[db]:
                        if kr_hit(food, PAR_KR[label]):
                            found.append((food, len(inv[db][food]), food))
            else:
                for r in rost_by_db[db]:
                    nm = (r["name_en"] or "").lower()
                    sc = (r["sci_name"] or "").lower()
                    if alias_hit(nm, spec[lvl]) or alias_hit(sc, spec[lvl]):
                        n = len(inv[db].get(r["food_id"], ()))
                        if n:
                            found.append((r["name_en"], n, r["food_id"]))
            found = list({f[2]: f for f in found}.values())
            found.sort(key=lambda x: -x[1])
            if found:
                fams = Counter()
                for _, _, key in found:
                    for c, fam in inv[db].get(key, ()):
                        fams[fam] += 1
                res[lvl] = {"n_db_foods": len(found),
                            "top": [(a[:48], b) for a, b, _ in found[:4]],
                            "families": dict(fams.most_common()),
                            "phyto_compounds": sum(v for k, v in fams.items() if k != "기타")}
        if res:
            per_db[db] = res
    bob[label] = {"rda_items": len(rda_hits),
                  "rda_examples": [b["name_kr"] for b in rda_hits[:4]],
                  "dbs": per_db,
                  "has_specific": sorted(d for d, v in per_db.items() if "specific" in v),
                  "parent_only": sorted(d for d, v in per_db.items() if "specific" not in v)}
rep["bobsnu"] = bob

# =========== 7. write ===========
with open(os.path.join(MAP, "compound_families.csv"), "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.writer(fh)
    w.writerow(["db", "compound", "family", "is_saponin"])
    for db in DBS:
        for c, f in sorted(comp_fam[db].items()):
            w.writerow([db, c, f, "Y" if is_saponin(c) else ""])

with open(os.path.join(DB, "_coverage.json"), "w", encoding="utf-8") as fh:
    json.dump(rep, fh, indent=2, ensure_ascii=False)

print(json.dumps({k: v for k, v in rep.items() if k != "bobsnu"}, indent=2, ensure_ascii=False))
print("\n===== BOBSNU =====")
print(json.dumps(rep["bobsnu"], indent=2, ensure_ascii=False)[:6000])
