// externs/getEstadistica.js - Con logging mejorado

const axios = require('axios');
require('dotenv').config();

const getEstadistica = async (tipo) => {
  try {
    const url = `${process.env.API_ESTADISTICA}/estadisticas/${tipo}`;
    const config = {
      headers: {
        Authorization: `Bearer ${process.env.TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BeeHappy-Meli/2.0'
      },
      timeout: 10000, // 10 segundos timeout
    };
    
    console.log(`🔄 Solicitando estadísticas de ${tipo}...`);
    console.log(`🌐 URL: ${url}`);
    
    const startTime = Date.now();
    const response = await axios.get(url, config);
    const endTime = Date.now();
    
    console.log(`✅ Estadísticas de ${tipo} obtenidas en ${endTime - startTime}ms`);
    console.log(`📊 Datos recibidos:`, {
      status: response.status,
      dataLength: response.data?.data?.length || 0,
      hasData: !!response.data?.data
    });
    
    return response.data.data;
    
  } catch (error) {
    console.error(`❌ Error al obtener estadísticas de ${tipo}:`, {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url
    });
    
    // Proporcionar mensajes de error más específicos
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Error al obtener estadísticas de ${tipo}: No se puede conectar al servidor de datos. Verifica que la API esté funcionando en ${process.env.API_ESTADISTICA}`);
    } else if (error.code === 'ENOTFOUND') {
      throw new Error(`Error al obtener estadísticas de ${tipo}: URL del servidor no encontrada. Verifica la variable API_ESTADISTICA: ${process.env.API_ESTADISTICA}`);
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new Error(`Error al obtener estadísticas de ${tipo}: Tiempo de espera agotado. El servidor está tardando demasiado en responder`);
    } else if (error.response?.status === 401) {
      throw new Error(`Error al obtener estadísticas de ${tipo}: Token de autenticación inválido o expirado`);
    } else if (error.response?.status === 403) {
      throw new Error(`Error al obtener estadísticas de ${tipo}: Sin permisos para acceder a este recurso`);
    } else if (error.response?.status === 404) {
      throw new Error(`Error al obtener estadísticas de ${tipo}: Endpoint no encontrado. Verifica la URL: ${error.config?.url}`);
    } else if (error.response?.status >= 500) {
      throw new Error(`Error al obtener estadísticas de ${tipo}: Error interno del servidor (${error.response.status})`);
    } else {
      throw new Error(`Error al obtener estadísticas de ${tipo}: ${error.message}`);
    }
  }
};

const combineEstadisticas = async () => {
  console.log('🐝 Iniciando combinación de estadísticas...');
  
  try {
    // Verificar variables de entorno requeridas
    if (!process.env.API_ESTADISTICA) {
      throw new Error('Variable de entorno API_ESTADISTICA no configurada');
    }
    
    if (!process.env.TOKEN) {
      throw new Error('Variable de entorno TOKEN no configurada');
    }
    
    console.log('📋 Configuración verificada, obteniendo datos...');
    
    const startTime = Date.now();
    
    // Obtener estadísticas en paralelo para mejor rendimiento
    const [dataDia, dataSemana] = await Promise.all([
      getEstadistica('dia'),
      getEstadistica('semana'),
    ]);
    
    const endTime = Date.now();
    
    console.log('📊 Datos obtenidos exitosamente:');
    console.log(`   - Datos del día: ${dataDia?.length || 0} registros`);
    console.log(`   - Datos de la semana: ${dataSemana?.length || 0} registros`);
    console.log(`   - Tiempo total: ${endTime - startTime}ms`);
    
    // Validar que los datos tienen el formato esperado
    if (!Array.isArray(dataDia)) {
      console.warn('⚠️  dataDia no es un array:', typeof dataDia);
    }
    
    if (!Array.isArray(dataSemana)) {
      console.warn('⚠️  dataSemana no es un array:', typeof dataSemana);
    }
    
    // Combinar los datos
    const combinedData = [
      ...(Array.isArray(dataDia) ? dataDia : []),
      ...(Array.isArray(dataSemana) ? dataSemana : [])
    ];
    
    const result = {
      data: combinedData,
      status: 'success',
      timestamp: new Date().toISOString(),
      version: 'v2.0',
      metadata: {
        dia_records: Array.isArray(dataDia) ? dataDia.length : 0,
        semana_records: Array.isArray(dataSemana) ? dataSemana.length : 0,
        total_records: combinedData.length,
        execution_time_ms: endTime - startTime
      }
    };
    
    console.log('🎉 Estadísticas combinadas exitosamente:', {
      total_records: result.data.length,
      status: result.status
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error al combinar estadísticas:', {
      message: error.message,
      stack: error.stack
    });
    
    // Re-throw con contexto adicional
    throw new Error(`Error al combinar estadísticas: ${error.message}`);
  }
};

// Función de prueba para verificar conectividad
const testConnection = async () => {
  console.log('🧪 Probando conexión con API de estadísticas...');
  
  try {
    if (!process.env.API_ESTADISTICA || !process.env.TOKEN) {
      throw new Error('Variables de entorno no configuradas');
    }
    
    // Probar endpoint base
    const response = await axios.get(`${process.env.API_ESTADISTICA}/health`, {
      headers: {
        Authorization: `Bearer ${process.env.TOKEN}`,
      },
      timeout: 5000
    });
    
    console.log('✅ Conexión exitosa:', response.status);
    return true;
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    return false;
  }
};

module.exports = { 
  combineEstadisticas,
  getEstadistica,
  testConnection
};