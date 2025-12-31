// Azure-integrated frontend JavaScript
let currentOrder = null;
let authToken = null;

// Microsoft Entra ID Authentication
async function initAuth() {
    const authButton = document.getElementById('auth-button');
    
    if (authToken) {
        // User is logged in
        authButton.textContent = 'Logout';
        authButton.onclick = logout;
        showAppSection();
    } else {
        // User needs to login
        authButton.textContent = 'Login with Microsoft';
        authButton.onclick = login;
    }
}

async function login() {
    try {
        // Redirect to Azure Functions managed authentication
        const authUrl = 'https://foodorder-function-node-gjhnhtapgnd9g0fq.southeastasia-01.azurewebsites.net/.auth/login/microsoft';
        window.location.href = authUrl;
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

// PKCE helper functions
function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function logout() {
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    showLoginSection();
}

async function handleAuthCallback() {
    try {
        // Azure Functions managed auth provides user info directly
        const response = await fetch('https://foodorder-function-node-gjhnhtapgnd9g0fq.southeastasia-01.azurewebsites.net/.auth/me');
        const userInfo = await response.json();
        
        if (userInfo && userInfo.length > 0) {
            const user = userInfo[0];
            authToken = user.access_token;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('user', JSON.stringify({
                name: user.user_details,
                email: user.user_id
            }));
            
            // Redirect back to main page after successful login
            window.location.href = '/';
        } else {
            throw new Error('No user information received');
        }
    } catch (error) {
        console.error('Authentication error:', error);
        alert('Authentication failed. Please try again.');
        window.location.href = '/';
    }
}

// UI Functions
function showLoginSection() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('app-section').style.display = 'none';
}

function showAppSection() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const welcomeMessage = document.querySelector('#app-section h1');
    if (user.name) {
        welcomeMessage.textContent = `Welcome to Food Express, ${user.name}!`;
    }
}

// Order Functions
async function placeOrder(foodItem, price) {
    if (!authToken) {
        alert('Please login to place an order');
        return;
    }
    
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        const response = await fetch('https://foodorder-function-node-gjhnhtapgnd9g0fq.southeastasia-01.azurewebsites.net/api/order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                foodItem,
                price,
                customerEmail: user.email || 'customer@example.com',
                customerName: user.name || 'Customer'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentOrder = data;
            updateOrderStatus(`Order placed! Order ID: ${data.orderId}`);
            
            // Trigger notification via Azure Logic Apps
            triggerNotification(data.orderId, user.email);
        } else {
            throw new Error(data.error || 'Order failed');
        }
    } catch (error) {
        console.error('Order error:', error);
        alert('Failed to place order. Please try again.');
    }
}

async function trackOrder() {
    if (!currentOrder) {
        updateOrderStatus('No active orders to track.');
        return;
    }
    
    try {
        const response = await fetch(`https://foodorder-function-node-gjhnhtapgnd9g0fq.southeastasia-01.azurewebsites.net/api/order?orderId=${currentOrder.orderId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.orderId) {
            updateOrderStatus(`Order ${data.orderId}: ${data.status} - Estimated time: ${data.estimatedTime}`);
        } else {
            throw new Error(data.error || 'Failed to track order');
        }
    } catch (error) {
        console.error('Track order error:', error);
        updateOrderStatus('Failed to track order. Please try again.');
    }
}

function updateOrderStatus(message) {
    document.getElementById('status-display').textContent = message;
}

// Azure Logic Apps Notification
async function triggerNotification(orderId, customerEmail) {
    try {
        // This would call your Azure Logic Apps endpoint
        const response = await fetch('https://foodorder-function-node-gjhnhtapgnd9g0fq.southeastasia-01.azurewebsites.net/api/notify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                orderId,
                customerEmail,
                notificationType: 'order_placed'
            })
        });
        
        if (!response.ok) {
            console.warn('Notification trigger failed');
        }
    } catch (error) {
        console.warn('Notification error:', error);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Check for existing auth
    authToken = localStorage.getItem('authToken');
    
    // Initialize UI
    initAuth();
});

// Auto-refresh order status every 30 seconds
setInterval(() => {
    if (currentOrder && authToken) {
        trackOrder();
    }
}, 30000);
