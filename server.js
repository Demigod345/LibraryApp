const express = require("express");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const db = require("./config/db.config.js");
const jwt = require("jsonwebtoken");
const path = require("path");
const cookieParser = require("cookie-parser");

dotenv.config();
const app = express();
const port = process.env.PORT;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static("./public"));

async function hashPassword(password) {
  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds);
  const hash = await bcrypt.hash(password, salt);

  return {
    salt: salt,
    hash: hash,
  };
}

function authenticateUser(req, res, next) {
  const token = req.cookies.token;
  let tokenHeaderKey = process.env.TOKEN_HEADER_KEY;
  let jwtSecretKey = process.env.JWT_SECRET_KEY;
  const verified = jwt.verify(token, jwtSecretKey);
  req.userId = verified.userId;
  req.username = verified.username;
  req.isAdmin = verified.isAdmin;

  if (verified && !verified.isAdmin) {
    next();
  } else {
    res.redirect("/login");
  }
}

function authenticateAdmin(req, res, next) {
  const token = req.cookies.token;
  let tokenHeaderKey = process.env.TOKEN_HEADER_KEY;
  let jwtSecretKey = process.env.JWT_SECRET_KEY;
  const verified = jwt.verify(token, jwtSecretKey);
  req.userId = verified.userId;
  req.username = verified.username;
  req.isAdmin = verified.isAdmin;

  if (verified && verified.isAdmin) {
    next();
  } else {
    res.redirect("/login");
  }
}

app.listen(port, (error) => {
  if (!error) console.log(`Server is listening on http://localhost:${port}`);
  else console.log("Error occurred, server can't start", error);
});

app.get("/", (req, res, next) => {
  res.render("pages/login");
});

app.get("/signUp", (req, res) => {
  res.render("pages/signUp");
});

app.get("/login", (req, res) => {
  res.render("pages/login");
});

app.get("/adminHome", authenticateAdmin, (req, res, next) => {
  var books = [];

  let client = "user";
  if (req.isAdmin) {
    client = "admin";
  }

  db.query(`SELECT * FROM books  ;`, (err, result, field) => {
    books = result;
    res.render("pages/adminHome", {
      books: books,
      username: req.username,
      client: client,
    });
  });
});

app.get("/userHome", authenticateUser, (req, res, next) => {
  var books = [];
  let client = "user";
  if (req.isAdmin) {
    client = "admin";
  }
  db.query(`SELECT * FROM books  ;`, (err, result, field) => {
    books = result;
    res.render("pages/userHome", {
      books: books,
      username: req.username,
      client: client,
    });
  });
});

app.get("/adminRequests", authenticateAdmin, (req, res, next) => {
  var approveRequest = [];
  var issued = [];
  var returnRequest = [];

  let client = "user";
  if (req.isAdmin) {
    client = "admin";
  }

  db.query(
    `SELECT * FROM requests where state= 'requested';`,
    (err, result, field) => {
      approveRequest = result;
      db.query(
        `SELECT * FROM requests where state= 'issued';`,
        (err, result, field) => {
          issued = result;
          db.query(
            `SELECT * FROM requests where state= 'checkedIn';`,
            (err, result, field) => {
              returnRequest = result;
              res.render("pages/adminRequests", {
                approveRequest: approveRequest,
                issued: issued,
                returnRequest: returnRequest,
                username: req.username,
                client: client,
              });
            }
          );
        }
      );
    }
  );
});

app.get("/userRequests", authenticateUser, (req, res, next) => {
  var approveRequest = [];
  var issued = [];
  var returnRequest = [];
  var userId = req.userId;

  let client = "user";
  if (req.isAdmin) {
    client = "admin";
  }

  db.query(
    `SELECT * FROM requests where state= 'requested' and userId=${userId};`,
    (err, result, field) => {
      approveRequest = result;
      db.query(
        `SELECT * FROM requests where state= 'issued' and userId=${userId};`,
        (err, result, field) => {
          issued = result;
          db.query(
            `SELECT * FROM requests where state= 'checkedIn' and userId=${userId};`,
            (err, result, field) => {
              returnRequest = result;
              res.render("pages/userRequests", {
                approveRequest: approveRequest,
                issued: issued,
                returnRequest: returnRequest,
                username: req.username,
                client: client,
              });
            }
          );
        }
      );
    }
  );
});

app.post("/", (req, res) => {
  message = req.body.message;
});

app.post("/signUp", async (req, res, next) => {
  let username = req.body.username;
  let password = req.body.password;
  let passwordC = req.body.passwordC;

  if (password !== passwordC) {
    res.json({ hey: 12 });
    res.redirect("/signUp");
  } else {
    var pass = await hashPassword(password);

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
              res.redirect("/login");
            } else if (password !== passwordC) {
              res.redirect("/signUp");
            } else {
              res.redirect("/signUp");
            }
          } else {
            res.redirect("/signUp");
          }
        }
      }
    );
  }
});

app.post("/login", async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;

  db.query(
    `SELECT salt,hash,userId, isAdmin FROM users WHERE userName = ${db.escape(
      username
    )};`,
    async (err, result, field) => {
      if (err) throw err;
      else if (result.length == 0) {

        res.redirect("/login");
      } else {
        let userId = result[0].userId;
        let hash = await bcrypt.hash(password, result[0].salt);
        let isAdmin = result[0].isAdmin;
        let redirect = "/userHome";

        if (isAdmin) {
          redirect = "/adminHome";
        }
        if (hash === result[0].hash) {
          let jwtSecretKey = process.env.JWT_SECRET_KEY;
          let data = {
            time: Date(),
            userId: userId,
            username: username,
            isAdmin: isAdmin,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
          };

          const token = jwt.sign(data, jwtSecretKey);

          res
            .cookie("token", token, {
              secure: true,
              httpOnly: true,
              sameSite: "strict",
            })
            .redirect(redirect);
        } else {
          res.redirect("/login");
        }
      }
    }
  );
});

app.post("/newBook", authenticateAdmin, (req, res, next) => {
  let title = req.body.title;
  let quantity = parseInt(req.body.quantity);

  if (quantity > 0) {
    db.query(
      `SELECT * FROM books WHERE title= ${db.escape(title)};`,
      (err, result) => {
        if (err) throw err;

        if (result[0] !== undefined) {

          let newTotalQuantity = quantity + result[0].totalQuantity;
          let newAvailable = quantity + result[0].available;
          db.query(`UPDATE books 
            SET totalQuantity = ${db.escape(newTotalQuantity)},
            available = ${db.escape(newAvailable)}
            WHERE title= ${db.escape(title)};`);

          if (!err) {

            res.redirect("/adminHome");
          }
        } else {
          db.query(`INSERT INTO books(title, totalQuantity, available) 
            VALUES (${db.escape(title)}, ${db.escape(quantity)}, ${db.escape(
            quantity
          )} );`);

          if (!err) {
            res.redirect("/adminHome");

          }
        }
      }
    );
  }
});

app.post("/removeBook", authenticateAdmin, (req, res, next) => {
  let title = req.body.title;
  let quantity = parseInt(req.body.quantity);

  if (quantity > 0) {
    db.query(
      `SELECT * FROM books WHERE title= ${db.escape(title)};`,
      (err, result) => {
        if (err) throw err;

        if (result[0] !== undefined) {
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
            return res.redirect("/adminHome");
          } else if (
            newAvailable == newTotalQuantity &&
            newTotalQuantity == 0
          ) {
            db.query(`DELETE from books 
                WHERE title= ${db.escape(title)};`);
            return res.redirect("/adminHome");
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
  }

});

app.post("/requestBook", authenticateUser, (req, res, next) => {
  let bookId = req.body.bookId;
  let userId = req.userId;

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
                    return res.redirect("/userHome");
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
  let userId = req.userId;

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
                    return res.redirect("/userRequests");
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

app.post("/approveRequest", authenticateAdmin, async (req, res, next) => {
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
          `SELECT * from books where bookId=${bookId};`,
          (error, result) => {
            var available = result[0].available;

            if (available > 0) {
              db.query(
                `UPDATE books SET available = available -1 WHERE bookId = ${bookId};`,
                (error, result) => {
                  if (error || !result) {
                    throw error;
                  } else {
                    db.query(
                      `UPDATE requests SET state = 'issued' WHERE requestId= ${db.escape(
                        requestId
                      )} AND state = 'requested';`
                    );
                    return res.redirect("/adminRequests");
                  }
                }
              );
            } else {
              db.query(
                `DELETE FROM requests WHERE requestId= ${db.escape(
                  requestId
                )} AND state = 'requested';`
              );
              res.redirect("/adminRequests");
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
        db.query(
          `DELETE FROM requests WHERE requestId= ${db.escape(
            requestId
          )} AND state = 'requested';`,
          (error, result) => {
            if (error || !result) throw error;
            else {
              return res.redirect("/adminRequests");
            }
          }
        );
      }
    }
  );
});

app.post("/approveReturn", authenticateAdmin, async (req, res, next) => {
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
              return res.redirect("/adminRequests");
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
              return res.redirect("/adminRequests");
            }
          }
        );
      }
    }
  );
});
