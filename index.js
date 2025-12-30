const crypto = require('crypto');

module.exports = async function (context, req) {
    context.log('Food Order Function started');
    context.log('Request method:', req.method);
    
    try {
        if (req.method === 'POST' && req.url.includes('/api/order')) {
            // Handle order submission
            const { foodItem, price, customerEmail, customerName } = req.body;
            
            if (!foodItem || !price || !customerEmail) {
                context.res = {
                    status: 400,
                    body: { error: 'Missing required fields: foodItem, price, customerEmail' }
                };
                return;
            }
            
            // Generate order ID and timestamp
            const orderId = generateOrderId();
            const timestamp = new Date().toISOString();
            const expiryTime = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(); // 23 hours retention
            
            // Create order document
            const orderDocument = {
                id: orderId,
                foodItem,
                price,
                customerEmail,
                customerName: customerName || 'Anonymous',
                status: 'pending',
                timestamp,
                expiryTime,
                partitionKey: orderId
            };
            
            // Store in Cosmos DB
            context.bindings.orderDocument = orderDocument;
            
            context.log(`Order created: ${orderId}`);
            
            context.res = {
                status: 201,
                body: {
                    success: true,
                    orderId,
                    status: 'pending',
                    message: 'Order placed successfully'
                }
            };
            
        } else if (req.method === 'GET' && req.url.includes('/api/order')) {
            // Handle order status check
            const orderId = req.query.orderId;
            
            if (!orderId) {
                context.res = {
                    status: 400,
                    body: { error: 'OrderId is required' }
                };
                return;
            }
            
            // In a real implementation, you would query Cosmos DB here
            // For now, return a mock response
            context.res = {
                status: 200,
                body: {
                    orderId,
                    status: 'preparing',
                    estimatedTime: '15 minutes'
                }
            };
            
        } else {
            // Default endpoint
            context.res = {
                status: 200,
                body: {
                    message: 'Food Order API is running',
                    endpoints: {
                        'POST /api/order': 'Place a new order',
                        'GET /api/order?orderId=xxx': 'Check order status'
                    }
                }
            };
        }
        
    } catch (error) {
        context.log.error('Error processing request:', error);
        context.res = {
            status: 500,
            body: { error: 'Internal server error' }
        };
    }
};

function generateOrderId() {
    return 'ORD-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}