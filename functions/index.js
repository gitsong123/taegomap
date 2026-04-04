const { onRequest } = require('firebase-functions/v2/https');
const https = require('https');

// Naver Local Search API proxy (server-side to avoid CORS)
exports.naverSearch = onRequest({ cors: true, region: 'asia-northeast3' }, (req, res) => {
  const query = req.query.query;
  if (!query) {
    res.status(400).json({ error: 'Missing query parameter' });
    return;
  }

  const path = `/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&sort=comment`;
  const options = {
    hostname: 'openapi.naver.com',
    path,
    method: 'GET',
    headers: {
      'X-Naver-Client-Id': 'cT8lwPWYEDzoOVMXeyKe',
      'X-Naver-Client-Secret': 'fYSU79ZaoN',
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => { data += chunk; });
    apiRes.on('end', () => {
      res.set('Content-Type', 'application/json');
      res.status(apiRes.statusCode).send(data);
    });
  });

  apiReq.on('error', (e) => {
    res.status(500).json({ error: e.message });
  });

  apiReq.end();
});
