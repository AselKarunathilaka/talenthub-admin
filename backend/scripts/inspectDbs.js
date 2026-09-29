const { MongoClient } = require('mongoose').mongo;

const PROD_URI = "mongodb+srv://Thisal:Thisal@cluster0.mjduh6q.mongodb.net/intern-attendance?retryWrites=true&w=majority&appName=Cluster0";
const TEST_URI = "mongodb://lakindu:Sltlakindu26@124.43.216.137:27017/talenthub?authSource=talenthub&tls=false&directConnection=true";

async function inspect() {
  console.log("Connecting to Production MongoDB (READ ONLY)...");
  const prodClient = new MongoClient(PROD_URI, { readPreference: 'primaryPreferred' });
  await prodClient.connect();
  console.log("Connected to Production successfully!");

  console.log("Connecting to Testing MongoDB...");
  const testClient = new MongoClient(TEST_URI, { directConnection: true });
  await testClient.connect();
  console.log("Connected to Testing successfully!");

  const prodDb = prodClient.db("intern-attendance");
  const testDb = testClient.db("talenthub");

  const prodCollections = (await prodDb.listCollections().toArray()).map(c => c.name).sort();
  const testCollections = (await testDb.listCollections().toArray()).map(c => c.name).sort();

  console.log("\n--- PRODUCTION COLLECTIONS & COUNTS ---");
  for (const name of prodCollections) {
    const count = await prodDb.collection(name).countDocuments();
    console.log(`  ${name}: ${count} docs`);
  }

  console.log("\n--- TESTING COLLECTIONS & COUNTS ---");
  for (const name of testCollections) {
    const count = await testDb.collection(name).countDocuments();
    console.log(`  ${name}: ${count} docs`);
  }

  await prodClient.close();
  await testClient.close();
  console.log("\nConnections closed.");
}

inspect().catch(err => {
  console.error("Inspection error:", err);
  process.exit(1);
});
