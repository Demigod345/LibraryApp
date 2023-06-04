const mysql = require('mysql');
const dotenv = require("dotenv");
dotenv.config();

const dbConn = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : process.env.MYSQL_PASSWORD ,
    database : 'backend_assign'
});

dbConn.connect(function(err) {
  if(err) throw err;
  console.log('hey db is connected!');
});

module.exports = dbConn;