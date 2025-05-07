/**
 * Environment configuration utilities
 * Handles loading and validating environment variables
 */

import 'dotenv/config';
import type { AppConfig, WhatsAppConfig } from '../types';

/**
 * Validates and loads the application configuration from environment variables
 * @param args Command line arguments
 * @returns Application configuration
 */
export function loadAppConfig(args: any = {}): AppConfig {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required');

  const rawTargetUsers = process.env.TARGET_USERS || '';
  const rawTargetRepos = process.env.TARGET_REPOS || '';

  const targetUsers = rawTargetUsers
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  const rawRepos = rawTargetRepos
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  const organization = process.env.GITHUB_ORG || undefined;
  const debug = process.env.DEBUG === 'true';
  const checkPreviousDay = process.env.CHECK_PREVIOUS_DAY === 'true';
  const outputFormat = (args.outputFormat ||
    process.env.OUTPUT_FORMAT ||
    'simple') as 'simple' | 'detailed';
  const noFiles = args.noFiles ?? process.env.NO_FILES === 'true';
  const outputDir = process.env.OUTPUT_DIR || 'reports';
  const maxBranches = process.env.MAX_BRANCHES
    ? parseInt(process.env.MAX_BRANCHES, 10)
    : 10;

  const allowedOutputs = ['txt', 'json', 'md'] as const;
  type OutputFormat = (typeof allowedOutputs)[number];

  const outputArg = args.output ?? 'txt';
  const output: OutputFormat = allowedOutputs.includes(outputArg as any)
    ? (outputArg as OutputFormat)
    : 'txt';

  let date = new Date();
  if (args.date) {
    const d = new Date(args.date);
    if (!isNaN(d.getTime())) date = d;
    else console.warn('Invalid CLI --date. Using today.');
  } else if (process.env.TARGET_DATE) {
    // Special case: if TARGET_DATE is "TODAY", use today's date
    if (process.env.TARGET_DATE.toUpperCase() === 'TODAY') {
      date = new Date();
      if (process.env.DEBUG === 'true') {
        console.debug("Using today's date:", date.toISOString().split('T')[0]);
      }
    } else {
      const d = new Date(process.env.TARGET_DATE);
      if (!isNaN(d.getTime())) date = d;
      else
        console.warn(
          `Invalid TARGET_DATE: ${process.env.TARGET_DATE}. Using today's date.`
        );
    }
  }

  return {
    token,
    targetUsers,
    targetRepos: rawRepos,
    organization,
    date,
    debug,
    checkPreviousDay,
    outputFormat,
    noFiles,
    outputDir,
    output,
    maxBranches,
  };
}

/**
 * Validates and loads the WhatsApp configuration from environment variables
 * @returns WhatsApp configuration
 */
export function loadWhatsAppConfig(): WhatsAppConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
  const toNumber = process.env.WHATSAPP_TO;
  const debug = process.env.DEBUG === 'true';

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    throw new Error(
      'Missing WhatsApp configuration. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, and WHATSAPP_TO environment variables.'
    );
  }

  return {
    accountSid,
    authToken,
    fromNumber,
    toNumber,
    debug,
  };
}
