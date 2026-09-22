"""Step C: match RDA base plant foods to each phytochemical DB's foods.

Tiers, applied in order (first hit wins, tier recorded):
  T1 exact_en   : normalized English head-noun phrase equal
  T2 sci_species: 학명 genus+species equal
  T3 sci_genus  : 학명 genus equal
  T4 rule       : curated similar-food alias rule (mapping/match_rules.csv)
"""
import csv, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from norm import norm_sci, genus, head_en

csv.field_size_limit(10 ** 8)
DB = sys.argv[1]
MAP = os.path.join(DB, "mapping")


def sing(s):
    """crude singular/plural variants of a head phrase"""
    out = {s}
    for suf, rep in (("ies", "y"), ("oes", "o"), ("ses", "s"), ("es", ""), ("s", "")):
        if s.endswith(suf) and len(s) > len(suf) + 2:
            out.add(s[:-len(suf)] + rep)
    out.add(s + "s")
    out.add(s + "es")
    return {x for x in out if x}


base = list(csv.DictReader(open(os.path.join(MAP, "base_foods_rda104.csv"), encoding="utf-8-sig")))
rost = list(csv.DictReader(open(os.path.join(MAP, "db_food_rosters.csv"), encoding="utf-8-sig")))

# KNHANES intake-frequency proxy: a food appearing in the survey code book is actually eaten.
kn = list(csv.DictReader(open(os.path.join(MAP, "knhanes_food_codes.csv"), encoding="utf-8-sig")))
latest = max(k["year"] for k in kn)
kn_codes = {k["rda_code"] for k in kn if k["year"] == latest and k["rda_code"]}
kn_names = {k["name_kr"] for k in kn if k["year"] == latest}
for b in base:
    b["in_knhanes"] = "Y" if (b["rda_code"] in kn_codes or b["name_kr"] in kn_names) else "N"

rules = []
rp = os.path.join(MAP, "match_rules.csv")
if os.path.exists(rp):
    rules = [r for r in csv.DictReader(open(rp, encoding="utf-8-sig")) if r.get("db_food_head")]

DBS = list(dict.fromkeys(r["db"] for r in rost))
idx = {}
for db in DBS:
    rows = [r for r in rost if r["db"] == db]
    by_head, by_sp, by_gen, full = {}, {}, {}, []
    for r in rows:
        h = head_en(r["name_en"])
        if h:
            for v in sing(h):
                by_head.setdefault(v, []).append(r)
        sp = norm_sci(r["sci_name"])
        if sp and " " in sp:
            by_sp.setdefault(sp, []).append(r)
        g = genus(r["sci_name"])
        if g:
            by_gen.setdefault(g, []).append(r)
        full.append(((r["name_en"] or "").lower(), r))
    idx[db] = (by_head, by_sp, by_gen, rows, full)

rule_by_kr = {}
for r in rules:
    rule_by_kr.setdefault(r["kr_key"], []).append(r)

out = []
for b in base:
    bh = head_en(b["name_en"])
    bsp = norm_sci(b["sci_name"])
    bg = genus(b["sci_name"])
    kr_head = b["name_kr"].split(",")[0].strip()
    for db in DBS:
        by_head, by_sp, by_gen, _, full = idx[db]
        hit, tier = None, ""
        for v in sing(bh):
            if v in by_head:
                hit, tier = by_head[v][0], "T1_exact_en"
                break
        if not hit and bsp and " " in bsp and bsp in by_sp:
            hit, tier = by_sp[bsp][0], "T2_sci_species"
        if not hit and bg and bg in by_gen:
            hit, tier = by_gen[bg][0], "T3_sci_genus"
        if not hit:
            for r in rule_by_kr.get(kr_head, []):
                alias = r["db_food_head"].lower()
                for v in sing(alias):
                    if v in by_head:
                        hit, tier = by_head[v][0], "T4_rule"
                        break
                if hit:
                    break
                for nm, row in full:
                    if alias in nm:
                        hit, tier = row, "T4_rule"
                        break
                if hit:
                    break
        out.append({
            "rda_idx": b["rda_idx"], "rda_code": b["rda_code"], "group": b["group_short"],
            "name_kr": b["name_kr"], "kr_head": kr_head, "name_en": b["name_en"],
            "sci_name": b["sci_name"], "in_knhanes": b["in_knhanes"],
            "db": db, "tier": tier, "db_food_id": hit["food_id"] if hit else "",
            "db_food_name": hit["name_en"] if hit else "", "db_sci_name": hit["sci_name"] if hit else "",
        })

with open(os.path.join(MAP, "food_matches.csv"), "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.DictWriter(fh, list(out[0]))
    w.writeheader()
    w.writerows(out)

# ---- summary ----
from collections import Counter, defaultdict
n_base = len(base)
n_kn = sum(1 for b in base if b["in_knhanes"] == "Y")
print(f"base plant foods {n_base} (KNHANES-present {n_kn})\n")
print(f"{'DB':<24}{'matched':>8}{'cov%':>7}{'T1':>6}{'T2':>6}{'T3':>6}{'T4':>6}{'KN-matched':>12}{'KNcov%':>8}")
for db in DBS:
    rows = [o for o in out if o["db"] == db]
    m = [o for o in rows if o["tier"]]
    t = Counter(o["tier"] for o in m)
    knm = [o for o in m if o["in_knhanes"] == "Y"]
    print(f"{db:<24}{len(m):>8}{100*len(m)/n_base:>6.1f}%{t['T1_exact_en']:>6}{t['T2_sci_species']:>6}"
          f"{t['T3_sci_genus']:>6}{t['T4_rule']:>6}{len(knm):>12}{100*len(knm)/n_kn:>7.1f}%")

anyhit = {o["rda_idx"] for o in out if o["tier"]}
print(f"\nunion (any DB): {len(anyhit)}/{n_base} = {100*len(anyhit)/n_base:.1f}%")

# top unmatched, KNHANES-present first, grouped by Korean head noun
unmatched = defaultdict(lambda: {"n": 0, "kn": 0, "en": "", "sci": "", "grp": ""})
for b in base:
    if b["rda_idx"] in anyhit:
        continue
    k = b["name_kr"].split(",")[0].strip()
    u = unmatched[k]
    u["n"] += 1
    u["kn"] += (b["in_knhanes"] == "Y")
    u["en"] = u["en"] or b["name_en"]
    u["sci"] = u["sci"] or b["sci_name"]
    u["grp"] = u["grp"] or b["group_short"]
print(f"\nunmatched distinct Korean head nouns: {len(unmatched)}")
print("top unmatched (by KNHANES presence, then item count):")
for k, u in sorted(unmatched.items(), key=lambda x: (-x[1]["kn"], -x[1]["n"]))[:60]:
    print(f"   {k:<16} n={u['n']:<3} kn={u['kn']:<3} {u['grp']:<12} | {u['en'][:46]:<48} | {u['sci'][:28]}")
