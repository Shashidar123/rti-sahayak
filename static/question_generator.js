/**
 * Generates custom, context-specific RTI questions using live endpoint generation configs
 * @param {string} summary - The formal summary or grievance copy from the active text box
 * @param {string} department - The chosen government department target line
 * @param {string} language - The active language target framework
 * @returns {Promise<{questions: string[]}>}
 */
async function generateRTIQuestions(summary, department, language) {
    if (!summary) {
        return { questions: [] };
    }

    const prompt = `
        You are an AI classification and legal assistance engine evaluating public requests under the Indian RTI Act, 2005.
        Analyze this unique citizen grievance: "${summary}"
        Target Department: "${department}"
        
        Task:
        Generate exactly 4 critical, highly specific, and legally precise information request items. These items must demand specific official records, file processing logs, timeline tracking metrics, or ledger audit sheets held by this public authority that are explicitly required to investigate or resolve this exact user issue.
        
        Rigid Design Constraints:
        - Absolute zero generic templates, infrastructure keywords, or construction jargon unless the issue explicitly concerns physical engineering works like roads or bridges.
        - Create every single question entirely from scratch based on the unique situation provided by the user.
        - Write all 4 questions directly in the "${language}" language using its native script layout framework.
        
        Return your answer inside a valid JSON object structure matching this exact schema key perfectly with no external markdown fencing:
        {
          "questions": [
            "Tailored question 1...",
            "Tailored question 2...",
            "Tailored question 3...",
            "Tailored question 4..."
          ]
        }
    `;
    
    try {
        const config = window.GEMINI_CONFIG;
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.MODEL}:generateContent?key=${config.API_KEY}`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json" // Mandates clean deterministic parsing
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Gemini question generation pipeline dropped: ${response.status}`);
        }
        
        const data = await response.json();
        const rawJsonText = data.candidates[0].content.parts[0].text.trim();
        const parsedData = JSON.parse(rawJsonText);
        
        return {
            questions: Array.isArray(parsedData.questions) ? parsedData.questions : []
        };
} catch (error) {
        console.error("question_generator.js processing failed:", error);
        // Fallback safely to prevent application ui freezing
        return {
            questions: [
                "What is the current status of my application/complaint?",
                "What are the specific reasons for the delay in processing this request?",
                "Which officer/authority is responsible for handling this file?",
                "What is the official expected timeline for the resolution of this issue?"
            ]
        };
    }
}