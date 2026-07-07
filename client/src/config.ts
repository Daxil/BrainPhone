// Базовый URL API. В проде SPA и API живут на одном домене (Express отдаёт
// статику и /api из одного контейнера), поэтому по умолчанию — относительный
// путь. Для отдельного деплоя фронтенда задайте VITE_API_URL при сборке.
export const API_BASE_URL: string = import.meta.env.VITE_API_URL || '/api';

// Health-эндпоинт живёт вне префикса /api (до auth-middleware).
export const HEALTH_URL: string = API_BASE_URL.replace(/\/api$/, '') + '/health';
