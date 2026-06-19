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
const IMGBB_API_KEY = '4f8dda29e32ee35dc93056f67ab70328';

// Пропускаем тело запроса как есть, без парсинга — прокси должен быть прозрачным
app.use(express.raw({ type: '*/*', limit: '20mb' }));

// Отдельный route для imgbb: тело запроса — это base64 картинки как plain text.
// Сервер Railway сам делает запрос к imgbb (со своей, доступной без VPN сети)
// и возвращает результат клиенту. Так картинка обходит ту же сетевую проблему,
// что и Supabase — клиент стучится только в Railway, а Railway уже достучится
// до imgbb сам.
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
    console.error('imgbb proxy error:', err.message);
    res.status(502).json({ error: 'imgbb proxy error', message: err.message });
  }
});

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

    // Прокидываем статус и заголовки ответа как есть.
    // ВАЖНО: content-encoding и content-length НЕ переносим — node-fetch уже
    // автоматически распаковывает gzip при получении ответа от Supabase, но
    // заголовок content-encoding: gzip остаётся в response.headers. Если мы
    // передадим этот заголовок дальше клиенту, а тело при этом уже не сжато —
    // клиент попытается распаковать обычный JSON как gzip и упадёт с ошибкой
    // "ID1ID2 magic bytes mismatch". Аналогично content-length должен быть
    // пересчитан под реальный (несжатый) размер тела.
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
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Rovo Supabase proxy listening on port ${PORT}`);
});
