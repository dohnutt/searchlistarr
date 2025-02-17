# Use an official lightweight Node image.
FROM node:22-alpine

# Create app directory
WORKDIR /usr/src/app

# Install nodemon globally
RUN yarn global add nodemon

# Copy package files and install dependencies.
COPY package.json ./
COPY yarn.lock ./
RUN yarn

# Copy the rest of your source code.
COPY . .

USER node

# Expose the port (match the port used in server.js)
EXPOSE 5155

# Run the server.
CMD ["node", "server.js"]