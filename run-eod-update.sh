#!/bin/bash

# Change to the directory where the tool is located
cd "$(dirname "$0")"

# Run the tool
npm run start || pnpm run start

# Exit with the status of the last command
exit $?
