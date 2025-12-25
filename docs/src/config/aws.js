// src/config/aws.js
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configure AWS credentials and region
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Initialize AWS services
export const dynamoDB = new AWS.DynamoDB.DocumentClient();
export const textract = new AWS.Textract();

// DynamoDB table name from environment variable
export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'transactions';

/**
 * Helper function to check if AWS configuration is valid
 * Throws an error if credentials are missing
 * @returns {boolean} true if configuration is valid
 * @throws {Error} if AWS credentials are not configured
 */
export const checkAWSConfig = () => {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials are not configured. Please check your .env file.');
  }
  
  if (!process.env.AWS_REGION) {
    console.warn('Warning: AWS_REGION not set, using default: us-east-1');
  }
  
  console.log('AWS Configuration loaded successfully');
  console.log('Region:', process.env.AWS_REGION || 'us-east-1');
  console.log('Table Name:', TABLE_NAME);
  
  return true;
};

// Export default object with all AWS services
export default {
  dynamoDB,
  textract,
  TABLE_NAME,
  checkAWSConfig
};