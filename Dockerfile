# Use an official lightweight Node image.
FROM node:22-alpine

# Create app directory
WORKDIR /home/app

# Install nodemon globally
RUN yarn global add nodemon

# Copy package files and install dependencies.
COPY package.json ./
COPY yarn.lock ./
RUN yarn

# Copy the rest of your source code.
COPY . .

# Expose the port (match the port used in server.js)
EXPOSE 5155

RUN addgroup searchlistarr && adduser -S -G searchlistarr searchlistarr
RUN chown -R searchlistarr:searchlistarr ./
USER searchlistarr

# Run the server.
CMD ["node", "server.js"]