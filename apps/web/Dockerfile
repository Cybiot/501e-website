# Front 501e (Angular SSR) — build depuis la racine : docker build -f apps/web/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install -g npm@11
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web --include-workspace-root=false
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
EXPOSE 4000
CMD ["node", "apps/web/dist/web/server/server.mjs"]
