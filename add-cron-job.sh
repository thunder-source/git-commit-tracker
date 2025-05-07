#!/bin/bash

# Get the current crontab
crontab -l > current_crontab.tmp

# Check if the EOD update job already exists
if grep -q "run-eod-update.sh" current_crontab.tmp; then
  echo "EOD update cron job already exists."
else
  # Add the new cron job
  cat eod-update-cron >> current_crontab.tmp
  
  # Install the updated crontab
  crontab current_crontab.tmp
  
  echo "EOD update cron job added successfully."
fi

# Clean up
rm current_crontab.tmp
