const mongoose = require('mongoose');

const uri = 'mongodb+srv://divyanshyadav10270_db_user:j14BaPbi0ot7eAOo@cluster0.yz9opfv.mongodb.net/workpulse?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  const users = await db.collection('users').find({}).toArray();
  console.log('Users:');
  users.forEach(u => console.log(u.name, '->', u.officeEndTime, u.department));
  
  // also fix Mahima
  await db.collection('users').updateOne(
    { email: 'fastmahima2024@gmail.com' },
    { $set: { department: 'IT and support' } }
  );
  console.log('Mahima updated to IT and support');
  
  mongoose.disconnect();
}
run();
