FROM node:20-alpine

WORKDIR /app

# Install dependencies first so npm cache layer is preserved
COPY package*.json ./
RUN npm install --omit=dev --prefer-offline --no-audit \
    || npm install --omit=dev --no-audit

# Copy source
COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
