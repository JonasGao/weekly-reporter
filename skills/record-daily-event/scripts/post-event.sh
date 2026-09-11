#!/usr/bin/env bash
set -euo pipefail

# Post an event to the weekly-reporter timeline API
# Usage: post-event.sh "<content>" [--time <ISO8601-timestamp>]

WEEKLY_REPORTER_URL="${WEEKLY_REPORTER_URL:-http://localhost:6868}"
API_ENDPOINT="${WEEKLY_REPORTER_URL}/api/events"

content=""
event_time=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --time)
      event_time="$2"
      shift 2
      ;;
    *)
      if [[ -z "$content" ]]; then
        content="$1"
      else
        echo "Error: unexpected argument '$1'" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$content" ]]; then
  echo "Error: content is required" >&2
  echo "Usage: post-event.sh \"<content>\" [--time <ISO8601-timestamp>]" >&2
  exit 1
fi

# Build JSON payload
if [[ -n "$event_time" ]]; then
  payload=$(jq -n \
    --arg content "$content" \
    --arg eventTime "$event_time" \
    '{content: $content, eventTime: $eventTime}')
else
  payload=$(jq -n \
    --arg content "$content" \
    '{content: $content}')
fi

# POST to API
response=$(curl -s -w "\n%{http_code}" -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$payload" 2>&1)

# Extract HTTP status code (last line)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

# Handle response
case "$http_code" in
  200|201)
    # Success - extract event ID
    event_id=$(echo "$body" | jq -r '.id // empty')
    if [[ -n "$event_id" ]]; then
      echo "✓ Event created: #$event_id"
      exit 0
    else
      echo "✓ Event created successfully"
      exit 0
    fi
    ;;
  000)
    # Connection failed
    echo "Error: Cannot reach weekly-reporter at $WEEKLY_REPORTER_URL" >&2
    echo "Is the server running? Try: npm run dev" >&2
    exit 1
    ;;
  4*)
    # Client error
    echo "Error: Invalid request (HTTP $http_code)" >&2
    if [[ -n "$body" ]]; then
      error_msg=$(echo "$body" | jq -r '.error // .message // empty')
      if [[ -n "$error_msg" ]]; then
        echo "Server says: $error_msg" >&2
      fi
    fi
    exit 1
    ;;
  5*)
    # Server error
    echo "Error: Server error (HTTP $http_code)" >&2
    echo "Check the server logs for details" >&2
    exit 1
    ;;
  *)
    # Unexpected status
    echo "Error: Unexpected response (HTTP $http_code)" >&2
    exit 1
    ;;
esac

# Future: Add authentication header support here
# Example:
# if [[ -n "${WEEKLY_REPORTER_API_KEY:-}" ]]; then
#   curl_args+=(-H "Authorization: Bearer $WEEKLY_REPORTER_API_KEY")
# fi
