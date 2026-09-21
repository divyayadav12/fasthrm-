const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://fasthrm.onrender.com/api/auth/login', {
      email: 'divyayadav141203@gmail.com', // wait, is this the admin? I'll use the user from the screenshot: "admin"
      password: 'password', // I don't know the password.
    });
  } catch(err) {
    console.error(err.response?.data || err.message);
  }
}
test();
