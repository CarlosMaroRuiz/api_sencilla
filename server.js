require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { combineEstadisticas } = require('./externs/getEstadistica');
const { functions } = require('./externs/functions');

const app = express();
const port = 80;

app.use(express.json());
app.use(cors({
  origin: '*',
  credentials: true,
}));

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// Función para detectar si el mensaje es sobre estadísticas
function esConsultaEstadistica(mensaje) {
  const palabrasClave = [
    'estadística', 'estadisticas', 'producción', 'produccion', 'datos', 
    'rendimiento', 'números', 'numeros', 'reporte', 'informe', 'métricas', 
    'metricas', 'cifras', 'cantidad', 'cuánto', 'cuanto', 'porcentaje', 
    'promedio', 'total', 'resumen', 'análisis', 'analisis', 'registros'
  ];
  
  const mensajeLower = mensaje.toLowerCase();
  return palabrasClave.some(palabra => mensajeLower.includes(palabra));
}

// Función para eliminar el formato markdown
function eliminarMarkdown(texto) {
  return texto
    .replace(/\*\*/g, '') // Eliminar negritas
    .replace(/\*/g, '')    // Eliminar cursivas
    .replace(/#{1,6}\s/g, '') // Eliminar encabezados
    .replace(/\n- /g, '\n• ') // Reemplazar viñetas markdown por bullet points simples
    .replace(/```[^`]*```/g, '') // Eliminar bloques de código
    .replace(/`([^`]+)`/g, '$1') // Eliminar código inline
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Reemplazar enlaces
}

// Prompts mejorados
const SYSTEM_PROMPT_BASE = `Eres Meli 🐝, la abeja apicultora más experta y entusiasta de BeeHappy. Tienes años de experiencia trabajando con colmenas y conoces todos los secretos de la apicultura.

PERSONALIDAD Y ESTILO:
• Eres alegre, conocedora y siempre positiva
• Usas "¡Bzzz!" al inicio o durante conversaciones
• Incluyes emojis relacionados con abejas, miel y flores: 🐝 🍯 🌻 🌸 🏠
• Hablas con pasión sobre la apicultura y el cuidado de las abejas

FORMATO DE RESPUESTA OBLIGATORIO:
• NUNCA uses markdown (sin **, *, #, -, \`\`\`)
• Escribe solo texto plano con emojis
• Estructura tu información de manera clara pero sin formato markdown
• Usa espacios y saltos de línea para organizar la información

CONOCIMIENTOS:
• Dominas todos los aspectos de la apicultura
• Conoces sobre salud de colmenas, producción de miel, comportamiento de abejas
• Puedes explicar procesos técnicos de forma sencilla y amigable
• Siempre buscas educar y ayudar a mejorar las prácticas apícolas`;

const SYSTEM_PROMPT_ESTADISTICAS = `${SYSTEM_PROMPT_BASE}

MANEJO DE ESTADÍSTICAS:
• Presenta los datos de forma clara y comprensible
• Relaciona las cifras con la salud de las colmenas y calidad de la miel
• Explica qué significan los números en términos prácticos para el apicultor
• Destaca tendencias importantes o datos que requieren atención

ESTRUCTURA OBLIGATORIA PARA ESTADÍSTICAS:
1. Saludo con "¡Bzzz!" y contexto breve
2. Presentación de datos principales con interpretación
3. Sección "CONCLUSIONES:" al final con 2-3 puntos clave sobre las implicaciones para la apicultura

Ejemplo de formato:
"¡Bzzz! Aquí tienes el resumen de nuestro panal 🐝

[Datos con interpretación apícola]

CONCLUSIONES:
• [Punto clave 1 sobre salud/producción]
• [Punto clave 2 sobre tendencias]
• [Recomendación práctica]"`;

app.post('/api/message', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
    }
    
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: '¡Bzzz! 🐝 Necesito que me digas qué quieres saber sobre nuestras colmenas o la producción de miel.',
      });
    }
    
    // Detectar si el mensaje es sobre estadísticas
    const esEstadistica = esConsultaEstadistica(message);
    
    // Determinar el prompt del sistema apropiado
    const systemPrompt = esEstadistica ? SYSTEM_PROMPT_ESTADISTICAS : SYSTEM_PROMPT_BASE;
    
    // Primera solicitud al modelo con function calling habilitado
    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        { role: 'user', content: message },
      ],
      functions,
      function_call: esEstadistica ? { name: 'combineEstadisticas' } : 'auto',
      temperature: 0.7, // Añadido para respuestas más naturales pero consistentes
    });
    
    const responseMessage = completion.choices[0].message;
    
    // Verificar si el modelo quiere invocar la función
    if (responseMessage.function_call && responseMessage.function_call.name === 'combineEstadisticas') {
      try {
        // Ejecutar la función combineEstadisticas
        const estadisticas = await combineEstadisticas();
        
        // Enviar el resultado de la función de vuelta al modelo para un resumen
        const followUpCompletion = await openai.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `${SYSTEM_PROMPT_ESTADISTICAS}

INSTRUCCIONES ESPECÍFICAS PARA ESTA RESPUESTA:
• Los datos que recibirás contienen estadísticas reales de las colmenas
• Interpreta cada métrica desde la perspectiva de un apicultor experto
• Identifica patrones, anomalías o datos que requieren atención especial
• Proporciona contexto práctico: ¿qué significan estos números para la salud de las abejas?
• Sugiere acciones concretas basadas en los datos cuando sea apropiado`
            },
            { role: 'user', content: message },
            {
              role: 'function',
              name: 'combineEstadisticas',
              content: JSON.stringify(estadisticas),
            },
          ],
          temperature: 0.6, // Ligeramente más conservador para datos técnicos
        });
        
        // Eliminar formato markdown de la respuesta
        let respuestaLimpia = eliminarMarkdown(followUpCompletion.choices[0].message.content);
              
        res.json({
          response: respuestaLimpia,
          data: estadisticas.data,
          status: 'success',
          timestamp: new Date().toISOString(),
          version: 'v1.1', // Actualizada versión
        });
      } catch (error) {
        console.error('Error al ejecutar combineEstadisticas:', error.message);
        res.status(500).json({
          error: '¡Bzzz! 🐝 Ups, hubo un problemita en el panal al obtener los datos. Las abejas están trabajando para solucionarlo. ¡Inténtalo de nuevo en un momento! 🍯',
        });
      }
    } else {
      // Respuesta directa del modelo sin function calling
      // Eliminar formato markdown de la respuesta
      let respuestaLimpia = eliminarMarkdown(responseMessage.content);
      
      res.json({
        response: respuestaLimpia,
        status: 'success',
        timestamp: new Date().toISOString(),
        version: 'v1.1',
      });
    }
  } catch (error) {
    console.error('Error:', error);
    
    // Mensaje de error más amigable y específico
    let errorMessage = '¡Bzzz! 🐝 Algo salió mal en el panal. ';
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage += 'No puedo conectarme con el servidor de datos. ';
    } else if (error.status === 429) {
      errorMessage += 'Las abejas están muy ocupadas ahora. ';
    } else if (error.status >= 500) {
      errorMessage += 'Hay un problema en nuestros sistemas. ';
    }
    
    errorMessage += '¡Inténtalo de nuevo en un momento! 🍯';
    
    res.status(500).json({
      error: errorMessage,
    });
  }
});

app.listen(port, () => {
  console.log(`🐝 Servidor Meli funcionando en http://localhost:${port}`);
});