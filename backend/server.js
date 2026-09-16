const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS so your GitHub Pages domain can talk to this backend
app.use(cors({ origin: '*' })); 
app.use(express.json());

// This environment variable will be set in Google Cloud Run securely
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, temperature = 0.1, model = 'gemini-2.5-flash' } = req.body;

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY is missing.' });
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        // Forward the request to Google Gemini
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: temperature }
            })
        });

        // Pass any errors directly back to the frontend
        if (!response.ok) {
            const errText = await response.text();
            return res.status(response.status).send(errText);
        }

        // Send the successful data back to the frontend
        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Backend proxy listening on port ${PORT}`);
});