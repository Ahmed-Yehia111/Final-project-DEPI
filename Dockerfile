FROM node:22-bookworm-slim AS js-build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY apps ./apps
RUN npm run build
RUN npm --prefix apps/api prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    API_PORT=8080 \
    PYTHON_BIN=/opt/venv/bin/python \
    MODEL_PATH=/home/site/wwwroot/model-artifacts/best_model_auc.keras \
    WEB_DIST_PATH=/app/apps/api/public

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libglib2.0-0 libgomp1 python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/python/requirements.txt ./apps/api/python/requirements.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r ./apps/api/python/requirements.txt

COPY --from=js-build /app/apps/api/dist ./apps/api/dist
COPY --from=js-build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=js-build /app/apps/api/package.json ./apps/api/package.json
COPY --from=js-build /app/apps/api/python ./apps/api/python
COPY --from=js-build /app/apps/web/dist ./apps/api/public

EXPOSE 8080

CMD ["node", "apps/api/dist/server.js"]
