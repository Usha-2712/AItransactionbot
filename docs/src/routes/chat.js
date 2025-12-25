// src/routes/chat.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { 
  processTransactionFromText, 
  processTransactionFromImage,
  processTransactionFromBuffer,
  getUserTransactionHistory 
} from '../services/transactionService.js';
import { asyncHandler } from '../utils/errors.js';
import { ValidationError } from '../utils/errors.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Save to uploads folder
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter - only accept images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new ValidationError('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: fileFilter
});

/**
 * POST /api/chat - Process transaction from text message
 * 
 * Chatbot API endpoint that:
 * - Captures user input from chat interface
 * - Processes transaction using LLM
 * - Returns confirmation response with transaction details
 * 
 * Request Body: { userId: string, message: string }
 * 
 * Response: {
 *   success: boolean,
 *   data: {
 *     transaction: Object,
 *     message: string,
 *     isDuplicate: boolean
 *   }
 * }
 * 
 * Message handling:
 * - Supports single-line and multi-line input
 * - Trims leading/trailing whitespace
 * - Normalizes internal whitespace (multiple spaces/newlines collapsed)
 * - Validates non-empty message after trimming
 */
router.post('/chat', asyncHandler(async (req, res) => {
  const { userId, message } = req.body;

  // Validate required fields
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new ValidationError('User ID is required and cannot be empty', 'userId');
  }

  if (!message || typeof message !== 'string') {
    throw new ValidationError('Message is required and must be a string', 'message');
  }

  // Trim and normalize message
  // Remove leading/trailing whitespace and normalize internal whitespace
  // Replace multiple spaces/newlines with single space for better LLM processing
  let normalizedMessage = message.trim();
  
  if (normalizedMessage.length === 0) {
    throw new ValidationError('Message cannot be empty after trimming whitespace', 'message');
  }

  // Normalize internal whitespace: replace multiple spaces/newlines with single space
  // This helps with multi-line messages that users may paste or type
  normalizedMessage = normalizedMessage.replace(/\s+/g, ' ').trim();

  // Process transaction with normalized message
  const result = await processTransactionFromText(userId, normalizedMessage);

  // Send response
  res.json({
    success: true,
    data: {
      transaction: result.transaction,
      message: result.message,
      isDuplicate: result.isDuplicate
    }
  });
}));

/**
 * POST /chat/upload - Process transaction from uploaded receipt image
 * Form data: userId, file (image)
 */
router.post('/chat/upload', upload.single('file'), asyncHandler(async (req, res) => {
  const { userId } = req.body;

  // Validate required fields
  if (!userId) {
    throw new ValidationError('User ID is required', 'userId');
  }

  if (!req.file) {
    throw new ValidationError('Image file is required', 'file');
  }

  // Process transaction from uploaded image
  const result = await processTransactionFromImage(userId, req.file.path);

  // Send response
  res.json({
    success: true,
    data: {
      transaction: result.transaction,
      message: result.message,
      isDuplicate: result.isDuplicate
    }
  });
}));

/**
 * GET /transactions/:userId - Get user transaction history
 * Params: userId
 * Query: limit (optional, default: 100)
 */
router.get('/transactions/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 100;

  // Get transaction history
  const transactions = await getUserTransactionHistory(userId, limit);

  res.json({
    success: true,
    data: {
      transactions: transactions,
      count: transactions.length
    }
  });
}));

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Transaction bot API is running',
    timestamp: new Date().toISOString()
  });
});

export default router;