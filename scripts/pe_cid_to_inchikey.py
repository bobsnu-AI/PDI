"""PE pubchem_compound_id -> InChIKey via PubChem PUG-REST (batched POST)."""
import csv, json, os, sys, time, urllib.request, urllib.parse

DB = sys.argv[1]
OUT = os.path.join(DB, "pe_pubchem_inchikey.csv")
URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/property/InChIKey,CanonicalSMILES,Title/CSV"

cids = sorted({
    r["pubchem_compound_id"].strip()
    for r in csv.DictReader(open(os.path.join(DB, "phenol_explorer/compounds.csv"), encoding="utf-8", errors="replace"))
    if (r["pubchem_compound_id"] or "").strip().isdigit()
}, key=int)
print(f"unique PE CIDs: {len(cids)}")

rows, header = [], None
for i in range(0, len(cids), 100):
    batch = cids[i:i + 100]
    data = urllib.parse.urlencode({"cid": ",".join(batch)}).encode()
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(URL, data=data), timeout=120) as r:
                txt = r.read().decode()
            break
        except Exception as e:
            print(f"  batch {i} attempt {attempt}: {e}")
            time.sleep(3 * (attempt + 1))
    else:
        print(f"  batch {i}: FAILED, skipped")
        continue
    rd = list(csv.reader(txt.splitlines()))
    header = rd[0]
    rows += rd[1:]
    print(f"  batch {i}-{i+len(batch)}: {len(rd)-1} rows")
    time.sleep(0.25)

with open(OUT, "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(header)
    w.writerows(rows)
print(f"wrote {OUT}: {len(rows)} rows, {sum(1 for r in rows if len(r) > 1 and r[1])} with InChIKey")
