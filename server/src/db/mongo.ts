import { MongoClient } from "mongodb";

function getMongoUri() {
  const uri = process.env.MONGO_URI;
  return typeof uri === "string" && uri.trim() ? uri.trim() : "";
}

function getDbName() {
  const name = process.env.MONGO_DB;
  return typeof name === "string" && name.trim() ? name.trim() : "code_editor";
}

const globalKey = "__code_editor_mongo_client_promise__";

async function getClient() {
  const uri = getMongoUri();
  if (!uri) return null;

  const g = globalThis;
  if (!g[globalKey]) {
    const client = new MongoClient(uri);
    g[globalKey] = client.connect().then(() => client);
  }
  return g[globalKey];
}

export async function getMongoDb() {
  const client = await getClient();
  if (!client) return null;
  return client.db(getDbName());
}

