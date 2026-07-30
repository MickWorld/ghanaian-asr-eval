"""WER / CER scoring and word-level alignment for the diff explorer.

Normalization: NFC, lowercase, strip everything that is not a letter, digit,
apostrophe, or whitespace — Unicode-aware so Ghanaian orthography
(ɛ, ɔ, ƒ, ɖ, ŋ, x, ...) survives intact.

WER and CER are computed from a single Levenshtein alignment
(substitution/insertion/deletion all cost 1), so the numbers shown in the
summary always agree with the highlighted diffs.
"""

import re
import unicodedata


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text).lower()
    text = "".join(
        ch if (unicodedata.category(ch)[0] in ("L", "N") or ch in (" ", "'")) else " "
        for ch in text
    )
    return re.sub(r"\s+", " ", text).strip()


def align(ref: list, hyp: list) -> list[dict]:
    """Levenshtein alignment with backtrace.

    Returns ops: [{op: 'ok'|'sub'|'ins'|'del', ref, hyp}]
    'ins' = extra token in hypothesis, 'del' = token missing from hypothesis.
    """
    n, m = len(ref), len(hyp)
    # dp[i][j] = edit distance between ref[:i] and hyp[:j]
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = i
    for j in range(1, m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if ref[i - 1] == hyp[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j - 1] + cost, dp[i - 1][j] + 1, dp[i][j - 1] + 1)

    ops: list[dict] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1):
            op = "ok" if ref[i - 1] == hyp[j - 1] else "sub"
            ops.append({"op": op, "ref": ref[i - 1], "hyp": hyp[j - 1]})
            i, j = i - 1, j - 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            ops.append({"op": "del", "ref": ref[i - 1], "hyp": None})
            i -= 1
        else:
            ops.append({"op": "ins", "ref": None, "hyp": hyp[j - 1]})
            j -= 1
    ops.reverse()
    return ops


def error_counts(ops: list[dict]) -> dict:
    counts = {"ok": 0, "sub": 0, "ins": 0, "del": 0}
    for o in ops:
        counts[o["op"]] += 1
    return counts


def score_pair(reference: str, hypothesis: str) -> dict:
    """Score one (reference, hypothesis) pair. Returns rates, counts, and word ops."""
    ref_n, hyp_n = normalize(reference), normalize(hypothesis)
    ref_words, hyp_words = ref_n.split(), hyp_n.split()

    word_ops = align(ref_words, hyp_words)
    wc = error_counts(word_ops)
    char_ops = align(list(ref_n), list(hyp_n))
    cc = error_counts(char_ops)

    n_ref_words = max(len(ref_words), 1)
    n_ref_chars = max(len(ref_n), 1)
    return {
        "wer": (wc["sub"] + wc["ins"] + wc["del"]) / n_ref_words,
        "cer": (cc["sub"] + cc["ins"] + cc["del"]) / n_ref_chars,
        "word_counts": wc,
        "char_counts": cc,
        "ref_words": len(ref_words),
        "ref_chars": len(ref_n),
        "ops": word_ops,
    }


def aggregate(pairs: list[dict]) -> dict:
    """Corpus-level WER/CER: total edits / total reference length (the standard way)."""
    if not pairs:
        return {"clips": 0, "wer": None, "cer": None}
    word_edits = sum(p["word_counts"]["sub"] + p["word_counts"]["ins"] + p["word_counts"]["del"] for p in pairs)
    total_words = sum(p["ref_words"] for p in pairs) or 1
    char_edits = sum(p["char_counts"]["sub"] + p["char_counts"]["ins"] + p["char_counts"]["del"] for p in pairs)
    total_chars = sum(p["ref_chars"] for p in pairs) or 1
    return {
        "clips": len(pairs),
        "wer": round(word_edits / total_words, 4),
        "cer": round(char_edits / total_chars, 4),
    }
