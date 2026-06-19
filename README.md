# Rovo Supabase Proxy

Прозрачный прокси-сервер к Supabase REST API. Решает проблему недоступности
Supabase (и Cloudflare) напрямую из России без VPN.

## Деплой на Railway

1. Зайди на https://railway.app
2. New Project → Deploy from GitHub repo (или Empty Project → загрузи эти файлы вручную)
3. Если через GitHub — создай новый репозиторий, залей туда `server.js` и `package.json`, подключи в Railway
4. Railway автоматически определит Node.js проект и задеплоит
5. После деплоя зайди в Settings → Networking → Generate Domain — получишь URL вида `rovo-proxy-production.up.railway.app`
6. Пришли этот URL — он будет использоваться вместо прямого Supabase URL в приложении

## Локальный запуск (для проверки)

```
npm install
npm start
```

Сервер запустится на порту 3000. Проверка: `curl http://localhost:3000/rest/v1/posts?select=*`
