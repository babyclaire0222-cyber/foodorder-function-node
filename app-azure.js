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
        // Redirect to Microsoft Entra ID login
        const authUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?' +
            'client_id=' + encodeURIComponent('02b91625-106e-4b30-89f3-171969d614ea') +
            '&response_type=code' +
            '&redirect_uri=' + encodeURIComponent(window.location.origin + '/auth/callback') +
            '&response_mode=query' +
            '&scope=' + encodeURIComponent('openid profile email') +
            '&state=' + Math.random().toString(36).substring(7);
            
        window.location.href = authUrl;
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

function logout() {
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    showLoginSection();
    initAuth();
}

function handleAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code) {
        // Exchange auth code for token
        exchangeCodeForToken(code);
    }
}

async function exchangeCodeForToken(code) {
    try {
        const response = await fetch('https://foodorder-function-node-gjhnhtapgnd9g0fq.southeastasia-01.azurewebsites.net/api/auth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Remove auth params from URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            showAppSection();
            initAuth();
        } else {
            throw new Error(data.error || 'Authentication failed');
        }
    } catch (error) {
        console.error('Token exchange error:', error);
        alert('Authentication failed. Please try again.');
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
    // Check for auth callback
    if (window.location.search.includes('code=')) {
        handleAuthCallback();
        return;
    }
    
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
