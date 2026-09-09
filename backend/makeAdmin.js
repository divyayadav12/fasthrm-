const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://divyanshyadav10270_db_user:j14BaPbi0ot7eAOo@cluster0.yz9opfv.mongodb.net/workpulse?retryWrites=true&w=majority')
  .then(() => mongoose.connection.db.collection('users').updateOne({email: 'fast@gmail.com'}, {$set: {role: 'ADMIN'}}))
  .then(res => console.log('Update result:', res))
  .catch(err => console.error('Error:', err))
  .finally(() => process.exit());
