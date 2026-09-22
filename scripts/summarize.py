"""Row counts, per-DB coverage stats, and PE<->FooDB compound overlap."""
import csv, glob, json, os, sys

csv.field_size_limit(10 ** 8)
DB = sys.argv[1]
FB = os.path.join(DB, "foodb/foodb_2020_04_07_csv")
PE = os.path.join(DB, "phenol_explorer")
US = os.path.join(DB, "usda")
rep = {}


def rd(path, **kw):
    return csv.DictReader(open(path, encoding="utf-8", errors="replace"), **kw)


def isnum(v):
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


# ---------- FooDB: table list + row counts ----------
tables = {}
for p in sorted(glob.glob(os.path.join(FB, "*.csv"))):
    name = os.path.basename(p)[:-4]
    with open(p, encoding="utf-8", errors="replace", newline="") as fh:
        r = csv.reader(fh)
        cols = next(r, [])
        n = sum(1 for _ in r)
    tables[name] = {"rows": n, "cols": len(cols), "bytes": os.path.getsize(p)}
    print(f"  {name:<32} {n:>9,} rows  {len(cols):>3} cols")
rep["foodb_tables"] = tables

# ---------- FooDB stats ----------
# FooDB's 2020-04-07 Compound.csv ships a header whose field ORDER does not match
# the data (moldb_inchikey column holds InChI, cas_number holds SMILES, ...).
# Real positional order, verified against known compounds:
FB_COMPOUND_COLS = [
    "id", "public_id", "name", "state", "annotation_quality", "description",
    "cas_number", "moldb_smiles", "moldb_inchi", "moldb_mono_mass",
    "moldb_inchikey", "moldb_iupac", "kingdom", "superklass", "klass", "subklass",
]
with open(os.path.join(FB, "Compound.csv"), encoding="utf-8", errors="replace", newline="") as fh:
    _r = csv.reader(fh)
    _hdr = next(_r)
    assert sorted(_hdr) == sorted(FB_COMPOUND_COLS), _hdr
    fb_comp = [dict(zip(FB_COMPOUND_COLS, row)) for row in _r if len(row) == 16]
# rewrite with a header that actually matches the data
with open(os.path.join(FB, "Compound_fixed_header.csv"), "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, FB_COMPOUND_COLS)
    w.writeheader()
    w.writerows(fb_comp)
_ik = {r["public_id"]: r["moldb_inchikey"] for r in fb_comp}
assert _ik.get("FDB011904", "").startswith("REFJWTPEDVJJIY"), _ik.get("FDB011904")  # quercetin
fb_food = list(rd(os.path.join(FB, "Food.csv")))
qfoods, qcomps, qn, qn_std, by_type = set(), set(), 0, 0, {}
with open(os.path.join(FB, "Content.csv"), encoding="utf-8", errors="replace", newline="") as fh:
    for r in csv.DictReader(fh):
        st = r["source_type"]
        by_type[st] = by_type.get(st, 0) + 1
        has = isnum(r["orig_content"]) or isnum(r["standard_content"])
        if not has:
            continue
        qn += 1
        qn_std += isnum(r["standard_content"])
        qfoods.add(r["food_id"])
        if st == "Compound":
            qcomps.add(r["source_id"])
rep["foodb"] = {
    "foods_total": len(fb_food), "compounds_total": len(fb_comp),
    "content_rows": sum(by_type.values()), "content_by_source_type": by_type,
    "quant_values": qn, "quant_values_standardised": qn_std,
    "foods_with_quant": len(qfoods), "compounds_with_quant": len(qcomps),
    "compounds_with_inchikey": sum(1 for r in fb_comp if (r["moldb_inchikey"] or "").strip()),
}

# ---------- Phenol-Explorer ----------
import openpyxl
wb = openpyxl.load_workbook(os.path.join(PE, "composition-data.xlsx"), read_only=True)
ws = wb.worksheets[0]
it = ws.iter_rows(values_only=True)
hdr = list(next(it))
ix = {k: hdr.index(k) for k in ("food", "compound", "mean", "units")}
pf, pc, pn, prows = set(), set(), 0, 0
for row in it:
    if row[ix["food"]] is None:
        continue
    prows += 1
    pf.add(row[ix["food"]]); pc.add(row[ix["compound"]])
    pn += isnum(row[ix["mean"]])
wb.close()
pe_comp = list(rd(os.path.join(PE, "compounds.csv")))
rep["phenol_explorer"] = {
    "version": "3.6 (2016-12-10)",
    "compounds_total": len(pe_comp),
    "foods_total": sum(1 for _ in rd(os.path.join(PE, "foods.csv"))),
    "compound_classes": sum(1 for _ in rd(os.path.join(PE, "compounds-classification.csv"))),
    "food_classes": sum(1 for _ in rd(os.path.join(PE, "foods-classification.csv"))),
    "metabolites": sum(1 for _ in rd(os.path.join(PE, "metabolites.csv"))),
    "publications": sum(1 for _ in rd(os.path.join(PE, "publications.csv"))),
    "composition_rows": prows,
    "foods_with_quant": len(pf), "compounds_with_quant": len(pc), "quant_values": pn,
    "compounds_with_pubchem_cid": sum(1 for r in pe_comp if (r["pubchem_compound_id"] or "").strip()),
    "compounds_with_cas": sum(1 for r in pe_comp if (r["cas_number"] or "").strip()),
}

# ---------- USDA special-interest DBs ----------
for key, sub, dat in (("usda_flavonoid_3.3", "flavonoid_csv", "FLAV_DAT"),
                      ("usda_isoflavone_2.1", "isoflavone_csv", "ISFL_DAT"),
                      ("usda_proanthocyanidin_2", "proanthocyanidin_csv", "PA_DAT")):
    d = os.path.join(US, sub)
    dr = list(rd(os.path.join(d, dat + ".csv")))
    amt = next((c for c in ("Flav_Val", "Isflv_Val", "PA_Val", "Nutr_Val") if dr and c in dr[0]), None)
    if amt is None:
        amt = next(c for c in dr[0] if c.lower().endswith("val"))
    fk = "NDB_No" if "NDB_No" in dr[0] else list(dr[0])[0]
    nk = "Nutr_No" if "Nutr_No" in dr[0] else list(dr[0])[1]
    e = {
        "foods_total": sum(1 for _ in rd(os.path.join(d, "FOOD_DES.csv"))),
        "compounds_total": sum(1 for _ in rd(os.path.join(d, "NUTR_DEF.csv"))),
        "value_rows": len(dr), "value_column": amt,
        "foods_with_quant": len({r[fk] for r in dr if isnum(r[amt])}),
        "compounds_with_quant": len({r[nk] for r in dr if isnum(r[amt])}),
        "quant_values": sum(1 for r in dr if isnum(r[amt])),
        "quant_values_gt0": sum(1 for r in dr if isnum(r[amt]) and float(r[amt]) > 0),
        "tables": {os.path.basename(p)[:-4]: sum(1 for _ in rd(p)) for p in sorted(glob.glob(os.path.join(d, "*.csv")))},
    }
    if sub == "flavonoid_csv":
        e["individual_value_rows"] = sum(1 for _ in rd(os.path.join(d, "FLAV_IND.csv")))
    rep[key] = e

# ---------- SR Legacy carotenoids ----------
car = list(rd(os.path.join(US, "carotenoids.csv")))
cols = [c for c in car[0] if c.endswith("_ug")]
rep["usda_sr_legacy_carotenoids"] = {
    "source": "FoodData_Central_sr_legacy_food_csv_2018-04",
    "foods_total": sum(1 for _ in rd(os.path.join(US, "sr_legacy/FoodData_Central_sr_legacy_food_csv_2018-04/food.csv"))),
    "compounds_total": len(cols), "compounds": cols,
    "foods_with_quant": len(car),
    "foods_with_quant_gt0": sum(1 for r in car if any(isnum(r[c]) and float(r[c]) > 0 for c in cols)),
    "quant_values": sum(1 for r in car for c in cols if isnum(r[c])),
    "quant_values_gt0": sum(1 for r in car for c in cols if isnum(r[c]) and float(r[c]) > 0),
}

# ---------- PE <-> FooDB overlap ----------
def norm(s):
    return (s or "").strip().upper()


pe_ik = {}  # cid -> inchikey
for r in rd(os.path.join(DB, "pe_pubchem_inchikey.csv")):
    if norm(r.get("InChIKey")):
        pe_ik[r["CID"].strip()] = norm(r["InChIKey"])

pe_by_ik, pe_by_cas = {}, {}
for r in pe_comp:
    cid = (r["pubchem_compound_id"] or "").strip()
    ik = pe_ik.get(cid)
    if ik:
        pe_by_ik.setdefault(ik, []).append(r["name"])
    for c in (r["cas_number"] or "").split(";"):
        if c.strip():
            pe_by_cas.setdefault(c.strip(), []).append(r["name"])

fb_by_ik, fb_by_cas = {}, {}
for r in fb_comp:
    ik = norm(r["moldb_inchikey"]).replace("INCHIKEY=", "")
    if ik:
        fb_by_ik.setdefault(ik, []).append(r["public_id"])
    if (r["cas_number"] or "").strip():
        fb_by_cas.setdefault(r["cas_number"].strip(), []).append(r["public_id"])

ik_hit = sorted(set(pe_by_ik) & set(fb_by_ik))
sk_pe = {k.split("-")[0]: k for k in pe_by_ik}
sk_fb = {k.split("-")[0] for k in fb_by_ik}
cas_hit = sorted(set(pe_by_cas) & set(fb_by_cas))
pe_names = {n.lower() for r in pe_comp for n in [r["name"]]}
fb_names = {r["name"].lower() for r in fb_comp}

rep["overlap_pe_foodb"] = {
    "pe_compounds": len(pe_comp),
    "pe_with_pubchem_cid": rep["phenol_explorer"]["compounds_with_pubchem_cid"],
    "pe_with_resolved_inchikey": sum(len(v) for v in pe_by_ik.values()),
    "pe_distinct_inchikeys": len(pe_by_ik),
    "foodb_distinct_inchikeys": len(fb_by_ik),
    "match_full_inchikey": len(ik_hit),
    "match_inchikey_skeleton_14": len(set(sk_pe) & sk_fb),
    "match_cas": len(cas_hit),
    "match_exact_name_ci": len(pe_names & fb_names),
}

# union of PubChem/InChIKey-based identity (what was asked for)
rep["overlap_pe_foodb"]["match_inchikey_or_cas_union"] = len(
    {pe_by_ik[k][0] for k in ik_hit} | {n for c in cas_hit for n in pe_by_cas[c]}
)

with open(os.path.join(DB, "_stats.json"), "w", encoding="utf-8") as fh:
    json.dump(rep, fh, indent=2, ensure_ascii=False)

with open(os.path.join(DB, "pe_foodb_compound_overlap.csv"), "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["inchikey", "phenol_explorer_compound", "foodb_public_id"])
    for k in ik_hit:
        w.writerow([k, "; ".join(pe_by_ik[k]), "; ".join(fb_by_ik[k])])

print(json.dumps({k: v for k, v in rep.items() if k != "foodb_tables"}, indent=2, ensure_ascii=False))
