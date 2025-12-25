// src/utils/validation.js
import { ValidationError } from './errors.js';

/**
 * Validates transaction amount
 * @param {number|string} amount - Transaction amount
 * @returns {number} Validated numeric amount
 * @throws {ValidationError} If amount is invalid
 */
export const validateAmount = (amount) => {
  if (amount === undefined || amount === null) {
    throw new ValidationError('Amount is required', 'amount');
  }

  // Convert string to number if needed
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Check if it's a valid number
  if (isNaN(numAmount)) {
    throw new ValidationError('Amount must be a valid number', 'amount');
  }

  // Check if amount is positive
  if (numAmount <= 0) {
    throw new ValidationError('Amount must be greater than 0', 'amount');
  }

  // Check if amount is not too large (prevent overflow)
  if (numAmount > 1000000000) {
    throw new ValidationError('Amount is too large (max: 1,000,000,000)', 'amount');
  }

  return numAmount;
};

/**
 * Validates transaction date
 * @param {string} dateString - Date string in ISO format (YYYY-MM-DD)
 * @returns {string} Validated ISO date string
 * @throws {ValidationError} If date is invalid
 */
export const validateDate = (dateString) => {
  if (!dateString) {
    throw new ValidationError('Date is required', 'date');
  }

  // Try to parse the date
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date format. Use ISO 8601 format (YYYY-MM-DD)', 'date');
  }

  // Check if date is not too far in the future (within 1 year)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  
  if (date > oneYearFromNow) {
    throw new ValidationError('Date cannot be more than 1 year in the future', 'date');
  }

  // Format to ISO date string (YYYY-MM-DD)
  return date.toISOString().split('T')[0];
};

/**
 * Validates transaction type (income or expense)
 * @param {string} type - Transaction type
 * @returns {string} Validated transaction type (lowercase)
 * @throws {ValidationError} If type is invalid
 */
export const validateTransactionType = (type) => {
  const validTypes = ['income', 'expense'];
  
  if (!type) {
    throw new ValidationError('Transaction type is required', 'type');
  }

  const lowerType = type.toLowerCase();
  
  if (!validTypes.includes(lowerType)) {
    throw new ValidationError(`Transaction type must be either 'income' or 'expense'. Received: ${type}`, 'type');
  }

  return lowerType;
};

/**
 * Validates merchant name
 * @param {string} merchant - Merchant name
 * @returns {string} Validated merchant name (trimmed)
 * @throws {ValidationError} If merchant is invalid
 */
export const validateMerchant = (merchant) => {
  if (!merchant || typeof merchant !== 'string') {
    throw new ValidationError('Merchant name is required and must be a string', 'merchant');
  }

  const trimmed = merchant.trim();
  
  if (trimmed.length === 0) {
    throw new ValidationError('Merchant name cannot be empty', 'merchant');
  }

  if (trimmed.length > 200) {
    throw new ValidationError('Merchant name is too long (max 200 characters)', 'merchant');
  }

  return trimmed;
};

/**
 * Validates category
 * @param {string} category - Transaction category
 * @returns {string} Validated category (trimmed)
 * @throws {ValidationError} If category is invalid
 */
export const validateCategory = (category) => {
  if (!category || typeof category !== 'string') {
    throw new ValidationError('Category is required and must be a string', 'category');
  }

  const trimmed = category.trim();
  
  if (trimmed.length === 0) {
    throw new ValidationError('Category cannot be empty', 'category');
  }

  if (trimmed.length > 100) {
    throw new ValidationError('Category is too long (max 100 characters)', 'category');
  }

  return trimmed;
};

/**
 * Validates currency code
 * @param {string} currency - Currency code (e.g., USD, EUR)
 * @returns {string} Validated currency code (uppercase)
 * @throws {ValidationError} If currency is invalid
 */
export const validateCurrency = (currency) => {
  if (!currency || typeof currency !== 'string') {
    return 'USD'; // Default to USD if not provided
  }

  const upperCurrency = currency.toUpperCase().trim();
  
  // Currency codes should be 3 letters (ISO 4217 standard)
  if (upperCurrency.length !== 3) {
    throw new ValidationError('Currency must be a 3-letter code (e.g., USD, EUR)', 'currency');
  }

  // Check if it's alphanumeric (should be all letters)
  if (!/^[A-Z]{3}$/.test(upperCurrency)) {
    throw new ValidationError('Currency code must contain only letters', 'currency');
  }

  return upperCurrency;
};

/**
 * Validates complete transaction object
 * @param {Object} transaction - Transaction object to validate
 * @returns {Object} Validated and sanitized transaction object
 * @throws {ValidationError} If validation fails
 */
export const validateTransaction = (transaction) => {
  try {
    const validated = {
      amount: validateAmount(transaction.amount),
      date: validateDate(transaction.date),
      type: validateTransactionType(transaction.type),
      merchant: validateMerchant(transaction.merchant),
      category: validateCategory(transaction.category),
      currency: validateCurrency(transaction.currency || 'USD'),
      description: transaction.description ? String(transaction.description).trim() : '',
      source: transaction.source || 'manual',
      rawText: transaction.rawText || ''
    };

    // Validate description length if provided
    if (validated.description.length > 500) {
      throw new ValidationError('Description is too long (max 500 characters)', 'description');
    }

    return validated;
  } catch (error) {
    // If it's already a ValidationError, re-throw it
    if (error instanceof ValidationError) {
      throw error;
    }
    // Otherwise, wrap it in a ValidationError
    throw new ValidationError(`Validation failed: ${error.message}`);
  }
};

/**
 * Validates user ID
 * @param {string} userId - User identifier
 * @returns {string} Validated user ID (trimmed)
 * @throws {ValidationError} If user ID is invalid
 */
export const validateUserId = (userId) => {
  if (!userId || typeof userId !== 'string') {
    throw new ValidationError('User ID is required and must be a string', 'userId');
  }

  const trimmed = userId.trim();
  
  if (trimmed.length === 0) {
    throw new ValidationError('User ID cannot be empty', 'userId');
  }

  if (trimmed.length > 100) {
    throw new ValidationError('User ID is too long (max 100 characters)', 'userId');
  }

  return trimmed;
};