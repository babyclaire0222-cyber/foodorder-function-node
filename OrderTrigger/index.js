module.exports = async function (context, req) {
    try {
        context.log('=== FUNCTION STARTED ===');
        context.log('Request method:', req.method);
        context.log('Request headers:', JSON.stringify(req.headers));
        context.log('Request body:', JSON.stringify(req.body));
        
        // Test basic response first
        context.log('Sending test response...');
        context.res = {
            status: 200,
            body: JSON.stringify({
                message: "Function working!",
                received: req.body,
                timestamp: new Date().toISOString()
            })
        };
        
        context.log('=== FUNCTION COMPLETED SUCCESSFULLY ===');
    } catch (error) {
        context.log('=== ERROR CAUGHT ===');
        context.log('Error type:', typeof error);
        context.log('Error message:', error.message);
        context.log('Error stack:', error.stack);
        
        context.res = { 
            status: 500, 
            body: JSON.stringify({
                error: error.message,
                stack: error.stack
            })
        };
    }
};
