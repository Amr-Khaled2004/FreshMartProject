require("dotenv").config();

const fs = require("fs");
const path = require("path");
const connectDB = require("../config/db");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");

function normalizeRecord(record) {
  const id = String(record.id || record._id);

  return {
    ...record,
    id,
    _id: id
  };
}

async function upsertMany(Model, records) {
  for (const record of records) {
    const normalizedRecord = normalizeRecord(record);
    await Model.updateOne(
      { _id: normalizedRecord._id },
      { $set: normalizedRecord },
      { upsert: true }
    );
  }
}

async function migrate() {
  const databasePath = path.join(__dirname, "..", "database.json");
  const db = JSON.parse(fs.readFileSync(databasePath, "utf-8"));

  await connectDB();

  await upsertMany(User, db.users || []);
  await upsertMany(Product, db.products || []);
  await upsertMany(Order, db.orders || []);

  console.log(`Migrated ${(db.users || []).length} users`);
  console.log(`Migrated ${(db.products || []).length} products`);
  console.log(`Migrated ${(db.orders || []).length} orders`);

  process.exit(0);
}

migrate().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
