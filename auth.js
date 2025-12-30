const { ConfidentialClientApplication } = require('@azure/msal-node');
const jwt = require('jsonwebtoken');

// Microsoft Entra ID Configuration
const msalConfig = {
    auth: {
        clientId: process.env.AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
    },
    system: {
        loggerOptions: {
            loggerCallback(loglevel, message, containsPii) {
                console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: 'Info',
        },
    },
};

const cca = new ConfidentialClientApplication(msalConfig);

// Token validation middleware
async function validateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }
        
        const token = authHeader.substring(7);
        
        // For development, you might want to validate with Microsoft Entra ID
        // For now, we'll do basic JWT validation
        const decoded = jwt.decode(token);
        
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        // Add user info to request
        req.user = {
            userId: decoded.oid || decoded.sub,
            email: decoded.email || decoded.upn,
            name: decoded.name
        };
        
        next();
    } catch (error) {
        console.error('Token validation error:', error);
        return res.status(401).json({ error: 'Token validation failed' });
    }
}

// Get authorization URL for Microsoft Entra ID
function getAuthUrl() {
    return cca.getAuthCodeUrl({
        scopes: ['user.read'],
        redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback'
    });
}

// Exchange auth code for tokens
async function acquireTokenByCode(authCode) {
    try {
        const response = await cca.acquireTokenByCode({
            code: authCode,
            scopes: ['user.read'],
            redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback'
        });
        
        return response;
    } catch (error) {
        console.error('Token acquisition error:', error);
        throw error;
    }
}

module.exports = {
    validateToken,
    getAuthUrl,
    acquireTokenByCode,
    cca
};
