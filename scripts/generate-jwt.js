const jwt = require('jsonwebtoken');

const secret = 'YOUR_SUPABASE_JWT_SECRET'; // Replace with your actual secret
const payload = {
  role: 'service_role',
  exp: Math.floor(Date.now() / 1000) + (60 * 60), // expires in 1 hour
};

const token = jwt.sign(payload, secret);
console.log(token);
