# EOD GitHub Contribution Tracker - Source Code

This directory contains the source code for the EOD GitHub Contribution Tracker.

## Directory Structure

- **config/**: Configuration handling
  - `env.ts`: Environment variable loading and validation

- **services/**: Core services
  - `GitHubService.ts`: GitHub API interactions
  - `EODProcessor.ts`: Processing GitHub events into contributions
  - `Reporter.ts`: Generating and outputting reports
  - `WhatsAppService.ts`: Sending WhatsApp messages

- **types/**: TypeScript type definitions
  - `index.ts`: Core type definitions

- **utils/**: Utility functions
  - `date.ts`: Date formatting and manipulation
  - `file.ts`: File system operations

- **scripts/**: Standalone scripts
  - `send-whatsapp.ts`: Script for sending WhatsApp messages

- **main.ts**: Main entry point

## Flow

1. **main.ts**: Entry point that orchestrates the entire process
   - Loads configuration
   - Fetches GitHub events
   - Processes events into contributions
   - Generates reports

2. **GitHubService**: Handles all GitHub API interactions
   - Fetches repositories, events, and commits
   - Supports fetching from multiple branches

3. **EODProcessor**: Processes GitHub events into contributions
   - Filters events by date, repository, and user
   - Groups commits by repository

4. **Reporter**: Generates and outputs reports
   - Formats contributions for console output
   - Writes reports to files
   - Generates minimal EOD summaries

5. **WhatsAppService**: Sends WhatsApp messages
   - Formats content for WhatsApp
   - Handles splitting long messages into multiple parts
   - Sends messages with proper delays
