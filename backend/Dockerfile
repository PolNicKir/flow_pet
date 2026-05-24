FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl fontconfig ttf-dejavu
COPY package*.json ./
RUN npm install

FROM deps AS build
WORKDIR /app
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl fontconfig ttf-dejavu
COPY package*.json ./
RUN npm install --omit=dev
COPY prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
