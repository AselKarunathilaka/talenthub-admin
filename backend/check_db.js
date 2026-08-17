const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/TalentHub').then(async () => {
  const db = mongoose.connection.db;
  const collection = db.collection('inactiveinterns');
  const docs = await collection.find({ attendance: { $exists: true, $not: {$size: 0} } }).limit(2).toArray();
  console.log(JSON.stringify(docs, null, 2));
  process.exit(0);
});
