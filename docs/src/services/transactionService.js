// src/services/transactionService.js
import { extractTextFromImage, extractTextFromBuffer, cleanupImageFile } from './services./ocrServices.js';
import { extractTransactionFromText } from './services/llmServices.js';

import { 
  createTransaction, 
  checkForDuplicates, 
  getUserTransactions,
  getTransaction 
} from './services./dynamodbService.js';
import { validateTransaction, validateUserId } from '../utils/validation.js';
import { ValidationError } from '../utils/errors.js';

/**
 * Processes a transaction from text input
 * @param {string} userId - User identifier
 * @param {string} text - User message or text input
 * @returns {Promise<Object>} Created transaction and confirmation message
 */
export const processTransactionFromText = async (userId, text) => {
  try {
    // Validate user ID
    const validUserId = validateUserId(userId);

    // Extract transaction data using LLM
    let transactionData = await extractTransactionFromText(text);

    // Add source and raw text
    transactionData.source = 'manual';
    transactionData.rawText = text;

    // Validate transaction data
    const validatedData = validateTransaction(transactionData);

    // Check for duplicates
    const duplicates = await checkForDuplicates(validUserId, validatedData);
    
    if (duplicates.length > 0) {
      return {
        transaction: null,
        message: `⚠️ Potential duplicate transaction detected. Similar transaction found: $${duplicates[0].amount} at ${duplicates[0].merchant} on ${duplicates[0].date}. Transaction ID: ${duplicates[0].transactionId}`,
        isDuplicate: true,
        duplicateTransaction: duplicates[0]
      };
    }

    // Create transaction in database
    const createdTransaction = await createTransaction(validUserId, validatedData);

    // Generate confirmation message
    const confirmationMessage = generateConfirmationMessage(createdTransaction);

    return {
      transaction: createdTransaction,
      message: confirmationMessage,
      isDuplicate: false
    };

  } catch (error) {
    console.error('Error processing transaction from text:', error);
    throw error;
  }
};

/**
 * Processes a transaction from uploaded image (receipt)
 * @param {string} userId - User identifier
 * @param {string} imagePath - Path to uploaded image file
 * @returns {Promise<Object>} Created transaction and confirmation message
 */
export const processTransactionFromImage = async (userId, imagePath) => {
  let cleanedUp = false;

  try {
    // Validate user ID
    const validUserId = validateUserId(userId);

    // Extract text from image using OCR
    console.log('Extracting text from image...');
    const extractedText = await extractTextFromImage(imagePath);

    // Extract transaction data from OCR text using LLM
    console.log('Extracting transaction data from OCR text...');
    let transactionData = await extractTransactionFromText(extractedText);

    // Add source and raw text
    transactionData.source = 'ocr';
    transactionData.rawText = extractedText;

    // Validate transaction data
    const validatedData = validateTransaction(transactionData);

    // Check for duplicates
    const duplicates = await checkForDuplicates(validUserId, validatedData);
    
    if (duplicates.length > 0) {
      // Cleanup image file
      await cleanupImageFile(imagePath);
      cleanedUp = true;

      return {
        transaction: null,
        message: `⚠️ Potential duplicate transaction detected from receipt. Similar transaction found: $${duplicates[0].amount} at ${duplicates[0].merchant} on ${duplicates[0].date}. Transaction ID: ${duplicates[0].transactionId}`,
        isDuplicate: true,
        duplicateTransaction: duplicates[0]
      };
    }

    // Create transaction in database
    const createdTransaction = await createTransaction(validUserId, validatedData);

    // Cleanup image file after successful processing
    await cleanupImageFile(imagePath);
    cleanedUp = true;

    // Generate confirmation message
    const confirmationMessage = generateConfirmationMessage(createdTransaction, true);

    return {
      transaction: createdTransaction,
      message: confirmationMessage,
      isDuplicate: false
    };

  } catch (error) {
    console.error('Error processing transaction from image:', error);
    
    // Cleanup image file on error (if not already cleaned up)
    if (!cleanedUp) {
      await cleanupImageFile(imagePath);
    }
    
    throw error;
  }
};

/**
 * Processes a transaction from image buffer (from multer)
 * @param {string} userId - User identifier
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<Object>} Created transaction and confirmation message
 */
export const processTransactionFromBuffer = async (userId, imageBuffer) => {
  try {
    // Validate user ID
    const validUserId = validateUserId(userId);

    // Extract text from image buffer using OCR
    console.log('Extracting text from image buffer...');
    const extractedText = await extractTextFromBuffer(imageBuffer);

    // Extract transaction data from OCR text using LLM
    console.log('Extracting transaction data from OCR text...');
    let transactionData = await extractTransactionFromText(extractedText);

    // Add source and raw text
    transactionData.source = 'ocr';
    transactionData.rawText = extractedText;

    // Validate transaction data
    const validatedData = validateTransaction(transactionData);

    // Check for duplicates
    const duplicates = await checkForDuplicates(validUserId, validatedData);
    
    if (duplicates.length > 0) {
      return {
        transaction: null,
        message: `⚠️ Potential duplicate transaction detected from receipt. Similar transaction found: $${duplicates[0].amount} at ${duplicates[0].merchant} on ${duplicates[0].date}. Transaction ID: ${duplicates[0].transactionId}`,
        isDuplicate: true,
        duplicateTransaction: duplicates[0]
      };
    }

    // Create transaction in database
    const createdTransaction = await createTransaction(validUserId, validatedData);

    // Generate confirmation message
    const confirmationMessage = generateConfirmationMessage(createdTransaction, true);

    return {
      transaction: createdTransaction,
      message: confirmationMessage,
      isDuplicate: false
    };

  } catch (error) {
    console.error('Error processing transaction from buffer:', error);
    throw error;
  }
};

/**
 * Gets all transactions for a user
 * @param {string} userId - User identifier
 * @param {number} limit - Maximum number of transactions to return
 * @returns {Promise<Array>} Array of transactions
 */
export const getUserTransactionHistory = async (userId, limit = 100) => {
  try {
    const validUserId = validateUserId(userId);
    const transactions = await getUserTransactions(validUserId, limit);
    return transactions;
  } catch (error) {
    console.error('Error getting user transaction history:', error);
    throw error;
  }
};

/**
 * Generates a confirmation message for a transaction
 * @param {Object} transaction - Transaction object
 * @param {boolean} fromReceipt - Whether transaction came from receipt/image
 * @returns {string} Confirmation message
 */
const generateConfirmationMessage = (transaction, fromReceipt = false) => {
  const sourceText = fromReceipt ? 'from receipt' : '';
  const typeEmoji = transaction.type === 'income' ? '💰' : '💸';
  const typeText = transaction.type === 'income' ? 'income' : 'expense';
  
  return `✅ Transaction recorded ${sourceText}: $${transaction.amount.toFixed(2)} ${typeText} at ${transaction.merchant} (${transaction.category}). Transaction ID: ${transaction.transactionId}`;
};