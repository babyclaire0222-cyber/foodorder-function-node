// --- LOCAL TESTING VERSION ---
const orderEndpoint = "http://localhost:3000/api/OrderTrigger";

// Login function
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;
    
    if (email && password) {
        // Simple validation - in production, you'd authenticate against a real service
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        console.log('Logged in with email:', email);
    } else {
        alert('Please enter both email and password');
    }
}

// Order function (simplified for local testing)
async function placeOrder(itemName, price) {
    try {
        const statusElement = document.getElementById('status-display');
        statusElement.innerText = "Processing order...";

        const orderData = {
            item: itemName,
            price: price,
            timestamp: new Date().toISOString(),
            customerEmail: document.getElementById('login-email').value || 'test@example.com'
        };

        console.log('Sending order:', orderData);

        // Send order without Azure authentication for local testing
        const response = await fetch(orderEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            const result = await response.json();
            statusElement.innerText = `Order placed successfully! ${itemName} - $${price}`;
            console.log('Order response:', result);
        } else {
            const errorData = await response.json();
            statusElement.innerText = `Order failed: ${errorData.error || 'Unknown error'}`;
            console.error('Order error:', errorData);
        }
    } catch (error) {
        console.error("Error:", error);
        document.getElementById('status-display').innerText = "Communication Error.";
    }
}

// Track order function
async function trackOrder() {
    const statusElement = document.getElementById('status-display');
    statusElement.innerText = "Checking order status...";
    
    // Simulate status check - in production, you'd query a real order tracking API
    setTimeout(() => {
        statusElement.innerText = "Order status: Preparing your food...";
    }, 1000);
}
