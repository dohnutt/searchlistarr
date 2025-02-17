# Use an official lightweight Node image.
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files and install dependencies.
COPY package*.json ./
RUN npm install

# Copy the rest of your source code.
COPY . .

# Expose the port (match the port used in server.js, e.g., 3000)
EXPOSE 7077

# Run the server.
CMD ["node", "server.js"]