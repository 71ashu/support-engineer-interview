#!/bin/bash

EMAIL="${1:-71ashu@gmail.com}"
AMOUNT="${2:-100}"

# Get token and account ID
TOKEN=$(node scripts/get-session-token.js "$EMAIL")
ACCOUNT_ID=$(node scripts/get-account-id.js "$EMAIL")

if [ -z "$TOKEN" ] || [ -z "$ACCOUNT_ID" ]; then
  echo "Error: Could not get token or account ID"
  exit 1
fi

# Create JSON body using jq if available, otherwise use printf
if command -v jq &> /dev/null; then
  JSON_BODY=$(jq -n \
    --argjson accountId "$ACCOUNT_ID" \
    --argjson amount "$AMOUNT" \
    '{
      "json": {
        "accountId": $accountId,
        "amount": $amount,
        "fundingSource": {
          "type": "card",
          "accountNumber": "4242424242424242"
        }
      }
    }')
else
  # Fallback to printf if jq is not available
  JSON_BODY=$(printf '{"json":{"accountId":%d,"amount":%d,"fundingSource":{"type":"card","accountNumber":"4242424242424242"}}}' "$ACCOUNT_ID" "$AMOUNT")
fi

# Make the curl request
curl -X POST "http://localhost:3000/api/trpc/account.fundAccount" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=$TOKEN" \
  -d "$JSON_BODY" \
  -w "\n"

