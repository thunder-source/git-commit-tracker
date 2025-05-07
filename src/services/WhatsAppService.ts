/**
 * WhatsApp Messaging Service
 * Handles sending messages to WhatsApp using Twilio
 */

import twilio from 'twilio';
import type { MessagePartInfo, WhatsAppConfig } from '../types';

/**
 * Service for sending WhatsApp messages
 */
export class WhatsAppService {
  private client: twilio.Twilio;
  private fromNumber: string;
  private toNumber: string;
  private debug: boolean;

  /**
   * Creates a new WhatsAppService instance
   * @param config WhatsApp configuration
   */
  constructor(config: WhatsAppConfig) {
    this.client = twilio(config.accountSid, config.authToken);
    this.fromNumber = config.fromNumber;
    this.toNumber = config.toNumber;
    this.debug = config.debug ?? false;
  }

  /**
   * Formats a date for display in messages
   * @param date Date to format
   * @returns Formatted date string
   */
  private formatDate(date: Date = new Date()): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Formats content for WhatsApp, splitting into multiple parts if needed
   * @param content Raw content to format
   * @param date Optional date to include in the header
   * @returns Array of formatted message parts
   */
  public formatContent(content: string, date?: Date): string[] {
    const dateStr = this.formatDate(date);
    
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
        const lastLineBreak = remainingContent.lastIndexOf('\n', MAX_CONTENT_LENGTH);
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
  public async sendSingleMessage(
    message: string,
    partInfo?: MessagePartInfo
  ): Promise<any> {
    try {
      if (this.debug) {
        console.debug('[DEBUG] Sending WhatsApp message to:', this.toNumber);
        console.debug('[DEBUG] Message length:', message.length);
        if (partInfo) {
          console.debug(
            `[DEBUG] Sending part ${partInfo.current} of ${partInfo.total}`
          );
        }
      }

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: this.toNumber,
      });

      if (this.debug) {
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
   * Sends multiple message parts with a delay between them
   * @param messages Array of message parts to send
   * @returns Promise that resolves when all messages are sent
   */
  public async sendMultipartMessage(messages: string[]): Promise<any[]> {
    try {
      const results = [];
      const totalMessages = messages.length;
      
      if (totalMessages > 1) {
        console.log(`📱 Sending message in ${totalMessages} parts...`);
      }
      
      // Add a small delay between messages to avoid rate limiting
      for (let i = 0; i < messages.length; i++) {
        const result = await this.sendSingleMessage(
          messages[i],
          totalMessages > 1 ? { current: i + 1, total: totalMessages } : undefined
        );
        results.push(result);
        
        // Add a delay between messages if there are more to send
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (totalMessages > 1) {
        console.log('✅ All message parts sent successfully!');
      }
      
      return results;
    } catch (error) {
      console.error(
        `❌ Error sending WhatsApp messages: ${(error as Error).message}`
      );
      throw error;
    }
  }
}
