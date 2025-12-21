// src/services/llmService.js
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { LLMError } from '../utils/errors.js';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * System prompt that instructs the LLM to extract transaction data
 * and return ONLY valid JSON
 */
const SYSTEM_PROMPT = `You are a transaction data extraction assistant. Your job is to extract structured transaction information from user messages or OCR text and return ONLY valid JSON.

IMPORTANT RULES:
1. You MUST return ONLY valid JSON, no explanations, no markdown, no code blocks
2. The JSON must match this exact structure:
{
  "amount": <number>,
  "date": "<YYYY-MM-DD>",
  "merchant": "<string>",
  "category": "<string>",
  "type": "income" or "expense",
  "currency": "USD" (or other 3-letter code),
  "description": "<string>"
}

3. Transaction types: "income" for money received, "expense" for money spent
4. If date is not mentioned, use today's date in YYYY-MM-DD format
5. If category is unclear, choose the best matching category from common ones: Food, Transport, Shopping, Entertainment, Bills, Healthcare, Education, Income, Other
6. Amount should always be a positive number
7. If information is missing or unclear, make reasonable inferences based on context
8. For receipts, extract merchant name, total amount, and date from the text

Example valid responses:
{"amount": 50.00, "date": "2024-01-15", "merchant": "Target", "category": "Shopping", "type": "expense", "currency": "USD", "description": "Groceries"}

{"amount": 1200.00, "date": "2024-01-01", "merchant": "Employer", "category": "Income", "type": "income", "currency": "USD", "description": "Monthly salary"}`;

/**
 * Gets today's date in YYYY-MM-DD format
 * Used as default when date is not provided
 */
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Extracts structured transaction data from text using OpenAI
 * @param {string} text - User message or OCR text
 * @returns {Promise<Object>} Structured transaction data
 * @throws {LLMError} If extraction fails
 */
export const extractTransactionFromText = async (text) => {
  try {
    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new LLMError('Text input is required and cannot be empty');
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      throw new LLMError('OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file.');
    }

    console.log('Calling OpenAI to extract transaction data...');
    console.log('Input text:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using cost-effective model, can switch to 'gpt-4' for better accuracy
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Extract transaction information from this text: ${text}`
        }
      ],
      temperature: 0.1, // Low temperature for consistent, structured output
      max_tokens: 200, // Limit response length
      response_format: { type: 'json_object' } // Force JSON output (requires gpt-4o-mini, gpt-4, or gpt-3.5-turbo)
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new LLMError('Empty response from OpenAI');
    }

    console.log('OpenAI raw response:', responseContent);

    // Parse JSON response
    let transactionData;
    try {
      // Remove markdown code blocks if present (backup in case response_format doesn't work)
      const cleanJson = responseContent.replace(/\n?/g, '').replace(/```\n?/g, '').trim();
      transactionData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Failed to parse:', responseContent);
      throw new LLMError(`Failed to parse JSON response from OpenAI: ${parseError.message}`, parseError);
    }

    // Validate required fields
        // Validate required fields
        const requiredFields = ['amount', 'date', 'merchant', 'category', 'type'];
        const missingFields = requiredFields.filter(field => transactionData[field] === undefined || transactionData[field] === null);
    
        if (missingFields.length > 0) {
          console.error('LLM Response Data:', JSON.stringify(transactionData, null, 2));
          console.error('Missing fields:', missingFields);
          throw new LLMError(`Missing required fields in LLM response: ${missingFields.join(', ')}. Response: ${JSON.stringify(transactionData)}`);
        }

    // Ensure numeric fields are numbers
    if (typeof transactionData.amount === 'string') {
      transactionData.amount = parseFloat(transactionData.amount);
    }

    // Ensure date is in correct format (YYYY-MM-DD)
    if (transactionData.date && !/^\d{4}-\d{2}-\d{2}$/.test(transactionData.date)) {
      // Try to parse and reformat
      const parsedDate = new Date(transactionData.date);
      if (!isNaN(parsedDate.getTime())) {
        transactionData.date = parsedDate.toISOString().split('T')[0];
      } else {
        // If can't parse, use today's date
        transactionData.date = getTodayDate();
      }
    }

    // Set defaults for optional fields
    transactionData.currency = transactionData.currency || 'USD';
    transactionData.description = transactionData.description || '';

    console.log('Transaction data extracted successfully:', transactionData);
    return transactionData;

  } catch (error) {
    console.error('LLM Service Error:', error);

    // If it's already an LLMError, re-throw it
    if (error instanceof LLMError) {
      throw error;
    }

    // Handle OpenAI-specific errors
    if (error.response) {
      const statusCode = error.response.status;
      const errorMessage = error.response.data?.error?.message || error.message;

      if (statusCode === 401) {
        throw new LLMError('OpenAI API key is invalid. Please check your OPENAI_API_KEY in .env file.', error);
      }

      if (statusCode === 429) {
        throw new LLMError('OpenAI API rate limit exceeded. Please try again later.', error);
      }

      if (statusCode === 500) {
        throw new LLMError('OpenAI API server error. Please try again later.', error);
      }

      if (statusCode === 503) {
        throw new LLMError('OpenAI API service is temporarily unavailable. Please try again later.', error);
      }

      throw new LLMError(`OpenAI API error: ${errorMessage}`, error);
    }

    // Handle OpenAI SDK errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        throw new LLMError('OpenAI API key is invalid', error);
      }
      if (error.status === 429) {
        throw new LLMError('OpenAI API rate limit exceeded', error);
      }
      throw new LLMError(`OpenAI API error: ${error.message}`, error);
    }

    throw new LLMError(`Failed to extract transaction data: ${error.message}`, error);
  }
};

/**
 * Uses LLM to resolve transaction issues (duplicates, missing fields, etc.)
 * Optional function for advanced issue resolution
 * @param {string} issueDescription - Description of the issue
 * @param {Object} transactionData - Current transaction data
 * @param {Object} existingTransaction - Existing transaction if duplicate
 * @returns {Promise<Object>} Resolution recommendation
 */
export const resolveTransactionIssue = async (issueDescription, transactionData, existingTransaction = null) => {
  try {
    const prompt = `A transaction issue has been detected: ${issueDescription}

Current transaction data:
${JSON.stringify(transactionData, null, 2)}

${existingTransaction ? `Existing similar transaction:
${JSON.stringify(existingTransaction, null, 2)}` : ''}

Please provide a resolution recommendation in JSON format:
{
  "action": "save" | "skip" | "update",
  "reason": "<explanation>",
  "confidence": <0-1>,
  "updatedData": {<if action is update, provide corrected data>}
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a transaction validation assistant. Analyze transaction issues and provide resolution recommendations in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const response = JSON.parse(completion.choices[0].message.content);
    return response;

  } catch (error) {
    console.error('Issue resolution error:', error);
    // If resolution fails, default to saving the transaction
    return {
      action: 'save',
      reason: 'Unable to resolve issue automatically',
      confidence: 0.5
    };
  }
};

