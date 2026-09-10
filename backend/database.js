import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;
let client = null;
let db = null;
let isConnected = false;

export async function initDatabase() {
  if (!uri) {
    console.log('[Database] ℹ️ MONGODB_URI not found. Running in local file-only mode.');
    return null;
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('fastchick');
    isConnected = true;
    console.log('🚀 [Database] Successfully connected to MongoDB Atlas (fastchick database)!');
    return db;
  } catch (err) {
    console.error('❌ [Database] Connection error to MongoDB Atlas:', err.message);
    isConnected = false;
    return null;
  }
}

export function isDbConnected() {
  return isConnected && db !== null;
}

/**
 * Hydrates an in-memory dictionary from a MongoDB collection.
 * If MongoDB collection is empty and local data exists, automatically seeds MongoDB!
 */
export async function syncStore(collectionName, localData = {}) {
  if (!isDbConnected()) return localData;

  try {
    const col = db.collection(collectionName);
    const count = await col.countDocuments();

    if (count === 0) {
      // Seed MongoDB with initial local data
      const entries = Object.entries(localData);
      if (entries.length > 0) {
        console.log(`[Database] 📦 Seeding MongoDB collection "${collectionName}" with ${entries.length} local items...`);
        const docs = entries.map(([key, val]) => ({
          _id: String(key),
          data: val,
          updatedAt: new Date()
        }));
        await col.insertMany(docs);
      }
      return localData;
    }

    // Load from MongoDB
    const docs = await col.find({}).toArray();
    const result = { ...localData };
    for (const doc of docs) {
      result[doc._id] = doc.data !== undefined ? doc.data : doc;
    }
    console.log(`[Database] 📥 Loaded ${docs.length} records from MongoDB collection "${collectionName}"`);
    return result;
  } catch (err) {
    console.error(`[Database] Error syncing collection "${collectionName}":`, err.message);
    return localData;
  }
}

/**
 * Upsert a single key-value into a MongoDB collection
 */
export async function upsertItem(collectionName, key, value) {
  if (!isDbConnected() || !key) return;
  try {
    const col = db.collection(collectionName);
    await col.updateOne(
      { _id: String(key) },
      { $set: { _id: String(key), data: value, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error(`[Database] Error upserting into "${collectionName}":`, err.message);
  }
}

/**
 * Replace entire collection or bulk save (e.g. for complete objects)
 */
export async function saveAllItems(collectionName, dataObj) {
  if (!isDbConnected() || !dataObj) return;
  try {
    const col = db.collection(collectionName);
    const operations = Object.entries(dataObj).map(([key, val]) => ({
      updateOne: {
        filter: { _id: String(key) },
        update: { $set: { _id: String(key), data: val, updatedAt: new Date() } },
        upsert: true
      }
    }));
    if (operations.length > 0) {
      await col.bulkWrite(operations);
    }
  } catch (err) {
    console.error(`[Database] Error bulk saving "${collectionName}":`, err.message);
  }
}

/**
 * Special handler for support tickets array
 */
export async function syncTickets(localTickets = []) {
  if (!isDbConnected()) return localTickets;
  try {
    const col = db.collection('support_tickets');
    const count = await col.countDocuments();

    if (count === 0 && localTickets.length > 0) {
      console.log(`[Database] 📦 Seeding MongoDB support tickets with ${localTickets.length} items...`);
      const docs = localTickets.map(t => ({
        _id: t.ticketId,
        ...t,
        updatedAt: new Date(t.updatedAt || t.createdAt || Date.now())
      }));
      await col.insertMany(docs);
      return localTickets;
    }

    const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
    if (docs.length > 0) {
      console.log(`[Database] 📥 Loaded ${docs.length} support tickets from MongoDB`);
      return docs.map(d => {
        const { _id, ...rest } = d;
        return { ticketId: _id, ...rest };
      });
    }
    return localTickets;
  } catch (err) {
    console.error('[Database] Error syncing support tickets:', err.message);
    return localTickets;
  }
}

export async function upsertTicket(ticket) {
  if (!isDbConnected() || !ticket?.ticketId) return;
  try {
    const col = db.collection('support_tickets');
    const { ticketId, ...rest } = ticket;
    await col.updateOne(
      { _id: ticketId },
      { $set: { _id: ticketId, ticketId, ...rest, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error('[Database] Error upserting ticket to MongoDB:', err.message);
  }
}

export async function saveAllTickets(tickets) {
  if (!isDbConnected() || !Array.isArray(tickets)) return;
  try {
    const col = db.collection('support_tickets');
    const operations = tickets.map(t => ({
      updateOne: {
        filter: { _id: t.ticketId },
        update: { $set: { _id: t.ticketId, ...t, updatedAt: new Date() } },
        upsert: true
      }
    }));
    if (operations.length > 0) {
      await col.bulkWrite(operations);
    }
  } catch (err) {
    console.error('[Database] Error bulk saving support tickets:', err.message);
  }
}

export async function deleteTicketFromMongo(ticketId) {
  if (!isDbConnected() || !ticketId) return;
  try {
    const col = db.collection('support_tickets');
    await col.deleteOne({ _id: ticketId });
  } catch (err) {
    console.error('[Database] Error deleting ticket from MongoDB:', err.message);
  }
}

