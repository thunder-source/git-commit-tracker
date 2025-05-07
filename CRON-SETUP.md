# Scheduled Execution Setup

This document explains how to set up the EOD GitHub Contribution Tracker to run automatically at 5:50 PM every day except Sundays. After running, it will send the EOD summary to WhatsApp using Twilio.

## Files

- `run-eod-update.sh`: Shell script that runs the EOD update tool and sends WhatsApp messages
- `send-whatsapp.ts`: TypeScript script that sends the EOD summary to WhatsApp
- `eod-update-cron`: Cron job definition file
- `add-cron-job.sh`: Script to add the cron job to your crontab

## Manual Setup

1. Make sure the scripts are executable:

   ```
   chmod +x run-eod-update.sh add-cron-job.sh
   ```

2. Edit your crontab:

   ```
   crontab -e
   ```

3. Add the following line to your crontab:

   ```
   # Run EOD update at 5:50 PM Monday through Saturday (1-6 are Monday-Saturday, 0 is Sunday)
   50 17 * * 1-6 /Users/pradityamanjhi/Desktop/automation/run-eod-update.sh >> /Users/pradityamanjhi/Desktop/automation/eod-update.log 2>&1
   ```

4. Save and exit the editor.

## Automatic Setup

Run the `add-cron-job.sh` script to automatically add the cron job to your crontab:

```
./add-cron-job.sh
```

## Verifying the Cron Job

To verify that the cron job has been added correctly, run:

```
crontab -l
```

You should see the EOD update cron job in the output.

## Log File

The output of the EOD update tool will be logged to:

```
/Users/pradityamanjhi/Desktop/automation/eod-update.log
```

You can check this file to see the results of the scheduled runs.

## Modifying the Schedule

If you need to change the schedule, edit the cron job definition in your crontab or in the `eod-update-cron` file and run the `add-cron-job.sh` script again.

### Cron Format

The cron job format is:

```
minute hour day-of-month month day-of-week command
```

For example, `50 17 * * 1-6` means:

- 50: Run at minute 50
- 17: Run at hour 17 (5 PM)
- \*: Run on any day of the month
- \*: Run in any month
- 1-6: Run on days 1-6 of the week (Monday-Saturday)

## Troubleshooting

If the cron job is not running as expected:

1. Check the log file for errors
2. Make sure the scripts have execute permissions
3. Verify that the paths in the cron job are correct
4. Check the system logs for cron-related errors:
   ```
   grep cron /var/log/system.log
   ```

## WhatsApp Integration

To set up the WhatsApp integration:

1. Create a Twilio account at https://www.twilio.com
2. Set up a WhatsApp Sandbox in your Twilio account
3. Follow Twilio's instructions to connect your WhatsApp number to the Sandbox
4. Add the following environment variables to your `.env` file:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
   WHATSAPP_TO=whatsapp:+1234567890
   ```
5. Replace the values with your actual Twilio credentials and WhatsApp numbers

Note: The WhatsApp numbers must be in the format `whatsapp:+1234567890` with the country code.

The WhatsApp integration supports sending long messages by automatically splitting them into multiple parts if they exceed WhatsApp's message length limit. Each part will be clearly labeled (e.g., "Part 1/3") to maintain readability.
