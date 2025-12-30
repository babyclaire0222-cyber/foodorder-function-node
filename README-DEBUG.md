# Food Order App - Debug Instructions

## Issues Found and Fixed:

### 1. Missing JavaScript Functions
**Problem**: HTML was calling `handleLogin()`, `placeOrder()`, and `trackOrder()` but these weren't properly defined in app.js.

**Fix**: Added all missing functions with proper error handling.

### 2. Incomplete Frontend Integration
**Problem**: The `placeOrder()` function wasn't properly connected to the UI elements.

**Fix**: Updated function signatures to match HTML calls and improved status display.

### 3. Missing Dependencies
**Problem**: No npm packages for Azure Functions runtime.

**Fix**: Added `@azure/functions` dependency to package.json.

### 4. Development Environment Setup
**Problem**: Node.js and Azure Functions Core Tools not installed.

**Fix**: Created local testing server that works without Azure dependencies.

## How to Test Locally:

### Option 1: Quick Local Testing (Recommended)
1. Open PowerShell in the project directory
2. Run: `node server.js`
3. Open browser: `http://localhost:3000`
4. Use any email/password to login
5. Test ordering functionality

### Option 2: Full Azure Setup (Requires Installation)
1. Install Node.js: https://nodejs.org/
2. Install Azure Functions Core Tools: https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local
3. Run: `npm install`
4. Run: `func start`

## Files Created for Debugging:

- `server.js` - Local HTTP server for testing
- `app-local.js` - Simplified frontend without Azure auth
- `index-local.html` - Local testing version
- `README-DEBUG.md` - This file

## Backend Issues to Fix:

1. **Logic App URL**: Update line 19 in `OrderTrigger/index.js`:
   ```javascript
   const logicAppUrl = new URL("YOUR_ACTUAL_LOGIC_APP_URL_HERE");
   ```

2. **CORS Settings**: The backend allows requests from `https://yuyuanng.github.io`. Update if needed.

3. **Authentication**: The current setup uses Azure AD client credentials. Ensure:
   - Client ID and secret are valid
   - API permissions are configured correctly
   - Logic App URL is accessible

## Testing Checklist:

- [ ] Login functionality works
- [ ] Order buttons respond to clicks
- [ ] Order data is sent to backend
- [ ] Status updates display correctly
- [ ] Error handling works properly
- [ ] CORS requests succeed

## Production Deployment:

1. Replace localhost endpoint with Azure Function URL
2. Update Logic App URL in backend
3. Test Azure AD authentication
4. Deploy to Azure Functions
5. Update CORS settings for production domain
