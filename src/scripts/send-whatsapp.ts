#!/usr/bin/env node

/**
 * WhatsApp EOD Summary Sender
 * 
 * This script sends the EOD summary to WhatsApp using Twilio's API.
 * It reads the latest EOD summary file and sends its contents as a WhatsApp message.
 */

import { loadWhatsAppConfig } from '../config/env';
import { WhatsAppService } from '../services/WhatsAppService';
import { getLatestFile, readFileContent } from '../utils/file';

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    console.log('📱 Preparing EOD summary for WhatsApp...');

    // Load WhatsApp configuration
    const config = loadWhatsAppConfig();
    const whatsApp = new WhatsAppService(config);
    
    // Get the latest EOD summary file
    const outputDir = process.env.OUTPUT_DIR || 'reports';
    const latestFile = getLatestFile(outputDir, 'eod-summary');
    
    if (!latestFile) {
      throw new Error('No EOD summary files found');
    }
    
    if (config.debug) {
      console.debug('[DEBUG] Latest EOD summary file:', latestFile);
    }

    // Read the EOD summary
    const summary = readFileContent(latestFile);
    
    if (!summary) {
      throw new Error(`Failed to read EOD summary file: ${latestFile}`);
    }

    // Format for WhatsApp (may return multiple message parts)
    const messageParts = whatsApp.formatContent(summary);
    
    if (config.debug) {
      console.debug(`[DEBUG] Message will be sent in ${messageParts.length} part(s)`);
    }

    // Send to WhatsApp
    await whatsApp.sendMultipartMessage(messageParts);
  } catch (error) {
    console.error(
      '❌ Failed to send EOD summary to WhatsApp:',
      (error as Error).message
    );
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
