"""Phytochemical family classifier: compound name (+ optional class label) -> family."""
import re

FAMILIES = ["플라보놀", "플라반-3-올", "이소플라본", "안토시아니딘", "플라바논", "플라본",
            "프로안토시아니딘", "카로티노이드", "페놀산", "스틸벤", "리그난", "기타"]

# 14-family taxonomy: the 11 above + 사포닌 + 토코페롤류, 기타 last.
FAMILIES14 = ["플라보놀", "플라반-3-올", "이소플라본", "안토시아니딘", "플라바논", "플라본",
              "프로안토시아니딘", "카로티노이드", "페놀산", "스틸벤", "리그난",
              "사포닌", "토코페롤류", "기타"]

# order matters: first hit wins
NAME_RULES = [
    ("프로안토시아니딘", r"proanthocyanid|procyanid|prodelphinid|propelargonid|\bpa\s*(dimer|trimer|polymer)|mer\b.*proanth"),
    ("이소플라본", r"daidz|genist|glycit|biochanin|formononetin|coumestrol|puerarin|isoflav|ononin|sissotrin|equol|glycinol|sophorico"),
    ("안토시아니딘", r"cyanidin|delphinidin|malvidin|peonidin|petunidin|pelargonidin|anthocyan"),
    ("플라반-3-올", r"catechin|theaflavin|thearubigin|flavan-3-ol|flavan3ol|afzelechin|gallocatechin"),
    ("플라바논", r"hesperet|hesperid|naringen|naringin|eriodictyol|flavanone|narirutin|neohesperidin|didymin|poncirin|liquiritigenin|isosakuranetin|pinocembrin|sakuranetin|prunin"),
    ("플라본", r"apigenin|luteolin|chrysin|baical|tangeretin|nobiletin|sinensetin|flavone|vitexin|orientin|scutellare|diosmet|diosmin|acacetin|rhoifolin|tricin|wogonin|nepetin|schaftoside|isoschaftoside|lucenin|violanthin|saponarin|swertisin|cynaroside"),
    ("플라보놀", r"quercet|kaempfer|myricet|isorhamnetin|rutin|flavonol|\bmorin\b|fisetin|galangin|spiraeoside|hyperoside|astragalin|afzelin|robinin|nicotiflorin|narcissin|typhaneoside|icariin|syringetin|laricitrin|rhamnetin|rhamnazin|patuletin|gossypetin|herbacetin|axillarin|limocitrin"),
    ("카로티노이드", r"caroten|lycopene|lutein|zeaxanthin|cryptoxanthin|violaxanthin|neoxanthin|astaxanthin|capsanthin|capsorubin|fucoxanthin|antheraxanthin|phytoene|phytofluene|xanthophyll"),
    ("스틸벤", r"resveratrol|stilben|piceid|pterostilbene|piceatannol|astringin|rhapontig"),
    ("리그난", r"lignan|lariciresinol|matairesinol|pinoresinol|secoisolaricires|sesamin|sesamol|syringaresinol|medioresinol|arctigenin|schisandr|gomisin|enterolactone|enterodiol|episesamin"),
    ("페놀산", r"caffeic|ferulic|coumaric|sinapic|gallic|vanillic|syringic|protocatech|chlorogenic|caffeoyl|feruloyl|coumaroyl|sinapoyl|ellagic|galloyl|benzoic acid|cinnamic|salicylic|rosmarinic|hydroxybenzo|hydroxycinnam|shikimic|quinic acid|phenolic acid|lithospermic|salvianolic|cichoric|chicoric|verbascoside|homovanillic|phenylacetic|hydroxyphenyl.*acid|tannic|punicalag|vescalagin|castalagin|theogallin|digallate|gallate"),
]
COMPILED = [(f, re.compile(p, re.I)) for f, p in NAME_RULES]

CLASS_MAP = {
    "anthocyanins": "안토시아니딘", "anthocyanidins": "안토시아니딘",
    "flavanols": "플라반-3-올", "flavan-3-ols": "플라반-3-올",
    "flavones": "플라본", "flavonols": "플라보놀", "flavanones": "플라바논",
    "isoflavonoids": "이소플라본", "isoflavones": "이소플라본",
    "lignans": "리그난", "stilbenes": "스틸벤",
    "proanthocyanidins": "프로안토시아니딘",
    "hydroxybenzoic acids": "페놀산", "hydroxycinnamic acids": "페놀산",
    "hydroxyphenylacetic acids": "페놀산", "hydroxyphenylpropanoic acids": "페놀산",
    "phenolic acids": "페놀산",
}


def classify(name, klass="", subklass=""):
    for lbl in (subklass, klass):
        k = (lbl or "").strip().lower()
        if k in CLASS_MAP:
            return CLASS_MAP[k]
    n = name or ""
    for fam, rx in COMPILED:
        if rx.search(n):
            return fam
    # class-level fallbacks that are not exact CLASS_MAP keys
    k = f"{klass} {subklass}".lower()
    for key, fam in CLASS_MAP.items():
        if key in k:
            return fam
    if re.search(r"saponin|ginsenoside|glycyrrhizin|platycodin|lancemaside|astragalosid|"
                 r"soyasapon|chikusetsu|notoginsenoside|asiaticoside|madecassoside|saikosaponin",
                 n, re.I):
        return "기타"          # 사포닌: user's family list has no saponin bucket
    return "기타"


def is_saponin(name):
    return bool(re.search(r"saponin|ginsenoside|glycyrrhizin|platycodin|lancemaside|astragalosid|"
                          r"soyasapon|chikusetsu|notoginsenoside|asiaticoside|madecassoside|"
                          r"saikosaponin|ciwujianoside|eleutheroside|sessiloside|jujuboside",
                          name or "", re.I))


TOCO = re.compile(r"tocopherol|tocotrienol|tocomonoenol", re.I)

# 개별 화합물의 합계로 이미 집계된 행. 개별값과 함께 더하면 이중계산이 된다.
AGG = re.compile(r"^(polyphenols,\s*total|anthocyanins,\s*total|total\s+isoflavones|"
                 r"total\s+flavonoids?|"
                 # FooDB 의 계열 총합 행. 'Catechin' 처럼 실제 화합물인 단수형은 제외.
                 r"isoflavones|flavonoids|saponins|anthocyanins|polyphenols|tannins|"
                 r"carotenoids|phenolic\s+acids|proanthocyanidins|lignans|stilbenes)$", re.I)

# 이름 어간이 규칙에 없어 기타로 새던 것들 (실데이터에서 확인해 추가)
EXTRA = [
    ("플라본", r"chrysoeriol|jaceosidin|cirsilineol|cirsimaritin|pectolinarigenin|hispidulin"),
    ("플라보놀", r"spinacetin|spinatoside|jaceidin|patuletin|axillarin|centaureidin|casticin"),
    ("이소플라본", r"calycosin|odoratin|pratensein|irilone|texasin|orobol"),
]
EXTRA_C = [(f, re.compile(p, re.I)) for f, p in EXTRA]


def classify14(name, klass="", subklass="", source_db=""):
    """14-family classifier.

    Two families cannot be decided from the compound name alone:
      - 토코페롤류: name rule is reliable (tocopherol / tocotrienol).
      - 사포닌: RDA's saponin DB uses systematic triterpene names with no 'saponin'
        substring ('(20S)-protopanaxadiol 20-O-glucoside'), so that DB is assigned
        by provenance; other DBs fall back to the name rule.
    """
    n = (name or "").strip()
    if AGG.match(n):
        return "합계"                       # 절대 합산하지 말 것
    if TOCO.search(n):
        return "토코페롤류"
    if source_db == "rda_saponin" or is_saponin(n):
        return "사포닌"
    # 아실기(feruloyl/coumaroyl…)보다 플라보노이드 골격이 우선이어야 한다.
    # 예: 'spinacetin 3-O-(2″-O-feruloylglucosyl)…' 은 페놀산이 아니라 플라보놀.
    for fam, rx in EXTRA_C:
        if rx.search(n):
            return fam
    return classify(n, klass, subklass)
