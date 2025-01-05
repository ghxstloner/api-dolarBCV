const https = require('https');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 3009;

app.use(cors());

const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/facturacion.amaxoniaerp.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/facturacion.amaxoniaerp.com/cert.pem'),
  ca: fs.readFileSync('/etc/letsencrypt/live/facturacion.amaxoniaerp.com/chain.pem'),
};

const https = require('https');
const agent = new https.Agent({
  rejectUnauthorized: false,
});

app.get('/api/dolar', async (req, res) => {
  try {
    console.log('Iniciando solicitud a https://www.bcv.org.ve/');

    const response = await axios.get('https://www.bcv.org.ve/', { httpsAgent: agent });
    console.log('Solicitud completada. Estado:', response.status);

    const $ = cheerio.load(response.data);
    const dolarElement = $('#dolar .col-sm-6.col-xs-6.centrado strong');
    console.log('Elemento encontrado con el selector:', dolarElement.html());

    const dolarValueRaw = dolarElement.text().trim();
    console.log('Valor bruto extraído del HTML:', dolarValueRaw);

    if (dolarValueRaw) {
      const dolarValueProcessed = dolarValueRaw.replace(/\./g, '').replace(',', '.');
      const dolarValue = parseFloat(dolarValueProcessed);
      console.log('Valor final como número:', dolarValue);

      return res.json({ success: true, dolar: dolarValue });
    } else {
      console.warn('No se encontró el valor del dólar en el HTML.');
      return res.json({ success: false, dolar: 0 });
    }
  } catch (error) {
    console.error('Error al obtener el dólar:', error.message);
    return res.json({ success: false, dolar: -1 });
  }
});


https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor HTTPS ejecutándose en https://facturacion.amaxoniaerp.com:${PORT}`);
});
