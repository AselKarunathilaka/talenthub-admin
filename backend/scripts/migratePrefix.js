const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  for (const col of ['staff', 'security_alerts', 'users']) {
    const cursor = await db.collection(col).find({});
    for await (const doc of cursor) {
      let updates = {};
      for (const key in doc) {
        if (typeof doc[key] === 'string' && doc[key].startsWith('ENC:')) {
          updates[key] = doc[key].replace('ENC:', 'enc:');
        }
      }
      if (Object.keys(updates).length > 0) {
        await db.collection(col).updateOne({ _id: doc._id }, { $set: updates });
      }
    }
  }
  console.log('Done migrating ENC: to enc:');
  process.exit(0);
});
