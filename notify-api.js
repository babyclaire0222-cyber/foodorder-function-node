module.exports = async function (context, req) {
    context.log('Notification API - Triggering Azure Logic Apps');
    
    try {
        const { orderId, customerEmail, notificationType } = req.body;
        
        if (!orderId || !customerEmail || !notificationType) {
            context.res = {
                status: 400,
                body: { error: 'Missing required fields: orderId, customerEmail, notificationType' }
            };
            return;
        }
        
        // Azure Logic Apps endpoint URL (configure in local.settings.json)
        const logicAppUrl = process.env.LOGIC_APP_NOTIFICATION_URL;
        
        if (!logicAppUrl) {
            context.log.warn('Logic App URL not configured, skipping notification');
            context.res = {
                status: 200,
                body: { 
                    success: true,
                    message: 'Notification skipped - Logic App not configured'
                }
            };
            return;
        }
        
        // Prepare notification payload
        const notificationPayload = {
            orderId,
            customerEmail,
            notificationType,
            timestamp: new Date().toISOString(),
            foodOrderSystem: 'Azure Food Express'
        };
        
        // Call Azure Logic Apps
        const response = await fetch(logicAppUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(notificationPayload)
        });
        
        if (response.ok) {
            context.log(`Notification sent successfully for order ${orderId}`);
            
            context.res = {
                status: 200,
                body: {
                    success: true,
                    message: 'Notification triggered successfully',
                    orderId,
                    notificationType
                }
            };
        } else {
            throw new Error(`Logic App responded with status: ${response.status}`);
        }
        
    } catch (error) {
        context.log.error('Notification error:', error);
        context.res = {
            status: 500,
            body: {
                success: false,
                error: 'Failed to trigger notification',
                details: error.message
            }
        };
    }
};
