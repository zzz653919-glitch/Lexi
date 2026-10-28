# Lexi Learn — production image (Node 22 has the built-in SQLite module the app uses; the only npm dependency is Express)
FROM node:22-slim
ENV NODE_ENV=production PORT=3000 LEXI_DATA_DIR=/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY shared ./shared
COPY locales ./locales
COPY public ./public
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
