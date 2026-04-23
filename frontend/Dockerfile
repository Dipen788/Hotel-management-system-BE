FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --prefer-offline --no-audit || npm install --no-audit

COPY . .

ENV CHOKIDAR_USEPOLLING=true
EXPOSE 3000

# Dev server — for a production build, swap to `npm run build` + nginx.
CMD ["npm", "start"]
