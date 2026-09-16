#!/usr/bin/env python3
import json
import random
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAPPING_PATH = ROOT / 'data' / 'authority_mapping.json'
TEMPLATES_PATH = ROOT / 'data' / 'templates.json'
OUT_PATH = ROOT / 'data' / 'training_samples.jsonl'

SIMPLE_PHRASES = [
    "{subject} has not been completed as per schedule.",
    "I have not received any update about {subject}.",
    "There is a delay in {subject} and no one is responding.",
    "I want to know the status of {subject}.",
    "Who is responsible for {subject}?",
    "When will {subject} be finished?",
    "My {subject} application has been pending for months.",
    "The {subject} in our area is in bad condition and needs attention.",
    "Please provide details about {subject} and the allocated funds.",
    "What actions have been taken regarding {subject}?"
]

PARAPHRASE_TEMPLATES = [
    "{subject}",
    "{subject} - please help",
    "Regarding {subject}, what is the current status?",
    "Concern: {subject}",
    "Help needed for {subject} in our locality",
    "Status update requested for {subject}"
]

# small helper to pick a keyword-ish phrase for subject
def pick_subject(entry):
    # prefer multi-word keywords if present
    kws = entry.get('keywords', [])
    if not kws:
        return entry.get('department', 'the matter')
    candidates = [k for k in kws if len(k.split())>1]
    if not candidates:
        candidates = kws
    return random.choice(candidates)


def make_variations_from_entry(entry, n=5):
    texts = []
    subj = pick_subject(entry)
    subj_simple = subj
    # generate variations using SIMPLE_PHRASES and paraphrases
    for _ in range(n):
        ph = random.choice(SIMPLE_PHRASES)
        txt = ph.format(subject=subj_simple)
        # add some optional context
        if random.random() < 0.4:
            txt = random.choice(['In my village, ', 'In our area, ', 'For months, ']) + txt
        # sometimes add a small detail
        if random.random() < 0.3:
            txt += random.choice([' It is causing hardship.', ' No response has been given.', ' Please advise.'])
        texts.append(txt)
    # also include paraphrase templates
    for p in PARAPHRASE_TEMPLATES:
        texts.append(p.format(subject=subj_simple))
    # add some transliteration-like variants (Latin-script approx) for a few languages
    if random.random() < 0.3:
        # simple transliteration hack: replace some vowels or common words
        t2 = texts[0].replace('road', 'roadu').replace('ration', 'raashan')
        texts.append(t2)
    # unique
    uniq = []
    for t in texts:
        if t not in uniq:
            uniq.append(t)
    return uniq


def make_variations_from_template(template, n=6):
    texts = []
    summary = template.get('summary') or template.get('desc') or ''
    for _ in range(n):
        if random.random() < 0.6:
            # slightly alter summary
            if len(summary) > 40 and random.random() < 0.5:
                piece = summary
            else:
                piece = random.choice([summary, template.get('title','')])
            # insert phrase
            txt = random.choice(['Please help: ', 'Concern: ', '']) + piece
            if random.random() < 0.3:
                txt += random.choice([' Please provide the status.', ' No update has been received.', ' Who is responsible?'])
        else:
            subj = pick_subject({'keywords': template.get('questions', [])})
            txt = random.choice(SIMPLE_PHRASES).format(subject=subj)
        texts.append(txt)
    # also add the raw summary
    texts.append(summary)
    return list(dict.fromkeys(texts))


def build_samples(total=150):
    mapping = json.load(open(MAPPING_PATH))
    templates = json.load(open(TEMPLATES_PATH))

    samples = []
    # First, from templates (ensure coverage)
    for tmpl in templates:
        vars = make_variations_from_template(tmpl, n=8)
        for v in vars:
            labels = {
                'key': None,
                'department': tmpl.get('department',''),
                'level': tmpl.get('level','Mandal'),
                'authority': 'SPIO',
                'questions': tmpl.get('questions',[])
            }
            # try to find mapping key by matching template title/desc
            for e in mapping:
                if e['department'] and e['department'] in tmpl.get('department',''):
                    labels['key'] = e['key']; break
            samples.append({'text': v, 'labels': labels})
    # Then from mapping entries directly
    for e in mapping:
        vars = make_variations_from_entry(e, n=6)
        for v in vars:
            labels = {
                'key': e.get('key'),
                'department': e.get('department'),
                'level': e.get('level'),
                'authority': e.get('authority'),
                'questions': e.get('questions',[])
            }
            samples.append({'text': v, 'labels': labels})

    # If still fewer than desired, create paraphrases by mixing keywords
    attempts = 0
    while len(samples) < total and attempts < 2000:
        a = random.choice(mapping)
        b = random.choice(mapping)
        subj = pick_subject(a)
        ph = random.choice(SIMPLE_PHRASES).format(subject=subj)
        extra = ''
        if random.random() < 0.4:
            extra = ' ' + random.choice(['Also note: ' + pick_subject(b), 'Please respond quickly.', 'This is urgent.'])
        txt = ph + extra
        labels = {
            'key': a.get('key'),
            'department': a.get('department'),
            'level': a.get('level'),
            'authority': a.get('authority'),
            'questions': a.get('questions',[])
        }
        samples.append({'text': txt, 'labels': labels})
        attempts += 1

    # Shuffle and trim
    random.shuffle(samples)
    samples = samples[:total]
    return samples


def write_samples(samples):
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--count', type=int, default=150)
    args = parser.parse_args()
    samples = build_samples(args.count)
    write_samples(samples)
    print(f'Wrote {len(samples)} samples to {OUT_PATH}')
