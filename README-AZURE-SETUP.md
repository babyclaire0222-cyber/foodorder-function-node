# Azure Food Ordering System - Setup Guide

## Overview
This food ordering system implements your complete workflow with Azure services:
- **Azure App Service** - Hosts the frontend web application
- **Azure Functions** - Handles order processing and API endpoints
- **Azure Cosmos DB** - Stores order data with 24-hour retention
- **Microsoft Entra ID** - Manages user authentication
- **Azure Logic Apps** - Automates order notifications
- **Azure Monitor** - Provides admin monitoring capabilities

## Architecture Flow
1. Users authenticate via Microsoft Entra ID
2. Frontend (App Service) displays food menu
3. Orders are processed by Azure Functions
4. Data stored in Cosmos DB (auto-expiring after 24 hours)
5. Logic Apps send notifications to users
6. Admin monitoring via Azure Monitor integration

## Setup Instructions

### 1. Azure Services Configuration

#### Microsoft Entra ID Setup
1. Register a new application in Azure AD
2. Configure authentication settings:
   - Redirect URI: `https://your-app-service-url/auth/callback`
   - Enable ID tokens
3. Create client secret
4. Update `local.settings.json`:
   ```json
   "AZURE_CLIENT_ID": "your-app-client-id",
   "AZURE_TENANT_ID": "your-tenant-id",
   "AZURE_CLIENT_SECRET": "your-client-secret"
   ```

#### Cosmos DB Setup
1. Create Cosmos DB account (Core SQL API)
2. Create database: `FoodOrderDB`
3. Create container: `Orders` with partition key `/id`
4. Configure Time to Live (TTL): 24 hours (1440 seconds)
5. Update connection string in `local.settings.json`:
   ```json
   "CosmosDBConnection": "your-cosmos-db-connection-string"
   ```

#### Azure Functions Setup
1. Deploy your function app
2. Configure application settings with all values from `local.settings.json`
3. Enable auto-scaling for high volume handling

#### Azure Logic Apps Setup
1. Create Logic App for order notifications
2. Configure trigger: When HTTP request is received
3. Add actions for email/SMS notifications
4. Save and get the webhook URL
5. Update `local.settings.json`:
   ```json
   "LOGIC_APP_NOTIFICATION_URL": "your-logic-app-webhook-url"
   ```

### 2. API Endpoints

#### Authentication
- `POST /api/auth/token` - Exchange auth code for access token

#### Order Management
- `POST /api/order` - Place new food order
- `GET /api/order?orderId=xxx` - Check order status

#### Notifications
- `POST /api/notify` - Trigger order notifications

#### Admin Monitoring
- `GET /api/admin` - System statistics (requires admin key)

### 3. Frontend Configuration

Update `app-azure.js` with your Azure AD client ID:
```javascript
const authUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' +
    'client_id=' + encodeURIComponent('YOUR-ACTUAL-CLIENT-ID') +
    // ... rest of the URL
```

### 4. Testing with Postman

#### Order Placement
```http
POST /api/order
Authorization: Bearer <access-token>
Content-Type: application/json

{
    "foodItem": "Pizza",
    "price": 12.99,
    "customerEmail": "user@example.com",
    "customerName": "John Doe"
}
```

#### Order Status Check
```http
GET /api/order?orderId=ORD-1234567890-ABC123
Authorization: Bearer <access-token>
```

#### Admin Monitoring
```http
GET /api/admin
X-Admin-Key: <admin-api-key>
```

### 5. Azure Monitor Integration

The system automatically integrates with Azure Monitor through:
- Application Insights (already configured)
- Custom metrics from admin API
- Log streaming from Azure Functions
- Performance monitoring

### 6. Deployment

#### Azure Functions
```bash
func azure functionapp publish your-function-app-name
```

#### Azure App Service
1. Deploy the `index.html`, `style.css`, and `app-azure.js` files
2. Configure authentication to use Azure AD
3. Set up custom domain if needed

### 7. Security Considerations

- All API endpoints require valid JWT tokens
- Admin endpoints require additional API key
- Cosmos DB data automatically expires after 24 hours
- Use HTTPS for all communications
- Regularly rotate Azure AD client secrets

### 8. Scaling Features

- Azure Functions auto-scale based on demand
- Cosmos DB provisioned throughput can be adjusted
- Logic Apps handle high-volume notifications
- App Service can scale out for web traffic

## Troubleshooting

### 401 Unauthorized
- Check Azure AD configuration
- Verify client ID and secret
- Ensure redirect URI matches

### 500 Internal Server Error
- Check Azure Functions logs
- Verify Cosmos DB connection
- Validate all environment variables

### Missing Notifications
- Verify Logic App webhook URL
- Check Logic App run history
- Validate notification payload

This completes your Azure food ordering system with all requested features!
