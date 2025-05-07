#!/usr/bin/env node

/**
 * WhatsApp EOD Summary Sender
 *
 * This script sends the EOD summary to WhatsApp using Twilio's API.
 * It reads the latest EOD summary file and sends its contents as a WhatsApp message.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import twilio from 'twilio';

// Configuration from environment variables
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM;
const whatsAppTo = process.env.WHATSAPP_TO ?? '';
const outputDir = process.env.OUTPUT_DIR || 'reports';
const debug = process.env.DEBUG === 'true';

// Validate configuration
if (
  !twilioAccountSid ||
  !twilioAuthToken ||
  !twilioWhatsAppFrom ||
  !whatsAppTo
) {
  console.error(
    '❌ Error: Missing WhatsApp configuration. Please set the following environment variables:'
  );
  console.error('  - TWILIO_ACCOUNT_SID: Your Twilio Account SID');
  console.error('  - TWILIO_AUTH_TOKEN: Your Twilio Auth Token');
  console.error(
    '  - TWILIO_WHATSAPP_FROM: Your Twilio WhatsApp number (format: whatsapp:+1234567890)'
  );
  console.error(
    "  - WHATSAPP_TO: The recipient's WhatsApp number (format: whatsapp:+1234567890)"
  );
  process.exit(1);
}

// Initialize Twilio client
const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

/**
 * Gets the latest EOD summary file
 * @returns Path to the latest EOD summary file
 */
function getLatestEODSummaryFile(): string {
  try {
    const files = fs.readdirSync(outputDir);
    // Filter for EOD summary files
    const eodFiles = files.filter((file) => file.startsWith('eod-summary'));

    if (eodFiles.length === 0) {
      throw new Error('No EOD summary files found');
    }

    // Sort by date (newest first)
    eodFiles.sort().reverse();

    return path.join(outputDir, eodFiles[0]);
  } catch (error) {
    console.error(
      `❌ Error finding EOD summary file: ${(error as Error).message}`
    );
    throw error;
  }
}

/**
 * Reads the EOD summary file content
 * @param filePath Path to the EOD summary file
 * @returns Content of the EOD summary file
 */
function readEODSummary(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(
      `❌ Error reading EOD summary file: ${(error as Error).message}`
    );
    throw error;
  }
}

/**
 * Formats the EOD summary for WhatsApp
 * @param content Raw EOD summary content
 * @returns Array of formatted message parts for WhatsApp
 */
function formatForWhatsApp(content: string): string[] {
  // Get today's date in a nice format
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Add a header
  const header = `*EOD Summary - ${dateStr}*\n\n`;

  // WhatsApp message limit is around 1600 characters, but we'll use 1500 to be safe
  const MAX_MESSAGE_LENGTH = 1500;
  const MAX_CONTENT_LENGTH = MAX_MESSAGE_LENGTH - header.length;

  // If content is short enough, return as a single message
  if (content.length <= MAX_CONTENT_LENGTH) {
    return [header + content];
  }

  // Split content into multiple parts
  const messages: string[] = [];
  let remainingContent = content;
  let partNumber = 1;

  // Calculate total parts
  const totalParts = Math.ceil(content.length / MAX_CONTENT_LENGTH);

  while (remainingContent.length > 0) {
    // Find a good breaking point (end of a line) within the limit
    let endIndex = Math.min(MAX_CONTENT_LENGTH, remainingContent.length);
    if (endIndex < remainingContent.length) {
      // Try to find a line break to split at
      const lastLineBreak = remainingContent.lastIndexOf(
        '\n',
        MAX_CONTENT_LENGTH
      );
      if (lastLineBreak > MAX_CONTENT_LENGTH / 2) {
        endIndex = lastLineBreak + 1; // Include the newline
      }
    }

    const part = remainingContent.substring(0, endIndex);
    remainingContent = remainingContent.substring(endIndex);

    // Create message with part number for multiple parts
    const messageHeader = `*EOD Summary - ${dateStr} (Part ${partNumber}/${totalParts})*\n\n`;

    messages.push(messageHeader + part);
    partNumber++;
  }

  return messages;
}

/**
 * Sends a single WhatsApp message
 * @param message Message content to send
 * @param partInfo Optional part information for multi-part messages
 * @returns Promise that resolves when the message is sent
 */
async function sendSingleWhatsAppMessage(
  message: string,
  partInfo?: { current: number; total: number }
): Promise<any> {
  try {
    if (debug) {
      console.debug('[DEBUG] Sending WhatsApp message to:', whatsAppTo);
      console.debug('[DEBUG] Message length:', message.length);
      if (partInfo) {
        console.debug(
          `[DEBUG] Sending part ${partInfo.current} of ${partInfo.total}`
        );
      }
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: twilioWhatsAppFrom,
      to: whatsAppTo,
    });

    if (debug) {
      console.debug('[DEBUG] Message sent with SID:', result.sid);
    }

    if (partInfo) {
      console.log(
        `✅ Part ${partInfo.current}/${partInfo.total} sent successfully!`
      );
    } else {
      console.log('✅ Message sent successfully!');
    }

    return result;
  } catch (error) {
    console.error(
      `❌ Error sending WhatsApp message: ${(error as Error).message}`
    );
    throw error;
  }
}

/**
 * Sends the EOD summary to WhatsApp, handling multiple parts if needed
 * @param messages Array of message parts to send
 * @returns Promise that resolves when all messages are sent
 */
async function sendWhatsAppMessage(messages: string[]): Promise<any[]> {
  try {
    const results = [];
    const totalMessages = messages.length;

    if (totalMessages > 1) {
      console.log(`📱 Sending EOD summary in ${totalMessages} parts...`);
    }

    // Add a small delay between messages to avoid rate limiting
    for (let i = 0; i < messages.length; i++) {
      const result = await sendSingleWhatsAppMessage(
        messages[i],
        totalMessages > 1 ? { current: i + 1, total: totalMessages } : undefined
      );
      results.push(result);

      // Add a delay between messages if there are more to send
      if (i < messages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (totalMessages > 1) {
      console.log('✅ All EOD summary parts sent to WhatsApp successfully!');
    } else {
      console.log('✅ EOD summary sent to WhatsApp successfully!');
    }

    return results;
  } catch (error) {
    console.error(
      `❌ Error sending WhatsApp messages: ${(error as Error).message}`
    );
    throw error;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    console.log('📱 Preparing EOD summary for WhatsApp...');

    // Get the latest EOD summary file
    const latestFile = getLatestEODSummaryFile();
    if (debug) {
      console.debug('[DEBUG] Latest EOD summary file:', latestFile);
    }

    // Read the EOD summary
    const summary = readEODSummary(latestFile);

    // Format for WhatsApp (may return multiple message parts)
    const messageParts = formatForWhatsApp(summary);

    if (debug) {
      console.debug(
        `[DEBUG] Message will be sent in ${messageParts.length} part(s)`
      );
    }

    // Send to WhatsApp
    await sendWhatsAppMessage(messageParts);
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
