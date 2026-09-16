// ==========================================
// GLOBAL CONFIGURATION
// Shared across scripts loaded in this tab context
// ==========================================
window.GEMINI_CONFIG = {
    // API_KEY is intentionally removed! It is now safely stored on the Python Cloud Run backend.
    MODEL: "gemini-2.5-flash"                  
};

/**
 * Generates an official, condensed statement of facts using live prompt streams.
 * @param {string} issueText - The raw user input from the textbox or audio transcription.
 * @param {string} language - The plain language name framework (e.g., 'English', 'Hindi', 'Telugu').
 * @returns {Promise<{summary: string, description: string}>}
 */
async function generateIssueSummary(issueText, language) {
    if (!issueText) {
        return { summary: '', description: '' };
    }

    // Dynamic extraction instruction mirroring your target pipeline blueprint
    const prompt = `
        You are a highly efficient administrative engine summarizing citizen input context. 
        Analyze the raw complaint below and rewrite it into exactly 2 to 3 lines of highly formal, objective narrative prose. 
        This text block will serve as the "Statement of Facts/Context" section in an official letter to a Public Information Officer (PIO).
        
        Constraints:
        - The finalized text must be exactly 2 to 3 lines long.
        - Write the output completely in the "${language}" language using its native script layout.
        - Return ONLY the raw textual summary. Do not include prefixes like "Summary:" or markdown wrappers.
        
        Citizen Complaint Input text:
        "${issueText}"
    `;
    
    try {
        const config = window.GEMINI_CONFIG;
        
        // Use the global BACKEND_URL defined in index.html, fallback to localhost for local testing
        const backendUrl = window.BACKEND_URL || "http://localhost:8080";
        const endpoint = `${backendUrl}/api/generate`;
        
        // Use the global fetchWithRetry wrapper if available in index.html, otherwise standard fetch
        const fetchMethod = window.fetchWithRetry || fetch;

        const response = await fetchMethod(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                temperature: 0.1,
                model: config.MODEL
            })
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Backend service dropped request (${response.status}): ${errText}`);
        }
        
        const data = await response.json();
        
        // Parse the Gemini response structure returned by our Python backend
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || issueText;
        
        return {
            summary: generatedText.replace(/^"|"$/g, '').trim(), // clean up any lingering quote marks
            description: issueText
        };
    } catch (error) {
        console.error("ai_summary.js execution failed:", error);
        // Clean baseline safe recovery context return
        return { 
            summary: issueText, 
            description: issueText 
        };
    }
}