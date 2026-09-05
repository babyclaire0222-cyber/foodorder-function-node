const { CosmosClient } = require('@azure/cosmos');

let client;
let ordersContainerPromise;
let menuContainerPromise;

function getClient() {
  if (!client) {
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('COSMOS_CONNECTION_STRING app setting is not configured');
    }
    client = new CosmosClient(connectionString);
  }
  return client;
}

// Lazily creates the database/Orders container the first time they're needed,
// with TTL turned on at the container level. Cosmos only auto-expires
// documents that (a) have a numeric `ttl` field and (b) live in a container
// where TTL is enabled.
async function getOrdersContainer() {
  if (!ordersContainerPromise) {
    ordersContainerPromise = (async () => {
      const dbName = process.env.COSMOS_DATABASE_NAME || 'FoodOrderDB';
      const containerName = process.env.COSMOS_CONTAINER_NAME || 'Orders';

      const { database } = await getClient().databases.createIfNotExists({ id: dbName });
      const { container } = await database.containers.createIfNotExists({
        id: containerName,
        partitionKey: { paths: ['/id'] },
        defaultTtl: -1 // enabled container-wide; each item's own `ttl` field controls its lifetime
      });
      return container;
    })();
  }
  return ordersContainerPromise;
}

// Menu lives in its own container (no TTL — menu items are permanent until a
// staff member deletes them) so stall staff can edit it without touching
// application code.
const DEFAULT_MENU_ITEMS = [
  { id: 'pizza', itemId: 'pizza', name: 'Pizza', price: 12.99 },
  { id: 'burger', itemId: 'burger', name: 'Burger', price: 7.99 },
  { id: 'spaghetti', itemId: 'spaghetti', name: 'Spaghetti', price: 8.99 }
];

async function getMenuContainer() {
  if (!menuContainerPromise) {
    menuContainerPromise = (async () => {
      const dbName = process.env.COSMOS_DATABASE_NAME || 'FoodOrderDB';
      const containerName = process.env.COSMOS_MENU_CONTAINER_NAME || 'MenuItems';

      const { database } = await getClient().databases.createIfNotExists({ id: dbName });
      const { container } = await database.containers.createIfNotExists({
        id: containerName,
        partitionKey: { paths: ['/id'] }
      });

      // Seed with the original three items on first run so the app isn't
      // empty out of the box; staff can edit/delete/add from there.
      const { resources: existing } = await container.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
      if (!existing[0]) {
        for (const item of DEFAULT_MENU_ITEMS) {
          await container.items.create(item);
        }
      }
      return container;
    })();
  }
  return menuContainerPromise;
}

const ORDER_TTL_SECONDS = 24 * 60 * 60; // 24 hours, matches the product requirement

async function createOrder(order) {
  const container = await getOrdersContainer();
  const { resource } = await container.items.create({
    ...order,
    ttl: ORDER_TTL_SECONDS
  });
  return resource;
}

async function getOrder(orderId) {
  const container = await getOrdersContainer();
  try {
    const { resource } = await container.item(orderId, orderId).read();
    return resource || null;
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}

async function updateOrder(orderId, patch) {
  const container = await getOrdersContainer();
  const existing = await getOrder(orderId);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  const { resource } = await container.item(orderId, orderId).replace(updated);
  return resource;
}

// For the stall dashboard: most recent orders first, optionally filtered by
// status. Capped at 100 so a busy stall's dashboard stays fast.
async function listOrders({ status, limit = 100 } = {}) {
  const container = await getOrdersContainer();
  const query = status
    ? {
        query: 'SELECT * FROM c WHERE c.status = @status ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit',
        parameters: [{ name: '@status', value: status }, { name: '@limit', value: limit }]
      }
    : {
        query: 'SELECT * FROM c ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit',
        parameters: [{ name: '@limit', value: limit }]
      };
  const { resources } = await container.items.query(query).fetchAll();
  return resources;
}

async function listMenuItems() {
  const container = await getMenuContainer();
  const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
  return resources;
}

async function getMenuItemById(itemId) {
  const container = await getMenuContainer();
  try {
    const { resource } = await container.item(itemId, itemId).read();
    return resource || null;
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}

async function upsertMenuItem(item) {
  const container = await getMenuContainer();
  const { resource } = await container.items.upsert({ ...item, id: item.itemId });
  return resource;
}

async function deleteMenuItem(itemId) {
  const container = await getMenuContainer();
  try {
    await container.item(itemId, itemId).delete();
    return true;
  } catch (err) {
    if (err.code === 404) return false;
    throw err;
  }
}

module.exports = {
  getClient,
  getOrdersContainer,
  getMenuContainer,
  createOrder,
  getOrder,
  updateOrder,
  listOrders,
  listMenuItems,
  getMenuItemById,
  upsertMenuItem,
  deleteMenuItem,
  ORDER_TTL_SECONDS
};
