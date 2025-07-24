// externs/functions.js - API Tools actualizada

const tools = [
  {
    type: "function", // ✅ REQUERIDO en la nueva API
    function: {
      name: 'combineEstadisticas',
      description: 'Obtiene y combina estadísticas diarias y semanales de las colmenas de BeeHappy. Proporciona datos sobre producción de miel, salud de las abejas, y métricas importantes para el manejo apícola.',
      parameters: {
        type: 'object',
        properties: {
          // No necesita parámetros ya que obtiene datos predefinidos
        },
        required: [],
      },
    },
  },
];

// Función de validación para verificar que las tools están bien formadas
function validateTools() {
  for (const tool of tools) {
    if (!tool.type || tool.type !== 'function') {
      throw new Error(`Tool ${tool.function?.name || 'unknown'} debe tener type: "function"`);
    }
    
    if (!tool.function) {
      throw new Error('Tool debe tener una propiedad "function"');
    }
    
    if (!tool.function.name) {
      throw new Error('Tool function debe tener un "name"');
    }
    
    if (!tool.function.description) {
      throw new Error(`Tool function "${tool.function.name}" debe tener una "description"`);
    }
    
    if (!tool.function.parameters || typeof tool.function.parameters !== 'object') {
      throw new Error(`Tool function "${tool.function.name}" debe tener "parameters" object`);
    }
  }
  
  return true;
}

// Validar al cargar el módulo
try {
  validateTools();
  console.log(`✅ Tools validadas correctamente: ${tools.length} herramientas disponibles`);
} catch (error) {
  console.error('❌ Error en validación de tools:', error.message);
  throw error;
}

module.exports = { 
  tools,
  validateTools 
};