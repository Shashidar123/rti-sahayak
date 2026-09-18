const express = require('express');
const cors = require('cors');

const app = express();

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --------------------------------------------------
// CORS
// --------------------------------------------------
app.use(cors({
    origin: 'https://asritha5486.github.io',
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '1mb' }));

// --------------------------------------------------
// Health check
// --------------------------------------------------
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'RTI Sahayak Backend'
    });
});
console.log('RTI Sahayak routes loaded: / and /health');
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy'
    });
});

// --------------------------------------------------
// Gemini API Proxy
// --------------------------------------------------
app.post('/api/generate', async (req, res) => {
    const startTime = Date.now();

    try {
        const {
            prompt,
            temperature = 0.1,
            model = 'gemini-2.5-flash'
        } = req.body;

        // Check API key
        if (!GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is missing');

            return res.status(500).json({
                error: 'Server misconfiguration: GEMINI_API_KEY is missing.'
            });
        }

        // Check prompt
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({
                error: 'A valid prompt is required.'
            });
        }

        // Prevent extremely large requests
        if (prompt.length > 100000) {
            return res.status(400).json({
                error: 'Prompt is too large.'
            });
        }

        // Only allow the model used by RTI Sahayak
        const selectedModel =
            model === 'gemini-2.5-flash'
                ? model
                : 'gemini-2.5-flash';

        const endpoint =
            `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;

        console.log(
            `Gemini request started | model=${selectedModel} | promptLength=${prompt.length}`
        );

        // 60-second timeout
        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 60000);

        let response;

        try {
            response = await fetch(endpoint, {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY
                },

                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],

                    generationConfig: {
                        temperature: Number(temperature)
                    }
                }),

                signal: controller.signal
            });
        } finally {
            clearTimeout(timeout);
        }

        const elapsed = Date.now() - startTime;

        // Gemini returned an error
        if (!response.ok) {
            const errText = await response.text();

            console.error(
                `Gemini API error | status=${response.status} | time=${elapsed}ms`
            );

            return res.status(response.status).json({
                error: 'Gemini API request failed.',
                status: response.status,
                details: errText
            });
        }

        // Successful response
        const data = await response.json();

        console.log(
            `Gemini request successful | status=${response.status} | time=${elapsed}ms`
        );

        return res.status(200).json(data);

    } catch (error) {

        if (error.name === 'AbortError') {
            console.error('Gemini request timed out');

            return res.status(504).json({
                error: 'Gemini request timed out. Please try again.'
            });
        }

        console.error('Backend Error:', error);

        return res.status(500).json({
            error: 'Internal backend error.',
            details: error.message
        });
    }
});

// --------------------------------------------------
// Start server
// --------------------------------------------------
app.listen(PORT, () => {
    console.log(`Backend proxy listening on port ${PORT}`);
});
