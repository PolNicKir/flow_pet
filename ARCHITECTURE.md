# Архитектура web-приложения Flow Estimate

## 1. Цель системы

Приложение предназначено для создания коммерческой сметы CE и визуального production flow презентаций. Основной финансовый источник - CE. Flow используется как визуальная карта и справочный источник статистики, а обновляет CE только по явному действию пользователя.

## 2. Рекомендуемый стек

### Frontend

- React + TypeScript
- Vite
- React Router
- TanStack Query для серверного состояния
- Zustand для локального UI-состояния canvas
- React Flow для flow-canvas, карточек, стрелок, масштабирования и drag-and-drop
- MUI или Ant Design для базовых интерфейсных компонентов
- i18n не требуется на первой версии, значения flow хранятся на английском согласно ТЗ

### Backend

- Node.js + TypeScript
- NestJS
- PostgreSQL как основная база данных
- Prisma ORM
- Redis для блокировок редактирования, сессий и фоновых задач
- BullMQ для очередей экспорта PDF/Excel/изображений
- MinIO/S3-compatible storage для изображений, логотипов и экспортируемых файлов

### Экспорт

- PDF: Playwright/Chromium render service
- Excel: ExcelJS
- Экспорт flow как изображения: серверный рендер через Playwright или клиентский export с отправкой результата на backend

### Инфраструктура

- docker-compose для локального и staging-разворачивания
- Nginx как reverse proxy
- Отдельные контейнеры: frontend, backend, postgres, redis, minio, worker, nginx

## 3. Контейнерная схема

```text
client browser
  |
  v
nginx
  |-- /              -> frontend
  |-- /api           -> backend
  |-- /storage       -> minio, опционально через signed URLs

backend
  |-- PostgreSQL     -> бизнес-данные
  |-- Redis          -> locks, sessions, queues
  |-- MinIO          -> изображения, логотипы, экспорты
  |-- BullMQ         -> export jobs

worker
  |-- Redis          -> получает export jobs
  |-- PostgreSQL     -> читает проект
  |-- MinIO          -> сохраняет готовые файлы
```

## 4. docker-compose состав

Минимальный состав:

```yaml
services:
  nginx:
    image: nginx:alpine
    depends_on:
      - frontend
      - backend
    ports:
      - "8080:80"

  frontend:
    build: ./frontend
    environment:
      VITE_API_URL: /api

  backend:
    build: ./backend
    depends_on:
      - postgres
      - redis
      - minio
    environment:
      DATABASE_URL: postgresql://flow:flow@postgres:5432/flow
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_BUCKET: flow

  worker:
    build: ./backend
    command: npm run worker
    depends_on:
      - backend
      - postgres
      - redis
      - minio

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: flow
      POSTGRES_USER: flow
      POSTGRES_PASSWORD: flow
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: flowadmin
      MINIO_ROOT_PASSWORD: flowadmin123
    volumes:
      - minio_data:/data
    ports:
      - "9001:9001"

volumes:
  postgres_data:
  minio_data:
```

## 5. Основные bounded contexts

### Auth

Отвечает за вход, выход, регистрацию или создание пользователей администратором. На первой версии достаточно email/login + password + displayName.

Пароли хранятся только в виде hash, например Argon2 или bcrypt.

### Projects

Работает с проектами и шаблонами. Проект и шаблон имеют одинаковую структуру данных, различаются типом.

Функции:

- создать пустой проект
- создать проект из шаблона
- создать шаблон из проекта
- редактировать проект/шаблон
- удалить только собственный проект/шаблон
- импорт/экспорт проекта файлом

### CE

Отвечает за структуру сметы, строки, блоки, ставки, количества, скидки, наценки, коэффициенты и итоговые расчёты.

Расчёт выполняется на backend как источник истины. Frontend может делать optimistic preview, но сохранённый результат должен пересчитываться backend-сервисом.

### Flow

Отвечает за flow-доски внутри проекта.

Один проект может содержать несколько flow. Каждый flow содержит:

- карточки слайдов
- позиции карточек
- стрелки и связи
- изображения
- типы дизайна и верстки
- статистику

Flow не меняет CE автоматически. Для переноса статистики в CE используется отдельная команда.

### Rates

Справочник ставок. Ставки могут храниться глобально и копироваться в проект/шаблон при создании, чтобы старые проекты не менялись неожиданно после обновления справочника.

### History

Версионирование проектов и шаблонов.

Фиксируются:

- дата и время
- пользователь
- тип действия
- комментарий к версии
- snapshot или diff данных

Для первой версии проще и надёжнее хранить JSON snapshot ключевых данных проекта на каждое сохранение. Позже можно перейти к diff-модели.

### Locks

Блокировка редактирования проекта/шаблона.

Redis key:

```text
lock:project:{projectId}
lock:template:{templateId}
```

Значение:

```json
{
  "userId": "uuid",
  "displayName": "Иван Петров",
  "lockedAt": "2026-05-17T10:00:00Z",
  "expiresAt": "2026-05-17T10:15:00Z"
}
```

Frontend продлевает lock heartbeat каждые 30-60 секунд. При закрытии вкладки backend получает unlock best-effort, но окончательно полагается на TTL.

### Export

Экспорт лучше выполнять асинхронно через очередь.

Типы задач:

- export PDF
- export XLSX
- export flow image
- export project/template archive

Backend создаёт задачу, worker формирует файл, сохраняет его в MinIO и возвращает ссылку/статус.

## 6. Модель данных

Ниже логическая модель, не финальная Prisma-схема.

### User

- id
- login
- passwordHash
- displayName
- createdAt
- updatedAt

### Project

- id
- type: `PROJECT | TEMPLATE`
- name
- client
- brand
- currency
- logoFileId
- ownerId
- dataVersion
- createdAt
- updatedAt
- deletedAt

### ProjectAccess

На первой версии может не понадобиться, потому что все пользователи видят все проекты. Можно оставить для будущего развития.

- id
- projectId
- userId
- role

### CeDocument

- id
- projectId
- requisites jsonb
- blocks jsonb
- ratesSnapshot jsonb
- adjustments jsonb
- totals jsonb
- updatedAt

### Flow

- id
- projectId
- name
- order
- viewport jsonb
- createdAt
- updatedAt

### FlowNode

- id
- flowId
- slideNumber
- title
- designType
- codingType
- popupsCount
- comments
- positionX
- positionY
- mainImageFileId
- additionalImageFileIds jsonb
- meta jsonb

### FlowEdge

- id
- flowId
- sourceNodeId
- targetNodeId
- label
- color
- lineType
- meta jsonb

### Rate

- id
- code
- name
- amount
- currency
- category
- isActive
- updatedAt

### FileAsset

- id
- projectId
- storageKey
- filename
- mimeType
- size
- kind: `LOGO | FLOW_IMAGE | EXPORT | IMPORT`
- createdBy
- createdAt

### Version

- id
- projectId
- userId
- comment
- actionType
- snapshot jsonb
- createdAt

### ExportJob

- id
- projectId
- userId
- type: `PDF | XLSX | FLOW_IMAGE | PROJECT_ARCHIVE`
- status: `PENDING | PROCESSING | DONE | FAILED`
- fileAssetId
- error
- createdAt
- updatedAt

## 7. CE расчёты

Backend-сервис `CeCalculationService` должен быть единственной точкой финального расчёта.

Формулы:

```text
rowTotal = rate * quantity
baseBlockTotal = sum(rowTotal)
adjustedBlockTotal = baseBlockTotal * urgencyCoefficient * complexityCoefficient
blockTotal = adjustedBlockTotal + markup - discount
ceTotal = sum(blockTotal)
```

Правила:

- пустая ставка или пустое количество дают пустой итог строки
- отрицательные и дробные значения запрещены
- итог CE считается после применения коэффициентов, скидок и наценок по блокам
- CE может отличаться от flow, но приложение показывает предупреждение

## 8. Flow -> CE синхронизация

Команда:

```http
POST /api/projects/:projectId/sync-flow-to-ce
```

Алгоритм:

1. Backend собирает статистику по всем flow проекта.
2. Применяет маппинг из ТЗ:
   - `new simple design` -> простой слайд
   - `new medium design` -> средний слайд
   - `new complex design` -> сложный слайд
   - adaptation design -> строки адаптации
   - coding -> строки верстки/анимации
3. Обновляет только соответствующие количества CE.
4. Не обновляет распределение и заливку автоматически.
5. Пересчитывает CE.
6. Создаёт запись в истории изменений.

## 9. API

### Auth

```http
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Projects and templates

```http
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id

GET    /api/templates
POST   /api/templates
POST   /api/projects/:id/create-template
POST   /api/templates/:id/create-project
```

### Locks

```http
POST   /api/projects/:id/lock
POST   /api/projects/:id/lock/heartbeat
DELETE /api/projects/:id/lock
GET    /api/projects/:id/lock
```

### CE

```http
GET   /api/projects/:id/ce
PATCH /api/projects/:id/ce
POST  /api/projects/:id/ce/recalculate
```

### Flow

```http
GET    /api/projects/:id/flows
POST   /api/projects/:id/flows
GET    /api/flows/:flowId
PATCH  /api/flows/:flowId
DELETE /api/flows/:flowId

POST   /api/flows/:flowId/nodes
PATCH  /api/flows/:flowId/nodes/:nodeId
DELETE /api/flows/:flowId/nodes/:nodeId

POST   /api/flows/:flowId/edges
PATCH  /api/flows/:flowId/edges/:edgeId
DELETE /api/flows/:flowId/edges/:edgeId

GET    /api/flows/:flowId/statistics
```

### Files

```http
POST   /api/files
GET    /api/files/:id
DELETE /api/files/:id
```

### Export

```http
POST /api/projects/:id/export/pdf
POST /api/projects/:id/export/xlsx
POST /api/flows/:flowId/export/image
GET  /api/export-jobs/:jobId
```

### History

```http
GET  /api/projects/:id/versions
GET  /api/projects/:id/versions/:versionId
POST /api/projects/:id/versions/:versionId/restore
```

## 10. Frontend структура

```text
frontend/src
  app/
    router.tsx
    providers.tsx
  pages/
    LoginPage.tsx
    ProjectsPage.tsx
    ProjectPage.tsx
    TemplatesPage.tsx
  features/
    auth/
    projects/
    ce/
    flow/
    rates/
    history/
    export/
    files/
  shared/
    api/
    ui/
    types/
    utils/
```

Основной экран проекта:

```text
ProjectPage
  Header: проект, клиент, бренд, сохранение, экспорт, lock status
  Tabs:
    CE
    Flow 1
    Flow 2
    ...
    History
```

## 11. Backend структура

```text
backend/src
  main.ts
  app.module.ts
  modules/
    auth/
    users/
    projects/
    ce/
    flow/
    rates/
    locks/
    files/
    history/
    export/
  workers/
    export.worker.ts
  common/
    prisma/
    storage/
    validation/
    errors/
```

## 12. Хранение проекта файлом

Формат для импорта/экспорта проекта лучше сделать ZIP-архивом:

```text
project.flow.zip
  manifest.json
  project.json
  ce.json
  flows/
    flow-1.json
    flow-2.json
  assets/
    logo.png
    images/...
```

Так проще переносить проект вместе с изображениями и логотипом. Обычный JSON неудобен для бинарных файлов.

## 13. Экспорт PDF

Рекомендуемый подход:

1. Worker открывает внутреннюю print-страницу проекта через Playwright.
2. Print-страница рендерит CE и все flow в экспортном режиме.
3. CE масштабируется по ширине страницы.
4. Каждый flow выводится на отдельные страницы после CE.
5. PDF сохраняется в MinIO.

Имя файла:

```text
Клиент_Бренд_Смета_Дата.pdf
```

## 14. Экспорт Excel

ExcelJS формирует `.xlsx`:

- CE как редактируемые листы с формулами
- ставки, количества, скидки, наценки, коэффициенты
- итоги с Excel-формулами
- flow как отдельные листы

Сложная часть - полноценное сохранение canvas со стрелками, изображениями и позициями. Для первой реализации рекомендуется:

1. В Excel создавать отдельный лист на каждый flow.
2. Вставлять изображение всей flow-карты как картинку.
3. Дополнительно создавать таблицу карточек и связей в редактируемом виде.

Это сохраняет читаемость и данные, а не требует вручную воссоздавать canvas средствами Excel shapes на первом этапе.

## 15. Валидация

Backend валидирует все данные независимо от frontend.

Правила:

- ставки и количества только целые неотрицательные числа
- обязательные поля проекта проверяются перед экспортом
- нулевой итог CE допускается, но должен показываться warning
- несоответствие CE и flow не блокирует работу
- незаполненные обязательные поля перед экспортом требуют отдельного продуктового решения: warning или blocker

## 16. История изменений

Историю лучше писать на явное сохранение, экспорт, импорт, sync flow -> CE, restore version, изменение ставок и изменение структуры flow.

Версия содержит snapshot проекта. Откат версии:

1. Проверяет lock.
2. Создаёт текущую версию перед откатом.
3. Восстанавливает snapshot выбранной версии.
4. Пересчитывает CE.
5. Создаёт запись `RESTORE_VERSION`.

## 17. Безопасность

- HTTP-only session cookie или JWT в HTTP-only cookie
- hash паролей через Argon2/bcrypt
- проверка авторизации на всех `/api/projects`, `/api/templates`, `/api/files`
- проверка ownerId при удалении
- signed URL для приватных файлов или проксирование файлов через backend
- ограничение размера изображений и допустимых mime types

## 18. MVP этапы

### Этап 1. Основа

- docker-compose
- auth
- проекты и шаблоны
- базовая CE
- справочник ставок
- сохранение в PostgreSQL

### Этап 2. Flow canvas

- React Flow canvas
- карточки слайдов
- стрелки
- изображения
- несколько flow в проекте
- статистика flow

### Этап 3. CE integration

- расчёты CE на backend
- предупреждения о расхождениях
- кнопка sync flow -> CE
- история изменений
- блокировки редактирования

### Этап 4. Экспорт

- PDF
- flow image
- Excel CE
- Excel flow в виде изображения + таблиц
- импорт/экспорт проекта ZIP

### Этап 5. Полировка

- автосохранение черновиков
- улучшение производительности canvas
- расширенный restore версий
- улучшенный Excel-export flow через shapes, если это потребуется

## 19. Главные архитектурные решения

1. CE - источник истины для денег.
2. Flow не меняет CE без команды пользователя.
3. Проект и шаблон имеют одну модель данных с разным типом.
4. Расчёты CE выполняются на backend.
5. Flow хранится как graph: nodes + edges + viewport.
6. Изображения и экспорты не хранятся в базе, только в object storage.
7. Блокировки редактирования живут в Redis с TTL.
8. Экспорт выполняется асинхронно через worker.
9. Версионирование первой версии строится на snapshots, а не diff.
10. Разворачивание выполняется через docker-compose.

## 20. Открытые архитектурные вопросы

Перед стартом разработки нужно подтвердить:

1. ZIP как формат файла проекта/шаблона.
2. TTL блокировки редактирования, например 15 минут.
3. Должны ли обязательные поля блокировать экспорт.
4. Нужна ли страница управления пользователями в первой версии.
5. Финальный порядок применения скидок, наценок и коэффициентов.
6. Достаточно ли для первой версии экспортировать flow в Excel как изображение + таблицу данных.
