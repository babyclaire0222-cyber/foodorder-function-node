const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
    context.log('Admin API - System monitoring request');
    
    try {
        // Simple admin authentication (in production, use proper role-based access)
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.ADMIN_API_KEY) {
            context.res = {
                status: 403,
                body: { error: 'Unauthorized - Admin access required' }
            };
            return;
        }
        
        const endpoint = process.env.CosmosDBConnection;
        const client = new CosmosClient(endpoint);
        
        // Get system statistics
        const stats = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            orders: await getOrderStats(client),
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                environment: process.env.NODE_ENV || 'development'
            }
        };
        
        context.res = {
            status: 200,
            body: {
                success: true,
                data: stats
            }
        };
        
    } catch (error) {
        context.log.error('Admin API error:', error);
        context.res = {
            status: 500,
            body: {
                success: false,
                error: 'Failed to retrieve admin data',
                details: error.message
            }
        };
    }
};

async function getOrderStats(client) {
    try {
        const database = client.database('FoodOrderDB');
        const container = database.container('Orders');
        
        // Get total orders
        const { resources: allOrders } = await container.items
            .query('SELECT VALUE COUNT(1) FROM c')
            .fetchAll();
        
        // Get orders by status
        const { resources: statusCounts } = await container.items
            .query('SELECT c.status, COUNT(1) as count FROM c GROUP BY c.status')
            .fetchAll();
        
        // Get recent orders (last 24 hours)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { resources: recentOrders } = await container.items
            .query(`SELECT VALUE COUNT(1) FROM c WHERE c.timestamp >= "${twentyFourHoursAgo}"`)
            .fetchAll();
        
        return {
            total: allOrders[0] || 0,
            recent: recentOrders[0] || 0,
            byStatus: statusCounts.reduce((acc, item) => {
                acc[item.status] = item.count;
                return acc;
            }, {})
        };
    } catch (error) {
        return { error: 'Failed to get order stats' };
    }
}
