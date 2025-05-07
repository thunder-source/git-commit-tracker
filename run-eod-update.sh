#!/bin/bash

# Change to the directory where the tool is located
cd "$(dirname "$0")"

# Ensure the latest build is used
echo "Building the project..."
pnpm run build
BUILD_STATUS=$?

if [ $BUILD_STATUS -ne 0 ]; then
  echo "Build failed with status $BUILD_STATUS. Exiting."
  exit $BUILD_STATUS
fi

# Run the tool
echo "Running EOD update..."
pnpm run start
EOD_STATUS=$?

# If the EOD update was successful, send the summary to WhatsApp
if [ $EOD_STATUS -eq 0 ]; then
  echo "EOD update completed successfully. Sending summary to WhatsApp..."
  pnpm run send-whatsapp
  WHATSAPP_STATUS=$?

  if [ $WHATSAPP_STATUS -ne 0 ]; then
    echo "Failed to send WhatsApp message. Check the logs for details."
    exit $WHATSAPP_STATUS
  fi

  echo "WhatsApp message sent successfully."
else
  echo "EOD update failed with status $EOD_STATUS. Not sending WhatsApp message."
  exit $EOD_STATUS
fi

# Exit with success status
echo "All tasks completed successfully."
exit 0
