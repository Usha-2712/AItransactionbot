// src/services/dynamodbService.js
import { dynamoDB, TABLE_NAME } from '../config/aws.js';
import { DatabaseError } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a new transaction record in DynamoDB
 * @param {string} userId - User identifier
 * @param {Object} transactionData - Transaction data object
 * @returns {Promise<Object>} Created transaction record
 * @throws {DatabaseError} If creation fails
 */
export const createTransaction = async (userId, transactionData) => {
  try {
    // Generate unique transaction ID
    const transactionId = `tx-${uuidv4()}`;
    
    // Get current timestamp
    const timestamp = Date.now();
    const now = new Date().toISOString();

    // Build transaction item
    const item = {
      userId: userId,
      transactionId: transactionId,
      timestamp: timestamp,
      amount: transactionData.amount,
      currency: transactionData.currency || 'USD',
      date: transactionData.date,
      merchant: transactionData.merchant,
      category: transactionData.category,
      type: transactionData.type,
      description: transactionData.description || '',
      source: transactionData.source || 'manual',
      rawText: transactionData.rawText || '',
      status: 'confirmed',
      createdAt: now,
      updatedAt: now
    };

    const params = {
      TableName: TABLE_NAME,
      Item: item
    };

    console.log('Creating transaction in DynamoDB:', transactionId);
    await dynamoDB.put(params).promise();

    console.log('Transaction created successfully:', transactionId);
    return item;

  } catch (error) {
    console.error('Error creating transaction:', error);
    throw new DatabaseError(`Failed to create transaction: ${error.message}`, error);
  }
};

/**
 * Gets a transaction by ID
 * @param {string} userId - User identifier
 * @param {string} transactionId - Transaction identifier
 * @returns {Promise<Object|null>} Transaction object or null if not found
 * @throws {DatabaseError} If query fails
 */
export const getTransaction = async (userId, transactionId) => {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        userId: userId,
        transactionId: transactionId
      }
    };

    const result = await dynamoDB.get(params).promise();
    
    return result.Item || null;

  } catch (error) {
    console.error('Error getting transaction:', error);
    throw new DatabaseError(`Failed to get transaction: ${error.message}`, error);
  }
};

/**
 * Queries transactions by user ID
 * @param {string} userId - User identifier
 * @param {number} limit - Maximum number of results (default: 100)
 * @returns {Promise<Array>} Array of transaction objects
 * @throws {DatabaseError} If query fails
 */
export const getUserTransactions = async (userId, limit = 100) => {
  try {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false, // Sort by transactionId descending (newest first)
      Limit: limit
    };

    const result = await dynamoDB.query(params).promise();
    
    return result.Items || [];

  } catch (error) {
    console.error('Error getting user transactions:', error);
    throw new DatabaseError(`Failed to get user transactions: ${error.message}`, error);
  }
};

/**
 * Checks for duplicate transactions based on merchant, date, and amount
 * @param {string} userId - User identifier
 * @param {Object} transactionData - Transaction data to check
 * @returns {Promise<Array>} Array of similar transactions found
 * @throws {DatabaseError} If query fails
 */
export const checkForDuplicates = async (userId, transactionData) => {
  try {
    const { merchant, date, amount } = transactionData;
    
    // Use GSI (merchant-date-index) to find similar transactions
    // Note: This requires the GSI to be created in DynamoDB
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'merchant-date-index', // GSI name
      KeyConditionExpression: 'merchant = :merchant AND #date = :date',
      ExpressionAttributeNames: {
        '#date': 'date' // 'date' is a reserved word, so we use ExpressionAttributeNames
      },
      ExpressionAttributeValues: {
        ':merchant': merchant,
        ':date': date
      }
    };

    const result = await dynamoDB.query(params).promise();
    
    // Filter by similar amount (within 5% tolerance)
    const tolerance = 0.05; // 5%
    const similarTransactions = (result.Items || []).filter(item => {
      if (item.userId !== userId) return false; // Only same user
      const amountDifference = Math.abs(item.amount - amount);
      const percentDifference = amountDifference / amount;
      return percentDifference <= tolerance; // Within 5% of amount
    });

    return similarTransactions;

  } catch (error) {
    console.error('Error checking for duplicates:', error);
    
    // If GSI doesn't exist, fall back to scanning (less efficient)
    // This is a fallback for when GSI is not yet created
    if (error.code === 'ResourceNotFoundException' || error.message.includes('index')) {
      console.warn('GSI not found, using scan fallback for duplicate check');
      return await checkForDuplicatesFallback(userId, transactionData);
    }
    
    throw new DatabaseError(`Failed to check for duplicates: ${error.message}`, error);
  }
};

/**
 * Fallback method to check duplicates using scan (less efficient)
 * Used when GSI is not available
 * @param {string} userId - User identifier
 * @param {Object} transactionData - Transaction data to check
 * @returns {Promise<Array>} Array of similar transactions
 */
const checkForDuplicatesFallback = async (userId, transactionData) => {
  try {
    const { merchant, date, amount } = transactionData;
    
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'userId = :userId AND merchant = :merchant AND #date = :date',
      ExpressionAttributeNames: {
        '#date': 'date'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':merchant': merchant,
        ':date': date
      },
      Limit: 100
    };

    const result = await dynamoDB.scan(params).promise();
    
    // Filter by similar amount (within 5% tolerance)
    const tolerance = 0.05;
    const similarTransactions = (result.Items || []).filter(item => {
      const amountDifference = Math.abs(item.amount - amount);
      const percentDifference = amountDifference / amount;
      return percentDifference <= tolerance;
    });

    return similarTransactions;

  } catch (error) {
    console.error('Error in fallback duplicate check:', error);
    throw new DatabaseError(`Failed to check for duplicates (fallback): ${error.message}`, error);
  }
};

/**
 * Updates a transaction record
 * @param {string} userId - User identifier
 * @param {string} transactionId - Transaction identifier
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated transaction object
 * @throws {DatabaseError} If update fails
 */
export const updateTransaction = async (userId, transactionId, updates) => {
  try {
    // Build update expression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    // Allowed fields to update
    const allowedFields = ['amount', 'date', 'merchant', 'category', 'type', 'description', 'status'];
    
    Object.keys(updates).forEach((key, index) => {
      if (allowedFields.includes(key)) {
        updateExpressions.push(`#${key} = :val${index}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:val${index}`] = updates[key];
      }
    });

    if (updateExpressions.length === 0) {
      throw new DatabaseError('No valid fields to update');
    }

    // Always update updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const params = {
      TableName: TABLE_NAME,
      Key: {
        userId: userId,
        transactionId: transactionId
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    console.log('Updating transaction:', transactionId);
    const result = await dynamoDB.update(params).promise();

    console.log('Transaction updated successfully:', transactionId);
    return result.Attributes;

  } catch (error) {
    console.error('Error updating transaction:', error);
    throw new DatabaseError(`Failed to update transaction: ${error.message}`, error);
  }
};

/**
 * Deletes a transaction record
 * @param {string} userId - User identifier
 * @param {string} transactionId - Transaction identifier
 * @returns {Promise<void>}
 * @throws {DatabaseError} If deletion fails
 */
export const deleteTransaction = async (userId, transactionId) => {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        userId: userId,
        transactionId: transactionId
      }
    };

    console.log('Deleting transaction:', transactionId);
    await dynamoDB.delete(params).promise();

    console.log('Transaction deleted successfully:', transactionId);

  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw new DatabaseError(`Failed to delete transaction: ${error.message}`, error);
  }
};

/**
 * Gets transactions by date range
 * @param {string} userId - User identifier
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of transactions in date range
 * @throws {DatabaseError} If query fails
 */
export const getTransactionsByDateRange = async (userId, startDate, endDate) => {
  try {
    // This uses a scan with filter (less efficient but works without GSI)
    // For better performance, use a GSI with date as sort key
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'userId = :userId AND #date BETWEEN :startDate AND :endDate',
      ExpressionAttributeNames: {
        '#date': 'date'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':startDate': startDate,
        ':endDate': endDate
      }
    };

    const result = await dynamoDB.scan(params).promise();
    
    // Sort by date descending
    const sorted = (result.Items || []).sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });

    return sorted;

  } catch (error) {
    console.error('Error getting transactions by date range:', error);
    throw new DatabaseError(`Failed to get transactions by date range: ${error.message}`, error);
  }
};