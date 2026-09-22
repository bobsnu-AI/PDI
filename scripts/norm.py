"""Shared normalizers for food-name matching."""
import re

AUTH = re.compile(r"\b(l\.|linn\.?|mill\.?|dc\.?|thunb\.?|nakai|maxim\.?|sieb\.?|zucc\.?|willd\.?|"
                  r"lam\.?|pers\.?|hook\.?|f\.|rupr\.?|kom\.?|makino|bunge|turcz\.?|regel|"
                  r"hara|ohwi|kitag\.?|schott|blume|roxb\.?|wall\.?|steud\.?|beauv\.?|"
                  r"gaertn\.?|moench|karst\.?|houtt\.?|walp\.?|swingle|osbeck|burm\.?|"
                  r"ex\b|et\b|and\b|spp?\.|var\.|subsp\.|ssp\.|cv\.|group|convar\.|f\b)\b")

STOP = {"raw", "cooked", "boiled", "dried", "fresh", "frozen", "canned", "with", "without",
        "and", "or", "the", "of", "in", "all", "types", "type", "unprepared", "prepared",
        "drained", "solids", "salt", "added", "unsalted", "whole", "sliced", "chopped",
        "juice", "including", "commercial", "commercially", "usda", "ns", "as", "to",
        "fat", "reduced", "low", "skin", "skins", "seed", "seeds", "leaf", "leaves",
        "root", "roots", "fruit", "fruits", "flesh", "peel", "pulp", "powder", "powdered",
        "ready", "eat", "heat", "young", "mature", "immature", "green", "red", "white",
        "black", "yellow", "purple", "blue", "cultivated", "wild", "var", "subsp",
        "processed", "unprocessed", "blanched", "steamed", "roasted", "fried", "baked",
        "product", "products", "ground", "flour", "extract", "concentrate", "stem", "stems",
        "part", "parts", "portion", "edible", "inedible", "removed", "included", "kernel"}


def norm_sci(s):
    """'Brassica oleracea var. capitata L.' -> 'brassica oleracea'"""
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^a-z\s.]", " ", s)
    s = AUTH.sub(" ", s)
    toks = [t for t in re.split(r"\s+", s) if t and not t.endswith(".") and len(t) > 2]
    return " ".join(toks[:2])


def genus(s):
    n = norm_sci(s)
    return n.split(" ")[0] if n else ""


def tokens_en(s):
    """Content tokens of an English food name, parentheticals and process words dropped."""
    if not s:
        return frozenset()
    s = s.lower()
    s = re.sub(r"\[.*?\]|\(.*?\)", " ", s)
    s = re.sub(r"[^a-z\s-]", " ", s)
    return frozenset(t for t in re.split(r"[\s-]+", s) if t and t not in STOP and len(t) > 2)


def head_en(s):
    """First comma segment, normalized -> the food's head noun phrase."""
    if not s:
        return ""
    s = re.sub(r"\[.*?\]|\(.*?\)", " ", s.lower())
    s = s.split(",")[0]
    s = re.sub(r"[^a-z\s-]", " ", s)
    toks = [t for t in re.split(r"[\s-]+", s) if t and len(t) > 2 and t not in STOP]
    return " ".join(toks)
