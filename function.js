{
  "scriptFile"; "index.js",
  "bindings"; [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["post", "get"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    },
    {
      "type": "cosmosDB",
      "direction": "out",
      "name": "orderDocument",
      "databaseName": "FoodOrderDB",
      "collectionName": "Orders",
      "createIfNotExists": true,
      "connectionStringSetting": "CosmosDBConnection"
    }
  ]
}