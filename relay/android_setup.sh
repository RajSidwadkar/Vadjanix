#!/bin/bash
# Termux setup commands for Vadjanix Relay

# 1. Update and install dependencies
pkg update && pkg upgrade -y
pkg install nodejs-lts git -y

# 2. Clone/Setup project (assuming already done or to be done)
# mkdir -p ~/projects/vadjanix
# cd ~/projects/vadjanix

# 3. Install NPM dependencies
npm install @whiskeysockets/baileys better-sqlite3 express

# 4. Install PM2 for process management
npm install -g pm2

# 5. Start the relay
pm2 start relay/relay.ts --name vadjanix-relay --interpreter tsx

# 6. Setup startup
pm2 startup
pm2 save

# 7. Prevent Termux from sleeping
termux-wake-lock

echo "IMPORTANT: Set Android Settings > Battery > Termux to 'Unrestricted'"
echo "Relay is now running. Scan QR code in terminal if prompted."
