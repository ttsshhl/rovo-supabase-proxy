// Прозрачный прокси к Supabase REST API.
//
// Зачем: Supabase Storage и сам REST API оказались систематически недоступны
// из России без VPN. Попытка через Cloudflare Workers (включая кастомный домен)
// тоже не помогла — похоже сама сеть Cloudflare блокируется на уровне DPI,
// не конкретный домен. Railway — другая инфраструктура (другие IP-диапазоны),
// уже подтверждённо доступна без VPN (использовалась для WwwLove).
//
// Этот сервер просто прозрачно пересылает все запросы на Supabase и возвращает
// ответ как есть — приложение Rovo стучится сюда вместо прямого Supabase URL.

const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = 'https://jznjjpilbhkyytmwvnnc.supabase.co';

// Пропускаем тело запроса как есть, без парсинга — прокси должен быть прозрачным
app.use(express.raw({ type: '*/*', limit: '20mb' }));

app.all('*', async (req, res) => {
  try {
    const targetUrl = SUPABASE_URL + req.originalUrl;

    // Копируем все заголовки кроме host (он должен указывать на Supabase, не на наш прокси)
    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length']; // пересчитается автоматически

    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && req.body.length > 0) {
      fetchOptions.body = req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);
    const buffer = await response.buffer();

    // Прокидываем статус и заголовки ответа как есть
    res.status(response.status);
    response.headers.forEach((value, key) => {
      // transfer-encoding и connection не должны переноситься между серверами
      if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'connection') {
        res.setHeader(key, value);
      }
    });
    res.send(buffer);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Rovo Supabase proxy listening on port ${PORT}`);
});
