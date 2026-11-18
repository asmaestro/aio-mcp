FROM node:22.19.0-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY scripts ./scripts
COPY solution ./solution
USER node
CMD ["node", "src/my-server.mjs"]
