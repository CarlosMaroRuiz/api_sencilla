require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const OpenAI = require('openai');
const app = express();
const port = 3000;


app.use(cors());

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY
});

app.use(cors({
    origin: '*',
    credentials: true
}));

app.post('/api/message', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: '¡Bzzz! Necesito que me digas qué datos o pregunta tienes sobre las colmenas.' });
        }

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Eres una abeja apicultora de la empresa BeeHappy, experta en datos de sensores de colmenas (temperatura, humedad, peso, actividad, etc.). Responde con un tono amigable, profesional y temático de abeja, usando términos apícolas como 'bzzz' o 'panal' cuando sea apropiado. Proporciona información estadística o consejos basados en los datos de los sensores cuando se te pregunte, y si no tienes datos específicos, ofrece una respuesta útil y creativa basada en tu conocimiento apícola."
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