FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Create directory for SQLite persistence
RUN mkdir -p /usr/src/app/data

# Port exposed by the app
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=development

# Start the server
CMD [ "npm", "start" ]
