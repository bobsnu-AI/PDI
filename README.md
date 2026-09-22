# phyto_db — 파이토케미컬 공개 DB 수집본 (해외 + 국내)

수집일: 2026-09-18 · 전체 2.3 GB · 원본 형식 그대로 보존 + 필요한 변환본 병기

**매핑·커버리지 분석 결과는 별도 문서 → [`coverage_report.md`](coverage_report.md)**

---

## 1. 요약 표

### 해외 DB

| DB | 고유 식품 수 | 고유 화합물 수 | 정량 함량값 수 |
|---|---|---|---|
| Phenol-Explorer 3.6 (composition-data) | **458** | **508** | **7,486** |
| USDA Flavonoid 3.3 | **512** | **25** (정의 26) | **3,641** (>0: 1,804) |
| USDA Isoflavone 2.1 | **560** | **7** | **2,429** (>0: 1,247) |
| USDA Proanthocyanidin 2 | **283** | **5** | **1,240** (>0: 563) |
| USDA SR Legacy — 카로티노이드 | **5,448** | **5** | **26,741** (>0: 6,271) |
| FooDB 2020-04-07 | **902** | **4,130** | **858,921** |

### 국내 DB

| DB | 고유 식품 수 | 고유 화합물 수 | 정량 함량값 수 |
|---|---|---|---|
| RDA 국가표준식품성분표 10.4 | **3,366** (식물성 1,878) | **1** (β-카로틴) | **1,792** (>0: 1,284, 식물성 기준) |
| RDA 플라보노이드 DB 1.0 | **240** | **474** | **3,161** |
| RDA 페놀산 DB | **305** (>0: 251) | **164** | **14,439** (>0: 2,752) |
| RDA 사포닌 DB 3.0 | **169** (>0: 157) | **549** (>0: 538) | **3,817** (>0: 2,807) |
| KNHANES 제9기 식품코드집 | **2,301** (2024년) | — (코드표) | — |
| MFDS K-FIND 3종 | **341,907** | **0** (일반영양성분만) | — |

- 「고유 식품/화합물 수」는 **정량값이 1건 이상 붙은** 개체 기준. DB 전체 등재 수는 아래 각 섹션 참조.
- 「정량 함량값 수」는 수치 파싱이 되는 행 수. `>0`은 0 초과 값만 센 수(0 값이 "미검출"로 기록된 경우가 많아 병기).
- Phenol-Explorer의 화합물 508 > 등재 501: `composition-data.xlsx`의 `compound` 컬럼은 화합물명 문자열이며 `compounds.csv`에 없는 aglycone 합산 항목(예: 총 flavonoid류)을 일부 포함.

### Phenol-Explorer ↔ FooDB 화합물 겹침

| 조인 키 | 겹치는 화합물 수 |
|---|---|
| **InChIKey (full, 27자)** | **177** |
| InChIKey skeleton (앞 14자 = 연결성만) | 250 |
| CAS 번호 | 174 |
| 화합물명 완전일치 (대소문자 무시) | 264 |
| InChIKey ∪ CAS (합집합) | **227** |

조인 방법과 한계:

- PE `compounds.csv`에는 **InChIKey가 없고** `pubchem_compound_id`만 있습니다. FooDB CSV 배포본에는 **PubChem CID가 없고** InChIKey만 있습니다. → 공통 키가 없으므로 PE의 PubChem CID 280건을 **PubChem PUG-REST**(`/compound/cid/property/InChIKey/CSV`)로 조회해 InChIKey로 변환한 뒤 FooDB InChIKey와 조인했습니다. 결과: `pe_pubchem_inchikey.csv`, `pe_foodb_compound_overlap.csv`.
- **조인 상한이 283입니다.** PE 501개 화합물 중 PubChem CID 보유는 283개(56%), CAS 보유는 193개(39%)뿐입니다. 즉 177/283 = **62.5%가 매칭**되었고, 나머지 218개 PE 화합물은 식별자 자체가 없어 조인 대상에 들어가지 못했습니다. 매핑 커버리지를 올리려면 PE `compounds-structures.csv`의 SMILES에서 InChIKey를 직접 생성(RDKit)하는 단계가 추가로 필요합니다.
- full InChIKey 177 vs skeleton 250의 차이(73건)는 대부분 **입체이성질/호변이성질/전하상태 표기 차이**입니다(예: 안토시아니딘 배당체의 `-O` 프로톤화 블록). 매핑 목적에 따라 skeleton 조인이 더 적절할 수 있습니다.

---

## 2. Phenol-Explorer 3.6 — `phenol_explorer/`

- 출처: <http://phenol-explorer.eu/downloads> (Latest = Version 3.6, released 2016-12-10)
- **주의: `https://phenol-explorer.eu`는 TLS 인증서가 도메인과 불일치합니다** (제시 인증서 CN=`wishartlab.com`, SAN에 `phenol-explorer.eu` 없음 → `SEC_E_WRONG_PRINCIPAL`). HTTPS 접속이 불가해 **HTTP로 다운로드**했습니다. 서버 측 설정 문제이며, 무결성이 중요하면 원 저자에게 문의가 필요합니다.
- 요청한 5종 전부 확보. `composition-data`는 사이트에 **Excel(xlsx)만** 제공되며 CSV판이 없습니다.

| 요청 항목 | 파일 | 행 수 |
|---|---|---|
| composition-data (food-compound 함량) | `composition-data.xlsx` | 7,486 |
| compounds | `compounds.csv` / `.xls` | 501 |
| foods | `foods.csv` / `.xls` | 459 |
| compound-classification | `compounds-classification.csv` / `.xls` | 751 |
| food-classification | `foods-classification.csv` / `.xls` | 543 |

추가로 함께 받은 파일: `metabolites` (372), `publications` (1,308), `compounds-structures.csv` (SMILES), `metabolites-structures.csv`. `.zip` 원본과 압축 해제본을 모두 보관했습니다.

`composition-data.xlsx` 컬럼: `food_group, food_sub_group, food, experimental_method_group, compound_group, compound_sub_group, compound, units, mean, min, max, sd, n, N, nb_of_publications, publication_ids, pubmed_ids`

---

## 3. USDA — `usda/`

### 3.1 특수 성분 DB 3종

`catalog.data.gov`의 해당 데이터셋 페이지는 현재 **404**이고 `data.nal.usda.gov`는 `nal.usda.gov/services/agdatacommons`로 리다이렉트됩니다. 실제 파일은 **Ag Data Commons(Figshare 기반)** 에 있어 Figshare API로 article을 찾아 받았습니다.

| DB | Ag Data Commons DOI | 원본 파일 | 변환본 |
|---|---|---|---|
| Flavonoid Release 3.3 (2018-03) | `10.15482/USDA.ADC/1529181` | `Flav_R03-3.accdb` (11.5 MB), `Flav3.3.pdf` | `flavonoid_csv/` |
| Isoflavone Release 2.1 (2015-11) | `10.15482/USDA.ADC/1324538` | `Isoflav_R2-1.zip` → `isoflav_r2-1/Isoflav_R2-1.accdb`, `Isoflav_R2-1.pdf` | `isoflavone_csv/` |
| Proanthocyanidin Release 2 (2015) | `10.15482/USDA.ADC/1324621` | `PA02.zip` → `pa02/PA02.accdb`, `PA02.pdf` | `proanthocyanidin_csv/` |

**`.accdb` → CSV 변환은 mdbtools 없이** 이 머신에 이미 설치된 네이티브 `Microsoft Access Driver (*.mdb, *.accdb)` ODBC 드라이버 + `pyodbc`로 수행했습니다 (Windows 환경이라 `apt install mdbtools`는 적용 불가). 변환 스크립트는 아래 "재현" 참조.

테이블별 행 수:

| Flavonoid 3.3 | | Isoflavone 2.1 | | Proanthocyanidin 2 | |
|---|---|---|---|---|---|
| `FLAV_DAT` (요약값) | 3,641 | `ISFL_DAT` | 2,429 | `PA_DAT` | 1,240 |
| `FLAV_IND` (개별 측정값) | 24,130 | `SYBN_DTL` | 2,091 | `FOOD_DES` | 283 |
| `FOOD_DES` | 512 | `FOOD_DES` | 560 | `DATSRCLN` | 1,722 |
| `DATSRCLN` | 6,087 | `DATSRCLN` | 3,619 | `DATA_SRC` | 67 |
| `DATA_SRC` | 311 | `DATA_SRC` | 106 | `NUTR_DEF` | 5 |
| `NUTR_DEF` | 26 | `NUTR_DEF` | 7 | `FD_GROUP` | 12 |
| `SRCLink` | 53 | | | | |
| `FD_GROUP` | 12 | | | | |
| `Nut_Val_CR` | 59 | | | | |
| `Food_Des_CR` | 6 | | | | |

함량값 컬럼은 Flavonoid/Proanthocyanidin이 `Flav_Val`, Isoflavone이 `Isfl_Val`이며 식품 키는 셋 다 `NDB_No`입니다 → SR Legacy `sr_legacy_food.csv`의 `NDB_number`로 조인 가능.

### 3.2 SR Legacy 카로티노이드 — `usda/carotenoids.csv`

- 출처: <https://fdc.nal.usda.gov/download-datasets> → `FoodData_Central_sr_legacy_food_csv_2018-04.zip` (전체 CSV 보관: `usda/sr_legacy/`)
- `food_nutrient.csv` 644,125행을 스캔해 추출.

**요청 목록에 대한 확인 필요 사항:** "카로티노이드 6종"으로 적혀 있으나 나열된 것은 5종(α-carotene, β-carotene, lycopene, lutein+zeaxanthin, β-cryptoxanthin)이며 retinol은 명시적으로 제외 대상입니다. 지시대로 **5종만** 추출했습니다. 6번째가 필요하면 SR Legacy에 다음 항목들이 존재합니다: `Carotene, gamma` (nutrient_id 1118), `Cryptoxanthin, alpha` (2032), `Lutein`/`Zeaxanthin` 분리값 (1121 / 1119), `Other carotenoids` (2040). 말씀 주시면 추가합니다.

| 컬럼 | SR nutrient_id | nutrient_nbr | 단위 |
|---|---|---|---|
| `alpha_carotene_ug` | 1108 | 322 | µg/100 g |
| `beta_carotene_ug` | 1107 | 321 | µg/100 g |
| `beta_cryptoxanthin_ug` | 1120 | 334 | µg/100 g |
| `lutein_zeaxanthin_ug` | 1123 | 338 | µg/100 g |
| `lycopene_ug` | 1122 | 337 | µg/100 g |

스키마: `fdc_id, ndb_number, description, food_category` + 위 5개 컬럼. SR Legacy 전체 7,793개 식품 중 카로티노이드 레코드가 있는 **5,448행**을 출력했고, 이 중 하나 이상이 0 초과인 식품은 2,718개입니다.

---

## 4. FooDB — `foodb/`

- 출처: <https://foodb.ca/downloads> → `foodb_2020_4_7_csv.tar.gz` (998 MB), 최신 배포판 2020-04-07
- **파일명은 `.tar.gz`지만 실제로는 gzip이 아닌 순수 tar입니다.** `tar -xzf`는 `not in gzip format`으로 실패하니 `tar -xf`를 쓰세요.
- 압축 해제 위치: `foodb/foodb_2020_04_07_csv/`

### ⚠ `Compound.csv` 헤더 오정렬 (중요)

FooDB 2020-04-07 배포본의 `Compound.csv`는 **헤더의 컬럼 순서가 데이터와 다릅니다.** 헤더대로 읽으면 `moldb_inchikey` 자리에 InChI 문자열이, `cas_number` 자리에 SMILES가 들어와 **InChIKey/CAS 조인이 전부 0건이 됩니다.**

실제 위치 순서 (알려진 화합물로 검증):

```
id, public_id, name, state, annotation_quality, description,
cas_number, moldb_smiles, moldb_inchi, moldb_mono_mass,
moldb_inchikey, moldb_iupac, kingdom, superklass, klass, subklass
```

→ 헤더를 데이터에 맞춰 고친 **`foodb/foodb_2020_04_07_csv/Compound_fixed_header.csv`** 를 함께 넣어두었습니다. 매핑 작업에는 이 파일을 쓰세요. `Content.csv`와 `Food.csv`는 정렬이 정상입니다.

### 테이블 목록 및 행 수

| 테이블 | 행 수 | 컬럼 |
|---|---|---|
| Content | 5,145,532 | 26 |
| CompoundOntologyTerm | 1,587,712 | 6 |
| CompoundSynonym | 171,240 | 7 |
| CompoundsEnzyme | 105,089 | 8 |
| CompoundSubstituent | 95,299 | 7 |
| Compound | 70,477 | 16 |
| CompoundAlternateParent | 50,691 | 7 |
| Reference | 31,778 | 12 |
| CompoundsFlavor | 11,775 | 10 |
| CompoundsHealthEffect | 11,062 | 14 |
| OntologyTerm | 4,370 | 12 |
| CompoundExternalDescriptor | 4,009 | 8 |
| Enzyme | 1,744 | 32 |
| OntologySynonym | 1,669 | 11 |
| CompoundsPathway | 1,604 | 7 |
| HealthEffect | 1,435 | 10 |
| AccessionNumber | 1,424 | 7 |
| Food | 992 | 23 |
| FoodTaxonomy | 889 | 7 |
| Flavor | 883 | 8 |
| NcbiTaxonomyMap | 242 | 5 |
| Pathway | 97 | 6 |
| Nutrient | 39 | 23 |
| EnzymeSynonym | 0 | 6 |
| MapItemsPathway | 0 | 6 |
| PdbIdentifier | 0 | 5 |
| Pfam | 0 | 5 |
| PfamMembership | 0 | 5 |
| Sequence | 0 | 8 |

빈 테이블 6종(Sequence, Pfam, PfamMembership, PdbIdentifier, EnzymeSynonym, MapItemsPathway)은 원본 배포본이 헤더만 담고 있습니다 — 다운로드 실패가 아닙니다.

### Content 상세

- 전체 5,145,532행 = `source_type` **Compound 5,007,500** + **Nutrient 138,032**
- 수치 함량값 858,921건 (그중 `standard_content`가 채워진 것 858,600건) — 즉 전체 Content 행의 **83%는 함량값 없는 정성적 "존재" 레코드**입니다. 정량 매핑에는 `standard_content IS NOT NULL` 필터가 필수.
- 정량값을 가진 식품 902종 / 화합물 4,130종 (등재는 각 992 / 70,477)
- InChIKey 보유 화합물 70,415 / 70,477 (고유 InChIKey 69,605)

---

## 4b. 국내 DB

커버리지·매핑 분석은 **`coverage_report.md`** 참조. 여기서는 수집 경로와 파일만 기록합니다.

### 4b-1. 농촌진흥청 농식품올바로 — `kr_rda/`

**사이트가 이전했습니다.** `koreanfood.rda.go.kr` → **`www.nics.go.kr/food/`** (2026-06-17 공지). 구 도메인은 리다이렉트만 하고 하위 경로는 404입니다.

다운로드는 로그인 없이 가능하나 **JS 팝업에서 사용목적·직업군을 선택**해야 합니다 (`downloadPop(gubun)` → `/food/kfi/fct/fctIntro/downPop.do` → `#btn_confirm` → POST `/food/kfi/fct/fctIntro/downloadImg.do`). 선택값: 사용목적 = `앱, 웹, 프로그램 등 개발 활용`(704009), 직업군 = `식품관련 기업 종사자`(704015).

| 파일 | 내용 | 비고 |
|---|---|---|
| `식품성분표(10개정판).xlsx` (13.3 MB) | **10.0 / 10.1 / 10.2 / 10.3 / 10.4 시트를 한 파일에 모두 수록** | 요청하신 **10.2** = 3,313 항목, 최신 **10.4** = 3,369 항목 |
| `식품성분표(10개정판).pdf` (50.9 MB) | 책자판 | |
| `플라보노이드 Data Base 1.0.xlsx` | 플라보노이드 성분표 (`sort=flavus`) | 240 식품 × 474 화합물 |
| `공공데이터_페놀산 DB.xlsx` | 페놀산 성분표 (`sort=phenolAc`) | 305 식품 × 164 화합물 |
| `RDA 기능성분 DB 3.0 사포닌 편.xlsx` | 사포닌 성분표 (`sort=saponinAc`) | 169 식품 × 549 화합물 |

성분표 부록 시트가 매핑의 핵심입니다:
- **부록2) 식품코드, 국문명, 영문명, 학명** — 3,366행. 국문↔영문↔학명 대응이 전부 들어 있어 해외 DB 조인 키로 바로 사용 가능.
- 부록1) 식품코드 연계표 — 10.0↔10.4 코드 변환.
- 성분표 본표 137컬럼 중 파이토케미컬은 **베타카로틴(col 35) 하나뿐**입니다. 라이코펜·루테인은 없습니다.

**카로티노이드 기능성 성분표는 이 사이트에 없습니다.** 메뉴는 플라보노이드·페놀산·사포닌 3종 + PLS-DA 기능성분 지도뿐입니다.

### 4b-2. 국민건강영양조사 — `kr_knhanes/`

`knhanes.kdca.go.kr`는 Vue SPA이고 페이지 경로를 직접 GET하면 `요청 타입을 확인해주세요`만 반환합니다. 메뉴 클릭을 통한 POST 네비게이션이 필요해 Playwright로 처리했습니다 (원시자료 → 이용지침서). 첨부 다운로드 API: `POST /knhanes/api/file/download.json {"type":"UG","dtlSn":<id>,"flSn":"1"}` → `is.kdca.go.kr` 리다이렉트. 로그인 불필요.

| 파일 | 내용 |
|---|---|
| `제9기+3차년도(2024)+영양조사+코드자료집.xlsx` | **식품코드 2,301건** (식품코드·식품코드명·**농진청식품코드**) + 음식코드 1,728건 |
| `제9기+2차년도(2023)+영양조사+코드자료집.xlsx` | 동일 구조 |
| `제9기+1차년도(2022)+영양조사+코드자료집.xlsx` | 동일 구조 |
| `국민건강영양조사+제9기(2022-2024)+원시자료+이용지침서.pdf` | 변수 설명서 |

코드집에 **농진청식품코드** 컬럼이 있어 RDA 성분표와 직접 조인됩니다 (2024년 2,301건 중 1,486건에 코드 부여). 3개년 모두 등장하는 코드 1,722건 = 상시 섭취 식품으로 간주해 가중에 사용했습니다.

> **원시자료(24시간 회상조사 실제 섭취량)는 받지 않았습니다.** 원시자료 다운로드는 SAS/SPSS 파일이며 `사용자등록`이 필요합니다. 지시대로 로그인 단계에서 멈췄습니다. 따라서 "섭취 빈도 가중"은 실제 섭취량이 아니라 **코드집 등재 여부/연도 지속성**을 프록시로 사용했습니다. 실제 빈도 가중이 필요하면 원시자료 계정이 필요합니다.

### 4b-3. 식약처 식품영양성분 DB — `kr_mfds/`

`data.go.kr`의 「식품의약품안전처_식품영양성분DB 통합 자료집_20221021」(id 15047698)은 **파일을 호스팅하지 않고 제공기관 사이트로 보내는 「바로가기」 항목**입니다 (→ `various.foodsafetykorea.go.kr/nutrient/`). 로그인 벽이 아니라 링크아웃 방식이라, 제공기관인 K-FIND에서 최신판을 직접 받았습니다.

K-FIND 다운로드는 로그인 없이 가능하나 **「시스템 개선을 위한 활용정보 입력」 모달**을 통과해야 합니다 (`/nutrient/export/down/filePop.do`, 소속·부서 자유입력 + 기관유형·활용목적 필수선택). 제출값:

| 필드 | 제출한 값 |
|---|---|
| 소속 | 서울대학교 식의학유전체실 |
| 부서 | 밥스누 AI 맞춤추천 프로젝트 |
| 기관유형 | 연구기관 |
| 활용 목적 | 앱 등 시스템 개발 DB로 활용 |

| 파일 | 건수 | 크기 |
|---|---|---|
| `20260828_가공식품DB_316734건.xlsx` | 316,734 | 201.6 MB |
| `20260828_음식DB_19617건.xlsx` | 19,617 | 12.1 MB |
| `20260623_건강기능식품DB_5556건.xlsx` | 5,556 | 3.4 MB |

**이 3종에는 파이토케미컬이 없습니다.** 160컬럼 전부 일반영양성분(에너지·수분·단백질·지방·탄수화물·당류·식이섬유·무기질·비타민·지방산·아미노산)입니다. 파이토케미컬 매핑에는 쓸 수 없고, **DPI 분모(총 kcal) 계산과 가공식품·외식 로깅용**으로만 유효합니다. K-FIND의 「원재료성식품 DB(국가표준식품성분표)」 항목은 용량이 `-`로 비어 있고 RDA 사이트로 링크아웃합니다 (= `kr_rda/`와 동일 자료).

### 4b-4. Jun et al. 2016 (Br J Nutr) — **없음**

`doi:10.1017/S0007114515004006` (Jun S, Shin S, Joung H. *Estimation of dietary flavonoid intake and major food sources of Korean adults*). Cambridge Core 논문 페이지에 **Supplementary material 항목이 존재하지 않습니다.** 본문 Table 1–5는 문서 내 표이고, 논문에서 구축한 한국인 플라보노이드 DB(KFDB)는 배포되지 않습니다. 전문도 페이월입니다. 파일 없음으로 기록합니다.

---

## 5. 누락 및 미확보 항목

| 항목 | 상태 |
|---|---|
| Phenol-Explorer composition-data CSV판 | **미제공** — 사이트에 xlsx만 존재 (v1/v2도 "Not Available") |
| Phenol-Explorer HTTPS 다운로드 | **불가** — 인증서 도메인 불일치, HTTP로 대체 |
| catalog.data.gov의 USDA 3종 데이터셋 페이지 | **404** — Ag Data Commons(Figshare)에서 확보 |
| FooDB의 PubChem CID | **배포본에 없음** — `CompoundExternalDescriptor.csv`는 ChEBI 등만 수록. PE 측 CID를 InChIKey로 변환해 우회 |
| PE 화합물 218개의 InChIKey/CAS | **원본에 식별자 없음** — 조인 불가, SMILES 기반 생성 필요 |

그 외 요청 파일은 전부 확보했습니다. 추측으로 만든 URL은 없으며, 모든 링크는 다운로드 페이지 파싱 또는 Figshare API 응답에서 얻었습니다.

---

## 6. 파일 트리

```
phyto_db/
├── README.md
├── _stats.json                        # 이 문서의 모든 수치 (기계 판독용)
├── pe_pubchem_inchikey.csv            # PE PubChem CID 280건 → InChIKey (PUG-REST)
├── pe_foodb_compound_overlap.csv      # InChIKey 일치 177건 매핑표
├── phenol_explorer/                   # .zip 원본 + 압축 해제본 (xlsx/xls/csv)
├── usda/
│   ├── carotenoids.csv                # SR Legacy 카로티노이드 5종 wide 포맷
│   ├── Flav_R03-3.accdb, Flav3.3.pdf
│   ├── flavonoid_csv/                 # accdb → CSV 10개 테이블
│   ├── Isoflav_R2-1.zip/.pdf, isoflav_r2-1/
│   ├── isoflavone_csv/                # 6개 테이블
│   ├── PA02.zip/.pdf, pa02/
│   ├── proanthocyanidin_csv/          # 6개 테이블
│   └── sr_legacy/                     # SR Legacy 전체 CSV 18개 파일
├── foodb/
│   ├── foodb_2020_4_7_csv.tar.gz      # 원본 (실제로는 비압축 tar) — zip에는 미포함
│   └── foodb_2020_04_07_csv/          # 29개 테이블 + Compound_fixed_header.csv
├── kr_rda/                            # 농식품올바로: 성분표 10.0~10.4 + 플라보노이드/페놀산/사포닌
├── kr_knhanes/                        # KNHANES 제9기 코드자료집 3개년 + 이용지침서
├── kr_mfds/                           # K-FIND 가공식품/음식/건강기능식품 DB (일반영양성분)
├── coverage_report.md                 # 매핑·커버리지 분석 결과
├── HOWTO.md                           # 식재료 -> 계열별 mg 계산 절차 + 월간 갱신 방법
├── component_mapping.md               # 14개 기능성분 × 매핑 가능 데이터 (엔진 스펙)
├── _coverage.json                     # coverage_report.md의 모든 수치 (기계 판독용)
├── _components.json                   # component_mapping.md의 모든 수치
├── _blindspot.json                    # 14계열이 못 잡는 축의 정량 가능성 검증
├── scripts/                           # 수집·매핑·집계 스크립트 (scripts/README.md 참조)
└── mapping/                           # 매핑 테이블 및 규칙
    ├── values/                        # 출처별 정량값 샤드 10개 (원본에서 재생성)
    ├── _manifest.json                 # 원본 파일 지문·행수·빌드 시각
    ├── component_sources.csv          # 계열 → 출처 우선순위 (엔진이 직접 소비)
    ├── component_matrix.csv           # 계열 × 출처 커버리지 매트릭스
    ├── base_foods_rda104.csv          # 기준 식품 1,878 (식물성)
    ├── match_rules.csv                # 유사 식품 매칭 규칙 (근거·신뢰도 기재)
    ├── food_matches.csv               # 해외 DB 매칭 결과
    ├── food_matches_all.csv           # + RDA 국내 DB 3종
    ├── db_food_rosters.csv            # 해외 DB 식품 명부
    ├── db_food_has_quant.csv          # (db, 식품ID) -> 정량 화합물 수
    ├── rda_phyto_long.csv             # RDA 국내 DB 3종 long format
    ├── rda_phyto_food_matches.csv     # RDA 국내 DB 식품명 대응
    ├── compound_families.csv          # 화합물 -> 12계열 분류
    ├── knhanes_food_codes.csv         # KNHANES 식품코드 + 농진청코드
    └── korean_native_unmatched.csv    # 한국 특유 식품 매핑 실패 목록
```

**`phyto_db.zip` 관련:** 154개 파일 / **301 MB** (무결성 검증 완료). 폴더 원본은 2.3 GB인데 그 중 998 MB가 FooDB 원본 tar이고 내용은 이미 `foodb_2020_04_07_csv/`로 풀려 있어 중복입니다. **zip에서는 이 tar 하나만 제외**했습니다 (`foodb_2020_4_7_csv.tar.gz`). 원본 아카이브가 필요하면 위 재현 명령으로 다시 받거나 `phyto_db/foodb/`의 로컬 파일을 쓰세요.

zip 용량의 대부분(201 MB)은 `kr_mfds/20260828_가공식품DB_316734건.xlsx`입니다. 이 파일에는 파이토케미컬이 없으므로(§4b-3), 매핑 작업만 주고받으실 거면 이 파일도 빼면 100 MB로 줄어듭니다.

---

## 7. 재현

```bash
# Phenol-Explorer 3.6 (HTTPS 불가 → http)
B=http://phenol-explorer.eu/system/downloads/current
for f in composition-data.xlsx compounds.csv compounds-classification.csv \
         foods.csv foods-classification.csv; do curl -LO "$B/$f.zip"; done

# USDA 특수 DB — Figshare API로 링크 확인 후 다운로드
curl -H 'Content-Type: application/json' -X POST \
  -d '{"search_for":"Flavonoid Content of Selected Foods","group":51648}' \
  https://api.figshare.com/v2/articles/search
curl -L https://api.figshare.com/v2/articles/24659802   # → files[].download_url

# SR Legacy
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip

# FooDB — tar.gz 이름이지만 -z 없이
curl -LO https://foodb.ca/public/system/downloads/foodb_2020_4_7_csv.tar.gz
tar -xf foodb_2020_4_7_csv.tar.gz
```

`.accdb` → CSV (Windows, mdbtools 불필요):

```python
import csv, pyodbc
cn = pyodbc.connect(r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=Flav_R03-3.accdb;")
cur = cn.cursor()
for t in [r.table_name for r in cur.tables(tableType="TABLE")]:
    cur.execute(f"SELECT * FROM [{t}]")
    with open(f"{t}.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow([d[0] for d in cur.description])
        w.writerows([["" if v is None else v for v in r] for r in cur])
```

Linux/mac이면 `sudo apt install mdbtools` 후 `mdb-tables -1 x.accdb | xargs -I{} sh -c 'mdb-export x.accdb {} > {}.csv'`.

---

## 8. 라이선스 / 인용

- **Phenol-Explorer**: 비상업적 이용 무료. DB 상당 부분을 사용한 논문은 Phenol-Explorer 원논문 인용 필요. 상업적 재배포는 저자 허가 필요. <http://phenol-explorer.eu/how_to_cite_us>
- **USDA (Flavonoid/Isoflavone/Proanthocyanidin/SR Legacy)**: US 정부 저작물, public domain. 위 DOI 인용 권장.
- **FooDB**: 비상업적 이용 무료, 출처 표기. 상업적 이용은 별도 문의.
# PDI
