/**
 * Core types for the EOD GitHub Contribution Tracker
 */

/**
 * Represents a Git commit with essential information
 */
export interface Commit {
  /** Short form of commit hash */
  hash: string;
  /** Commit message (first line) */
  message: string;
  /** Author name */
  author: string;
  /** ISO timestamp of commit */
  timestamp: string;
}

/**
 * Structure for grouped contributions by repository
 */
export interface Contribution {
  /** Repository name in format "owner/repo" */
  repo: string;
  /** Array of commits made to this repository */
  commits: Commit[];
}

/**
 * GitHub API event structure for push events
 */
export interface GitHubEvent {
  created_at: string;
  type: string;
  repo: {
    name: string;
  };
  payload: {
    commits?: Array<{
      sha: string;
      message: string;
      author: {
        name: string;
        email?: string;
      };
    }>;
  };
  actor?: {
    login: string;
  };
}

/**
 * Configuration options for the application
 */
export interface AppConfig {
  /** GitHub personal access token */
  token: string;
  /** List of GitHub usernames to track */
  targetUsers: string[];
  /** List of repositories to track in format "owner/repo" */
  targetRepos: string[];
  /** GitHub organization name */
  organization?: string;
  /** Date to use for filtering (defaults to today) */
  date: Date;
  /** Enable debug mode */
  debug: boolean;
  /** Check previous day if no contributions found today */
  checkPreviousDay: boolean;
  /** Format to use for console output (simple or detailed) */
  outputFormat: 'simple' | 'detailed';
  /** Skip writing to files */
  noFiles: boolean;
  /** Custom output directory for reports */
  outputDir: string;
  /** Output format for files */
  output: 'txt' | 'json' | 'md';
  /** Maximum number of branches to check for commits */
  maxBranches: number;
}

/**
 * Configuration for WhatsApp messaging
 */
export interface WhatsAppConfig {
  /** Twilio Account SID */
  accountSid: string;
  /** Twilio Auth Token */
  authToken: string;
  /** Twilio WhatsApp number (format: whatsapp:+1234567890) */
  fromNumber: string;
  /** Recipient's WhatsApp number (format: whatsapp:+1234567890) */
  toNumber: string;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Information about a message part in a multi-part message
 */
export interface MessagePartInfo {
  /** Current part number */
  current: number;
  /** Total number of parts */
  total: number;
}
