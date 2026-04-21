import fs from 'fs';
import path from 'path';

/**
 * Ensures the directory for the output file exists. If not, creates it.
 * @param {string} filePath - The path of the file (including the file name).
 */
export const ensureDirectoryExistence = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * @description Formats the output of the generated OpenAPI schema to avoid eslint errors.
 * @param {string} output - The output of the generated OpenAPI schema.
 * @returns {string} The formatted output.
 */
export const formatOutput = (output) => {
  return (
    output
      // Replace double quotes with single quotes
      .replace(/"/g, "'")
      // Replace 4 spaces with 2 spaces
      .replace(/ {4}/g, '  ')
  );
};

/**
 * Capitalize a string for use as a type name prefix.
 * Handles special chars like $ by removing them.
 * @param {string} str
 * @returns {string}
 */
export const capitalize = (str) => {
  const clean = str.replace(/[^a-zA-Z0-9]/g, '');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};
