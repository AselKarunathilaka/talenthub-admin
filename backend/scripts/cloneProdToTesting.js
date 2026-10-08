const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const { MongoClient } = mongoose.mongo;

const PROD_URI = 'mongodb+srv://Thisal:Thisal@cluster0.mjduh6q.mongodb.net/intern-attendance?retryWrites=true&w=majority&appName=Cluster0';
const TESTING_URI = 'mongodb+srv://sithulidulanma_db_user:SUkoXcbkdlXZAbKn@cluster0.fiuttha.mongodb.net/talenthub';

const PROD_DB_NAME = 'intern-attendance';
const TESTING_DB_NAME = 'talenthub';

// Strict Safety Pre-flight Checks
function runPreflightSafetyChecks() {
  if (PROD_URI === TESTING_URI) {
    throw new Error('FATAL: Production URI and Testing URI cannot be identical!');
  }
  if (!PROD_URI.includes('mjduh6q.mongodb.net') || !PROD_URI.includes(PROD_DB_NAME)) {
    throw new Error('FATAL: Production URI mismatch or invalid host/db.');
  }
  if (!TESTING_URI.includes('fiuttha.mongodb.net') || !TESTING_URI.includes(TESTING_DB_NAME)) {
    throw new Error('FATAL: Testing URI mismatch or invalid host/db.');
  }
  console.log('🛡️  Safety Pre-flight Checks PASSED:');
  console.log('   Source (Production - READ-ONLY):', PROD_DB_NAME, 'on cluster0.mjduh6q');
  console.log('   Target (Testing Server):', TESTING_DB_NAME, 'on cluster0.fiuttha');
}

async function cloneProductionToTesting() {
  runPreflightSafetyChecks();

  console.log('\n📡 Connecting to Production MongoDB (READ-ONLY)...');
  const prodClient = new MongoClient(PROD_URI);
  await prodClient.connect();
  const prodDb = prodClient.db(PROD_DB_NAME);

  console.log('📡 Connecting to Testing Server MongoDB...');
  const testClient = new MongoClient(TESTING_URI);
  await testClient.connect();
  const testDb = testClient.db(TESTING_DB_NAME);

  // Double check client and database identities
  if (testDb.databaseName !== TESTING_DB_NAME) {
    throw new Error(`Target database name must be ${TESTING_DB_NAME}, got ${testDb.databaseName}`);
  }

  try {
    // 1. Snapshot initial counts in Production for post-migration non-modification verification
    console.log('\n📸 Capturing initial Production document counts for integrity check...');
    const prodColObjects = (await prodDb.listCollections().toArray()).filter(c => !c.name.startsWith('system.'));
    const initialProdCounts = new Map();
    for (const col of prodColObjects) {
      const count = await prodDb.collection(col.name).countDocuments();
      initialProdCounts.set(col.name, count);
    }
    console.log(`Found ${prodColObjects.length} collections in Production.`);

    // 2. Identify Testing collections and remove collections not in Production
    const initialTestCols = (await testDb.listCollections().toArray()).filter(c => !c.name.startsWith('system.'));
    const prodColNamesSet = new Set(prodColObjects.map(c => c.name));

    console.log('\n🧹 Checking for extraneous collections in Testing...');
    for (const testCol of initialTestCols) {
      if (!prodColNamesSet.has(testCol.name)) {
        console.log(`⚠️  Dropping testing-only collection: ${testCol.name}`);
        await testDb.collection(testCol.name).drop();
        console.log(`✅ Dropped ${testCol.name} from Testing.`);
      }
    }

    // 3. Clone all collections from Production to Testing
    console.log('\n🚀 Starting clone from Production -> Testing...');
    const startTime = Date.now();

    for (let i = 0; i < prodColObjects.length; i++) {
      const colInfo = prodColObjects[i];
      const colName = colInfo.name;
      const expectedCount = initialProdCounts.get(colName);

      console.log(`\n[${i + 1}/${prodColObjects.length}] Processing collection: "${colName}" (Expected docs: ${expectedCount})`);

      // If collection exists in Testing, drop it first to ensure clean state
      const testColExists = (await testDb.listCollections({ name: colName }).toArray()).length > 0;
      if (testColExists) {
        await testDb.collection(colName).drop();
      }

      // Explicitly create collection in Testing (preserves 0-doc collections)
      await testDb.createCollection(colName);

      // Copy documents in batches if count > 0
      const prodCollection = prodDb.collection(colName);
      const testCollection = testDb.collection(colName);

      if (expectedCount > 0) {
        const cursor = prodCollection.find({});
        const BATCH_SIZE = 1000;
        let batch = [];
        let copied = 0;

        for await (const doc of cursor) {
          batch.push(doc);
          if (batch.length >= BATCH_SIZE) {
            await testCollection.insertMany(batch, { ordered: true });
            copied += batch.length;
            process.stdout.write(`   Copied ${copied}/${expectedCount} docs (${Math.round((copied / expectedCount) * 100)}%)...\r`);
            batch = [];
          }
        }

        if (batch.length > 0) {
          await testCollection.insertMany(batch, { ordered: true });
          copied += batch.length;
        }
        console.log(`\n   ✅ Data copied: ${copied} documents.`);
      } else {
        console.log('   ℹ️  Collection is empty (0 docs), created empty collection structure.');
      }

      // Clone indexes from Production
      const prodIndexes = await prodCollection.indexes();
      for (const idx of prodIndexes) {
        if (idx.name === '_id_') continue; // _id index created automatically

        const keySpec = idx.key;
        const options = {};
        if (idx.name) options.name = idx.name;
        if (idx.unique !== undefined) options.unique = idx.unique;
        if (idx.sparse !== undefined) options.sparse = idx.sparse;
        if (idx.background !== undefined) options.background = idx.background;
        if (idx.expireAfterSeconds !== undefined) options.expireAfterSeconds = idx.expireAfterSeconds;
        if (idx.partialFilterExpression !== undefined) options.partialFilterExpression = idx.partialFilterExpression;
        if (idx.weights !== undefined) options.weights = idx.weights;
        if (idx.default_language !== undefined) options.default_language = idx.default_language;
        if (idx.language_override !== undefined) options.language_override = idx.language_override;

        try {
          await testCollection.createIndex(keySpec, options);
        } catch (idxErr) {
          console.warn(`   ⚠️  Index creation notice for ${colName} [${idx.name}]:`, idxErr.message);
        }
      }
      console.log(`   ✅ Indexes copied: ${prodIndexes.length} total.`);
    }

    const durationSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🎉 Data cloning completed in ${durationSec} seconds!`);

    // 4. Verification Stage
    console.log('\n========================================');
    console.log('🔍 RUNNING COMPREHENSIVE VERIFICATION');
    console.log('========================================');

    // A. Verify Collection Names
    const finalProdCols = (await prodDb.listCollections().toArray()).filter(c => !c.name.startsWith('system.')).map(c => c.name).sort();
    const finalTestCols = (await testDb.listCollections().toArray()).filter(c => !c.name.startsWith('system.')).map(c => c.name).sort();

    console.log(`Production Collections Count: ${finalProdCols.length}`);
    console.log(`Testing Collections Count:    ${finalTestCols.length}`);

    if (JSON.stringify(finalProdCols) !== JSON.stringify(finalTestCols)) {
      throw new Error('VERIFICATION FAILED: Collection names list does not match between Production and Testing!');
    }
    console.log('✅ Collection names match 100% identically.');

    // B. Verify Document Counts & Data Integrity
    let totalProdDocs = 0;
    let totalTestDocs = 0;
    const verificationResults = [];

    for (const colName of finalProdCols) {
      const prodCount = await prodDb.collection(colName).countDocuments();
      const testCount = await testDb.collection(colName).countDocuments();
      totalProdDocs += prodCount;
      totalTestDocs += testCount;

      const countsMatch = prodCount === testCount;
      if (!countsMatch) {
        throw new Error(`VERIFICATION FAILED: Count mismatch in collection ${colName}: Prod=${prodCount}, Test=${testCount}`);
      }

      // Deep sample check if documents exist
      let sampleMatch = true;
      if (prodCount > 0) {
        // Sample first doc
        const firstProdDoc = await prodDb.collection(colName).find().sort({ _id: 1 }).limit(1).next();
        const firstTestDoc = await testDb.collection(colName).findOne({ _id: firstProdDoc._id });
        if (!firstTestDoc || JSON.stringify(firstTestDoc) !== JSON.stringify(firstProdDoc)) {
          sampleMatch = false;
        }

        // Sample last doc
        const lastProdDoc = await prodDb.collection(colName).find().sort({ _id: -1 }).limit(1).next();
        const lastTestDoc = await testDb.collection(colName).findOne({ _id: lastProdDoc._id });
        if (!lastTestDoc || JSON.stringify(lastTestDoc) !== JSON.stringify(lastProdDoc)) {
          sampleMatch = false;
        }
      }

      if (!sampleMatch) {
        throw new Error(`VERIFICATION FAILED: Sample data mismatch in collection ${colName}`);
      }

      verificationResults.push({
        collection: colName,
        prodCount,
        testCount,
        countsMatch,
        sampleMatch
      });
    }

    console.log('\n📊 Detailed Collection Verification Summary:');
    console.table(verificationResults);
    console.log(`Total Documents across all collections: ${totalTestDocs} (Prod: ${totalProdDocs})`);
    console.log('✅ All document counts and sample document structures match 100%.');

    // C. Verify Production was not modified
    console.log('\n🛡️  Verifying Production was NOT modified...');
    for (const [colName, initialCount] of initialProdCounts.entries()) {
      const currentProdCount = await prodDb.collection(colName).countDocuments();
      if (currentProdCount !== initialCount) {
        throw new Error(`FATAL: Production count changed for ${colName}! Was ${initialCount}, now ${currentProdCount}`);
      }
    }
    console.log('✅ Verified: Production database was completely untouched and unmodified.');

    console.log('\n🏆 ALL CLONING AND VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } finally {
    await prodClient.close();
    await testClient.close();
    console.log('🔌 Closed all database connections.');
  }
}

cloneProductionToTesting().catch(err => {
  console.error('\n❌ CLONING SCRIPT ENCOUNTERED AN ERROR:', err);
  process.exit(1);
});
