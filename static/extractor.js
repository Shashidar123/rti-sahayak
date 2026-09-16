// Language-aware extractor: loads authority_mapping.json and provides match(text, lang) -> {match,score}
(async function () {
  async function loadMapping() {
    try {
      const r = await fetch('/data/authority_mapping.json');
      if (!r.ok) throw new Error('Could not load mapping');
      return await r.json();
    } catch (e) { console.error('loadMapping error', e); return []; }
  }

  const MAPPING = await loadMapping();

  // small Levenshtein distance for fuzzy matching
  function levenshtein(a, b) {
    if (!a || !b) return (a||'').length + (b||'').length;
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m+1 }, () => new Array(n+1).fill(0));
    for (let i=0;i<=m;i++) dp[i][0]=i;
    for (let j=0;j<=n;j++) dp[0][j]=j;
    for (let i=1;i<=m;i++){
      for (let j=1;j<=n;j++){
        const cost = a[i-1]===b[j-1]?0:1;
        dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
      }
    }
    return dp[m][n];
  }

  // simple transliteration heuristics for common words (Latin -> Indic approximations)
  const TRANS = {
    'raashan': 'రాషన్',
    'raashaan': 'రాషన్',
    'ration': 'రాషన్',
    'sadak': 'సड़क',
    'sadaka': 'సड़क',
    'road': 'రోడ్డు',
    'roadu': 'రోడ్డు',
    'pothole': 'రోడ్డులో గుళికలు',
    'potholes': 'రోడ్డులో గుళికలు',
    'pension': 'పెన్షన్',
    'aadhar': 'ఆధార్',
    'aadhaar': 'ఆధార్',
    'pan': 'పాన్',
    'passport': 'పాస్‌పోర్ట్',
    'school': 'బడి',
    'water': 'నీరు',
    'electricity': 'విద్యుత్',
    'mgnerga': 'ఎంజిఎన్ఆర్‌ఈజిఎ',
    'rationcard': 'రాషన్ కార్డ్'
  };

  function expandLatinVariants(s) {
    // create simple variants: double vowels, drop vowels, common misspellings
    const variants = new Set([s]);
    variants.add(s.replace(/aa/g, 'a'));
    variants.add(s.replace(/a/g, 'aa'));
    variants.add(s.replace(/sh/g, 's'));
    variants.add(s.replace(/ch/g, 'c'));
    variants.add(s.replace(/ph/g, 'f'));
    // add common transliteration vowel tweaks
    variants.add(s.replace(/e/g, 'ai'));
    return Array.from(variants);
  }

  function transliterateText(t) {
    if (!t) return t;
    let s = t.toLowerCase();
    // If Sanscript loaded and usable, prefer it for transliteration
    if (window.Sanscript && typeof window.Sanscript.t === 'function') {
      try {
        const tel = window.Sanscript.t(s, 'iast', 'telugu');
        if (/[\u0C00-\u0C7F]/.test(tel)) return tel.toLowerCase();
        const dev = window.Sanscript.t(s, 'iast', 'devanagari');
        if (/[\u0900-\u097F]/.test(dev)) return dev.toLowerCase();
      } catch (err) {
        // fallback to heuristic
      }
    }
    // Try heuristic replacements and variant matching
    Object.keys(TRANS).forEach(k => {
      if (s.includes(k)) s = s.replace(new RegExp(k, 'g'), TRANS[k]);
    });
    // Add variants into the string to improve substring matches
    const parts = s.split(/\s+/).map(p => p.trim()).filter(Boolean);
    const expanded = parts.map(p => expandLatinVariants(p)).flat().join(' ');
    return (s + ' ' + expanded).toLowerCase();
  }

  // get keywords for language, falling back to english
  function keywordsFor(entry, lang) {
    if (!entry) return [];
    const by = entry.keywords_by_lang || {};
    if (lang && by[lang]) return by[lang];
    if (by['en']) return by['en'];
    // fallback: gather all
    return Object.values(by).flat();
  }

  function questionsFor(entry, lang) {
    const by = entry.questions_by_lang || {};
    if (lang && by[lang] && by[lang].length) return by[lang];
    if (by['en'] && by['en'].length) return by['en'];
    return [];
  }

  function scoreForEntry(entry, text, lang) {
    if (!text) return 0;
    let t = text.toLowerCase();
    // try transliteration for Latin script inputs
    t = transliterateText(t);
    const kws = keywordsFor(entry, lang);
    let score = 0;
    (kws || []).forEach(k => {
      const kk = (k||'').toLowerCase();
      if (!kk) return;
      if (t.includes(kk)) score += 12;
      // fuzzy match: if small edit distance between token and word in text
      const parts = kk.split(/\s+/).filter(Boolean);
      parts.forEach(p => {
        if (p.length <= 2) return;
        if (t.includes(p)) score += 3;
        // compare with words in t
        t.split(/\W+/).forEach(w => {
          const d = levenshtein(w, p);
          if (d <= 2 && Math.min(w.length, p.length) >= 4) score += Math.max(0, 4 - d);
        });
      });
    });
    // aliases
    (entry.aliases || []).forEach(a => { if (t.includes(a.toLowerCase())) score += 8; });
    if (entry.priority) score += (entry.priority * 2);
    return score;
  }

  function findBestMatches(text, lang = 'en', topN = 3) {
    const scored = MAPPING.map(e => ({ e, s: scoreForEntry(e, text, lang) }));
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, topN).map(x => ({ key: x.e.key, score: x.s, entry: x.e, questions: questionsFor(x.e, lang) }));
  }

  // Expose as window.RTIExtractor
  window.RTIExtractor = {
    findBestMatches,
    loadMapping
  };
})();
