# Stage 1: Build frontend
FROM node:24-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.node.json vite.config.ts ./
RUN npm ci
COPY src/ ./src/
COPY tests/ ./tests/
COPY index.html ./
RUN npm run build

# Stage 2: Production runtime
FROM node:24-alpine
WORKDIR /app

# Copy server package files and install only production deps
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source and data
COPY server/src/ ./server/src/
COPY server/tsconfig.json ./server/

# Copy frontend build from stage 1
COPY --from=frontend-builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http');http.get('http://localhost:3000/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{const j=JSON.parse(d);process.exit(j.status==='ok'?0:1)}catch{process.exit(1)}})})"

CMD ["node", "--import", "tsx", "server/src/index.ts"]
