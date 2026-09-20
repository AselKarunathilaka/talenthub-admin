const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const AutoCheckoutScheduler = require('../services/autoCheckoutScheduler');

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');
  await AutoCheckoutScheduler.runAutoCheckout();
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
