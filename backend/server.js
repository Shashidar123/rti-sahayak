const express = require('express');
const cors = require('cors');

const app = express();

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --------------------------------------------------
// CORS
// --------------------------------------------------

const allowedOrigins = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://asritha5486.github.io',
    'https://shashidar123.github.io'
];

app.use(cors({
    origin: function (origin, callback) {

        // Allow requests with no origin
        // (curl, Postman, server-to-server requests, etc.)
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.warn(`CORS blocked origin: ${origin}`);

        return callback(new Error('Not allowed by CORS'));
    },

    methods: ['GET', 'POST', 'OPTIONS'],

    allowedHeaders: [
        'Content-Type',
        'Authorization'
    ]
}));

// Explicitly handle CORS preflight requests
app.options('*', cors());


// --------------------------------------------------
// JSON BODY PARSER
// --------------------------------------------------

app.use(express.json({
    limit: '1mb'
}));


// --------------------------------------------------
// Basic request logging
// --------------------------------------------------

app.use((req, res, next) => {
    console.log(
        `${new Date().toISOString()} | ${req.method} ${req.originalUrl}`
    );

    next();
});


// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'RTI Sahayak Backend'
    });
});


app.get('/health', (req, res) => {
    res.json({
        status: 'healthy'
    });
});


console.log('RTI Sahayak routes loaded: / and /health');


// --------------------------------------------------
// Gemini API Proxy
// --------------------------------------------------

app.post('/api/generate', async (req, res) => {

    const startTime = Date.now();

    try {

        // --------------------------------------------------
        // Read request body
        // --------------------------------------------------

        const {
            prompt,
            temperature = 0.1,
            model = 'gemini-2.5-flash'
        } = req.body;


        // --------------------------------------------------
        // Check Gemini API key
        // --------------------------------------------------

        if (!GEMINI_API_KEY) {

            console.error(
                'GEMINI_API_KEY is missing'
            );

            return res.status(500).json({
                error: 'Server misconfiguration: GEMINI_API_KEY is missing.'
            });
        }


        // --------------------------------------------------
        // Validate prompt
        // --------------------------------------------------

        if (
            !prompt ||
            typeof prompt !== 'string'
        ) {

            return res.status(400).json({
                error: 'A valid prompt is required.'
            });
        }


        // --------------------------------------------------
        // Prevent extremely large prompts
        // --------------------------------------------------

        if (prompt.length > 100000) {

            return res.status(400).json({
                error: 'Prompt is too large.'
            });
        }


        // --------------------------------------------------
        // Validate / restrict model
        // --------------------------------------------------

        const selectedModel =
            model === 'gemini-2.5-flash'
                ? model
                : 'gemini-2.5-flash';


        // --------------------------------------------------
        // Gemini API endpoint
        // --------------------------------------------------

        const endpoint =
            `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;


        console.log(
            `Gemini request started | ` +
            `model=${selectedModel} | ` +
            `promptLength=${prompt.length}`
        );


        // --------------------------------------------------
        // Gemini request timeout
        // --------------------------------------------------

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


        const elapsed =
            Date.now() - startTime;


        // --------------------------------------------------
        // Gemini API returned an error
        // --------------------------------------------------

        if (!response.ok) {

            const errText =
                await response.text();

            console.error(
                `Gemini API error | ` +
                `status=${response.status} | ` +
                `time=${elapsed}ms`
            );

            console.error(
                `Gemini error details: ${errText}`
            );


            return res.status(response.status).json({

                error: 'Gemini API request failed.',

                status: response.status,

                details: errText

            });
        }


        // --------------------------------------------------
        // Successful Gemini response
        // --------------------------------------------------

        const data =
            await response.json();


        console.log(
            `Gemini request successful | ` +
            `status=${response.status} | ` +
            `time=${elapsed}ms`
        );


        return res.status(200).json(data);


    } catch (error) {


        // --------------------------------------------------
        // Timeout
        // --------------------------------------------------

        if (error.name === 'AbortError') {

            console.error(
                'Gemini request timed out'
            );


            return res.status(504).json({

                error:
                    'Gemini request timed out. Please try again.'

            });
        }


        // --------------------------------------------------
        // CORS error
        // --------------------------------------------------

        if (
            error.message &&
            error.message.includes('Not allowed by CORS')
        ) {

            console.error(
                `CORS request rejected: ${error.message}`
            );


            return res.status(403).json({

                error:
                    'Request origin is not allowed.'

            });
        }


        // --------------------------------------------------
        // General backend error
        // --------------------------------------------------

        console.error(
            'Backend Error:',
            error
        );


        return res.status(500).json({

            error:
                'Internal backend error.',

            details:
                error.message

        });

    }

});


// --------------------------------------------------
// 404 handler
// --------------------------------------------------

app.use((req, res) => {

    res.status(404).json({

        error: 'Route not found',

        path: req.originalUrl

    });

});


// --------------------------------------------------
// Global error handler
// --------------------------------------------------

app.use((err, req, res, next) => {

    console.error(
        'Unhandled server error:',
        err
    );


    if (!res.headersSent) {

        res.status(500).json({

            error:
                'Internal server error.'

        });

    }

});


// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, () => {

    console.log(
        `Backend proxy listening on port ${PORT}`
    );

});