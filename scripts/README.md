# 재현 스크립트

`$DB` = `phyto_db` 디렉터리 경로. 순서대로 실행하면 `mapping/`, `_stats.json`, `_coverage.json`이 재생성됩니다.

```bash
# --- 수집 ---
python nics_download.py       "$DB/kr_rda"     # 농식품올바로 성분표 (Playwright)
python knhanes_codebook.py    "$DB/kr_knhanes" # KNHANES 코드자료집 (Playwright)
python mfds_download3.py      "$DB/kr_mfds"    # K-FIND 영양성분DB (Playwright, 활용정보 설문)
python accdb2csv.py  in.accdb outdir ...       # USDA .accdb -> CSV (pyodbc, mdbtools 불필요)
python pe_cid_to_inchikey.py  "$DB"            # PE PubChem CID -> InChIKey (PUG-REST)

# --- 해외 DB 기초 통계 + PE/FooDB 겹침 ---
python summarize.py           "$DB"            # -> _stats.json, pe_foodb_compound_overlap.csv

# --- 매핑 및 커버리지 ---
python build_base.py          "$DB"            # 기준 식품 목록 + DB 식품 명부
python parse_rda_phyto.py     "$DB"            # RDA 국내 DB 3종 -> long format
python match.py               "$DB"            # T1~T4 매칭 (match_rules.csv 사용)
python coverage.py            "$DB"            # -> _coverage.json + mapping/*.csv

# --- 계산 엔진용 ---
python build_values.py        "$DB" --check    # 원본 레이아웃 검증만 (빌드 안 함)
python build_values.py        "$DB"            # 원본이 바뀐 출처만 -> mapping/values/<출처>.csv
python build_values.py        "$DB" --only foodb   # 특정 출처만
python component_sources.py   "$DB"            # -> 계열별 출처 우선순위표
python lookup.py "$DB" "시금치, 생것" 70 --trace   # 식재료 1건 조회. 절차 설명은 ../HOWTO.md
```

의존성: `openpyxl`, `pyodbc`(Windows Access 드라이버), `playwright`(+`playwright install chromium`).
`coverage.py`는 FooDB `Content.csv` 5.1M행을 스캔하므로 3~5분 걸립니다.

공유 모듈:
- `sources.py` — 출처별 어댑터. 원본 파일을 직접 읽고 레이아웃 변경을 감지해 즉시 실패
- `norm.py` — 학명/영문 식품명 정규화 (`norm_sci`, `genus`, `head_en`)
- `family.py` — 화합물명 → 12계열 분류 (`classify`), 사포닌 판정 (`is_saponin`)

`match_rules.csv`를 수정한 뒤에는 `match.py` → `coverage.py` 순으로 재실행하십시오.
동일 입력에 대해 결과는 결정적입니다(`kr_heads` 정렬에 안정적 tie-break 적용).
