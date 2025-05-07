/**
 * File utility functions
 */

import fs from 'fs';
import path from 'path';

/**
 * Ensures a directory exists, creating it if necessary
 * @param dirPath Directory path to ensure
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Gets the latest file matching a pattern in a directory
 * @param dirPath Directory to search in
 * @param pattern File name pattern to match
 * @returns Path to the latest file, or null if none found
 */
export function getLatestFile(dirPath: string, pattern: string): string | null {
  try {
    if (!fs.existsSync(dirPath)) {
      return null;
    }

    const files = fs.readdirSync(dirPath)
      .filter(file => file.startsWith(pattern))
      .sort()
      .reverse();

    if (files.length === 0) {
      return null;
    }

    return path.join(dirPath, files[0]);
  } catch (error) {
    console.error(`Error finding latest file: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Reads a file's content
 * @param filePath Path to the file
 * @returns File content as a string, or null if the file doesn't exist
 */
export function readFileContent(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Writes content to a file
 * @param filePath Path to the file
 * @param content Content to write
 * @returns True if successful, false otherwise
 */
export function writeFileContent(filePath: string, content: string): boolean {
  try {
    ensureDirectoryExists(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing file: ${(error as Error).message}`);
    return false;
  }
}
