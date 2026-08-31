# SynapseAi backend

Production-контур по ТЗ. Веб-клиент пока не трогаем: управление идёт через Telegram.

## Запуск

1. Скопируйте `.env.example` → `.env`, вставьте `TELEGRAM_BOT_TOKEN` (BotFather) и сгенерируйте `ENCRYPTION_KEY` / `JWT_SECRET`.
2. `npm install`
3. `npm run db:up`
4. `npm run db:generate`
5. `npm run db:migrate`
6. `npm run test:backend`
7. `npm run dev`
8. В Telegram откройте бота и отправьте `/start`.

## Команды бота

`/start` `/status` `/keys` `/balance` `/risk` `/auto_on` `/auto_off` `/scan BTCUSDT` `/trade BTCUSDT LONG 100 5` `/positions` `/history` `/logs` `/kill` `/unlock` `/price BTCUSDT`

Ключи Binance шифруются AES-256-GCM. Бот возвращает только маску `vmX9...4aZ`.
