const fetch = require("node-fetch");
const cron = require('node-cron');
const mysql = require("mysql2/promise");
require('dotenv').config();

async function autoSaveDolar(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    const data = await response.json();
    let dolar = 0;
    if (data.success == true) {
      dolar = data.dolar;

      const dbConfig = {
        host: process.env.HOST,
        user: process.env.USER,
        password: process.env.PASS,
        database: process.env.DB_CONF,
        port: 3306,
      };

      async function getDatabaseNames(config) {
        let connection;
        try {
          connection = await mysql.createConnection(config);
          const [rows] = await connection.execute("SELECT bd FROM nomempresa");
          return rows.map((row) => row.bd);
        } catch (error) {
          console.error(
            "Error al conectar con la base de datos principal:",
            error.message
          );
          return [];
        } finally {
          if (connection) {
            await connection.end();
            console.log("Conexión cerrada con la base de datos principal");
          }
        }
      }

      async function executeQuery(connectionConfig, tasaDolar) {
        let connection;
        try {
          connection = await mysql.createConnection(connectionConfig);
          let query = `INSERT INTO tasas_cambio(divisa, fecha, tasa, tasa_inversa, monedabase) VALUES (15, NOW(), 0, ${tasaDolar}, 14);`;
          await connection.execute(query);
          console.log(
            `Consultas ejecutadas correctamente en la base de datos: ${connectionConfig.database}`
          );
        } catch (error) {
          console.error(
            `Error al conectar o ejecutar la consulta en la base de datos ${connectionConfig.database}:`,
            error.message
          );
        } finally {
          if (connection) {
            await connection.end();
            console.log(
              `Conexión cerrada con la base de datos: ${connectionConfig.database}`
            );
          }
        }
      }

      const databaseNames = await getDatabaseNames(dbConfig);

      const dbConfigs = databaseNames.map((dbName) => ({
        host: process.env.HOST,
        user: process.env.USER,
        password: process.env.PASS,
        database: dbName,
        port: 3306,
      }));

      for (const config of dbConfigs) {
        await executeQuery(config, dolar);
      }
      
      console.log('************************************************************************')
      console.log('ejecucion finalizada... pronto se ejecutara la siguiente actualizacion')
      console.log('************************************************************************')
      console.log('\n')
    }
  } catch (error) {
    console.log(error);
  }
}

cron.schedule('0 0 * * *', () => {

autoSaveDolar(process.env.URL_TASA);
}, {
  timezone: 'America/Caracas',
});

/* 
VARIABLES PARA EL ARCHIVO .ENV

URL_TASA = ""
HOST = ""
USER = ""
PASS = ""
DB_CONF = ""

*/