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

// ✅ NUEVA FUNCIÓN: Detectar diferentes tipos de consultas
function detectarTipoConsulta(mensaje) {
  const mensajeLower = mensaje.toLowerCase();
  
  const tipos = {
    estadisticas: {
      palabras: [
        'estadística', 'estadisticas', 'producción', 'produccion', 'datos', 
        'rendimiento', 'números', 'numeros', 'reporte', 'informe', 'métricas', 
        'metricas', 'cifras', 'cantidad', 'cuánto', 'cuanto', 'porcentaje', 
        'promedio', 'total', 'resumen', 'análisis', 'analisis', 'registros',
        'mostrar', 'muestra', 'dame', 'ver', 'consultar', 'obtener'
      ],
      requiere_funcion: true
    },
    recomendaciones: {
      palabras: [
        'recomendación', 'recomendaciones', 'recomienda', 'recomiendas', 
        'sugieres', 'sugerencia', 'sugerencias', 'consejo', 'consejos',
        'qué debo', 'que debo', 'cómo puedo', 'como puedo', 'mejor manera',
        'ayuda', 'ayúdame', 'ayudame', 'orientación', 'orientacion'
      ],
      requiere_funcion: false
    },
    problemas: {
      palabras: [
        'problema', 'problemas', 'enfermedad', 'enfermedades', 'plaga', 'plagas',
        'varroa', 'nosema', 'loque', 'polilla', 'hormiga', 'hormigas',
        'mueren', 'muertas', 'débil', 'debil', 'débiles', 'debiles',
        'no produce', 'baja producción', 'baja produccion', 'agresivas',
        'pican', 'atacan', 'mal olor', 'huele mal', 'qué pasa', 'que pasa'
      ],
      requiere_funcion: false
    },
    cuidados: {
      palabras: [
        'cuidado', 'cuidados', 'mantenimiento', 'revisión', 'revision',
        'inspección', 'inspeccion', 'alimentación', 'alimentacion',
        'jarabe', 'polen', 'agua', 'bebedero', 'ventilación', 'ventilacion',
        'limpieza', 'desinfección', 'desinfeccion', 'temporada', 'estación', 'estacion'
      ],
      requiere_funcion: false
    },
    equipos: {
      palabras: [
        'equipo', 'equipos', 'herramienta', 'herramientas', 'colmena', 'colmenas',
        'cuadro', 'cuadros', 'marco', 'marcos', 'alzas', 'alza', 'ahumador',
        'extractor', 'centrifuga', 'overol', 'velo', 'guantes', 'espátula',
        'cepillo', 'material', 'materiales', 'comprar', 'necesito'
      ],
      requiere_funcion: false
    },
    temporadas: {
      palabras: [
        'primavera', 'verano', 'otoño', 'otono', 'invierno', 'temporada',
        'estación', 'estacion', 'floración', 'floracion', 'mielada',
        'cosecha', 'época', 'epoca', 'mes', 'cuando', 'cuándo'
      ],
      requiere_funcion: false
    },
    general: {
      palabras: ['hola', 'buenos', 'buenas', 'saludos', 'gracias', 'ayuda'],
      requiere_funcion: false
    }
  };
  
  let tipoDetectado = 'general';
  let maxCoincidencias = 0;
  let requiereFuncion = false;
  
  // Buscar el tipo con más coincidencias
  for (const [tipo, config] of Object.entries(tipos)) {
    const coincidencias = config.palabras.filter(palabra => 
      mensajeLower.includes(palabra)
    ).length;
    
    if (coincidencias > maxCoincidencias) {
      maxCoincidencias = coincidencias;
      tipoDetectado = tipo;
      requiereFuncion = config.requiere_funcion;
    }
  }
  
  console.log(`🐛 DEBUG - Mensaje: "${mensaje}"`);
  console.log(`🐛 DEBUG - Tipo detectado: ${tipoDetectado} (${maxCoincidencias} coincidencias)`);
  console.log(`🐛 DEBUG - Requiere función: ${requiereFuncion}`);
  
  return { tipo: tipoDetectado, requiere_funcion: requiereFuncion, coincidencias: maxCoincidencias };
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

// ✅ PROMPTS MEJORADOS Y EXPANDIDOS
const SYSTEM_PROMPT_BASE = `Eres Meli 🐝, la abeja apicultora más experta y entusiasta de BeeHappy. Tienes años de experiencia trabajando con colmenas y conoces todos los secretos de la apicultura.

PERSONALIDAD Y ESTILO:
• Eres alegre, conocedora y siempre positiva
• Usas "¡Bzzz!" al inicio o durante conversaciones
• Incluyes emojis relacionados con abejas, miel y flores: 🐝 🍯 🌻 🌸 🏠 🔧 ⚠️ 💡
• Hablas con pasión sobre la apicultura y el cuidado de las abejas
• Eres práctica y das consejos específicos y accionables

FORMATO DE RESPUESTA OBLIGATORIO:
• NUNCA uses markdown (sin **, *, #, -, \`\`\`)
• Escribe solo texto plano con emojis
• Estructura tu información de manera clara pero sin formato markdown
• Usa espacios y saltos de línea para organizar la información

ÁREAS DE EXPERTISE:
• Salud y enfermedades de colmenas (Varroa, Nosema, Loque, etc.)
• Manejo estacional y cuidados específicos por temporada
• Equipos y herramientas apícolas
• Técnicas de inspección y mantenimiento
• Alimentación y nutrición de abejas
• Producción y extracción de miel
• Solución de problemas comunes
• Recomendaciones preventivas

ESTILO DE RESPUESTA SEGÚN EL TEMA:
• Para problemas: Diagnóstico claro + soluciones paso a paso
• Para recomendaciones: Consejos prácticos con justificación
• Para equipos: Especificaciones + cuándo y cómo usar
• Para temporadas: Calendario de actividades + preparativos
• Para principiantes: Explicaciones simples + tips básicos
• Para expertos: Detalles técnicos + técnicas avanzadas`;

const SYSTEM_PROMPT_ESTADISTICAS = `${SYSTEM_PROMPT_BASE}

ESPECIALIZACIÓN EN DATOS Y ESTADÍSTICAS:
• Interpreta datos de producción, salud de colmenas y métricas apícolas
• Relaciona las cifras con la salud de las colmenas y calidad de la miel
• Identifica tendencias, patrones y anomalías en los datos
• Convierte números en insights prácticos para el apicultor
• Sugiere acciones correctivas basadas en análisis de datos

ESTRUCTURA OBLIGATORIA PARA ESTADÍSTICAS:
1. Saludo con "¡Bzzz!" y contexto de los datos
2. Análisis principal con interpretación apícola
3. Identificación de patrones importantes
4. Sección "CONCLUSIONES CLAVE:" con 2-3 puntos sobre:
   - Estado general del apiario
   - Áreas que requieren atención
   - Recomendaciones específicas basadas en datos

OBLIGATORIO: Para consultas sobre estadísticas, datos o métricas, DEBES usar la función combineEstadisticas.`;

// ✅ PROMPTS ESPECIALIZADOS POR TIPO DE CONSULTA
const PROMPTS_ESPECIALIZADOS = {
  recomendaciones: `${SYSTEM_PROMPT_BASE}

ESPECIALIZACIÓN EN RECOMENDACIONES:
• Proporciona consejos prácticos y específicos
• Considera la experiencia del usuario (principiante/intermedio/avanzado)
• Incluye cronogramas y calendarios cuando sea apropiado
• Explica el "por qué" detrás de cada recomendación
• Ofrece alternativas según recursos disponibles

ESTRUCTURA PARA RECOMENDACIONES:
1. Saludo personalizado con "¡Bzzz!"
2. Recomendaciones principales numeradas claramente
3. Explicación del beneficio de cada recomendación
4. Tips adicionales o consideraciones especiales
5. "RECUERDA:" con punto clave final`,

  problemas: `${SYSTEM_PROMPT_BASE}

ESPECIALIZACIÓN EN DIAGNÓSTICO Y SOLUCIÓN DE PROBLEMAS:
• Diagnóstica problemas basándote en síntomas descritos
• Ofrece soluciones paso a paso y prioriza por urgencia
• Incluye medidas preventivas para evitar recurrencia
• Diferencia entre problemas menores y emergencias
• Sugiere cuándo buscar ayuda profesional

ESTRUCTURA PARA PROBLEMAS:
1. Saludo empático con "¡Bzzz!"
2. Diagnóstico probable basado en síntomas
3. Plan de acción inmediato (URGENTE si aplica)
4. Pasos de tratamiento detallados
5. "PREVENCIÓN:" con medidas para evitar el problema`,

  cuidados: `${SYSTEM_PROMPT_BASE}

ESPECIALIZACIÓN EN CUIDADOS Y MANTENIMIENTO:
• Detalla rutinas de cuidado por temporada
• Explica técnicas de inspección y mantenimiento
• Incluye cronogramas y frecuencias recomendadas
• Aborda alimentación, limpieza y preparación estacional
• Considera diferentes tipos de colmenas y equipos

ESTRUCTURA PARA CUIDADOS:
1. Saludo motivacional con "¡Bzzz!"
2. Cuidados esenciales por prioridad
3. Cronograma o frecuencia recomendada
4. Técnicas específicas paso a paso
5. "IMPORTANTE:" con recordatorios críticos`,

  equipos: `${SYSTEM_PROMPT_BASE}

ESPECIALIZACIÓN EN EQUIPOS Y HERRAMIENTAS:
• Recomienda equipos según necesidades y presupuesto
• Explica uso correcto y mantenimiento de herramientas
• Compara opciones disponibles en el mercado
• Incluye tips de seguridad y durabilidad
• Sugiere alternativas caseras cuando sea apropiado

ESTRUCTURA PARA EQUIPOS:
1. Saludo técnico con "¡Bzzz!"
2. Equipos recomendados por categoría/prioridad
3. Especificaciones y características importantes
4. Consejos de uso y mantenimiento
5. "INVERSIÓN INTELIGENTE:" con tips de compra`,

  temporadas: `${SYSTEM_PROMPT_BASE}

ESPECIALIZACIÓN EN MANEJO ESTACIONAL:
• Proporciona calendarios apícolas detallados
• Explica cambios en comportamiento de abejas por temporada
• Incluye preparativos específicos para cada estación
• Considera variaciones climáticas regionales
• Planifica actividades con anticipación apropiada

ESTRUCTURA PARA TEMPORADAS:
1. Saludo estacional con "¡Bzzz!"
2. Características de la temporada actual/consultada
3. Actividades prioritarias del período
4. Preparativos para la siguiente temporada
5. "CALENDARIO:" con fechas clave a recordar`
};

app.post('/api/message', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
    }
    
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: '¡Bzzz! 🐝 Necesito que me digas qué quieres saber sobre nuestras colmenas. Puedo ayudarte con estadísticas, recomendaciones, problemas, cuidados, equipos o cualquier duda apícola.',
      });
    }
    
    // ✅ NUEVA LÓGICA: Detectar tipo de consulta
    const consultaInfo = detectarTipoConsulta(message);
    const { tipo, requiere_funcion } = consultaInfo;
    
    // Seleccionar el prompt apropiado
    let systemPrompt;
    if (requiere_funcion && tipo === 'estadisticas') {
      systemPrompt = SYSTEM_PROMPT_ESTADISTICAS;
    } else if (PROMPTS_ESPECIALIZADOS[tipo]) {
      systemPrompt = PROMPTS_ESPECIALIZADOS[tipo];
    } else {
      systemPrompt = SYSTEM_PROMPT_BASE;
    }
    
    console.log(`🐛 DEBUG - Tipo de consulta: ${tipo}`);
    console.log(`🐛 DEBUG - Requiere función: ${requiere_funcion}`);
    console.log(`🐛 DEBUG - Prompt seleccionado: ${tipo === 'estadisticas' && requiere_funcion ? 'ESTADISTICAS' : tipo.toUpperCase() || 'BASE'}`);
    
    // Preparar parámetros para OpenAI
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

    // ✅ Agregar tools solo si es necesario
    if (tools && tools.length > 0 && requiere_funcion) {
      completionParams.tools = tools;
      
      if (tipo === 'estadisticas') {
        completionParams.tool_choice = {
          type: "function",
          function: { name: "combineEstadisticas" }
        };
        console.log(`🐛 DEBUG - Forzando tool_choice: combineEstadisticas`);
      } else {
        completionParams.tool_choice = 'auto';
      }
    }
    
    console.log(`🐛 DEBUG - Configuración final:`, {
      tipo_consulta: tipo,
      usar_tools: !!completionParams.tools,
      tool_choice: completionParams.tool_choice || 'none'
    });
    
    // Primera solicitud al modelo
    const completion = await openai.chat.completions.create(completionParams);
    const responseMessage = completion.choices[0].message;
    
    console.log(`🐛 DEBUG - Respuesta del modelo:`, {
      has_tool_calls: !!responseMessage.tool_calls,
      tool_calls_count: responseMessage.tool_calls?.length || 0,
      finish_reason: completion.choices[0].finish_reason
    });
    
    // Procesar tool calls si existen
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      
      console.log(`🐝 INFO - Tool call ejecutado:`, {
        name: toolCall.function.name,
        id: toolCall.id
      });
      
      if (toolCall.function.name === 'combineEstadisticas') {
        try {
          console.log(`🐝 INFO - Obteniendo estadísticas...`);
          const estadisticas = await combineEstadisticas();
          
          // Segunda solicitud con los datos
          const followUpCompletion = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: `${SYSTEM_PROMPT_ESTADISTICAS}

CONTEXTO ADICIONAL PARA ESTA RESPUESTA:
• El usuario hizo una consulta de tipo: ${tipo}
• Los datos que recibirás son estadísticas reales y actualizadas
• Enfócate en proporcionar insights valiosos y accionables
• Relaciona siempre los números con la salud y productividad del apiario`
              },
              { role: 'user', content: message },
              responseMessage,
              {
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify(estadisticas),
              },
            ],
            temperature: 0.6,
          });
          
          let respuestaLimpia = eliminarMarkdown(followUpCompletion.choices[0].message.content);
                
          res.json({
            response: respuestaLimpia,
            data: estadisticas.data,
            status: 'success',
            tipo_consulta: tipo,
            timestamp: new Date().toISOString(),
            version: 'v2.1_enhanced',
            debug: {
              tool_used: true,
              tool_name: toolCall.function.name,
              query_type: tipo,
              data_count: estadisticas.data?.length || 0
            }
          });
          
        } catch (error) {
          console.error('❌ ERROR al ejecutar combineEstadisticas:', error);
          
          let errorMsg = `¡Bzzz! 🐝 Ups, hubo un problemita en el panal al obtener los datos de ${tipo}. `;
          
          if (error.message.includes('API_ESTADISTICA')) {
            errorMsg += 'El servidor de estadísticas no responde. 🔧';
          } else if (error.message.includes('TOKEN')) {
            errorMsg += 'Problema de autenticación con el servidor. 🔑';
          } else {
            errorMsg += `Error: ${error.message} 🍯`;
          }
          
          res.status(500).json({
            error: errorMsg,
            tipo_consulta: tipo,
            debug: process.env.NODE_ENV === 'development' ? {
              error_message: error.message,
              query_type: tipo
            } : undefined
          });
        }
      }
    } else {
      // Respuesta directa sin tool calling
      let respuestaLimpia = eliminarMarkdown(responseMessage.content);
      
      res.json({
        response: respuestaLimpia,
        status: 'success',
        tipo_consulta: tipo,
        timestamp: new Date().toISOString(),
        version: 'v2.1_enhanced',
        debug: {
          tool_used: false,
          query_type: tipo,
          direct_response: true
        }
      });
    }
  } catch (error) {
    console.error('❌ ERROR general:', error);
    
    let errorMessage = '¡Bzzz! 🐝 Algo salió mal en el panal. ';
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage += 'No puedo conectarme con los sistemas. 🔌';
    } else if (error.status === 429) {
      errorMessage += 'Las abejas están muy ocupadas ahora. ⏰';
    } else if (error.status >= 500) {
      errorMessage += 'Hay un problema técnico en el colmenar. 🔧';
    } else {
      errorMessage += 'Error técnico inesperado. 🐛';
    }
    
    errorMessage += ' ¡Inténtalo de nuevo en un momento! 🍯';
    
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

// ✅ ENDPOINTS DE DEBUG MEJORADOS
app.get('/debug/config', (req, res) => {
  res.json({
    api_configured: !!process.env.API_ESTADISTICA,
    token_configured: !!process.env.TOKEN,
    deepseek_configured: !!process.env.DEEPSEEK_API_KEY,
    tools_available: tools?.length || 0,
    tools_list: tools?.map(t => t.function.name) || [],
    prompts_available: Object.keys(PROMPTS_ESPECIALIZADOS).length + 2, // +2 por base y estadisticas
    api_version: 'v2.1_enhanced',
    node_env: process.env.NODE_ENV || 'development'
  });
});

app.post('/debug/test-detection', (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }
  
  const consultaInfo = detectarTipoConsulta(message);
  
  res.json({
    message: message,
    detected_type: consultaInfo.tipo,
    requires_function: consultaInfo.requiere_funcion,
    word_matches: consultaInfo.coincidencias,
    would_use_specialized_prompt: !!PROMPTS_ESPECIALIZADOS[consultaInfo.tipo],
    timestamp: new Date().toISOString()
  });
});

// Endpoint para probar diferentes tipos de consulta
app.get('/debug/query-types', (req, res) => {
  const tiposEjemplo = {
    estadisticas: ["muéstrame las estadísticas", "datos de producción", "cuánto produjeron las colmenas"],
    recomendaciones: ["qué me recomiendas", "dame consejos", "cómo puedo mejorar"],
    problemas: ["mis abejas están muriendo", "problema con varroa", "colmena débil"],
    cuidados: ["cómo cuidar las colmenas", "mantenimiento de primavera", "alimentación"],
    equipos: ["qué equipos necesito", "mejor ahumador", "herramientas básicas"],
    temporadas: ["cuidados de invierno", "preparación primavera", "cosecha verano"],
    general: ["hola", "buenos días", "gracias por tu ayuda"]
  };
  
  res.json({
    available_query_types: Object.keys(tiposEjemplo),
    examples: tiposEjemplo,
    specialized_prompts: Object.keys(PROMPTS_ESPECIALIZADOS),
    total_detection_words: Object.values(PROMPTS_ESPECIALIZADOS).length * 15, // Estimado
    version: 'v2.1_enhanced'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: 'v2.1_enhanced',
    api_type: 'multi_domain_tools',
    query_types_supported: ['estadisticas', 'recomendaciones', 'problemas', 'cuidados', 'equipos', 'temporadas', 'general'],
    uptime: process.uptime()
  });
});

app.listen(port, () => {
  console.log(`🐝 Servidor Meli MEJORADO funcionando en http://localhost:${port}`);
  console.log(`🔧 API Version: v2.1 Enhanced (Multi-Domain)`);
  console.log(`🎯 Tipos de consulta soportados:`);
  console.log(`   - Estadísticas (con función)`);
  console.log(`   - Recomendaciones`);
  console.log(`   - Problemas y diagnósticos`);
  console.log(`   - Cuidados y mantenimiento`);
  console.log(`   - Equipos y herramientas`);
  console.log(`   - Manejo estacional`);
  console.log(`   - Consultas generales`);
  console.log(`🐛 DEBUG - Endpoints disponibles:`);
  console.log(`   - POST /api/message (principal mejorado)`);
  console.log(`   - GET /debug/config (configuración)`);
  console.log(`   - POST /debug/test-detection (probar detección)`);
  console.log(`   - GET /debug/query-types (tipos disponibles)`);
  console.log(`   - GET /health (estado del servidor)`);
  console.log(`🛠  Prompts especializados: ${Object.keys(PROMPTS_ESPECIALIZADOS).length + 2}`);
  
  // Verificar configuración
  const missingVars = [];
  if (!process.env.DEEPSEEK_API_KEY) missingVars.push('DEEPSEEK_API_KEY');
  if (!process.env.API_ESTADISTICA) missingVars.push('API_ESTADISTICA');
  if (!process.env.TOKEN) missingVars.push('TOKEN');
  
  if (missingVars.length > 0) {
    console.log(`⚠️  Variables faltantes: ${missingVars.join(', ')}`);
  } else {
    console.log(`✅ Sistema completamente configurado - Meli lista para todo tipo de consultas apícolas`);
  }
});