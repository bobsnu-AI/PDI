"""식재료 1건 -> 계열별 함량. 출처를 순서대로 뒤지고 첫 히트만 채택한다.

사용:
  python lookup.py <phyto_db 경로> "시금치" [중량g]
  python lookup.py <phyto_db 경로> --trace "서리태" 30
"""
import csv, glob, json, os, sys
from collections import defaultdict
from statistics import median

csv.field_size_limit(10 ** 8)
ORDER = ["rda_fct", "rda_flavonoid", "rda_phenolic_acid", "rda_saponin",
         "phenol_explorer", "usda_isoflavone", "usda_flavonoid",
         "usda_proanthocyanidin", "usda_sr_carotenoid", "foodb"]
KR_DBS = {"rda_flavonoid", "rda_phenolic_acid", "rda_saponin"}   # 한글명 키 + 건조중량


def rd(p):
    return csv.DictReader(open(p, encoding="utf-8-sig", errors="replace"))


class Resolver:
    def __init__(self, db):
        self.db = db
        m = os.path.join(db, "mapping")
        self.base = list(rd(os.path.join(m, "base_foods_rda104.csv")))
        self.by_idx = {b["rda_idx"]: b for b in self.base}
        # 출처별 (food_id -> family -> [(compound, value, unit, basis)])
        # mapping/values/<출처>.csv 샤드를 읽는다. 원본 파일 하나를 갱신하면
        # build_values.py --only <출처> 로 그 샤드만 다시 만들면 된다.
        self.vals = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
        shards = sorted(glob.glob(os.path.join(m, "values", "*.csv")))
        shards = [s for s in shards if not os.path.basename(s).startswith("_")]
        if not shards:
            raise SystemExit(f"{m}/values/ 에 샤드가 없습니다. "
                             "먼저 `python build_values.py <phyto_db> --all` 을 실행하십시오.")
        self.shards = [os.path.basename(s)[:-4] for s in shards]
        for s in shards:
            for r in rd(s):
                self.vals[r["db"]][r["db_food_id"]][r["family"]].append(
                    (r["compound"], float(r["value"]), r["unit"], r["basis"]))
        mp = os.path.join(m, "_manifest.json")
        self.manifest = json.load(open(mp, encoding="utf-8")) if os.path.exists(mp) else {}
        # 기준식품 -> 출처별 매칭된 식품 id
        self.match = defaultdict(dict)
        self.tier = defaultdict(dict)
        for r in rd(os.path.join(m, "food_matches_all.csv")):
            if r["tier"]:
                self.match[r["rda_idx"]][r["db"]] = r["db_food_id"]
                self.tier[r["rda_idx"]][r["db"]] = r["tier"]

    def find_food(self, q):
        """한글 식품명 -> 성분표 항목. 완전일치 > 앞부분 일치 > 부분일치."""
        exact = [b for b in self.base if b["name_kr"] == q]
        if exact:
            return exact
        pre = [b for b in self.base if b["name_kr"].split(",")[0].strip() == q]
        if pre:
            return pre
        return [b for b in self.base if q in b["name_kr"]]

    def resolve(self, item, grams=100.0, trace=False):
        """계열별 mg 반환. 출처는 ORDER 순서대로, 계열마다 첫 히트만."""
        idx = item["rda_idx"]
        moisture = float(item["수분"]) if item.get("수분") else None
        out, log = {}, []
        for db in ORDER:
            fid = idx if db == "rda_fct" else self.match[idx].get(db)
            if not fid:
                log.append((db, "매칭 없음", "", ""))
                continue
            fams = self.vals[db].get(fid)
            if not fams:
                log.append((db, "매칭됨·값 없음", fid, ""))
                continue
            took = []
            for fam, lst in fams.items():
                # 기타 = 13계열 밖 잔여, 합계 = 개별값의 총합 행(더하면 이중계산)
                if fam in out or fam in ("기타", "합계"):
                    continue
                # 같은 화합물이 문헌별로 여러 행인 경우가 40% -> 화합물별 중앙값을 먼저 잡고
                # 그 다음에 서로 다른 화합물끼리만 더한다. 그냥 더하면 크게 과대계산된다.
                per_cmp = defaultdict(list)
                for cname, v, unit, basis in lst:
                    x = v / 1000.0 if unit.startswith("ug") else v
                    if basis == "DW":
                        if moisture is None:
                            continue                     # 수분 모르면 환산 불가 -> 버림
                        x *= (1 - moisture / 100.0)      # 건조중량 -> 신선중량
                    per_cmp[cname].append(x)
                mg100 = sum(median(v) for v in per_cmp.values())
                if mg100 > 0:
                    out[fam] = {"mg_per_100g": round(mg100, 4),
                                "source_built": (self.manifest.get(db) or {}).get("built_at", ""),
                                "mg_per_portion": round(mg100 * grams / 100.0, 4),
                                "source": db, "n_compounds": len(per_cmp),
                                "tier": self.tier[idx].get(db, "직접" if db == "rda_fct" else "")}
                    took.append(fam)
            log.append((db, f"채택 {len(took)}계열" if took else "이미 상위 출처가 채움",
                        fid, ", ".join(took)))
        if trace:
            print(f"\n[{item['name_kr']}]  식품코드 {item['rda_code']}  수분 {moisture}g  {grams}g 기준")
            print(f"{'순서':<4}{'출처':<24}{'결과':<18}{'매칭된 DB 식품':<34}채택 계열")
            for i, (db, st, fid, took) in enumerate(log, 1):
                print(f"{i:<4}{db:<24}{st:<18}{str(fid)[:32]:<34}{took}")
        return out


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--trace"]
    trace = "--trace" in sys.argv
    R = Resolver(args[0])
    q = args[1]
    grams = float(args[2]) if len(args) > 2 else 100.0
    hits = R.find_food(q)
    if not hits:
        print(f"'{q}' 성분표에 없음 -> 유사 식품 규칙(mapping/match_rules.csv) 또는 결측 처리")
        sys.exit(1)
    item = hits[0]
    if len(hits) > 1:
        print(f"후보 {len(hits)}건 중 첫 항목 사용: " + " | ".join(h["name_kr"] for h in hits[:5]))
    res = R.resolve(item, grams, trace=trace)
    print(f"\n{'계열':<14}{'mg/100g':>12}{f'mg/{grams:g}g':>12}  출처 (매칭 티어)")
    for fam, v in sorted(res.items(), key=lambda x: -x[1]["mg_per_100g"]):
        print(f"{fam:<14}{v['mg_per_100g']:>12.3f}{v['mg_per_portion']:>12.3f}  {v['source']} ({v['tier']}, {v['n_compounds']}종)  {v['source_built'][:10]}")
    if not res:
        print("  (모든 출처에서 값 없음)")
