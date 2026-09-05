// The menu now lives in Cosmos DB (MenuItems container) so stall staff can
// add/edit/remove items without a code deploy. The client still only ever
// sends an itemId when ordering — the server looks up the current price
// itself, so a stale price on the client's screen can never be exploited.
const { listMenuItems, getMenuItemById, upsertMenuItem, deleteMenuItem } = require('./cosmosClient');

async function getMenu() {
  const items = await listMenuItems();
  return items.map(({ itemId, name, price }) => ({ itemId, name, price }));
}

async function getMenuItem(itemId) {
  if (!itemId) return null;
  const item = await getMenuItemById(itemId);
  if (!item) return null;
  return { name: item.name, price: item.price };
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Used by the stall admin endpoints. Creating a new item omits itemId (one is
// derived from the name); updating an existing one passes itemId explicitly.
async function saveMenuItem({ itemId, name, price }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw Object.assign(new Error('Item name is required'), { status: 400 });
  }
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    throw Object.assign(new Error('Price must be a positive number'), { status: 400 });
  }
  const id = itemId || slugify(name);
  if (!id) {
    throw Object.assign(new Error('Could not derive an item ID from that name'), { status: 400 });
  }
  return upsertMenuItem({ itemId: id, name: name.trim(), price: Math.round(numericPrice * 100) / 100 });
}

async function removeMenuItem(itemId) {
  return deleteMenuItem(itemId);
}

module.exports = { getMenu, getMenuItem, saveMenuItem, removeMenuItem };
