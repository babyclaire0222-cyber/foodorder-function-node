const https = require('https');
const http = require('http');

/**
 * Makes an HTTP request using native Node.js modules
 * @param {string} url - The URL to request
 * @param {object} options - Request options
 * @param {string} data - Request body data
 * @returns {Promise} - Promise that resolves with response data
 */
function makeHttpRequest(url, options, data) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const client = isHttps ? https : http;
        
        const req = client.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseData,
                        headers: res.headers
                    });
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (data) {
            req.write(data);
        }
        
        req.end();
    });
}

module.exports = { makeHttpRequest };
