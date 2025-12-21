# Backend API Server

Backend API for Address Management System with MongoDB integration.

## Quick Start

### Development Mode (with auto-restart)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start server in production mode |
| `npm run dev` | Start server with nodemon (auto-restart) |
| `npm run dev:watch` | Start with explicit file watching |
| `npm run dev:debug` | Start with Node.js debugger |
| `npm run dev:verbose` | Start with verbose nodemon output |

## Quick Start Scripts

### Windows
```bash
./start-dev.bat
```

### Linux/Mac
```bash
chmod +x start-dev.sh
./start-dev.sh
```

## Environment Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB connection details
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

## API Endpoints

### Address Management
- `GET /api/addresses` - Get all addresses
- `POST /api/addresses` - Create new address
- `PUT /api/addresses/:id` - Update address
- `DELETE /api/addresses/:id` - Delete address

### Statistics
- `GET /api/stats/countries` - Get country statistics
- `GET /api/stats/countries/:countryCode/addresses` - Get addresses by country
- `GET /api/stats/processing-status` - Get country processing status
- `PUT /api/stats/processing-status/:countryCode` - Update country status

### Health Check
- `GET /api/health` - Server health check

## Development Features

### Nodemon Configuration
- **Auto-restart** on file changes
- **Watches**: `routes/`, `controllers/`, `models/`, `services/`
- **File types**: `.js`, `.json`
- **Ignores**: `node_modules/`, test files, logs

### Environment Variables
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/address_db
NODE_ENV=development
```

## Database Collections

- `address` - Main address data
- `country_status` - Country processing status

## Development Tips

1. **Auto-restart**: Server automatically restarts when you save files
2. **Logs**: Check console for detailed request/response logs
3. **Debug**: Use `npm run dev:debug` for Node.js debugging
4. **Health**: Visit `http://localhost:5000/api/health` to check server status

## Troubleshooting

### Server won't start
1. Check if MongoDB is running
2. Verify `.env` file configuration
3. Ensure port 5000 is available

### Database connection issues
1. Check MongoDB URI in `.env`
2. Verify database credentials
3. Ensure MongoDB service is running

### Nodemon not restarting
1. Check `nodemon.json` configuration
2. Verify file watching patterns
3. Try `npm run dev:verbose` for detailed logs