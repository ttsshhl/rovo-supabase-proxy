const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = 'https://ukrwbojclsmkjyvvlnzp.supabase.co';
const IMGBB_API_KEY = '4f8dda29e32ee35dc93056f67ab70328';

app.use(express.raw({ type: '*/*', limit: '20mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/imgbb-upload', async (req, res) => {
  try {
    const base64Image = req.body.toString('utf-8');
    const params = new URLSearchParams();
    params.append('key', IMGBB_API_KEY);
    params.append('image', base64Image);
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const json = await response.json();
    res.status(response.status).json(json);
  } catch (err) {
    res.status(502).json({ error: 'imgbb proxy error', message: err.message });
  }
});

app.get('/image-proxy', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl || !imageUrl.startsWith('https://i.ibb.co/')) {
      return res.status(400).json({ error: 'invalid url' });
    }
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(buffer);
  } catch (err) {
    res.status(502).json({ error: 'image-proxy error', message: err.message });
  }
});

app.all('*', async (req, res) => {
  try {
    const targetUrl = SUPABASE_URL + req.originalUrl;
    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length'];
    const fetchOptions = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && req.body.length > 0) {
      fetchOptions.body = req.body;
    }
    const response = await fetch(targetUrl, fetchOptions);
    const buffer = await response.buffer();
    res.status(response.status);
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower !== 'transfer-encoding' && lower !== 'connection' &&
          lower !== 'content-encoding' && lower !== 'content-length') {
        res.setHeader(key, value);
      }
    });
    res.send(buffer);
  } catch (err) {
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
});

app.listen(PORT, () => console.log(`Rovo proxy on port ${PORT}`));
