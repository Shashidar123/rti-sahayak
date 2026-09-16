#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IN = ROOT / 'data' / 'authority_mapping.json'
OUT = ROOT / 'data' / 'authority_mapping.json'

# Unicode ranges per language (simple)
RANGES = {
    'te': ('\u0C00', '\u0C7F'),
    'hi': ('\u0900', '\u097F'),
    'ta': ('\u0B80', '\u0BFF'),
    'kn': ('\u0C80', '\u0CFF'),
    'ml': ('\u0D00', '\u0D7F'),
    'bn': ('\u0980', '\u09FF'),
    'gu': ('\u0A80', '\u0AFF'),
    'pa': ('\u0A00', '\u0A7F'),
    'ur': ('\u0600', '\u06FF')
}


def detect_lang_for_string(s):
    if not s:
        return None
    for lang, (start, end) in RANGES.items():
        for ch in s:
            if start <= ch <= end:
                return lang
    return None


def migrate():
    data = json.load(open(IN, 'r', encoding='utf-8'))
    out = []
    for entry in data:
        new = dict(entry)  # copy
        # initialize new fields
        new['keywords_by_lang'] = { 'en': [], 'te': [], 'hi': [] }
        new['questions_by_lang'] = { 'en': [], 'te': [], 'hi': [] }
        # migrate keywords
        kws = entry.get('keywords', []) or []
        for k in kws:
            lang = detect_lang_for_string(k)
            if lang:
                new['keywords_by_lang'].setdefault(lang, []).append(k)
            else:
                new['keywords_by_lang']['en'].append(k)
        # also migrate aliases if present
        aliases = entry.get('aliases', []) or []
        for a in aliases:
            lang = detect_lang_for_string(a)
            if lang:
                new['keywords_by_lang'].setdefault(lang, []).append(a)
            else:
                new['keywords_by_lang']['en'].append(a)
        # migrate questions (assume english unless contains script)
        qs = entry.get('questions', []) or []
        for q in qs:
            lang = detect_lang_for_string(q)
            if lang:
                new['questions_by_lang'].setdefault(lang, []).append(q)
            else:
                new['questions_by_lang']['en'].append(q)
        # clean original fields optionally
        if 'keywords' in new:
            del new['keywords']
        if 'questions' in new:
            # keep original? remove to avoid duplication
            del new['questions']
        out.append(new)
    # write back
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'Migrated {len(out)} entries into {OUT}')

if __name__ == '__main__':
    migrate()
