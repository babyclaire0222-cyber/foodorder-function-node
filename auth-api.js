const { acquireTokenByCode } = require('./auth');

module.exports = async function (context, req) {
    context.log('Auth API - Token exchange started');
    
    try {
        const { code } = req.body;
        
        if (!code) {
            context.res = {
                status: 400,
                body: { error: 'Authorization code is required' }
            };
            return;
        }
        
        // Exchange auth code for tokens
        const tokenResponse = await acquireTokenByCode(code);
        
        if (tokenResponse && tokenResponse.accessToken) {
            context.log('Token exchange successful');
            
            context.res = {
                status: 200,
                body: {
                    success: true,
                    token: tokenResponse.accessToken,
                    refreshToken: tokenResponse.refreshToken,
                    user: {
                        name: tokenResponse.account.name,
                        email: tokenResponse.account.username,
                        userId: tokenResponse.account.localAccountId
                    }
                }
            };
        } else {
            throw new Error('Failed to acquire token');
        }
        
    } catch (error) {
        context.log.error('Token exchange error:', error);
        context.res = {
            status: 500,
            body: { 
                success: false,
                error: 'Authentication failed',
                details: error.message 
            }
        };
    }
};
