# Use Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json & package-lock.json first
COPY package*.json ./

# Install deps
RUN npm install

# Copy rest of the source code
COPY . .

# Expose backend port
EXPOSE 8080

# Run server
CMD ["npm", "start"]