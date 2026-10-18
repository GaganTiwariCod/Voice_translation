#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "=================================================="
echo " Setting up Live Translator Server on Termux"
echo "=================================================="

# 1. Update Termux packages
echo "[1/4] Updating Termux package repositories..."
pkg update -y && pkg upgrade -y

# 2. Install Node.js LTS, Python, and Git
echo "[2/4] Installing Node.js LTS, Python 3, and Git..."
pkg install nodejs-lts python git -y

# 3. Install Python dependencies
echo "[3/4] Installing Python STT libraries..."
pip install --upgrade pip
pip install -r requirements.txt

# 4. Install Node.js dependencies
echo "[4/4] Installing Node.js server dependencies..."
npm install

# 5. Create .env if not exists
if [ ! -f .env ]; then
  echo "Creating default .env configuration..."
  cp .env.example .env
fi

chmod +x start_termux.sh 2>/dev/null || true

echo "=================================================="
echo " Setup complete! To start the server, run:"
echo "   ./start_termux.sh"
echo "   or: npm start"
echo "=================================================="
