const { acquireTokenByCode } = require('./auth');

module.exports = async function (context, req) {
    context.log('Authentication API - Token exchange request');
    
    try {
        const { code, codeVerifier } = req.body;
        
        if (!code) {
            context.res = {
                status: 400,
                body: { error: 'Authorization code is required' }
            };
            return;
        }
        
        // Microsoft Entra ID token endpoint
        const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        
        // Prepare token request body
        const tokenRequestBody = new URLSearchParams({
            client_id: process.env.AZURE_CLIENT_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.REDIRECT_URI,
            scope: 'openid profile email'
        });
        
        // Add code verifier for PKCE (if provided)
        if (codeVerifier) {
            tokenRequestBody.append('code_verifier', codeVerifier);
        }
        
        // Exchange authorization code for tokens
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: tokenRequestBody.toString()
        });
        
        const tokenData = await response.json();
        
        if (response.ok) {
            // Generate JWT token for your application
            const jwt = require('jsonwebtoken');
            const appToken = jwt.sign(
                { 
                    sub: tokenData.id_token,
                    email: extractUserEmail(tokenData.id_token),
                    name: extractUserName(tokenData.id_token)
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            
            context.res = {
                status: 200,
                body: {
                    success: true,
                    token: appToken,
                    user: {
                        email: extractUserEmail(tokenData.id_token),
                        name: extractUserName(tokenData.id_token)
                    }
                }
            };
        } else {
            throw new Error(tokenData.error_description || 'Token exchange failed');
        }
        
    } catch (error) {
        context.log.error('Authentication error:', error);
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

function extractUserEmail(idToken) {
    try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        return payload.email || payload.preferred_username || 'user@example.com';
    } catch {
        return 'user@example.com';
    }
}

function extractUserName(idToken) {
    try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        return payload.name || payload.given_name || 'User';
    } catch {
        return 'User';
    }
}
