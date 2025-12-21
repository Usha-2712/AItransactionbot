// src/server.js
import express from 'express';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat.js';
import { errorHandler } from './utils/errors.js';
import { checkAWSConfig } from './config/aws.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Get port from environment or default to 3000
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// CORS middleware (enable if needed for frontend)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Routes
app.use('/api', chatRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'AI Transaction Bot API',
    version: '1.0.0',
    endpoints: {
      chat: 'POST /api/chat',
      upload: 'POST /api/chat/upload',
      transactions: 'GET /api/transactions/:userId',
      health: 'GET /api/health'
    }
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint not found',
      path: req.path
    }
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Check AWS configuration
    checkAWSConfig();

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.warn('Warning: OPENAI_API_KEY not set. LLM features will not work.');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📍 API endpoints available at http://localhost:${PORT}/api`);
      console.log(`💡 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();