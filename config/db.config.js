const mysql = require('mysql');
const dotenv = require("dotenv");
dotenv.config();

const dbConn = mysql.createConnection({
    host     : process.env.DBHOST,
    user     : process.env.DBUSER,
    password : process.env.DBPASSWORD ,
    database : process.env.DATABASE
});

dbConn.connect(function(err) {
  if(err) throw err;
  console.log('hey db is connected!');
});

module.exports = dbConn;