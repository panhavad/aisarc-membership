FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=3000 NODE_NO_WARNINGS=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server/index.js"]
