const axios = require('axios');
require('dotenv').config();

const getEstadistica = async (tipo) => {
  try {
    const url = `${process.env.API_ESTADISTICA}/estadisticas/${tipo}`;
    const config = {
      headers: {
        Authorization: `Bearer ${process.env.TOKEN}`,
      },
    };
    const response = await axios.get(url, config);
    return response.data.data;
  } catch (error) {
    throw new Error(`Error al obtener estadísticas de ${tipo}: ${error.message}`);
  }
};

const combineEstadisticas = async () => {
  try {
    const [dataDia, dataSemana] = await Promise.all([
      getEstadistica('dia'),
      getEstadistica('semana'),
    ]);
    return {
      data: [...dataDia, ...dataSemana],
      status: 'success',
      timestamp: new Date().toISOString(),
      version: 'v1.0',
    };
  } catch (error) {
    throw new Error(`Error al combinar estadísticas: ${error.message}`);
  }
};

module.exports = { combineEstadisticas };