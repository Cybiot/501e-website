# Bot Discord 501e — build depuis la racine : docker build -f apps/bot/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install -g npm@11
COPY package.json package-lock.json ./
COPY apps/bot/package.json apps/bot/
RUN npm ci --workspace apps/bot --include-workspace-root=false
COPY apps/bot apps/bot
RUN npm run build -w apps/bot && npm prune --omit=dev --workspace apps/bot

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/bot/dist ./apps/bot/dist
COPY --from=build /app/apps/bot/package.json ./apps/bot/package.json
USER node
CMD ["node", "apps/bot/dist/index.js"]
