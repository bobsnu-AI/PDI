"""원본 파일 -> 출처별 값 샤드. 파일 하나만 갱신했으면 그 출처만 다시 만들면 된다.

  python build_values.py <phyto_db>                 # 원본이 바뀐 출처만 재빌드
  python build_values.py <phyto_db> --only foodb    # 특정 출처만
  python build_values.py <phyto_db> --all           # 전부 강제 재빌드
  python build_values.py <phyto_db> --check         # 빌드 없이 원본 검증만

출력
  mapping/values/<출처>.csv   출처별 샤드
  mapping/_manifest.json     원본 파일 해시·행수·검증 결과·빌드 시각
"""
import csv, hashlib, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from family import classify14
from sources import ADAPTERS, SourceError

HDR = ["db", "db_food_id", "db_food_name", "compound", "family", "value", "unit", "basis"]


def digest(path):
    """파일 지문. 큰 파일은 앞뒤 8MB + 크기로 충분히 구분된다."""
    h = hashlib.sha256()
    size = os.path.getsize(path)
    h.update(str(size).encode())
    with open(path, "rb") as fh:
        h.update(fh.read(8 << 20))
        if size > 16 << 20:
            fh.seek(-(8 << 20), os.SEEK_END)
            h.update(fh.read())
    return h.hexdigest()[:16]


def fingerprint(db, meta):
    """어댑터가 실제로 읽은 파일/디렉터리의 지문."""
    rel = meta.get("file") or meta.get("dir")
    if not rel:
        return {}
    p = os.path.join(db, rel)
    if os.path.isfile(p):
        return {rel: {"sha": digest(p), "bytes": os.path.getsize(p),
                      "mtime": time.strftime("%Y-%m-%d %H:%M", time.localtime(os.path.getmtime(p)))}}
    out = {}
    for f in sorted(os.listdir(p)):
        fp = os.path.join(p, f)
        if os.path.isfile(fp):
            out[f"{rel}/{f}"] = {"sha": digest(fp), "bytes": os.path.getsize(fp),
                                 "mtime": time.strftime("%Y-%m-%d %H:%M", time.localtime(os.path.getmtime(fp)))}
    return out


def build_one(db, key, outdir):
    meta = {}
    t0 = time.time()
    rows, extra = ADAPTERS[key](db, meta)
    out = []
    for row in rows:
        src, fid, fname, cmp_, v, unit, basis = row[:7]
        fam = row[7] if len(row) > 7 else classify14(cmp_, "", "", src)
        out.append([src, fid, fname, cmp_, fam, v, unit, basis])
    path = os.path.join(outdir, key + ".csv")
    with open(path, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(HDR)
        w.writerows(out)
    meta.update({"rows": len(out), "foods_in_shard": len({r[1] for r in out}),
                 "compounds": len({r[3] for r in out}),
                 "seconds": round(time.time() - t0, 1),
                 "built_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                 "files": fingerprint(db, meta), "status": "ok"})
    # 어떤 성분표 컬럼/부가정보는 성분표 어댑터만 돌려준다
    if key == "rda_fct" and extra:
        with open(os.path.join(outdir, "_fct_foods.csv"), "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.writer(fh)
            w.writerow(["rda_idx", "name_kr", "group", "moisture", "kcal"])
            for fid, v in extra.items():
                w.writerow([fid, v["name"], v["group"], v["moisture"], v["kcal"]])
        meta["fct_foods_csv"] = len(extra)
    return meta


def main():
    args = sys.argv[1:]
    db = args[0]
    only = args[args.index("--only") + 1] if "--only" in args else None
    force = "--all" in args
    check = "--check" in args
    outdir = os.path.join(db, "mapping", "values")
    os.makedirs(outdir, exist_ok=True)
    mpath = os.path.join(db, "mapping", "_manifest.json")
    man = json.load(open(mpath, encoding="utf-8")) if os.path.exists(mpath) else {}

    keys = [only] if only else list(ADAPTERS)
    if only and only not in ADAPTERS:
        sys.exit(f"알 수 없는 출처 '{only}'. 가능: {', '.join(ADAPTERS)}")

    print(f"{'출처':<24}{'상태':<10}{'행수':>10}{'초':>7}  비고")
    total = 0
    for k in keys:
        prev = man.get(k, {})
        try:
            if check:
                meta = {}
                ADAPTERS[k](db, meta)                      # 검증만, 결과 버림
                fp = fingerprint(db, meta)
                same = fp == prev.get("files")
                print(f"{k:<24}{'검증 OK':<10}{'':>10}{'':>7}  "
                      f"{'원본 동일' if same else '원본 변경됨 -> 재빌드 필요'}")
                continue
            if not force and prev.get("status") == "ok" and os.path.exists(os.path.join(outdir, k + ".csv")):
                meta = {}
                try:
                    # 지문만 먼저 보고 같으면 건너뛴다. 지문을 알려면 파일 경로가 필요하므로
                    # 가벼운 어댑터는 그냥 다시 돌리고, 무거운 foodb 만 사전 확인한다.
                    if k == "foodb":
                        import glob as g
                        d = sorted(x for x in g.glob(os.path.join(db, "foodb/foodb_*_csv")) if os.path.isdir(x))
                        if d:
                            fp = fingerprint(db, {"dir": os.path.relpath(d[-1], db)})
                            if fp == prev.get("files"):
                                print(f"{k:<24}{'건너뜀':<10}{prev['rows']:>10,}{'':>7}  원본 변경 없음")
                                total += prev["rows"]
                                continue
                except Exception:
                    pass
            meta = build_one(db, k, outdir)
            man[k] = meta
            total += meta["rows"]
            note = meta.get("sheet") or meta.get("dir") or meta.get("file", "")
            print(f"{k:<24}{'재빌드':<10}{meta['rows']:>10,}{meta['seconds']:>7}  {note}")
        except SourceError as e:
            man[k] = {"status": "error", "error": str(e), "built_at": time.strftime("%Y-%m-%d %H:%M:%S")}
            print(f"{k:<24}{'실패':<10}{'':>10}{'':>7}  {e}")
        except Exception as e:
            man[k] = {"status": "error", "error": f"{type(e).__name__}: {e}",
                      "built_at": time.strftime("%Y-%m-%d %H:%M:%S")}
            print(f"{k:<24}{'오류':<10}{'':>10}{'':>7}  {type(e).__name__}: {e}")

    if not check:
        json.dump(man, open(mpath, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        bad = [k for k, v in man.items() if v.get("status") == "error"]
        print(f"\n합계 {total:,}행  ->  {os.path.relpath(outdir, db)}/")
        print(f"manifest: {os.path.relpath(mpath, db)}")
        if bad:
            print(f"\n!! 실패한 출처 {len(bad)}개: {', '.join(bad)}")
            print("   해당 출처는 이전 샤드가 남아 있으면 그대로 쓰이고, 없으면 그 계열은 결측이 됩니다.")
            sys.exit(1)


if __name__ == "__main__":
    main()
