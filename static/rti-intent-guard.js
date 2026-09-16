/**
 * RTI Intent Detection and Safety Guard
 * Classifies user input before RTI draft generation.
 */
(function (global) {
  'use strict';

  const INTENTS = [
    'RTI_REQUEST',
    'GREETING',
    'MIC_TEST',
    'CASUAL_CHAT',
    'HYPOTHETICAL',
    'OPINION',
    'GOVERNMENT_SERVICE_REQUEST',
    'PERSONAL_INFORMATION',
    'ILLEGAL_REQUEST',
    'NATIONAL_SECURITY',
    'NON_GOVERNMENT',
    'AMBIGUOUS',
    'INVALID_INPUT'
  ];

  const GREETING_PATTERNS = [
    /^(hi+|hello+|hey+|namaste|namaskar|good\s+(morning|afternoon|evening|night)|vanakkam|sat\s*sri\s*akal)[\s!.?,]*$/i,
    /^(hi|hello|hey)\s+(there|sir|madam|friend)?[\s!.?,]*$/i,
    /^(नमस्ते|नमस्कार|प्रणाम|शुभ\s*(प्रभात|संध्या))[\s!.?,]*$/,
    /^(హాయ్|హలో|నమస్కారం|శుభ\s*(ోదయం|సాయంత్రం))[\s!.?,]*$/
  ];

  const MIC_TEST_PATTERNS = [
    /\b(test(ing)?\s*(the\s*)?(mic|microphone)|mic\s*check|can you hear me|are you listening|hello\s+hello|check\s+audio)\b/i,
    /\b(माइक|माइक्रोफोन)\s*(टेस्ट|चेक)\b/,
    /\b(మైక్|మైకropho?ne)\s*(టెస్ట్|పరీక్ష)\b/i
  ];

  const CASUAL_CHAT_PATTERNS = [
    /\b(how are you|what'?s up|tell me a joke|who are you|what can you do|thank you|thanks|bye|goodbye)\b/i,
    /\b(कैसे हो|तुम कौन हो|धन्यवाद|अलविदा)\b/,
    /\b(ఎలా ఉన్నావ|నువ్వు ఎవరు|ధన్యవాదాలు)\b/
  ];

  const HYPOTHETICAL_PATTERNS = [
    /\bnext year('s)?\b.*\b(budget|allocation|plan|estimate)\b/i,
    /\bwill (the|be|there|it)\b.*\b(budget|repair|construct|approve|allocate|increase)\b/i,
    /\bwhat will\b.*\b(budget|cost|amount|happen|be allocated)\b/i,
    /\bpredict\b|\bforecast\b|\bestimate for future\b/i,
    /\bfuture\b.*\b(budget|plan|allocation|expenditure)\b/i,
    /\bwhen will\b.*\b(budget|fund|money)\b.*\b(increase|allocate|approve)\b/i,
    /\b(अगले\s*साल|भविष्य)\b.*\b(बजट|योजना)\b/,
    /\b(వచ్చే\s*సంవత్సరం|భవిష్యత్తు)\b.*\b(బడ్జెట్|ప్రణాళిక)\b/
  ];

  const OPINION_PATTERNS = [
    /\b(what do you think|do you agree|is (the|this) government|should (they|government)|your opinion|in your view)\b/i,
    /\b(आपकी\s*राय|क्या\s*आप\s*सहमत|सरकार\s*अच्छी)\b/,
    /\b(మీ\s*అభిప్రాయం|ప్రభుత్వం\s*బాగుందా)\b/
  ];

  const GOVT_SERVICE_PATTERNS = [
    /\b(repair (my|the|our)|fix (my|the|our)|I want\b.*\b(repaired|fixed|built|approved|released|admission)\b|take action|do something|approve my|give me admission|release my (pension|salary|payment))\b/i,
    /\b(मरम्मत\s*कर|ठीक\s*कर|कार्रवाई\s*कर|मेरी\s*pension\s*दो)\b/,
    /\b(మరమ్మతు\s*చే|సరిచే|చర్య\s*తీసుక)\b/
  ];

  const PERSONAL_PATTERNS = [
    /\b(bank account|account number|ifsc|pan card)\b.*\b(officer|employee|official|person)\b/i,
    /\b(salary|pay slip|pay scale|home address|phone number|mobile number|aadhaar|aadhar)\b.*\b(of|for)\b.*\b(officer|employee|official|person|named)\b/i,
    /\bgive me\b.*\b(personal|private|salary|bank|account)\b/i,
    /\b(officer|employee|official)\b.*\b(salary|bank account|account number|phone number|home address)\b/i
  ];

  const ILLEGAL_PATTERNS = [
    /\b(how to (bribe|hack|forge|fake)|give me bribe|make fake (document|certificate|id)|evade tax illegally)\b/i,
    /\b(घूस|नकली\s*(प्रमाण|दस्तावेज)| हैक)\b/,
    /\b(లంచం|నకిలీ\s*(ధృవ|పత్రం))\b/
  ];

  // ==========================================================
  // NATIONAL SECURITY
  // Broadened beyond explicit keywords like "classified" /
  // "top secret" to catch queries that ask for operational
  // defence details indirectly — base/port locations, asset
  // types stationed there, deployment, and command structure —
  // across the Navy, Army, Air Force, and paramilitary forces.
  // These are exempt under RTI Act Section 8(1)(a) and must
  // never fall through to the RTI_REQUEST default.
  // ==========================================================

  const NATIONAL_SECURITY_PATTERNS = [
    // Explicit / classified language
    /\b(classified|top secret|army deployment|military operation|intelligence report|border security plan|secret mission)\b/i,

    // Bases, ports, stations, installations belonging to any armed/paramilitary force
    /\b(naval|navy|army|air\s*force|military|defen[cs]e|paramilitary)\b[^.?!]{0,40}\b(base|bases|port|ports|station|stations|cantonment|airbase|air\s*base|installation|installations|garrison|dockyard)\b/i,
    /\b(base|bases|port|ports|station|stations|cantonment|airbase|air\s*base|installation|installations|garrison|dockyard)\b[^.?!]{0,40}\b(naval|navy|army|air\s*force|military|defen[cs]e|paramilitary)\b/i,

    // Ships, aircraft, and other military assets tied to stationing/deployment/location
    /\b(warship|destroyer|frigate|submarine|aircraft\s*carrier|corvette|naval\s*vessel|marine\s*ship|fighter\s*jet|missile\s*battery|radar\s*installation)\b[^.?!]{0,40}\b(stationed|deployed|located|based|posted|position(ed)?|list|currently)\b/i,
    /\b(stationed|deployed|located|based|posted)\b[^.?!]{0,40}\b(warship|destroyer|frigate|submarine|aircraft\s*carrier|corvette|naval\s*vessel|marine\s*ship|fighter\s*jet|troops?|regiment|battalion)\b/i,

    // Command structure / order of battle / troop movement
    /\b(command\s*structure|chain\s*of\s*command|order\s*of\s*battle|troop\s*deployment|troop\s*movement|force\s*deployment|operational\s*deployment|fleet\s*command)\b/i,

    // Paramilitary force deployment
    /\b(BSF|CRPF|ITBP|SSB|CISF|assam\s*rifles|coast\s*guard)\b[^.?!]{0,40}\b(deployment|deployed|posted|stationed|base|bases)\b/i,

    // Broad co-occurrence check — catches loosely / casually worded queries
    // that mention a defence force AND an asset/location term ANYWHERE in
    // the input, in any order, without needing exact phrasing or proximity.
    // e.g. "Navy places where Indian marine ships are there I want to know"
    /\b(navy|naval|indian\s*navy|army|indian\s*army|air\s*force|indian\s*air\s*force|military|defen[cs]e\s*forces?|armed\s*forces?|paramilitary|coast\s*guard)\b[\s\S]*\b(ship|ships|warship|warships|marine\s*ship|marine\s*ships|naval\s*ship|destroyer|frigate|submarine|aircraft\s*carrier|corvette|fighter\s*jet|troop|troops|regiment|battalion|base|bases|port|ports|station|stations|cantonment|airbase|installation|installations|establishment|establishments|facility|facilities|infrastructure|unit|units|wing|formation|garrison|dockyard|headquarters|hq|command\s*(centre|center|post)|control\s*room|place|places|location|locations|deployed|deployment|stationed|posted)\b/i,
    /\b(ship|ships|warship|warships|marine\s*ship|marine\s*ships|naval\s*ship|destroyer|frigate|submarine|aircraft\s*carrier|corvette|fighter\s*jet|troop|troops|regiment|battalion|base|bases|port|ports|station|stations|cantonment|airbase|installation|installations|establishment|establishments|facility|facilities|infrastructure|unit|units|wing|formation|garrison|dockyard|headquarters|hq|command\s*(centre|center|post)|control\s*room|place|places|location|locations|deployed|deployment|stationed|posted)\b[\s\S]*\b(navy|naval|indian\s*navy|army|indian\s*army|air\s*force|indian\s*air\s*force|military|defen[cs]e\s*forces?|armed\s*forces?|paramilitary|coast\s*guard)\b/i,

    // "Where is / where are / location of / address of" a defence force —
    // catches direct location queries even without an explicit asset word.
    /\b(where\s*is|where\s*are|located|location\s*of|address\s*of)\b[\s\S]*\b(navy|naval|indian\s*navy|army|indian\s*army|air\s*force|indian\s*air\s*force|military\s*headquarters|armed\s*forces?|coast\s*guard)\b/i,
    /\b(navy|naval|indian\s*navy|army|indian\s*army|air\s*force|indian\s*air\s*force|armed\s*forces?|coast\s*guard)\b[\s\S]*\b(where\s*is|where\s*are|headquarters|hq)\b/i,

    // Hindi
    /\b(नौसेना|सेना|वायुसेना|सैन्य|अर्धसैनिक)\b[^.?!]{0,40}\b(अड्डा|अड्डे|बेस|बंदरगाह|छावनी|तैनाती|तैनात)\b/,
    /\b(गोपनीय|सैन्य|सेना\s*तैनाती|राष्ट्रीय\s*सुरक्षा)\b/i,

    // Telugu
    /\b(నౌకాదళం|సైన్యం|వైమానిక\s*దళం|సైనిక|పారామిలిటరీ)\b[^.?!]{0,40}\b(స్థావరం|బేస్|నౌకాశ్రయం|కంటోన్మెంట్|మోహరింపు|మోహరించ)\b/,
    /\b(రహస్య\s*పదక|సైన్య\s*చర్య|జాతీయ\s*భద్రత\s*రహస్య)\b/i
  ];

  const NON_GOVT_PATTERNS = [
    /\b(private (bank|company|employer|factory|school|hospital)|dispute with neighbor|family fight|divorce|my boss at)\b/i,
    /\b(निजी\s*(कंपनी|employer)|पड़ोस|तलाक)\b/,
    /\b(ప్రైవేట్\s*(కంపెనీ|employer)| పొరుగ)\b/
  ];

  const RTI_REQUEST_PATTERNS = [
    /\b(rti|right to information|information act|certified copy|provide (a )?copy|file notings?|sanction order|status of (my )?application|records regarding|under section)\b/i,
    /\b(सूचना\s*का\s*अधिकार|प्रमाणित\s*प्रति|आवेदन\s*की\s*स्थिति)\b/,
    /\b(RTI|సమాచార\s*హక్కు|certified\s*copy|అప్లికేషన్\s*స్థితి)\b/i,
    /\b(pension|ration|road|aadhaar|aadhar|passport|caste certificate|pension|water supply|electricity bill)\b.*\b(not received|pending|delay|status|update|problem|issue)\b/i
  ];

  const RECORD_STATUS_PATTERNS = [
    /\b(pension|ration\s*card|scholarship|pmay|aadhaar|aadhar|passport|pan\s*card|caste\s*certificate|voter\s*id|electricity\s*connection)\b.*\b(application|request|complaint|benefit|payment)?\s*(status|pending|delay|not\s*received|not\s*processed)\b/i,
    /\b(status|progress|processing\s*status|current\s*status)\b.*\b(my\s*)?(pension|ration\s*card|scholarship|pmay|aadhaar|aadhar|passport|pan\s*card|caste\s*certificate|voter\s*id|electricity\s*connection)\b.*\b(application|request|complaint|benefit|payment)?\b/i,
    /\b(status|progress|processing\s*status|current\s*status)\b.*\b(my\s*)?(application|request|complaint)\b.*\b(pension|ration\s*card|scholarship|pmay|aadhaar|aadhar|passport|pan\s*card|caste\s*certificate|voter\s*id|electricity\s*connection)\b/i,
    /\b(मेरी|मेरा)?\s*(पेंशन|राशन\s*कार्ड|छात्रवृत्ति|आधार|पासपोर्ट)\b.*\b(स्थिति|लंबित|विलंब)\b/,
    /\b(పెన్షన్|రేషన్\s*కార్డ్|స్కాలర్‌షిప్|ఆధార్|పాస్‌పోర్ట్)\b.*\b(స్థితి|పెండింగ్|ఆలస్యం|రావడం\s*లేదు|రాలేదు|రాకపోవడం)\b/
  ];

  const OFFLINE_RESPONSES = {
    en: {
      GREETING: 'Hello! I am your RTI assistant. Please describe the government information or records you need — for example, pension status, ration card delay, or road project documents.',
      MIC_TEST: 'I can hear you. Please describe your RTI issue — such as a pending application, missing pension, or public works records you want to request.',
      CASUAL_CHAT: 'I am here to help you draft RTI applications under the RTI Act, 2005. Please tell me what government records or information you need.',
      HYPOTHETICAL: 'RTI can only request information already held in government records — not future budgets, predictions, or opinions. Try asking for approved budget documents, sanction orders, or work-progress reports for a specific project.',
      OPINION: 'RTI is for requesting existing government records, not opinions or advice. Please describe specific records, files, or factual information you want from a public authority.',
      GOVERNMENT_SERVICE_REQUEST: 'This sounds like a service complaint rather than an RTI request. RTI cannot order repairs or approvals directly — but you can request records such as sanction status, budget allocations, file notings, timelines, responsible officers, or action-taken reports. Would you like to convert this into an RTI for those records?',
      PERSONAL_INFORMATION: 'RTI cannot be used to obtain another person\'s salary, bank account, or private details without overriding public interest (RTI Act Section 8(1)(j)). You may request non-personal official records instead.',
      ILLEGAL_REQUEST: 'I cannot help with illegal requests. RTI is a lawful tool to obtain information held by public authorities. Please describe a legitimate information request.',
      NATIONAL_SECURITY: 'Details about defence force bases, deployment locations, stationed assets, or command structures are exempt from disclosure under RTI Act Section 8(1)(a), which protects information affecting national security and strategic interests. I cannot draft a request for this. Please ask about non-exempt administrative or general information instead.',
      NON_GOVERNMENT: 'RTI applies only to public authorities and government bodies — not private companies or personal disputes. Please describe an issue involving a government department or public office.',
      AMBIGUOUS: 'Your request is unclear. Please specify which government department, scheme, or issue you need information about — for example, pension, ration card, road work, or an application reference number.',
      INVALID_INPUT: 'Please speak or type a clear description of the government information you need. For example: "Status of my pension application" or "Sanction documents for road work in my village."'
    },
    hi: {
      GREETING: 'नमस्ते! मैं आपका RTI सहायक हूँ। कृपया बताएं कि आपको कौन सी सरकारी जानकारी या रिकॉर्ड चाहिए — जैसे पेंशन स्थिति, राशन कार्ड विलंब, या सड़क परियोजना दस्तावेज़।',
      MIC_TEST: 'मैं आपकी आवाज़ सुन सकता/सकती हूँ। कृपया अपना RTI विषय बताएं — जैसे लंबित आवेदन, न मिली पेंशन, या सार्वजनिक कार्य रिकॉर्ड।',
      CASUAL_CHAT: 'मैं RTI अधिनियम, 2005 के तहत आवेदन बनाने में मदद करता/करती हूँ। कृपया बताएं कि आपको कौन से सरकारी रिकॉर्ड चाहिए।',
      HYPOTHETICAL: 'RTI केवल सरकारी रिकॉर्ड में मौजूद जानकारी मांग सकता है — भविष्य के बजट, अनुमान या राय नहीं। किसी विशिष्ट परियोजना के स्वीकृत बजट दस्तावेज़, sanction orders, या कार्य-प्रगति रिपोर्ट मांगें।',
      OPINION: 'RTI मौजूदा सरकारी रिकॉर्ड के लिए है, राय या सलाह के लिए नहीं। कृपया विशिष्ट फाइलें या तथ्यात्मक जानकारी बताएं।',
      GOVERNMENT_SERVICE_REQUEST: 'यह सेवा शिकायत जैसा लगता है, RTI अनुरोध नहीं। RTI सीधे मरम्मत या स्वीकृति नहीं कर सकता — लेकिन आप sanction status, बजट, file notings, समय-सीमा, जिम्मेदार अधिकारी, या action-taken reports मांग सकते हैं। क्या आप इसे RTI में बदलना चाहेंगे?',
      PERSONAL_INFORMATION: 'RTI का उपयोग किसी अन्य व्यक्ति का वेतन, बैंक खाता, या निजी विवरण प्राप्त करने के लिए नहीं किया जा सकता (धारा 8(1)(j))।',
      ILLEGAL_REQUEST: 'मैं अवैध अनुरोधों में मदद नहीं कर सकता/सकती। कृपया वैध सूचना अनुरोध बताएं।',
      NATIONAL_SECURITY: 'सैन्य ठिकानों, तैनाती स्थानों, वहां तैनात संसाधनों, या कमान संरचना की जानकारी RTI अधिनियम की धारा 8(1)(a) के तहत राष्ट्रीय सुरक्षा के हित में प्रकटीकरण से मुक्त है। कृपया गैर-मुक्त प्रशासनिक जानकारी मांगें।',
      NON_GOVERNMENT: 'RTI केवल सार्वजनिक/praveshika प्राधिकरणों पर लागू होता है — निजी कंपनियों या व्यक्तिगत विवादों पर नहीं।',
      AMBIGUOUS: 'आपका अनुरोध स्पष्ट नहीं है। कृपया विभाग, योजना, या समस्या बताएं — जैसे पेंशन, राशन कार्ड, सड़क कार्य, या आवेदन संख्या।',
      INVALID_INPUT: 'कृपया स्पष्ट रूप से बताएं कि आपको कौन सी सरकारी जानकारी चाहिए। उदाहरण: "मेरे पेंशन आवेदन की स्थिति"।'
    },
    te: {
      GREETING: 'నమస్కారం! నేను మీ RTI సహాయకుడిని. మీకు అవసరమైన ప్రభుత్వ సమాచారం లేదా రికార్డులు చెప్పండి — pension status, ration card delay, road project documents వంటివి.',
      MIC_TEST: 'మీ మాట వినిపిస్తోంది. RTI సమస్య చెప్పండి — pending application, pension, public works records.',
      CASUAL_CHAT: 'RTI చట్టం, 2005 కింద applications రూపొందించడంలో సహాయం చేస్తాను. మీకు కావలసిన ప్రభుత్వ రికార్డులు చెప్పండి.',
      HYPOTHETICAL: 'RTI ఇప్పటికే ఉన్న ప్రభుత్వ రికార్డులను మాత్రమే అడగగలదు — future budgets, predictions, opinions కాదు. Specific project కోసం approved budget documents, sanction orders, work-progress reports అడగండి.',
      OPINION: 'RTI existing records కోసం — opinions/advice కోసం కాదు. Specific files లేదా factual information చెప్పండి.',
      GOVERNMENT_SERVICE_REQUEST: 'ఇది service complaint లాగా ఉంది, RTI request కాదు. RTI నేరుగా repairs/approvals చేయదు — కానీ sanction status, budget, file notings, timelines, responsible officers, action-taken reports అడగవచ్చు. RTI గా convert చేయాలా?',
      PERSONAL_INFORMATION: 'RTI మరొకరి salary, bank account, private details పొందడానికి ఉపయోగించలేము (Section 8(1)(j)).',
      ILLEGAL_REQUEST: 'illegal requests కు సహాయం చేయలేము. legitimate information request చెప్పండి.',
      NATIONAL_SECURITY: 'రక్షణ దళాల స్థావరాలు, మోహరింపు స్థానాలు, అక్కడ ఉన్న ఆయుధ/నౌకా వివరాలు, లేదా కమాండ్ నిర్మాణానికి సంబంధించిన సమాచారం RTI చట్టం సెక్షన్ 8(1)(a) కింద జాతీయ భద్రత దృష్ట్యా వెల్లడి నుండి మినహాయించబడింది. దయచేసి non-exempt administrative సమాచారం అడగండి.',
      NON_GOVERNMENT: 'RTI public authorities కు మాత్రమే — private companies/personal disputes కు కాదు.',
      AMBIGUOUS: 'మీ request స్పష్టంగా లేదు. department, scheme, issue చెప్పండి — pension, ration card, road work, application number.',
      INVALID_INPUT: 'మీకు కావలసిన ప్రభుత్వ సమాచారం స్పష్టంగా చెప్పండి. ఉదాహరణ: "నా pension application status".'
    }
  };

  function detectInputLang(text) {
    if (/[\u0900-\u097F]/.test(text)) return 'hi';
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
    return 'en';
  }

  function offlineResponse(intent, text) {
    const lang = detectInputLang(text);
    const bucket = OFFLINE_RESPONSES[lang] || OFFLINE_RESPONSES.en;
    return bucket[intent] || OFFLINE_RESPONSES.en[intent] || OFFLINE_RESPONSES.en.AMBIGUOUS;
  }

  function buildResult(intent, confidence, text) {
    const shouldGenerate = intent === 'RTI_REQUEST';
    return {
      intent,
      confidence: Math.min(1, Math.max(0, confidence)),
      should_generate_rti: shouldGenerate,
      response: shouldGenerate
        ? ''
        : offlineResponse(intent, text)
    };
  }

  function detectRtiIntentHeuristic(text) {
    const trimmed = (text || "").trim();

    // ==========================================================
    // INVALID INPUT
    // ==========================================================

    if (!trimmed) {
      return buildResult("INVALID_INPUT", 1.0, trimmed);
    }

    if (trimmed.length < 2) {
      return buildResult("INVALID_INPUT", 0.99, trimmed);
    }

    if (/^[0-9\s]+$/.test(trimmed)) {
      return buildResult("INVALID_INPUT", 0.99, trimmed);
    }

    if (/^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~ ]+$/.test(trimmed)) {
      return buildResult("INVALID_INPUT", 0.99, trimmed);
    }

    if (/^(.)\1{5,}$/.test(trimmed.replace(/\s/g, ""))) {
      return buildResult("INVALID_INPUT", 0.99, trimmed);
    }

    // ==========================================================
    // GREETING
    // ==========================================================

    for (const p of GREETING_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("GREETING", 0.99, trimmed);
      }
    }

    // ==========================================================
    // MIC TEST
    // ==========================================================

    for (const p of MIC_TEST_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("MIC_TEST", 0.99, trimmed);
      }
    }

    // ==========================================================
    // CASUAL CHAT
    // ==========================================================

    for (const p of CASUAL_CHAT_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("CASUAL_CHAT", 0.98, trimmed);
      }
    }

    // ==========================================================
    // ILLEGAL REQUEST
    // ==========================================================

    for (const p of ILLEGAL_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("ILLEGAL_REQUEST", 0.99, trimmed);
      }
    }

    // ==========================================================
    // NATIONAL SECURITY
    // ==========================================================

    for (const p of NATIONAL_SECURITY_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("NATIONAL_SECURITY", 0.99, trimmed);
      }
    }
for (const p of RECORD_STATUS_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("RTI_REQUEST", 0.98, trimmed);
      }
    }

    for (const p of RTI_REQUEST_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("RTI_REQUEST", 0.98, trimmed);
      }
    }
    // ==========================================================
    // HYPOTHETICAL
    // ==========================================================

    for (const p of HYPOTHETICAL_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("HYPOTHETICAL", 0.98, trimmed);
      }
    }

    // ==========================================================
    // OPINION
    // ==========================================================

    for (const p of OPINION_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("OPINION", 0.98, trimmed);
      }
    }

    // ==========================================================
    // PERSONAL INFORMATION
    // ==========================================================

    for (const p of PERSONAL_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("PERSONAL_INFORMATION", 0.99, trimmed);
      }
    }

    // ==========================================================
    // NON GOVERNMENT
    // ==========================================================

    for (const p of NON_GOVT_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("NON_GOVERNMENT", 0.98, trimmed);
      }
    }

    // ==========================================================
    // GOVERNMENT SERVICE REQUEST
    // ==========================================================

    for (const p of GOVT_SERVICE_PATTERNS) {
      if (p.test(trimmed)) {
        return buildResult("GOVERNMENT_SERVICE_REQUEST", 0.95, trimmed);
      }
    }

    // ==========================================================
    // RANDOM SPAM
    // ==========================================================

    const words = trimmed.toLowerCase().split(/\s+/);

    if (words.length >= 4 && new Set(words).size === 1) {
      return buildResult("INVALID_INPUT", 0.98, trimmed);
    }

    if (/^[a-z]{8,}$/i.test(trimmed) && !trimmed.includes(" ")) {
      return buildResult("INVALID_INPUT", 0.98, trimmed);
    }

    // ==========================================================
    // DEFAULT
    // ==========================================================
    // If the request is NOT classified as any non-RTI category,
    // assume it is an RTI request.

    return buildResult("RTI_REQUEST", 0.90, trimmed);
  }

  function buildIntentGuardPrompt(userInput) {
    return `You are an RTI Intent Detection and Safety Guard for a Voice-Based RTI Assistant.

Your task is to analyze every user input and determine whether it is a valid RTI request before allowing RTI draft generation.

Classify the input into exactly one of the following intents:

* RTI_REQUEST
* GREETING
* MIC_TEST
* CASUAL_CHAT
* HYPOTHETICAL
* OPINION
* GOVERNMENT_SERVICE_REQUEST
* PERSONAL_INFORMATION
* ILLEGAL_REQUEST
* NATIONAL_SECURITY
* NON_GOVERNMENT
* AMBIGUOUS
* INVALID_INPUT

Rules:

* Generate an RTI draft only if the intent is RTI_REQUEST.
* Classify as NATIONAL_SECURITY any request for defence-force base/port locations, the types of ships, aircraft, weapons, or troops stationed at a location, deployment details, troop movements, or command/chain-of-command structure of the Armed Forces or paramilitary forces — even if phrased as a routine information request and even if it does not use words like "classified" or "secret". Do this regardless of whether the requester frames it as personal curiosity, journalism, research, or any other purpose.
* For GOVERNMENT_SERVICE_REQUEST, suggest converting the request into an RTI seeking records, status, budgets, file notings, timelines, responsible officers, or action taken reports.
* For all other intents, do not generate an RTI draft. Instead, return a brief, helpful response explaining why the request cannot be processed as an RTI and guide the user to submit a valid RTI request if appropriate.
* Detect greetings, microphone testing, casual conversations, hypothetical questions, opinion requests, personal information requests, illegal requests, national security requests, non-government queries, ambiguous inputs, random text, repeated speech, abuse, and very short inputs.
* When uncertain between NATIONAL_SECURITY and RTI_REQUEST for a query touching defence/military/paramilitary institutions, prefer NATIONAL_SECURITY.
* Support all user languages and respond in the same language as the user's input.

Return only the following JSON:

{
  "intent": "<INTENT>",
  "confidence": 0.00,
  "should_generate_rti": true,
  "response": "<brief user-facing response>"
}

User input:
"${userInput.replace(/"/g, '\\"')}"`;
  }

  function parseIntentGuardJson(raw) {
    let text = (raw || '').replace(/```json/g, '').replace(/```/g, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON in intent guard response');
    const parsed = JSON.parse(text.substring(start, end + 1));

    const intent = INTENTS.includes(parsed.intent) ? parsed.intent : 'AMBIGUOUS';
    const confidence = Math.min(1, Math.max(0, parseFloat(parsed.confidence) || 0.5));
    const shouldGenerate = intent === 'RTI_REQUEST' && parsed.should_generate_rti !== false;

    return {
      intent,
      confidence,
      should_generate_rti: shouldGenerate,
      response: parsed.response || ''
    };
  }

  global.RTIIntentGuard = {
    INTENTS,
    detectInputLang,
    detectRtiIntentHeuristic,
    buildIntentGuardPrompt,
    parseIntentGuardJson,
    offlineResponse
  };
})(typeof window !== 'undefined' ? window : globalThis);