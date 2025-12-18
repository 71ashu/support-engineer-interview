# Testing Session Expiry Buffer Fix

This guide explains how to test the session expiration buffer fix that invalidates sessions 5 minutes before their actual expiry time.

## Overview

The fix ensures that sessions are invalidated 5 minutes before their actual `expires_at` timestamp to prevent security risks near expiration. This means:
- **Before fix**: Session valid until exact `expires_at` time
- **After fix**: Session invalidated 5 minutes before `expires_at` time

## Testing Methods

### Method 1: Using the Test Script (Recommended)

A test script is provided to easily modify session expiry times for testing.

#### Setup
1. Start your development server:
   ```bash
   npm run dev
   ```

2. Create a test user account or use an existing one

3. Log in to create a session token

#### Test Case 1: Session Expiring Soon (Should be INVALID)
Test that sessions with < 5 minutes remaining are invalidated:

```bash
# Set session to expire in 4 minutes (less than 5min buffer)
npm run test:session-expiry set-near-expiry your-email@example.com

# Check the status
npm run test:session-expiry check-status your-email@example.com
```

**Expected Result**: 
- Session status shows as INVALID
- Authenticated API calls should fail with UNAUTHORIZED
- User should be redirected to login or see "Unauthorized" error

#### Test Case 2: Valid Session (Should be VALID)
Test that sessions with > 5 minutes remaining are still valid:

```bash
# Set session to expire in 10 minutes (more than 5min buffer)
npm run test:session-expiry set-valid-session your-email@example.com

# Check the status
npm run test:session-expiry check-status your-email@example.com
```

**Expected Result**:
- Session status shows as VALID
- Authenticated API calls should succeed
- User can access protected routes

#### Test Case 3: Already Expired Session (Should be INVALID)
Test that expired sessions are invalidated:

```bash
# Set session to already be expired
npm run test:session-expiry set-expired your-email@example.com

# Check the status
npm run test:session-expiry check-status your-email@example.com
```

**Expected Result**:
- Session status shows as INVALID
- Authenticated API calls should fail with UNAUTHORIZED

### Method 2: Manual Database Testing

You can manually modify the database to test different scenarios:

1. Find your session token:
   ```bash
   npm run db:list-sessions
   ```

2. Connect to the database directly:
   ```bash
   sqlite3 bank.db
   ```

3. Update session expiry time:
   ```sql
   -- Set to expire in 4 minutes (should be invalid)
   UPDATE sessions 
   SET expires_at = datetime('now', '+4 minutes') 
   WHERE token = 'your-token-here';
   
   -- Set to expire in 10 minutes (should be valid)
   UPDATE sessions 
   SET expires_at = datetime('now', '+10 minutes') 
   WHERE token = 'your-token-here';
   
   -- Set to already be expired
   UPDATE sessions 
   SET expires_at = datetime('now', '-1 minute') 
   WHERE token = 'your-token-here';
   ```

4. Verify by checking session status:
   ```bash
   npm run test:session-expiry check-status your-email@example.com
   ```

### Method 3: Browser Testing

1. Log in to the application in your browser
2. Open browser DevTools → Application → Cookies
3. Note your session cookie value
4. Use the test script to modify the session expiry in the database:
   ```bash
   npm run test:session-expiry set-near-expiry your-email@example.com
   ```
5. Refresh the page or make a request to a protected route (e.g., `/dashboard`)
6. **Expected**: You should be logged out or see an unauthorized error

### Method 4: API Testing with cURL

1. Log in and get your session token from the cookie
2. Use the test script to set the session to expire in 4 minutes:
   ```bash
   npm run test:session-expiry set-near-expiry your-email@example.com
   ```
3. Make an authenticated API call:
   ```bash
   curl -X POST http://localhost:3000/api/trpc/[endpoint] \
     -H "Content-Type: application/json" \
     -H "Cookie: session=YOUR_SESSION_TOKEN_HERE" \
     -d '{"json": {...}}'
   ```
4. **Expected**: Should receive an UNAUTHORIZED error if session is invalid

## Verification Checklist

- [ ] Session with 4 minutes remaining is rejected (INVALID)
- [ ] Session with 10 minutes remaining is accepted (VALID)
- [ ] Expired session is rejected (INVALID)
- [ ] Session exactly at 5 minutes remaining is rejected (INVALID)
- [ ] Session with 5 minutes + 1 second remaining is accepted (VALID)
- [ ] Authenticated routes properly reject invalid sessions
- [ ] User is redirected or receives appropriate error message

## Edge Cases to Test

1. **Boundary Condition**: Test a session with exactly 5 minutes remaining (should be INVALID)
2. **Boundary Condition**: Test a session with 5 minutes + 1 second remaining (should be VALID)
3. **Concurrent Requests**: Make multiple API calls simultaneously with a near-expiry session
4. **Multiple Sessions**: Test that the buffer applies to all sessions independently

## Debugging

If tests aren't working as expected:

1. Check the server logs for any warnings or errors
2. Verify the session exists in the database:
   ```bash
   npm run db:list-sessions
   ```
3. Check the calculated expiry time:
   ```bash
   npm run test:session-expiry check-status your-email@example.com
   ```
4. Verify the buffer constant in `server/trpc.ts` (should be `5 * 60 * 1000` ms)
5. Check browser DevTools Network tab to see API responses
6. Verify JWT token is still valid (separate from session expiry check)

## Code Reference

The fix is implemented in `server/trpc.ts` in the `createContext` function:

```typescript
const bufferMs = 5 * 60 * 1000; // 5 minutes in milliseconds
const expiresAtTime = new Date(session.expiresAt).getTime();
const currentTime = new Date().getTime();
const expiresIn = expiresAtTime - currentTime;

// Session is valid only if more than buffer time remains
if (expiresIn > bufferMs) {
  // Session is valid
}
```

