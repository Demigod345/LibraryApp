const express = require("express");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const db = require("./config/db.config.js");
const jwt = require("jsonwebtoken");
// db.connect();

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

async function hashPassword(password) {
  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds);
  const hash = await bcrypt.hash(password, salt);

  return {
    salt: salt,
    hash: hash,
  };
}

function isAdmin(req, res, next) {
  if (req.adminAuth === 1) {
    next();
  } else {
    res.status(403).send({ msg: "Not Authenticated" });
  }
}

function authenticateUser(req, res, next) {
  next();
}

function authenticateAdmin(req, res, next) {
  next();
}

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/", (req, res) => {
  message = req.body.message;
  console.log(message);
});

app.listen(port, (error) => {
  if (!error) console.log(`Server is listening on http://localhost:${port}`);
  else console.log("Error occurred, server can't start", error);
});

app.get("/signUp", (req, res) => {
  res.send("SignUp Page");
});

app.post("/signUp", async (req, res, next) => {
  console.log(req.body.password);
  let username = req.body.username;
  let password = req.body.password;
  let passwordC = req.body.passwordC;
  var pass = await hashPassword(password);
  console.log(pass);
  db.query(
    "select * from users where userName = " + db.escape(username) + ";",
    (err, result) => {
      if (err) throw err;
      else {
        if (result[0] === undefined) {
          if (username && password === passwordC) {
            db.query(
              `INSERT INTO users (userName, salt, hash, isAdmin) VALUES(${db.escape(
                username
              )},'${pass.salt}', '${pass.hash}', false);`
            );
            res.send("Success");
          } else if (password !== passwordC) {
            res.send("Passwords didn't match");
          } else {
            res.send("Password must not be empty");
          }
        } else {
          res.send("Username is not unique");
        }
      }
    }
  );
});

app.get("/login", (req, res) => {
  res.send("Login Page");
});

app.post("/login", async (req, res, next) => {
  let username = req.body.username;
  let password = req.body.password;
  // console.log(username);
  // console.log(password);

  db.query(
    `SELECT salt,hash,userId, isAdmin FROM users WHERE userName = ${db.escape(
      username
    )};`,
    async (err, result, field) => {
      if (err) throw err;
      else if (result.length == 0) {
        res.send("Username doesn't exist");
      } else {
        let hash = await bcrypt.hash(password, result[0].salt);
        if (hash === result[0].hash) {
          console.log(`${username} logged in!`);
          res.send("Successful Login Attempt");
          //implement cookies and check for admin and direct to respective pages
        } else console.log("Some error occured");
        res.send("UnSuccessful Login Attempt");
      }
    }
  );
});

app.post("/genToken", (req, res) => {
  let jwtSecretKey = process.env.JWT_SECRET_KEY || "superdupersecurekey";
  let data = {
    time: Date(),
    userId: 12,
  };

  const token = jwt.sign(data, jwtSecretKey);
  const obj = { jwtToken: token, helo: 12 };

  res.send(obj);
});

function verifyJWT(req, res, next) {
  let tokenHeaderKey = process.env.TOKEN_HEADER_KEY;
  let jwtSecretKey = process.env.JWT_SECRET_KEY;

  next();
}

app.get("/valToken", (req, res) => {
  // Tokens are generally passed in the header of the request
  // Due to security reasons.

  let tokenHeaderKey = process.env.TOKEN_HEADER_KEY;
  let jwtSecretKey = process.env.JWT_SECRET_KEY || "superdupersecurekey";

  try {
    const token = req.header(tokenHeaderKey);
    const verified = jwt.verify(token, jwtSecretKey);
    console.log(verified);

    if (verified) {
      return res.send("Successfully Verified!");
    } else {
      return res.status(401).send(error);
    }
  } catch (error) {
    return res.status(401).send(error);
  }
});

app.post("/newBook", authenticateAdmin, (req, res, next) => {
  let title = req.body.title;
  let quantity = parseInt(req.body.quantity);

  db.query(
    `SELECT * FROM books WHERE title= ${db.escape(title)};`,
    (err, result) => {
      if (err) throw err;

      if (result[0] !== undefined) {
        //update existing records
        let newTotalQuantity = quantity + result[0].totalQuantity;
        let newAvailable = quantity + result[0].available;
        db.query(`UPDATE books 
            SET totalQuantity = ${db.escape(newTotalQuantity)},
            available = ${db.escape(newAvailable)}
            WHERE title= ${db.escape(title)};`);

        if (!err) {
          res.send("RECORDS UPDATED");
        }
      } else {
        db.query(`INSERT INTO books(title, totalQuantity, available) 
            VALUES (${db.escape(title)}, ${db.escape(quantity)}, ${db.escape(
          quantity
        )} );`);

        if (!err) {
          res.send("NEW BOOK ADDED");
        }
      }
    }
  );
});

app.post("/removeBook", authenticateAdmin, (req, res, next) => {
  let title = req.body.title;
  let quantity = parseInt(req.body.quantity);

  db.query(
    `SELECT * FROM books WHERE title= ${db.escape(title)};`,
    (err, result) => {
      if (err) throw err;

      if (result[0] !== undefined) {
        // //update existing records
        let newTotalQuantity = result[0].totalQuantity - quantity;
        let newAvailable = result[0].available - quantity;

        if (
          quantity <= result[0].available &&
          newAvailable >= 0 &&
          newTotalQuantity > 0
        ) {
          db.query(`UPDATE books 
                SET totalQuantity = ${db.escape(newTotalQuantity)},
                available = ${db.escape(newAvailable)}
                WHERE title= ${db.escape(title)};`);
          return res.send("BOOKS REMOVED!!");
        } else if (newAvailable == newTotalQuantity && newTotalQuantity == 0) {
          db.query(`DELETE from books 
                WHERE title= ${db.escape(title)};`);
          return res.send("BOOK DELETED!!");
        } else {
          return res.send("INVALID QUANTITY!!");
        }
      } else {
        if (!err) {
          return res.send("BOOK DOESN'T EXIST");
        }
      }
    }
  );
});

app.post("/requestBook", authenticateUser, (req, res, next) => {
  let bookId = req.body.bookId;
  let userId = req.body.userId;

  db.query(
    `SELECT * FROM books WHERE bookId= ${db.escape(bookId)}`,
    (error, result) => {
      if (error) throw error;
      else if (result.length === 0) return res.send("INVALID BOOK-ID!!");
      else if (result[0].available === 0) return res.send("OUT OF STOCK!!");
      else {
        db.query(
          `SELECT * FROM requests 
        WHERE bookId= ${db.escape(bookId)} AND userId= ${db.escape(userId)};`,
          (error, result) => {
            if (error) throw error;
            else if (result.length > 0) return res.send("ALREADY REQUESTED!!");
            else {
              db.query(
                `INSERT INTO requests (bookId, userId) 
                VALUES (${db.escape(bookId)}, ${db.escape(userId)})`,
                (error, result) => {
                  if (error) throw error;
                  else {
                    // db.query(`UPDATE books SET available = available -1 WHERE bookId = ${bookId}`);
                    return res.send("SUCCESSFUL ISSUE REQUEST!!");
                  }
                }
              );
            }
          }
        );
      }
    }
  );
});

app.post("/returnBook", authenticateUser, async (req, res, next) => {
  let bookId = req.body.bookId;
  let userId = req.body.userId;

  db.query(
    `SELECT * FROM books WHERE bookId= ${db.escape(bookId)}`,
    (error, result) => {
      if (error) throw error;
      else if (result.length === 0) return res.send("INVALID BOOK-ID!!");
      else {
        db.query(
          `SELECT * FROM requests 
        WHERE bookId= ${db.escape(bookId)} AND userId= ${db.escape(
            userId
          )} AND state = 'issued';`,
          (error, result) => {
            if (error) throw error;
            else if (result.length === 0) return res.send("BOOK NOT ISSUED!!");
            else {
              db.query(
                `UPDATE requests SET state = 'checkedIn' WHERE bookId= ${db.escape(
                  bookId
                )} AND userId= ${db.escape(userId)} AND state = 'issued';`,
                (error, result) => {
                  if (error) throw error;
                  else {
                    return res.send("SUCCESSFUL RETURN REQUEST!!");
                  }
                }
              );
            }
          }
        );
      }
    }
  );
});

app.post("/appoveRequest", authenticateAdmin, async (req, res, next) => {
  let requestId = parseInt(req.body.requestId);

  db.query(
    `SELECT * FROM requests WHERE requestId = ${db.escape(
      requestId
    )} AND state = 'requested';`,
    (error, result) => {
      if (error) throw error;
      else if (result.length === 0) return res.send("INVALID REQUEST!!");
      else {
        var bookId = result[0].bookId;

        db.query(
          `UPDATE requests SET state = 'issued' WHERE requestId= ${db.escape(
            requestId
          )} AND state = 'requested';`,
          (error, result) => {
            if (error || !result) throw error;
            else {
              db.query(
                `UPDATE books SET available = available -1 WHERE bookId = ${bookId}`
              );
              return res.send("ISSUE REQUEST APPROVED BY ADMIN!!");
            }
          }
        );
      }
    }
  );
});

app.post("/rejectRequest", authenticateAdmin, async (req, res, next) => {
  let requestId = parseInt(req.body.requestId);

  db.query(
    `SELECT * FROM requests WHERE requestId = ${db.escape(
      requestId
    )} AND state = 'requested';`,
    (error, result) => {
      if (error) throw error;
      else if (result.length === 0) return res.send("INVALID REQUEST!!");
      else {
        // var bookId= result[0].bookId;

        db.query(
          `DELETE FROM requests WHERE requestId= ${db.escape(
            requestId
          )} AND state = 'requested';`,
          (error, result) => {
            if (error || !result) throw error;
            else {
              // db.query(`UPDATE books SET available = available -1 WHERE bookId = ${bookId}`);
              return res.send("ISSUE REQUEST REJECTED BY ADMIN!!");
            }
          }
        );
      }
    }
  );
});

app.post("/appoveReturn", authenticateAdmin, async (req, res, next) => {
  let requestId = parseInt(req.body.requestId);

  db.query(
    `SELECT * FROM requests WHERE requestId = ${db.escape(
      requestId
    )} AND state = 'checkedIn';`,
    (error, result) => {
      if (error) throw error;
      else if (result.length === 0) return res.send("INVALID REQUEST!!");
      else {
        var bookId = result[0].bookId;

        db.query(
          `DELETE FROM requests WHERE requestId= ${db.escape(
            requestId
          )} AND state = 'checkedIn';`,
          (error, result) => {
            if (error || !result) throw error;
            else {
              db.query(
                `UPDATE books SET available = available + 1 WHERE bookId = ${bookId}`
              );
              return res.send("RETURN REQUEST APPROVED BY ADMIN!!");
            }
          }
        );
      }
    }
  );
});

app.post("/rejectReturn", authenticateAdmin, async (req, res, next) => {
  let requestId = parseInt(req.body.requestId);

  db.query(
    `SELECT * FROM requests WHERE requestId = ${db.escape(
      requestId
    )} AND state = 'checkedIn';`,
    (error, result) => {
      if (error) throw error;
      else if (result.length === 0) return res.send("INVALID REQUEST!!");
      else {
        db.query(
          `UPDATE requests SET state = 'issued' WHERE requestId= ${db.escape(
            requestId
          )} AND state = 'checkedIn';`,
          (error, result) => {
            if (error || !result) throw error;
            else {
              return res.send("RETURN REQUEST REJECTED BY ADMIN!!");
            }
          }
        );
      }
    }
  );
});
