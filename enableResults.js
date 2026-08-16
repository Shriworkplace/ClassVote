const mongoose = require('mongoose');
const Settings = require('./backend/models/Settings');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();
    settings.resultsPublished = true;
    await settings.save();
    console.log('Results published successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
