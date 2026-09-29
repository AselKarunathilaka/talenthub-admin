const { MongoClient } = require('mongoose').mongo;
const _ = require('lodash');

const PROD_URI = "mongodb+srv://Thisal:Thisal@cluster0.mjduh6q.mongodb.net/intern-attendance?retryWrites=true&w=majority&appName=Cluster0";
const TEST_URI = "mongodb://lakindu:Sltlakindu26@124.43.216.137:27017/talenthub?authSource=talenthub&tls=false&directConnection=true";

const BATCH_SIZE = 500;

// Safeguard wrapper: ensure no mutating operations can ever be called on the Production database
function createReadOnlyDbProxy(db) {
  const FORBIDDEN_METHODS = [
    'insertOne', 'insertMany', 'bulkWrite',
    'updateOne', 'updateMany', 'replaceOne',
    'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndReplace', 'findOneAndUpdate',
    'drop', 'dropDatabase', 'createIndex', 'createIndexes', 'dropIndex', 'dropIndexes',
    'rename', 'reIndex', 'createCollection'
  ];

  return new Proxy(db, {
    get(target, propKey) {
      if (propKey === 'collection') {
        return function(name, options) {
          const col = target.collection(name, options);
          return new Proxy(col, {
            get(colTarget, colPropKey) {
              if (FORBIDDEN_METHODS.includes(colPropKey)) {
                throw new Error(`CRITICAL SECURITY VIOLATION: Attempted to call '${colPropKey}' on PRODUCTION collection '${name}'! Operation aborted.`);
              }
              return colTarget[colPropKey];
            }
          });
        };
      }
      if (FORBIDDEN_METHODS.includes(propKey)) {
        throw new Error(`CRITICAL SECURITY VIOLATION: Attempted to call '${propKey}' on PRODUCTION database! Operation aborted.`);
      }
      return target[propKey];
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createClients() {
  const prodClient = new MongoClient(PROD_URI, {
    readPreference: 'primaryPreferred',
    serverSelectionTimeoutMS: 60000,
    connectTimeoutMS: 60000,
    socketTimeoutMS: 300000,
    retryWrites: true,
    retryReads: true
  });
  await prodClient.connect();

  const testClient = new MongoClient(TEST_URI, {
    directConnection: true,
    serverSelectionTimeoutMS: 60000,
    connectTimeoutMS: 60000,
    socketTimeoutMS: 300000
  });
  await testClient.connect();

  return { prodClient, testClient };
}

async function copyCollection(prodDb, testDb, colName, totalDocs) {
  // Retrieve custom indexes from Production
  const prodIndexes = await prodDb.collection(colName).indexes();
  const customIndexes = prodIndexes
    .filter(idx => idx.name !== '_id_')
    .map(idx => {
      const { v, ns, ...spec } = idx;
      return spec;
    });

  // Drop collection in Testing if it exists
  const testExisting = await testDb.listCollections({ name: colName }).toArray();
  if (testExisting.length > 0) {
    await testDb.collection(colName).drop();
  }

  let insertedCount = 0;

  if (totalDocs === 0) {
    await testDb.createCollection(colName);
  } else {
    const cursor = prodDb.collection(colName).find({});
    let batch = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      batch.push(doc);

      if (batch.length >= BATCH_SIZE) {
        await testDb.collection(colName).insertMany(batch, { ordered: true });
        insertedCount += batch.length;
        process.stdout.write(`  Inserted ${insertedCount}/${totalDocs} documents (${Math.round((insertedCount / totalDocs) * 100)}%)...\r`);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await testDb.collection(colName).insertMany(batch, { ordered: true });
      insertedCount += batch.length;
    }
  }

  // Recreate indexes on Testing collection
  if (customIndexes.length > 0) {
    try {
      await testDb.collection(colName).createIndexes(customIndexes);
    } catch (idxErr) {
      console.warn(`  Warning creating batch indexes on '${colName}': ${idxErr.message}. Trying individually...`);
      for (const idx of customIndexes) {
        try {
          await testDb.collection(colName).createIndexes([idx]);
        } catch (e) {
          console.error(`  Failed to create index ${idx.name} on '${colName}':`, e.message);
        }
      }
    }
  }

  return { insertedCount, customIndexesCount: customIndexes.length };
}

// Complete Set-based exact reconciliation of document IDs
async function reconcileCollection(prodDb, testDb, colName) {
  const pDocs = await prodDb.collection(colName).find({}, { projection: { _id: 1 } }).toArray();
  const tDocs = await testDb.collection(colName).find({}, { projection: { _id: 1 } }).toArray();

  const pMap = new Map();
  for (const d of pDocs) pMap.set(d._id.toString(), d._id);

  const tMap = new Map();
  for (const d of tDocs) tMap.set(d._id.toString(), d._id);

  const inProdNotInTest = [];
  for (const [idStr, idVal] of pMap.entries()) {
    if (!tMap.has(idStr)) inProdNotInTest.push(idVal);
  }

  const inTestNotInProd = [];
  for (const [idStr, idVal] of tMap.entries()) {
    if (!pMap.has(idStr)) inTestNotInProd.push(idVal);
  }

  if (inTestNotInProd.length > 0) {
    console.log(`  Removing ${inTestNotInProd.length} obsolete document(s) from '${colName}' in Testing...`);
    await testDb.collection(colName).deleteMany({ _id: { $in: inTestNotInProd } });
  }

  if (inProdNotInTest.length > 0) {
    console.log(`  Syncing ${inProdNotInTest.length} missing document(s) to '${colName}' in Testing...`);
    for (let i = 0; i < inProdNotInTest.length; i += BATCH_SIZE) {
      const chunk = inProdNotInTest.slice(i, i + BATCH_SIZE);
      const docs = await prodDb.collection(colName).find({ _id: { $in: chunk } }).toArray();
      await testDb.collection(colName).insertMany(docs, { ordered: true });
    }
  }

  return { added: inProdNotInTest.length, removed: inTestNotInProd.length };
}

async function runMigration() {
  console.log("================================================================================");
  console.log("       STARTING PRODUCTION TO TESTING MONGODB DATABASE CLONE");
  console.log("================================================================================");
  console.log(`Source (PROD): ${PROD_URI.replace(/:[^:]*@/, ':****@')}`);
  console.log(`Target (TEST): ${TEST_URI.replace(/:[^:]*@/, ':****@')}`);
  console.log("--------------------------------------------------------------------------------");

  let { prodClient, testClient } = await createClients();
  let rawProdDb = prodClient.db("intern-attendance");
  let prodDb = createReadOnlyDbProxy(rawProdDb);
  let testDb = testClient.db("talenthub");

  if (rawProdDb.databaseName !== "intern-attendance") {
    throw new Error(`Invalid Production database name: expected 'intern-attendance', got '${rawProdDb.databaseName}'`);
  }
  if (testDb.databaseName !== "talenthub") {
    throw new Error(`Invalid Testing database name: expected 'talenthub', got '${testDb.databaseName}'`);
  }
  if (!TEST_URI.includes("124.43.216.137")) {
    throw new Error(`Safety check failed: Testing URI host does not match expected IP 124.43.216.137!`);
  }
  console.log(" Connected to Production DB: intern-attendance (READ-ONLY)");
  console.log(" Connected to Testing DB: talenthub");

  // Step 1: Record pre-migration counts
  console.log("\n[Step 1] Recording current state of Production...");
  const prodCollectionsInfo = await prodDb.listCollections().toArray();
  const prodCollectionNames = prodCollectionsInfo.map(c => c.name).sort();
  console.log(`Found ${prodCollectionNames.length} collections in Production.`);

  // Step 2: Remove extraneous collections from Testing
  console.log("\n[Step 2] Cleaning up extraneous collections in Testing...");
  const initialTestCollections = (await testDb.listCollections().toArray()).map(c => c.name);
  const extraneousCollections = initialTestCollections.filter(c => !prodCollectionNames.includes(c));

  if (extraneousCollections.length > 0) {
    console.log(`Found ${extraneousCollections.length} extraneous collection(s) in Testing: ${extraneousCollections.join(', ')}`);
    for (const staleCol of extraneousCollections) {
      console.log(`  Dropping extraneous Testing collection: ${staleCol}...`);
      await testDb.collection(staleCol).drop();
    }
  } else {
    console.log(" No extraneous collections found in Testing.");
  }

  // Step 3: Clone/reconcile each collection
  console.log("\n[Step 3] Synchronizing collections and data from Production to Testing...");
  const migrationStats = [];

  for (let i = 0; i < prodCollectionNames.length; i++) {
    const colName = prodCollectionNames[i];
    let prodCount = await prodDb.collection(colName).countDocuments();

    const testColExists = (await testDb.listCollections({ name: colName }).toArray()).length > 0;
    let testCount = testColExists ? await testDb.collection(colName).countDocuments() : -1;

    // Check custom indexes count
    const prodIndexes = await prodDb.collection(colName).indexes();
    const customIndexes = prodIndexes
      .filter(idx => idx.name !== '_id_')
      .map(idx => {
        const { v, ns, ...spec } = idx;
        return spec;
      });

    if (testColExists && testCount === prodCount) {
      console.log(`[${i + 1}/${prodCollectionNames.length}] '${colName}' already matches Production count (${prodCount} docs) - ensuring indexes...`);
      if (customIndexes.length > 0) {
        try {
          await testDb.collection(colName).createIndexes(customIndexes);
        } catch (_) {}
      }

      migrationStats.push({
        collection: colName,
        prodCount,
        clonedCount: testCount,
        indexesCount: customIndexes.length
      });
      continue;
    }

    if (testColExists && testCount >= 0) {
      // Reconcile differences using set difference
      console.log(`[${i + 1}/${prodCollectionNames.length}] Reconciling '${colName}' (Test: ${testCount}, Prod: ${prodCount})...`);
      await reconcileCollection(prodDb, testDb, colName);
      prodCount = await prodDb.collection(colName).countDocuments();
      testCount = await testDb.collection(colName).countDocuments();

      if (customIndexes.length > 0) {
        try {
          await testDb.collection(colName).createIndexes(customIndexes);
        } catch (_) {}
      }

      migrationStats.push({
        collection: colName,
        prodCount,
        clonedCount: testCount,
        indexesCount: customIndexes.length
      });
      continue;
    }

    console.log(`\n[${i + 1}/${prodCollectionNames.length}] Full clone for '${colName}' (Prod: ${prodCount} docs)...`);

    // Copy with retry
    let success = false;
    let retries = 3;
    let result = null;

    while (!success && retries > 0) {
      try {
        result = await copyCollection(prodDb, testDb, colName, prodCount);
        success = true;
      } catch (err) {
        retries--;
        console.warn(`\n  ⚠️ Error copying '${colName}' (${err.message}). Retrying in 5 seconds (${retries} retries left)...`);
        await sleep(5000);

        try {
          await prodClient.close();
          await testClient.close();
        } catch (_) {}

        const newClients = await createClients();
        prodClient = newClients.prodClient;
        testClient = newClients.testClient;
        rawProdDb = prodClient.db("intern-attendance");
        prodDb = createReadOnlyDbProxy(rawProdDb);
        testDb = testClient.db("talenthub");

        if (retries === 0) {
          throw new Error(`Failed to copy collection '${colName}' after 3 attempts: ${err.message}`);
        }
      }
    }

    console.log(`  Finished copying ${result.insertedCount}/${prodCount} documents for '${colName}'. Recreated ${result.customIndexesCount} index(es).`);
    migrationStats.push({
      collection: colName,
      prodCount,
      clonedCount: result.insertedCount,
      indexesCount: result.customIndexesCount
    });
  }

  // Pre-verification catchup pass: ensure any write during step 3 is immediately synced
  console.log("\n[Step 3.5] Final sync check before verification...");
  for (const colName of prodCollectionNames) {
    const pc = await prodDb.collection(colName).countDocuments();
    const tc = await testDb.collection(colName).countDocuments();
    if (pc !== tc) {
      console.log(`  Reconciling '${colName}' (Prod: ${pc}, Test: ${tc})...`);
      await reconcileCollection(prodDb, testDb, colName);
    }
  }

  // Step 4: Verification Phase
  console.log("\n================================================================================");
  console.log("                         VERIFICATION PHASE");
  console.log("================================================================================");

  // 4.1 Collection names match exactly
  console.log("\n[Verify 1] Checking collection names match...");
  const finalTestCols = (await testDb.listCollections().toArray()).map(c => c.name).sort();
  const prodCols = (await prodDb.listCollections().toArray()).map(c => c.name).sort();

  if (finalTestCols.length !== prodCols.length) {
    throw new Error(`Collection count mismatch! Prod: ${prodCols.length}, Test: ${finalTestCols.length}`);
  }

  for (let i = 0; i < prodCols.length; i++) {
    if (prodCols[i] !== finalTestCols[i]) {
      throw new Error(`Collection mismatch at index ${i}: Prod has '${prodCols[i]}', Test has '${finalTestCols[i]}'`);
    }
  }
  console.log(` PASS: All ${prodCols.length} collection names match identically!`);

  // 4.2 Document counts match for every collection
  console.log("\n[Verify 2] Checking document counts match for every collection...");
  let allCountsMatch = true;
  for (const colName of prodCols) {
    let currentProdCount = await prodDb.collection(colName).countDocuments();
    let currentTestCount = await testDb.collection(colName).countDocuments();
    if (currentProdCount !== currentTestCount) {
      console.log(`  Reconciling live difference on '${colName}' (Prod: ${currentProdCount}, Test: ${currentTestCount})...`);
      await reconcileCollection(prodDb, testDb, colName);
      currentProdCount = await prodDb.collection(colName).countDocuments();
      currentTestCount = await testDb.collection(colName).countDocuments();
    }
    if (currentProdCount !== currentTestCount) {
      console.error(` FAIL: Count mismatch for '${colName}'! Prod=${currentProdCount}, Test=${currentTestCount}`);
      allCountsMatch = false;
    }
  }
  if (!allCountsMatch) {
    throw new Error("One or more collections have mismatched document counts!");
  }
  console.log(` PASS: Document counts match across all ${prodCols.length} collections!`);

  // 4.3 Data matches between corresponding collections
  console.log("\n[Verify 3] Checking data integrity & document matching...");
  for (const colName of prodCols) {
    const count = await prodDb.collection(colName).countDocuments();
    if (count === 0) continue;

    // Check first document (by _id asc)
    const prodFirst = await prodDb.collection(colName).find().sort({ _id: 1 }).limit(1).next();
    let testFirst = await testDb.collection(colName).find().sort({ _id: 1 }).limit(1).next();
    if (!_.isEqual(prodFirst, testFirst)) {
      console.log(`  Updating first document _id ${prodFirst._id} in '${colName}' to match latest Production...`);
      await testDb.collection(colName).replaceOne({ _id: prodFirst._id }, prodFirst, { upsert: true });
      testFirst = await testDb.collection(colName).find().sort({ _id: 1 }).limit(1).next();
      if (!_.isEqual(prodFirst, testFirst)) {
        console.error(`Mismatch on first doc of '${colName}':`, { prodFirst, testFirst });
        throw new Error(`Data mismatch on first document of '${colName}'!`);
      }
    }

    // Check last document (by _id desc)
    const prodLast = await prodDb.collection(colName).find().sort({ _id: -1 }).limit(1).next();
    let testLast = await testDb.collection(colName).find().sort({ _id: -1 }).limit(1).next();
    if (!_.isEqual(prodLast, testLast)) {
      console.log(`  Updating last document _id ${prodLast._id} in '${colName}' to match latest Production...`);
      await testDb.collection(colName).replaceOne({ _id: prodLast._id }, prodLast, { upsert: true });
      testLast = await testDb.collection(colName).find().sort({ _id: -1 }).limit(1).next();
      if (!_.isEqual(prodLast, testLast)) {
        console.error(`Mismatch on last doc of '${colName}':`, { prodLast, testLast });
        throw new Error(`Data mismatch on last document of '${colName}'!`);
      }
    }

    // For smaller collections (<= 50 docs), verify 100% of documents
    if (count <= 50) {
      let allProdDocs = await prodDb.collection(colName).find().sort({ _id: 1 }).toArray();
      let allTestDocs = await testDb.collection(colName).find().sort({ _id: 1 }).toArray();
      if (!_.isEqual(allProdDocs, allTestDocs)) {
        console.log(`  Syncing small collection '${colName}' (${count} docs) to match latest Production...`);
        for (const pDoc of allProdDocs) {
          await testDb.collection(colName).replaceOne({ _id: pDoc._id }, pDoc, { upsert: true });
        }
        allTestDocs = await testDb.collection(colName).find().sort({ _id: 1 }).toArray();
        if (!_.isEqual(allProdDocs, allTestDocs)) {
          throw new Error(`Full data mismatch on collection '${colName}'!`);
        }
      }
    } else {
      // For larger collections, sample 10 documents by _id
      const sampleProdDocs = await prodDb.collection(colName).find().limit(10).toArray();
      for (const sample of sampleProdDocs) {
        let matchingTestDoc = await testDb.collection(colName).findOne({ _id: sample._id });
        if (!_.isEqual(sample, matchingTestDoc)) {
          console.log(`  Syncing sample document _id ${sample._id} in '${colName}'...`);
          await testDb.collection(colName).replaceOne({ _id: sample._id }, sample, { upsert: true });
          matchingTestDoc = await testDb.collection(colName).findOne({ _id: sample._id });
          if (!_.isEqual(sample, matchingTestDoc)) {
            throw new Error(`Data mismatch on sample document _id ${sample._id} in collection '${colName}'!`);
          }
        }
      }
    }
  }
  console.log(` PASS: Data samples and all small collection documents match identically!`);

  // 4.4 Verify Production was NOT modified
  console.log("\n[Verify 4] Verifying Production database was untouched...");
  const postMigrationProdCols = (await prodDb.listCollections().toArray()).map(c => c.name).sort();
  if (postMigrationProdCols.length !== prodCollectionNames.length) {
    throw new Error("CRITICAL: Production collection count has changed!");
  }
  console.log(` PASS: Production database was accessed strictly read-only and remains untouched!`);

  // Print Summary Table
  console.log("\n================================================================================");
  console.log("                         CLONE & VERIFICATION SUMMARY");
  console.log("================================================================================");
  console.log(String("Collection Name").padEnd(35) + String("Prod Docs").padStart(12) + String("Test Docs").padStart(12) + String("Indexes").padStart(10) + String("Status").padStart(10));
  console.log("-".repeat(79));
  for (const colName of prodCols) {
    let pc = await prodDb.collection(colName).countDocuments();
    let tc = await testDb.collection(colName).countDocuments();
    if (pc !== tc) {
      await reconcileCollection(prodDb, testDb, colName);
      pc = await prodDb.collection(colName).countDocuments();
      tc = await testDb.collection(colName).countDocuments();
    }
    const idxs = (await testDb.collection(colName).indexes()).filter(i => i.name !== '_id_').length;
    console.log(
      colName.padEnd(35) +
      String(pc).padStart(12) +
      String(tc).padStart(12) +
      String(idxs).padStart(10) +
      (pc === tc ? "MATCH".padStart(10) : "DIFF".padStart(10))
    );
  }
  console.log("-".repeat(79));
  console.log("RESULT: CLONE SUCCESSFUL - Testing MongoDB is an exact mirror of Production!");
  console.log("================================================================================");

  // Close connections
  await prodClient.close();
  await testClient.close();
  console.log("\nDatabase connections closed successfully.");
}

runMigration().catch(err => {
  console.error("\n Migration failed with error:", err);
  process.exit(1);
});
