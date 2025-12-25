// src/services/ocrService.js
import { textract } from '../config/aws.js';
import { OCRError } from '../utils/errors.js';
import fs from 'fs';
import { promisify } from 'util';

// Convert callback-based fs functions to promise-based
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

/**
 * Extracts text from an image using AWS Textract
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} Extracted text from the image
 * @throws {OCRError} If OCR extraction fails
 */
export const extractTextFromImage = async (imagePath) => {
  try {
    // Validate image path
    if (!imagePath || typeof imagePath !== 'string') {
      throw new OCRError('Image path is required and must be a string');
    }

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new OCRError(`Image file not found: ${imagePath}`);
    }

    // Read the image file
    console.log('Reading image file:', imagePath);
    const imageBytes = await readFile(imagePath);

    // Validate file size (AWS Textract has limits)
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (imageBytes.length > maxSize) {
      throw new OCRError(`Image file is too large. Maximum size is 10 MB. Current size: ${(imageBytes.length / 1024 / 1024).toFixed(2)} MB`);
    }

    // Call AWS Textract
    const params = {
      Document: {
        Bytes: imageBytes
      }
    };

    console.log('Calling AWS Textract...');
    const response = await textract.detectDocumentText(params).promise();

    // Extract text from Textract response
    let extractedText = '';
    
    if (response.Blocks) {
      // Textract returns blocks of text with different types
      // We're interested in LINE blocks (complete lines of text)
      const textBlocks = response.Blocks
        .filter(block => block.BlockType === 'LINE')
        .map(block => block.Text)
        .filter(text => text && text.trim().length > 0);

      extractedText = textBlocks.join('\n');
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new OCRError('No text could be extracted from the image. Please ensure the image contains readable text.');
    }

    console.log('Text extracted successfully. Length:', extractedText.length, 'characters');
    console.log('Preview:', extractedText.substring(0, 100) + '...');
    
    return extractedText.trim();

  } catch (error) {
    console.error('OCR Error:', error);
    
    // If it's already an OCRError, re-throw it
    if (error instanceof OCRError) {
      throw error;
    }

    // Handle AWS-specific errors
    if (error.code === 'InvalidParameterException') {
      throw new OCRError('Invalid image format. Supported formats: PNG, JPEG, PDF. Please ensure the file is a valid image.', error);
    }

    if (error.code === 'AccessDeniedException') {
      throw new OCRError('AWS Textract access denied. Check your AWS credentials and IAM permissions for Textract.', error);
    }

    if (error.code === 'InvalidS3ObjectException') {
      throw new OCRError('Invalid S3 object (if using S3). Check the file path and permissions.', error);
    }

    if (error.code === 'ProvisionedThroughputExceededException') {
      throw new OCRError('AWS Textract throughput limit exceeded. Please try again in a few moments.', error);
    }

    if (error.code === 'ThrottlingException') {
      throw new OCRError('AWS Textract request was throttled. Please try again later.', error);
    }

    // Generic error handling
    throw new OCRError(`OCR extraction failed: ${error.message}`, error);
  }
};

/**
 * Extracts text from image buffer (alternative method)
 * Useful when image is already in memory (e.g., from multer)
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<string>} Extracted text
 * @throws {OCRError} If OCR extraction fails
 */
export const extractTextFromBuffer = async (imageBuffer) => {
  try {
    // Validate buffer
    if (!Buffer.isBuffer(imageBuffer)) {
      throw new OCRError('Image buffer is required and must be a Buffer');
    }

    // Validate file size
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (imageBuffer.length > maxSize) {
      throw new OCRError(`Image buffer is too large. Maximum size is 10 MB. Current size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    }

    const params = {
      Document: {
        Bytes: imageBuffer
      }
    };

    console.log('Calling AWS Textract with buffer...');
    const response = await textract.detectDocumentText(params).promise();

    let extractedText = '';
    
    if (response.Blocks) {
      const textBlocks = response.Blocks
        .filter(block => block.BlockType === 'LINE')
        .map(block => block.Text)
        .filter(text => text && text.trim().length > 0);

      extractedText = textBlocks.join('\n');
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new OCRError('No text could be extracted from the image buffer');
    }

    console.log('Text extracted from buffer successfully. Length:', extractedText.length, 'characters');
    
    return extractedText.trim();
  } catch (error) {
    console.error('OCR Buffer Error:', error);
    
    if (error instanceof OCRError) {
      throw error;
    }

    // Handle AWS-specific errors (same as extractTextFromImage)
    if (error.code === 'InvalidParameterException') {
      throw new OCRError('Invalid image format. Supported formats: PNG, JPEG, PDF.', error);
    }

    if (error.code === 'AccessDeniedException') {
      throw new OCRError('AWS Textract access denied. Check your AWS credentials and IAM permissions.', error);
    }

    throw new OCRError(`OCR extraction from buffer failed: ${error.message}`, error);
  }
};

/**
 * Cleanup function to delete temporary image file
 * Used after processing to free up disk space
 * @param {string} filePath - Path to file to delete
 * @returns {Promise<void>}
 */
export const cleanupImageFile = async (filePath) => {
  try {
    if (!filePath) {
      return; // Nothing to clean up
    }

    // Check if file exists before trying to delete
    if (fs.existsSync(filePath)) {
      await unlink(filePath);
      console.log('Temporary image file deleted:', filePath);
    } else {
      console.log('File already deleted or does not exist:', filePath);
    }
  } catch (error) {
    console.error('Error deleting temporary file:', error);
    // Don't throw - cleanup errors shouldn't break the main flow
    // Just log the error and continue
  }
};

/**
 * Validates image file extension
 * @param {string} filename - File name or path
 * @returns {boolean} True if file extension is supported
 */
export const isValidImageFormat = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  const supportedFormats = ['.jpg', '.jpeg', '.png', '.pdf'];
  const lowerFilename = filename.toLowerCase();
  
  return supportedFormats.some(format => lowerFilename.endsWith(format));
};