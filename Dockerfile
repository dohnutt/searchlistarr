# Use an official lightweight Node image.
FROM node:22-alpine

# Create app directory
WORKDIR /app

# Copy package files and install dependencies.
COPY package*.json ./
RUN npm install

# Copy the rest of your source code.
COPY . .

# Expose the port (match the port used in server.js)
EXPOSE 5155

# Run the server.
CMD ["node", "server.js"]