# Flow Estimate

Web-приложение для коммерческих смет CE и production flow презентаций.

## Этап 1

В репозитории заложен первый этап:

- docker-compose окружение;
- backend на NestJS + Prisma + PostgreSQL;
- простая авторизация;
- проекты и шаблоны;
- базовая CE с backend-пересчётом;
- справочник ставок;
- frontend на React + Vite.

## Запуск

```bash
cp .env.example .env
docker compose up --build
```

После запуска приложение доступно на `http://localhost:8080`.

## Первый пользователь

На экране входа можно создать пользователя через форму регистрации.

