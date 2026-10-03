FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js auth.js db.js ./
COPY public ./public
RUN mkdir data && chown node:node data
USER node
CMD ["node", "server.js"]
