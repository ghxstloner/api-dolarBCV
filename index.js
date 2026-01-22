const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const cron = require('node-cron');
const mysql = require('mysql2/promise');
require('dotenv').config();

// --- CONFIGURACIÓN ---
const app = express();
const PORT = 3009;

app.use(cors());

// Agente HTTPS para BCV
const agent = new https.Agent({ rejectUnauthorized: false });

// --- LÓGICA CENTRAL (SCRAPING) ---
// Esta función sirve tanto para la API como para el Cron
async function obtenerPrecioDolar() {
  try {
    const response = await axios.get('https://www.bcv.org.ve/', { httpsAgent: agent });
    const $ = cheerio.load(response.data);
    const dolarElement = $('#dolar .col-sm-6.col-xs-6.centrado strong');
    const dolarValueRaw = dolarElement.text().trim();

    if (dolarValueRaw) {
      const dolarValueProcessed = dolarValueRaw.replace(/\./g, '').replace(',', '.');
      const dolarValue = parseFloat(dolarValueProcessed);
      return { success: true, dolar: dolarValue };
    } else {
      console.warn('Scraping: No se encontró el elemento HTML del dólar.');
      return { success: false, dolar: 0 };
    }
  } catch (error) {
    console.error('Error en scraping BCV:', error.message);
    return { success: false, dolar: -1 };
  }
}

// --- SERVIDOR HTTP (API) ---
app.get('/api/dolar', async (req, res) => {
  const data = await obtenerPrecioDolar();
  res.json(data);
});

// --- CRON JOB (AUTO GUARDADO) ---
async function ejecutarAutoGuardado() {
  console.log('\n--- Iniciando proceso de Auto-Guardado (Cron) ---');
  
  // 1. Obtener precio (Llamada interna directa, sin fetch)
  const data = await obtenerPrecioDolar();
  
  if (!data.success || data.dolar <= 0) {
    console.error('Abortando guardado: No se pudo obtener una tasa válida.');
    return;
  }

  const dolar = data.dolar;
  console.log(`Tasa a guardar: ${dolar}`);

  const dbConfig = {
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASS,
    database: process.env.DB_CONF,
    port: 3306,
  };

  // 2. Lógica de Base de Datos
  let connectionMain;
  try {
    // A. Obtener lista de bases de datos
    connectionMain = await mysql.createConnection(dbConfig);
    const [rows] = await connectionMain.execute("SELECT bd FROM nomempresa");
    const databaseNames = rows.map((row) => row.bd);
    await connectionMain.end();

    // B. Insertar en cada base de datos
    for (const dbName of databaseNames) {
      const targetConfig = { ...dbConfig, database: dbName };
      let connectionTarget;
      try {
        connectionTarget = await mysql.createConnection(targetConfig);
        let query = `INSERT INTO tasas_cambio(divisa, fecha, tasa, tasa_inversa, monedabase) VALUES (15, NOW(), 0, ${dolar}, 14);`;
        await connectionTarget.execute(query);
        console.log(`> OK: ${dbName}`);
      } catch (err) {
        console.error(`> ERROR en ${dbName}: ${err.message}`);
      } finally {
        if (connectionTarget) await connectionTarget.end();
      }
    }
    console.log('--- Proceso de Cron Finalizado Exitosamente ---\n');

  } catch (error) {
    console.error('Error general en Cron Job:', error.message);
    if (connectionMain) await connectionMain.end();
  }
}

// Programar Cron: 00:00 Hora Caracas
cron.schedule('0 0 * * *', () => {
  ejecutarAutoGuardado();
}, {
  timezone: 'America/Caracas',
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` SISTEMA UNIFICADO DE TASAS BCV INICIADO `);
  console.log(` API: http://localhost:${PORT}/api/dolar`);
  console.log(` CRON: Activo (00:00 America/Caracas)    `);
  console.log(`=========================================`);
});