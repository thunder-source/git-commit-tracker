# EOD GitHub Contribution Tracker

This tool generates a summary of GitHub contributions made by specified users or to specified repositories. It's designed to create an end-of-day report showing what commits were made during the day.

## 🛠️ Fixed Issues

The updated version fixes several issues with the original script:

1. **Improved Token Handling**: Better feedback when token has insufficient permissions
2. **Date Flexibility**: Can check contributions for specific dates or previous days
3. **Better Repository Detection**: Falls back to explicitly defined repositories when API access fails
4. **More Robust User Tracking**: Checks both commit author names and GitHub usernames
5. **Enhanced Error Handling and Diagnostics**: More helpful error messages and debugging options
6. **Multi-Branch Support**: Fetches commits from all recently committed branches, not just the main branch
7. **WhatsApp Integration**: Automatically sends EOD summaries to WhatsApp after the daily run, with support for multi-part messages for long summaries

## 🚀 Setup

1. Clone the repository
2. Run `npm install` or `pnpm install` to install dependencies
3. Copy `.env.example` to `.env` and fill in your GitHub token and other settings
4. Build with `npm run build` or `pnpm run build`
5. Run with `npm run start` or `pnpm run start`

## ⚙️ Configuration

Configure the tracker through environment variables in your `.env` file:

| Variable | Description | Example |
| -------- | ----------- | ------- |

| `GITHUB_TOKEN` | GitHub personal access token | `ghp_1234567890` |
| `TARGET_REPOS` | Comma-separated list of repositories to track | `owner/repo1,owner/repo2` |
| `TARGET_USERS` | Comma-separated list of GitHub usernames to track | `user1,user2` |
| `GITHUB_ORG` | GitHub organization name | `myorg` |
| `TARGET_DATE` | Date to use for filtering (YYYY-MM-DD or "TODAY") | `2023-01-01` or `TODAY` |
| `CHECK_PREVIOUS_DAY` | Enable to check previous day if no contributions found today | `true` |
| `OUTPUT_FORMAT` | Format to use for console output (simple or detailed) | `simple` |
| `NO_FILES` | Disable file output (only show in console) | `false` |
| `OUTPUT_DIR` | Custom output directory for reports | `reports` |
| `DEBUG` | Enable for detailed logging | `false` |
| `MAX_BRANCHES` | Maximum number of branches to check for commits | `10` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID for WhatsApp integration | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token for WhatsApp integration | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp number to send from | `whatsapp:+1234567890` |
| `WHATSAPP_TO` | Recipient's WhatsApp number | `whatsapp:+1234567890` |
