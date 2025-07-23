require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const OpenAI = require('openai');
const app = express();
const port = 80;

app.use(express.json()); 
app.use(cors({           
    origin: '*',
    credentials: true
}));

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY
});

app.post('/api/message', async (req, res) => {
    try {
       
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
        }

        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: '¡Bzzz! Necesito que me digas qué datos o pregunta tienes sobre las colmenas.' });
        }

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Eres una abeja apicultora de la empresa BeeHappy..."
                },
                { role: "user", content: message }
            ],
            model: "deepseek-chat",
        });

        res.json({
            response: completion.choices[0].message.content
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: '¡Bzzz! Algo salió mal en el panal. Intenta de nuevo más tarde.' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});