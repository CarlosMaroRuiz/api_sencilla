require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { combineEstadisticas } = require('./externs/getEstadistica');
const { tools } = require('./externs/functions'); // ✅ Importar tools

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

// Función para detectar si el mensaje es sobre estadísticas (MEJORADA)
function esConsultaEstadistica(mensaje) {
  const palabrasClave = [
    'estadística', 'estadisticas', 'producción', 'produccion', 'datos', 
    'rendimiento', 'números', 'numeros', 'reporte', 'informe', 'métricas', 
    'metricas', 'cifras', 'cantidad', 'cuánto', 'cuanto', 'porcentaje', 
    'promedio', 'total', 'resumen', 'análisis', 'analisis', 'registros',
    'mostrar', 'muestra', 'dame', 'ver', 'consultar', 'obtener', 'panal'
  ];
  
  const mensajeLower = mensaje.toLowerCase();
  const esEstadistica = palabrasClave.some(palabra => mensajeLower.includes(palabra));
  
  // DEBUG: Log para ver si está detectando correctamente
  console.log(`🐛 DEBUG - Mensaje: "${mensaje}"`);
  console.log(`🐛 DEBUG - Es consulta estadística: ${esEstadistica}`);
  
  return esEstadistica;
}

// Función para eliminar el formato markdown
function eliminarMarkdown(texto) {
  if (!texto) return '';
  
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
• Siempre buscas educar y ayudar a mejorar las prácticas apícolas

IMPORTANTE: Si el usuario pregunta sobre estadísticas, datos, reportes, métricas o información numérica de las colmenas, DEBES usar la función combineEstadisticas disponible.`;

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
• [Recomendación práctica]"

OBLIGATORIO: Para responder esta consulta sobre estadísticas, DEBES usar la función combineEstadisticas.`;

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
    
    console.log(`🐛 DEBUG - Usando prompt de estadísticas: ${esEstadistica}`);
    console.log(`🐛 DEBUG - Tools disponibles:`, tools?.length || 0);
    
    // Preparar parámetros para OpenAI con la nueva API de Tools
    const completionParams = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
    };

    // ✅ NUEVA API: Agregar tools y tool_choice
    if (tools && tools.length > 0) {
      completionParams.tools = tools;
      
      // Si detectamos que es estadística, forzamos el uso de la función
      if (esEstadistica) {
        completionParams.tool_choice = {
          type: "function",
          function: { name: "combineEstadisticas" }
        };
        console.log(`🐛 DEBUG - Forzando tool_choice: combineEstadisticas`);
      } else {
        completionParams.tool_choice = 'auto';
      }
    }
    
    console.log(`🐛 DEBUG - Parámetros de completion:`, {
      model: completionParams.model,
      has_tools: !!completionParams.tools,
      tools_count: completionParams.tools?.length || 0,
      tool_choice: completionParams.tool_choice
    });
    
    // Primera solicitud al modelo con tool calling habilitado
    const completion = await openai.chat.completions.create(completionParams);
    
    const responseMessage = completion.choices[0].message;
    
    console.log(`🐛 DEBUG - Respuesta del modelo:`, {
      has_tool_calls: !!responseMessage.tool_calls,
      tool_calls_count: responseMessage.tool_calls?.length || 0,
      content_preview: responseMessage.content?.substring(0, 100) || 'none',
      finish_reason: completion.choices[0].finish_reason
    });
    
    // ✅ NUEVA API: Verificar tool_calls en lugar de function_call
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      
      console.log(`🐝 INFO - Tool call detectado:`, {
        name: toolCall.function.name,
        id: toolCall.id,
        arguments: toolCall.function.arguments
      });
      
      if (toolCall.function.name === 'combineEstadisticas') {
        console.log(`🐝 INFO - Ejecutando función combineEstadisticas...`);
        
        try {
          // Ejecutar la función combineEstadisticas
          const estadisticas = await combineEstadisticas();
          console.log(`🐝 INFO - Estadísticas obtenidas exitosamente:`, {
            dataCount: estadisticas.data?.length || 0,
            status: estadisticas.status
          });
          
          // ✅ NUEVA API: Enviar el resultado con el formato correcto
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
              responseMessage, // ✅ NUEVO: Incluir el mensaje original con tool_calls
              {
                role: 'tool', // ✅ NUEVO: rol 'tool' en lugar de 'function'
                tool_call_id: toolCall.id, // ✅ NUEVO: ID del tool call requerido
                name: toolCall.function.name,
                content: JSON.stringify(estadisticas),
              },
            ],
            temperature: 0.6,
          });
          
          // Eliminar formato markdown de la respuesta
          let respuestaLimpia = eliminarMarkdown(followUpCompletion.choices[0].message.content);
                
          res.json({
            response: respuestaLimpia,
            data: estadisticas.data,
            status: 'success',
            timestamp: new Date().toISOString(),
            version: 'v2.0', // Nueva versión con Tools API
            debug: {
              tool_used: true,
              tool_name: toolCall.function.name,
              data_count: estadisticas.data?.length || 0
            }
          });
          
        } catch (error) {
          console.error('❌ ERROR al ejecutar combineEstadisticas:', error);
          console.error('❌ Stack trace:', error.stack);
          
          // Respuesta de error más específica
          let errorMsg = '¡Bzzz! 🐝 Ups, hubo un problemita en el panal al obtener los datos. ';
          
          if (error.message.includes('API_ESTADISTICA')) {
            errorMsg += 'No puedo conectarme con el servidor de estadísticas. Verifica que la variable API_ESTADISTICA esté configurada correctamente.';
          } else if (error.message.includes('TOKEN')) {
            errorMsg += 'Hay un problema con el token de autenticación. Verifica que la variable TOKEN esté configurada.';
          } else if (error.message.includes('ECONNREFUSED')) {
            errorMsg += 'No puedo conectarme con el servidor de datos. Verifica que esté funcionando.';
          } else if (error.code === 'ENOTFOUND') {
            errorMsg += 'No encuentro el servidor de datos. Verifica la URL en API_ESTADISTICA.';
          } else {
            errorMsg += `Error específico: ${error.message}`;
          }
          
          errorMsg += ' 🍯';
          
          res.status(500).json({
            error: errorMsg,
            debug: process.env.NODE_ENV === 'development' ? {
              error_message: error.message,
              error_stack: error.stack
            } : undefined
          });
        }
      } else {
        console.log(`🐛 DEBUG - Tool call no reconocido: ${toolCall.function.name}`);
        
        res.status(400).json({
          error: '¡Bzzz! 🐝 La función solicitada no está disponible en el panal.',
        });
      }
    } else {
      console.log(`🐛 DEBUG - No se ejecutó tool_call, enviando respuesta directa`);
      
      // Respuesta directa del modelo sin tool calling
      let respuestaLimpia = eliminarMarkdown(responseMessage.content);
      
      res.json({
        response: respuestaLimpia,
        status: 'success',
        timestamp: new Date().toISOString(),
        version: 'v2.0',
        debug: {
          tool_used: false,
          direct_response: true
        }
      });
    }
  } catch (error) {
    console.error('❌ ERROR general:', error);
    console.error('❌ Stack trace:', error.stack);
    
    // Mensaje de error más amigable y específico
    let errorMessage = '¡Bzzz! 🐝 Algo salió mal en el panal. ';
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage += 'No puedo conectarme con el servidor de datos. ';
    } else if (error.status === 429) {
      errorMessage += 'Las abejas están muy ocupadas ahora (límite de uso alcanzado). ';
    } else if (error.status >= 500) {
      errorMessage += 'Hay un problema en nuestros sistemas. ';
    } else if (error.message.includes('API key')) {
      errorMessage += 'Hay un problema con la configuración de la API. ';
    } else if (error.message.includes('model')) {
      errorMessage += 'Hay un problema con el modelo de IA. ';
    }
    
    errorMessage += '¡Inténtalo de nuevo en un momento! 🍯';
    
    res.status(500).json({
      error: errorMessage,
      debug: process.env.NODE_ENV === 'development' ? {
        error_message: error.message,
        error_code: error.code,
        error_status: error.status
      } : undefined
    });
  }
});

// Endpoint de debug para verificar configuración
app.get('/debug/config', (req, res) => {
  res.json({
    api_configured: !!process.env.API_ESTADISTICA,
    token_configured: !!process.env.TOKEN,
    deepseek_configured: !!process.env.DEEPSEEK_API_KEY,
    tools_available: tools?.length || 0,
    tools_list: tools?.map(t => t.function.name) || [],
    api_version: 'v2.0_tools',
    node_env: process.env.NODE_ENV || 'development'
  });
});

// Endpoint de prueba para la función directamente
app.get('/debug/test-estadisticas', async (req, res) => {
  try {
    console.log('🧪 Probando función combineEstadisticas directamente...');
    const startTime = Date.now();
    const result = await combineEstadisticas();
    const endTime = Date.now();
    
    res.json({
      success: true,
      result: result,
      execution_time: `${endTime - startTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error en prueba directa:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para probar detección de estadísticas
app.post('/debug/test-detection', (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }
  
  const isStatistic = esConsultaEstadistica(message);
  
  res.json({
    message: message,
    detected_as_statistic: isStatistic,
    would_use_tool: isStatistic,
    timestamp: new Date().toISOString()
  });
});

// Endpoint de salud del servidor
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: 'v2.0',
    api_type: 'tools',
    uptime: process.uptime()
  });
});

app.listen(port, () => {
  console.log(`🐝 Servidor Meli funcionando en http://localhost:${port}`);
  console.log(`🔧 API Version: v2.0 (Tools API)`);
  console.log(`🐛 DEBUG activado - Endpoints disponibles:`);
  console.log(`   - POST /api/message (principal)`);
  console.log(`   - GET /debug/config (verificar configuración)`);
  console.log(`   - GET /debug/test-estadisticas (probar función directa)`);
  console.log(`   - POST /debug/test-detection (probar detección)`);
  console.log(`   - GET /health (estado del servidor)`);
  console.log(`🛠  Tools configuradas: ${tools?.length || 0}`);
  
  // Verificar configuración al inicio
  const missingVars = [];
  if (!process.env.DEEPSEEK_API_KEY) missingVars.push('DEEPSEEK_API_KEY');
  if (!process.env.API_ESTADISTICA) missingVars.push('API_ESTADISTICA');
  if (!process.env.TOKEN) missingVars.push('TOKEN');
  
  if (missingVars.length > 0) {
    console.log(`⚠️  Variables de entorno faltantes: ${missingVars.join(', ')}`);
  } else {
    console.log(`✅ Todas las variables de entorno configuradas`);
  }
});