"""Are the families the 13-list misses actually QUANTIFIED for our Korean base foods?"""
import csv, json, os, re, sys
from collections import defaultdict

csv.field_size_limit(10 ** 8)
DB = sys.argv[1]
MAP = os.path.join(DB, "mapping")
FB = os.path.join(DB, "foodb/foodb_2020_04_07_csv")

AXES = {
    "글루코시놀레이트": r"glucosinolate|glucoraphanin|sinigrin|glucobrassicin|progoitrin|gluconasturtiin|glucoiberin|glucoerucin",
    "이소티오시아네이트": r"isothiocyanate|sulforaphane|sulphoraphane",
    "오르가노설퍼": r"allicin|alliin|allyl.*sulf|diallyl|ajoene|S-allyl|thiosulfinate|propenyl.*sulf",
    "캡사이시노이드": r"capsaicin|dihydrocapsaicin|capsaicinoid",
    "피토스테롤": r"sitosterol|campesterol|stigmasterol|phytosterol|brassicasterol",
    "γ-오리자놀": r"oryzanol|cycloartenyl|methylenecycloartanyl",
    "토코페롤류": r"tocopherol|tocotrienol",
    "클로로필": r"chlorophyll|pheophytin",
    "베타레인": r"betanin|betalain|betacyanin",
}
RX = {k: re.compile(v, re.I) for k, v in AXES.items()}

FB_COLS = ["id", "public_id", "name", "state", "annotation_quality", "description",
           "cas_number", "moldb_smiles", "moldb_inchi", "moldb_mono_mass",
           "moldb_inchikey", "moldb_iupac", "kingdom", "superklass", "klass", "subklass"]
cid_axis = {}
with open(os.path.join(FB, "Compound.csv"), encoding="utf-8", errors="replace", newline="") as fh:
    r = csv.reader(fh)
    next(r)
    for row in r:
        if len(row) != 16:
            continue
        nm = row[2]
        for ax, rx in RX.items():
            if rx.search(nm):
                cid_axis[row[0]] = ax
                break
print("axis compounds in FooDB:", len(cid_axis))


def isnum(v):
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


quant = defaultdict(lambda: defaultdict(set))   # axis -> food_id -> compounds
det = defaultdict(lambda: defaultdict(set))
with open(os.path.join(FB, "Content.csv"), encoding="utf-8", errors="replace", newline="") as fh:
    r = csv.reader(fh)
    hdr = next(r)
    i_st, i_sid, i_fid = hdr.index("source_type"), hdr.index("source_id"), hdr.index("food_id")
    i_std, i_orig = hdr.index("standard_content"), hdr.index("orig_content")
    for row in r:
        if len(row) <= i_orig or row[i_st] != "Compound":
            continue
        ax = cid_axis.get(row[i_sid])
        if not ax:
            continue
        q = isnum(row[i_std]) or isnum(row[i_orig])
        (quant if q else det)[ax][row[i_fid]].add(row[i_sid])

matches = [m for m in csv.DictReader(open(os.path.join(MAP, "food_matches_all.csv"), encoding="utf-8-sig"))
           if m["db"] == "foodb" and m["tier"]]
kn = {m["rda_idx"] for m in csv.DictReader(open(os.path.join(MAP, "food_matches_all.csv"), encoding="utf-8-sig"))
      if m["in_knhanes"] == "Y"}
N = 1878

print(f"\n{'축':<18}{'정량 식품':>9}{'정량 화합물':>11}{'기준식품 매핑':>13}{'커버%':>8}{'비정량만':>9}")
out = {}
for ax in AXES:
    qf, df = quant[ax], det[ax]
    mapped = {m["rda_idx"] for m in matches if m["db_food_id"] in qf}
    mapped_det = {m["rda_idx"] for m in matches if m["db_food_id"] in df and m["db_food_id"] not in qf}
    ncmp = len({c for s in qf.values() for c in s})
    print(f"{ax:<18}{len(qf):>9}{ncmp:>11}{len(mapped):>13}{100*len(mapped)/N:>7.1f}%{len(mapped_det):>9}")
    out[ax] = {"foodb_foods_quant": len(qf), "quant_compounds": ncmp,
               "base_foods_mapped": len(mapped), "pct": round(100 * len(mapped) / N, 1),
               "knhanes_mapped": len(mapped & kn),
               "base_foods_detected_only": len(mapped_det)}
json.dump(out, open(os.path.join(DB, "_blindspot.json"), "w", encoding="utf-8"),
          indent=2, ensure_ascii=False)
