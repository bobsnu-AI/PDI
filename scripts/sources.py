"""출처별 어댑터. 원본 파일을 직접 읽고, 레이아웃이 바뀌면 조용히 틀리지 않고 즉시 실패한다.

각 어댑터가 하는 일
  find()     : glob 으로 원본 파일을 찾는다 (파일명에 날짜/버전이 붙어도 따라감)
  verify()   : 우리가 가정한 시트·컬럼·단위가 그대로인지 검사. 아니면 SourceError
  extract()  : (db_food_id, db_food_name, compound, value, unit, basis) 를 내놓는다
"""
import csv, glob, os, re
import openpyxl

csv.field_size_limit(10 ** 8)


class SourceError(Exception):
    """원본 파일이 없거나 레이아웃이 우리 가정과 달라짐."""


def one(db, pattern, what):
    hits = sorted(glob.glob(os.path.join(db, pattern)))
    if not hits:
        raise SourceError(f"{what}: '{pattern}' 에 해당하는 파일 없음")
    return hits[-1]          # 여러 개면 이름순 마지막 (날짜 붙은 최신본)


def norm(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def num(v):
    try:
        f = float(str(v).replace(",", ""))
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


# ============================ 1. 국가표준식품성분표 ============================
FCT_WANT = {
    "베타카로틴": ("카로티노이드", "ug/100g"),
    "알파 토코페롤": ("토코페롤류", "mg/100g"), "베타 토코페롤": ("토코페롤류", "mg/100g"),
    "감마 토코페롤": ("토코페롤류", "mg/100g"), "델타 토코페롤": ("토코페롤류", "mg/100g"),
    "알파 토코트리에놀": ("토코페롤류", "mg/100g"), "베타 토코트리에놀": ("토코페롤류", "mg/100g"),
    "감마 토코트리에놀": ("토코페롤류", "mg/100g"), "델타 토코트리에놀": ("토코페롤류", "mg/100g"),
}


def fct_sheet(wb):
    """'국가표준식품성분 Database 10.4' 중 버전이 가장 높은 시트. 10.5 가 나와도 따라간다."""
    cands = []
    for s in wb.sheetnames:
        m = re.search(r"국가표준식품성분\s*Database\s*([0-9.]+)", s)
        if m:
            cands.append((tuple(int(x) for x in m.group(1).split(".")), s))
    if not cands:
        raise SourceError("성분표: '국가표준식품성분 Database X.Y' 시트를 찾지 못함 "
                          f"(있는 시트: {wb.sheetnames[:6]})")
    return max(cands)[1], ".".join(str(x) for x in max(cands)[0])


def fct(db, meta):
    path = one(db, "kr_rda/식품성분표*.xlsx", "국가표준식품성분표")
    wb = openpyxl.load_workbook(path, read_only=True)
    sheet, ver = fct_sheet(wb)
    ws = wb[sheet]
    it = ws.iter_rows(values_only=True)
    next(it)
    hdr = [norm(x) for x in next(it)]           # 2행 = 성분명
    units = [norm(x) for x in next(it)]         # 3행 = 단위
    # 컬럼을 인덱스가 아니라 이름으로 찾는다 (컬럼이 추가/이동해도 안전)
    idx = {}
    for i, h in enumerate(hdr):
        if h in FCT_WANT:
            idx[i] = (h, *FCT_WANT[h])
    missing = set(FCT_WANT) - {v[0] for v in idx.values()}
    if missing:
        raise SourceError(f"성분표[{sheet}]: 컬럼을 못 찾음 -> {sorted(missing)}")
    for i, (name, fam, unit) in idx.items():
        got = units[i].replace("μ", "u").replace("µ", "u")
        want = unit.split("/")[0]
        if got.lower() != want.lower():
            raise SourceError(f"성분표: '{name}' 단위가 {want} 가 아니라 '{units[i]}'")
    try:
        c_idx, c_name, c_moist, c_kcal = hdr.index("DB{} 색인".format(ver)), None, None, None
    except ValueError:
        c_idx = 0
    c_name = hdr.index("식품명") if "식품명" in hdr else 3
    c_moist = hdr.index("수분") if "수분" in hdr else 6
    c_kcal = hdr.index("에너지") if "에너지" in hdr else 5
    rows, foods = [], {}
    for r in it:
        fid = norm(r[c_idx])
        if not fid:
            continue
        foods[fid] = {"name": norm(r[c_name]), "group": norm(r[2]),
                      "moisture": r[c_moist], "kcal": r[c_kcal]}
        for i, (name, fam, unit) in idx.items():
            v = num(r[i]) if i < len(r) else None
            if v:
                # 성분명이 한글이라 영문 기반 분류기가 못 잡는다. 계열을 여기서 확정해 넘긴다.
                rows.append(("rda_fct", fid, norm(r[c_name]), name, v, unit, "FW", fam))
    wb.close()
    meta.update({"file": os.path.relpath(path, db), "sheet": sheet, "version": ver,
                 "foods": len(foods), "columns_found": len(idx)})
    return rows, foods


# ============================ 2~4. RDA 국내 3종 (건조중량) ============================
RDA_WIDE = {
    "rda_flavonoid": ("kr_rda/*플라보노이드*.xlsx", "플라보노이드 성분명"),
    "rda_phenolic_acid": ("kr_rda/*페놀산*.xlsx", "페놀산 성분명"),
}


def rda_wide(db, meta, key):
    pattern, hdr0 = RDA_WIDE[key]
    path = one(db, pattern, key)
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    dry = False
    rows, sheets = [], []
    for ws in wb.worksheets:
        data = list(ws.iter_rows(values_only=True))
        if not data or norm(data[0][0]) != hdr0:
            # 'DB 설명' 같은 안내 시트. 단위 선언만 확인하고 넘어간다.
            for r in data[:80]:
                for c in r[:3]:
                    if re.search(r"dry\s*weight|건조중량", str(c or ""), re.I):
                        dry = True
            continue
        sheets.append(ws.title)
        foods = {i: norm(data[0][i]) for i in range(1, len(data[0])) if norm(data[0][i])}
        for r in data[1:]:
            c = norm(r[0])
            if not c or c.startswith("*") or c.startswith("=") or "총 " in c:
                if re.search(r"dry\s*weight|건조중량", c, re.I):
                    dry = True
                continue
            for i, food in foods.items():
                v = num(r[i]) if i < len(r) else None
                if v:
                    rows.append((key, food, food, c, v, "mg/100g", "DW"))
    wb.close()
    if not sheets:
        raise SourceError(f"{key}: '{hdr0}' 로 시작하는 시트를 못 찾음")
    if not dry:
        raise SourceError(f"{key}: 'dry weight/건조중량' 선언을 못 찾음. "
                          "신선중량으로 바뀌었을 수 있으니 환산식을 확인하십시오")
    meta.update({"file": os.path.relpath(path, db), "sheets": len(sheets), "basis": "DW"})
    return rows, {}


def rda_saponin(db, meta):
    path = one(db, "kr_rda/*사포닌*.xlsx", "rda_saponin")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows, sheets, dry = [], [], False
    for ws in wb.worksheets:
        data = list(ws.iter_rows(values_only=True))
        for r in data[:6]:
            for c in r[:2]:
                if re.search(r"dry\s*weight|건조중량", str(c or ""), re.I):
                    dry = True
        namerow = next((r for r in data if len(r) > 3 and norm(r[3]) == "식품명"), None)
        if namerow is None:
            continue
        sheets.append(ws.title)
        foods = {i: norm(namerow[i]) for i in range(4, len(namerow)) if norm(namerow[i])}
        for r in data[data.index(namerow) + 1:]:
            c = norm(r[2] if len(r) > 2 else "") or norm(r[1] if len(r) > 1 else "")
            if not c or c in ("Food Description", "식품명", "학명") or c.startswith(("*", "=")) or "총 " in c:
                continue
            for i, food in foods.items():
                v = num(r[i]) if i < len(r) else None
                if v:
                    rows.append(("rda_saponin", food, food, c, v, "mg/100g", "DW"))
    wb.close()
    if not sheets:
        raise SourceError("rda_saponin: '식품명' 행이 있는 시트를 못 찾음")
    if not dry:
        raise SourceError("rda_saponin: 건조중량 선언을 못 찾음")
    meta.update({"file": os.path.relpath(path, db), "sheets": len(sheets), "basis": "DW"})
    return rows, {}


# ============================ 5. Phenol-Explorer ============================
def phenol_explorer(db, meta):
    path = one(db, "phenol_explorer/composition-data.xlsx", "phenol_explorer")
    fpath = one(db, "phenol_explorer/foods.csv", "phenol_explorer foods")
    ids = {r["name"]: r["id"] for r in csv.DictReader(open(fpath, encoding="utf-8", errors="replace"))}
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    h = [norm(x) for x in next(it)]
    need = ["food", "compound", "compound_group", "compound_sub_group", "mean", "units"]
    miss = [c for c in need if c not in h]
    if miss:
        raise SourceError(f"phenol_explorer: 컬럼 없음 -> {miss} (있는 컬럼: {h[:10]})")
    ix = {c: h.index(c) for c in need}
    rows = []
    for r in it:
        v = num(r[ix["mean"]])
        if r[ix["food"]] is None or not v:
            continue
        fn = norm(r[ix["food"]])
        rows.append(("phenol_explorer", str(ids.get(fn, fn)), fn, norm(r[ix["compound"]]),
                     v, norm(r[ix["units"]]) or "mg/100g", "FW"))
    wb.close()
    meta.update({"file": os.path.relpath(path, db), "pe_foods": len(ids)})
    return rows, {}


# ============================ 6~8. USDA 특수 DB ============================
USDA = {
    "usda_flavonoid": ("usda/flavonoid_csv", "FLAV_DAT"),
    "usda_isoflavone": ("usda/isoflavone_csv", "ISFL_DAT"),
    "usda_proanthocyanidin": ("usda/proanthocyanidin_csv", "PA_DAT"),
}


def pick(d, *names):
    for n in names:
        if n in d:
            return n
    return None


def usda(db, meta, key):
    sub, dat = USDA[key]
    dpath = os.path.join(db, sub)
    if not os.path.isdir(dpath):
        raise SourceError(f"{key}: 디렉터리 없음 {sub} (.accdb -> CSV 변환을 먼저 하십시오)")
    nd = {}
    for r in csv.DictReader(open(os.path.join(dpath, "NUTR_DEF.csv"), encoding="utf-8", errors="replace")):
        no = r.get(pick(r, "Nutr_no", "Nutr_No"))
        nm = r.get(pick(r, "Nutrient name", "NutrDesc"))
        if no and nm:
            nd[no] = nm
    names = {}
    for r in csv.DictReader(open(os.path.join(dpath, "FOOD_DES.csv"), encoding="utf-8", errors="replace")):
        k = pick(r, "NDB_No", "NDB No")
        names[r[k]] = r.get("Long_Desc", "")
    rows = []
    rd = csv.DictReader(open(os.path.join(dpath, dat + ".csv"), encoding="utf-8", errors="replace"))
    first = next(rd, None)
    if first is None:
        raise SourceError(f"{key}: {dat}.csv 가 비어 있음")
    kf = pick(first, "NDB_No", "NDB No")
    kn = pick(first, "Nutr_no", "Nutr_No")
    kv = pick(first, "Flav_Val", "Isfl_Val", "PA_Val", "Nutr_Val")
    if not (kf and kn and kv):
        raise SourceError(f"{key}: {dat}.csv 컬럼 불명 -> {list(first)}")
    for r in [first] + list(rd):
        v = num(r[kv])
        if not v or r[kn] not in nd:
            continue
        rows.append((key, r[kf], names.get(r[kf], ""), nd[r[kn]], v, "mg/100g", "FW"))
    meta.update({"dir": sub, "nutrients": len(nd), "foods": len(names)})
    return rows, {}


# ============================ 9. SR Legacy 카로티노이드 ============================
CARO_RX = re.compile(r"^(carotene,\s*(alpha|beta)|cryptoxanthin,\s*beta|lycopene|"
                     r"lutein\s*\+\s*zeaxanthin)$", re.I)


def sr_carotenoid(db, meta):
    """SR Legacy 원본(food.csv/nutrient.csv/food_nutrient.csv)에서 직접 뽑는다.
    파생물 carotenoids.csv 에 의존하지 않으므로 SR 을 새로 받아도 그대로 동작한다."""
    root = sorted(glob.glob(os.path.join(db, "usda/sr_legacy/*")))
    root = [r for r in root if os.path.isdir(r)]
    if not root:
        raise SourceError("usda_sr_carotenoid: usda/sr_legacy/<압축해제 폴더> 없음")
    d = root[-1]
    nut = {}
    for r in csv.DictReader(open(os.path.join(d, "nutrient.csv"), encoding="utf-8", errors="replace")):
        if CARO_RX.match(norm(r["name"])):
            nut[r["id"]] = (norm(r["name"]), norm(r["unit_name"]))
    if len(nut) < 5:
        raise SourceError(f"usda_sr_carotenoid: 카로티노이드 5종 중 {len(nut)}종만 찾음 -> "
                          f"{[v[0] for v in nut.values()]}")
    names = {r["fdc_id"]: r["description"]
             for r in csv.DictReader(open(os.path.join(d, "food.csv"), encoding="utf-8", errors="replace"))}
    ndb = {r["fdc_id"]: r["NDB_number"]
           for r in csv.DictReader(open(os.path.join(d, "sr_legacy_food.csv"), encoding="utf-8", errors="replace"))}
    rows = []
    for r in csv.DictReader(open(os.path.join(d, "food_nutrient.csv"), encoding="utf-8", errors="replace")):
        n = nut.get(r["nutrient_id"])
        v = num(r["amount"])
        if not n or not v:
            continue
        fid = ndb.get(r["fdc_id"], r["fdc_id"])
        unit = "ug/100g" if n[1].upper() in ("UG", "ΜG") else "mg/100g"
        rows.append(("usda_sr_carotenoid", fid, names.get(r["fdc_id"], ""), n[0], v, unit, "FW"))
    meta.update({"dir": os.path.relpath(d, db), "nutrients": len(nut)})
    return rows, {}


# ============================ 10. FooDB ============================
OKUNIT = {"mg/100g", "mg/100 g"}
FB_COLS = ["id", "public_id", "name", "state", "annotation_quality", "description",
           "cas_number", "moldb_smiles", "moldb_inchi", "moldb_mono_mass",
           "moldb_inchikey", "moldb_iupac", "kingdom", "superklass", "klass", "subklass"]


def foodb(db, meta):
    d = sorted(glob.glob(os.path.join(db, "foodb/foodb_*_csv")))
    d = [x for x in d if os.path.isdir(x)]
    if not d:
        raise SourceError("foodb: foodb/foodb_*_csv 폴더 없음 (tar 를 `tar -xf` 로 푸십시오)")
    d = d[-1]
    # Compound.csv 헤더가 데이터와 순서가 다른 알려진 결함. 헤더 집합만 확인하고 위치로 읽는다.
    with open(os.path.join(d, "Compound.csv"), encoding="utf-8", errors="replace", newline="") as fh:
        r = csv.reader(fh)
        hdr = next(r)
        if sorted(norm(x) for x in hdr) != sorted(FB_COLS):
            raise SourceError(f"foodb Compound.csv: 컬럼 구성이 달라짐 -> {hdr}")
        cf = {x[0]: (x[2], x[14], x[15]) for x in r if len(x) == 16}
    foods = {x["id"]: x["name"]
             for x in csv.DictReader(open(os.path.join(d, "Food.csv"), encoding="utf-8", errors="replace"))}
    rows, seen_units = [], set()
    with open(os.path.join(d, "Content.csv"), encoding="utf-8", errors="replace", newline="") as fh:
        rd = csv.DictReader(fh)
        for c in ("source_type", "source_id", "food_id", "orig_unit", "standard_content", "orig_content"):
            if c not in rd.fieldnames:
                raise SourceError(f"foodb Content.csv: '{c}' 컬럼 없음")
        for x in rd:
            if x["source_type"] != "Compound":
                continue
            seen_units.add(x["orig_unit"])
            if x["orig_unit"] not in OKUNIT:
                continue
            v = num(x["standard_content"]) or num(x["orig_content"])
            nf = cf.get(x["source_id"])
            if not v or not nf:
                continue
            rows.append(("foodb", x["food_id"], foods.get(x["food_id"], ""), nf[0], v, "mg/100g", "FW"))
    meta.update({"dir": os.path.relpath(d, db), "foods": len(foods),
                 "compounds": len(cf), "units_seen": len(seen_units)})
    return rows, {}


# ============================ 등록 ============================
ADAPTERS = {
    "rda_fct": fct,
    "rda_flavonoid": lambda db, m: rda_wide(db, m, "rda_flavonoid"),
    "rda_phenolic_acid": lambda db, m: rda_wide(db, m, "rda_phenolic_acid"),
    "rda_saponin": rda_saponin,
    "phenol_explorer": phenol_explorer,
    "usda_isoflavone": lambda db, m: usda(db, m, "usda_isoflavone"),
    "usda_flavonoid": lambda db, m: usda(db, m, "usda_flavonoid"),
    "usda_proanthocyanidin": lambda db, m: usda(db, m, "usda_proanthocyanidin"),
    "usda_sr_carotenoid": sr_carotenoid,
    "foodb": foodb,
}
