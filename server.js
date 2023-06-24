const express = require("express");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const db = require("./config/db.config.js");
const jwt = require("jsonwebtoken");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("express-flash");

dotenv.config();
const app = express();
const port = process.env.PORT;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    resave: true,
  })
);

app.use(flash());
app.use(express.static("./public"));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

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
  if (token) {
    const verified = jwt.verify(token, jwtSecretKey);
    req.userId = verified.userId;
    req.username = verified.username;
    req.isAdmin = verified.isAdmin;

    db.query(
      `SELECT * FROM users where userId=${db.escape(req.userId)};`,
      (error, result) => {
        if (result[0].isAdmin === verified.isAdmin) {
          if (verified && !result[0].isAdmin) {
            next();
          }
        } else {
          req.flash("message", "Invalid Authentication.");
          res.redirect("/login");
        }
      }
    );
  } else {
    req.flash("message", "Invalid Authentication.");
    res.redirect("/login");
  }
}

function authenticateAdmin(req, res, next) {
  const token = req.cookies.token;
  let tokenHeaderKey = process.env.TOKEN_HEADER_KEY;
  let jwtSecretKey = process.env.JWT_SECRET_KEY;
  if (token) {
    const verified = jwt.verify(token, jwtSecretKey);
    req.userId = verified.userId;
    req.username = verified.username;
    req.isAdmin = verified.isAdmin;

    db.query(
      `SELECT * FROM users where userId=${db.escape(req.userId)};`,
      (error, result) => {
        if (result[0].isAdmin === verified.isAdmin) {
          if (verified && result[0].isAdmin) {
            next();
          }
        } else {
          res.redirect("/login");
        }
      }
    );
  } else {
    req.flash("message", "Invalid Authentication.");
    res.redirect("/login");
  }
}

app.listen(port, (error) => {
  if (!error) console.log(`Server is listening on http://localhost:${port}`);
  else console.log("Error occurred, server can't start", error);
});

app.get("/", (req, res, next) => {
  res.render("pages/login", {
    message: req.flash("message"),
  });
});

app.get("/signUp", (req, res) => {
  res.render("pages/signUp", {
    message: req.flash("message"),
  });
});

app.get("/login", (req, res) => {
  res.render("pages/login", {
    message: req.flash("message"),
  });
});

app.get("/adminHome", authenticateAdmin, (req, res, next) => {
  var books = [];

  let client = "user";
  if (req.isAdmin) {
    client = "admin";
  }

  db.query(`SELECT * FROM books where bookId > 0 ;`, (err, result, field) => {
    books = result;
    res.render("pages/adminHome", {
      books: books,
      username: req.username,
      client: client,
      message: req.flash("message"),
    });
  });
});

app.get("/userHome", authenticateUser, (req, res, next) => {
  var books = [];
  let client = "user";
  if (req.isAdmin) {
    client = "admin";
  }
  db.query(`SELECT * FROM books  where bookId > 0 ;`, (err, result, field) => {
    books = result;
    res.render("pages/userHome", {
      books: books,
      username: req.username,
      client: client,
      message: req.flash("message"),
    });
  });
});

app.get("/adminRequests", authenticateAdmin, (req, res, next) => {
  var approveRequest = [];
  var issued = [];
  var returnRequest = [];
  var adminRequest = [];
  var userId = req.userId;
  console.log(userId);

  let client = "user";
  if (req.isAdmin) {
    client = "admin";
  }

  db.query(
    `SELECT * FROM requests where state= 'requested' ;`,
    (err, result, field) => {
      approveRequest = result;
      console.log(result);
      db.query(
        `SELECT * FROM requests where state= 'issued' ;`,
        (err, result, field) => {
          issued = result;
          db.query(
            `SELECT * FROM requests where state= 'checkedIn' ;`,
            (err, result, field) => {
              returnRequest = result;
              db.query(
                `SELECT * FROM requests where state= 'AdminRequest' ;`,
                (err, result, field) => {
                  adminRequest = result;
                  console.log(approveRequest);
                  console.log(issued);
                  console.log(returnRequest);
                  console.log(adminRequest);

                  res.render("pages/adminRequests", {
                    approveRequest: approveRequest,
                    issued: issued,
                    returnRequest: returnRequest,
                    username: req.username,
                    adminRequest: adminRequest,
                    client: client,
                    message: req.flash("message"),
                  });
                }
              );
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
  var adminRequest = [];
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
              db.query(
                `SELECT * FROM requests where state= 'AdminRequest' and userId=${userId};`,
                (err, result, field) => {
                  adminRequest = result;
                  res.render("pages/userRequests", {
                    approveRequest: approveRequest,
                    issued: issued,
                    returnRequest: returnRequest,
                    username: req.username,
                    adminRequest: adminRequest,
                    client: client,
                    message: req.flash("message"),
                  });
                }
              );
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
    req.flash("message", "Passwords don't match!");
    res.redirect("/signUp");
  } else {
    var pass = await hashPassword(password);

    db.query(
      "select * from users where userName = " + db.escape(username) + ";",
      (err, result) => {
        if (err) throw err;
        else {
          if (result[0] === undefined) {
            if (username && password && passwordC) {
              db.query(
                `INSERT INTO users (userName, salt, hash, isAdmin) VALUES(${db.escape(
                  username
                )},'${pass.salt}', '${pass.hash}', false);`
              );
              req.flash("message", "Successfully Registered.");
              res.redirect("/login");
            } else {
              req.flash("message", "Username or Password can't be empty.");
              res.redirect("/signUp");
            }
          } else {
            req.flash("message", "User Already Registered.");
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
        req.flash("message", "User not registered.");
        res.redirect("/login");
      } else if (username && password) {
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
          if (isAdmin) {
            req.flash("message", "Admin Logged in.");
          }
          if (!isAdmin) {
            req.flash("message", "User Logged in.");
          }

          res
            .cookie("token", token, {
              secure: true,
              httpOnly: true,
              sameSite: "strict",
            })
            .redirect(redirect);
        } else {
          req.flash("message", "Wrong Password");
          res.redirect("/login");
        }
      } else {
        req.flash("message", "Username or Password can't be empty.");
        res.redirect("/login");
      }
    }
  );
});

app.post("/logout", (req, res) => {
  req.flash("message", "Logged out successfully.");

  res
    .cookie("token", "", {
      secure: true,
      httpOnly: true,
      sameSite: "strict",
    })
    .redirect("/login");
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
            req.flash("message", "Records Updated.");
            res.redirect("/adminHome");
          }
        } else {
          db.query(`INSERT INTO books(title, totalQuantity, available) 
            VALUES (${db.escape(title)}, ${db.escape(quantity)}, ${db.escape(
            quantity
          )} );`);

          if (!err) {
            req.flash("message", "New Book Added.");
            res.redirect("/adminHome");
          }
        }
      }
    );
  } else {
    // feedback for invalid quantity
    req.flash("message", "Invalid Quantity.");

    res.redirect("/adminHome");
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
          let bookId = result[0].bookId;

          if (
            quantity <= result[0].available &&
            newAvailable >= 0 &&
            newTotalQuantity > 0
          ) {
            db.query(`UPDATE books 
                SET totalQuantity = ${db.escape(newTotalQuantity)},
                available = ${db.escape(newAvailable)}
                WHERE title= ${db.escape(title)};`);
            req.flash("message", "Records Updated.");
            res.redirect("/adminHome");
          } else if (
            newAvailable == newTotalQuantity &&
            newTotalQuantity == 0
          ) {
            db.query(
              `SELECT * FROM requests where bookId=${bookId}`,
              (err, result) => {
                if (result[0] == undefined) {
                  db.query(`DELETE from books 
                  WHERE title= ${db.escape(title)};`);
                  req.flash("message", "Book deleted.");
                  res.redirect("/adminHome");
                } else {
                  req.flash(
                    "message",
                    "Book can't be deleted as there are pending requests."
                  );
                  res.redirect("/adminHome");
                }
              }
            );
          } else {
            req.flash("message", "Invalid Quantity.");
            res.redirect("/adminHome");
          }
        } else {
          if (!err) {
            req.flash("message", "Book doesn't Exist.");
            res.redirect("/adminHome");
          }
        }
      }
    );
  } else {
    // feedback for invalid quantity
    req.flash("message", "Invalid Quantity.");
    res.redirect("/adminHome");
  }
});

app.post("/requestBook", authenticateUser, (req, res, next) => {
  let bookId = req.body.bookId;
  let userId = req.userId;

  db.query(
    `SELECT * FROM books WHERE bookId= ${db.escape(bookId)}`,
    (error, result) => {
      if (error) throw error;
      else if (result.length === 0) {
        req.flash("message", "Book doesn't Exist.");
        res.redirect("/userHome");
      } else if (result[0].available === 0) {
        req.flash("message", "Book Out of Stock.");
        res.redirect("/userHome");
      } else {
        db.query(
          `SELECT * FROM requests 
        WHERE bookId= ${db.escape(bookId)} AND userId= ${db.escape(userId)};`,
          (error, result) => {
            if (error) throw error;
            else if (result.length > 0) {
              req.flash("message", "Already Requested.");
              res.redirect("/userHome");
            } else {
              db.query(
                `INSERT INTO requests (bookId, userId) 
                VALUES (${db.escape(bookId)}, ${db.escape(userId)})`,
                (error, result) => {
                  if (error) throw error;
                  else {
                    req.flash("message", "Book Successfully Requested.");
                    res.redirect("/userHome");
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
      else if (result.length === 0) {
        req.flash("message", "Book doesn't exist.");
        res.redirect("/userRequests");
      } else {
        db.query(
          `SELECT * FROM requests 
        WHERE bookId= ${db.escape(bookId)} AND userId= ${db.escape(
            userId
          )} AND state = 'issued';`,
          (error, result) => {
            if (error) throw error;
            else if (result.length === 0) {
              req.flash("message", "Book not issued.");
              res.redirect("/userRequests");
            } else {
              db.query(
                `UPDATE requests SET state = 'checkedIn' WHERE bookId= ${db.escape(
                  bookId
                )} AND userId= ${db.escape(userId)} AND state = 'issued';`,
                (error, result) => {
                  if (error) throw error;
                  else {
                    req.flash("message", "Book returned Successfully.");
                    res.redirect("/userRequests");
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
      else if (result.length === 0) {
        req.flash("message", "Invalid Request.");
        res.redirect("/adminRequests");
      } else {
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
                    req.flash("message", "Book Issued Successfully.");
                    res.redirect("/adminRequests");
                  }
                }
              );
            } else {
              req.flash("message", "Book unavailable.");
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
      else if (result.length === 0) {
        req.flash("message", "Invalid Request.");
        res.redirect("/adminRequests");
      } else {
        db.query(
          `DELETE FROM requests WHERE requestId= ${db.escape(
            requestId
          )} AND state = 'requested';`,
          (error, result) => {
            if (error || !result) throw error;
            else {
              req.flash("message", "Issue Request Rejected.");
              res.redirect("/adminRequests");
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
      else if (result.length === 0) {
        req.flash("message", "Invalid Request.");
        res.redirect("/adminRequests");
      } else {
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
              req.flash("message", "Return Request Approved.");
              res.redirect("/adminRequests");
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
      else if (result.length === 0) {
        req.flash("message", "Invalid Request.");
        res.redirect("/adminRequests");
      } else {
        db.query(
          `UPDATE requests SET state = 'issued' WHERE requestId= ${db.escape(
            requestId
          )} AND state = 'checkedIn';`,
          (error, result) => {
            if (error || !result) throw error;
            else {
              req.flash("message", "Return Request Rejected.");
              res.redirect("/adminRequests");
            }
          }
        );
      }
    }
  );
});

app.post("/requestAdmin", authenticateUser, (req, res) => {
  var bookId = req.body.bookId;
  var userId = req.userId;

  if (bookId == -1) {
    db.query(
      `SELECT * FROM requests 
      WHERE bookId= ${db.escape(bookId)} AND userId= ${db.escape(userId)};`,
      (error, result) => {
        if (error) throw error;
        else if (result.length > 0) {
          req.flash("message", "Already Requested.");
          res.redirect("/userHome");
        } else {
          db.query(
            `INSERT INTO requests (bookId, userId, state) 
              VALUES (${db.escape(bookId)}, ${db.escape(
              userId
            )}, 'AdminRequest')`,
            (error, result) => {
              if (error) throw error;
              else {
                req.flash("message", "Admin Request Successful.");
                res.redirect("/userHome");
              }
            }
          );
        }
      }
    );
  } else {
    //handle invalid request
    req.flash("message", "Invalid Request.");
    res.redirect("/userHome");
  }
});

app.post("/approveAdmin", authenticateAdmin, async (req, res, next) => {
  var requestId = req.body.requestId;
  var userId = req.body.userId;

  db.query(
    `SELECT * FROM requests WHERE requestId = ${db.escape(
      requestId
    )} AND state = 'AdminRequest';`,
    (error, result) => {
      if (error) throw error;
      else if (result.length === 0) {
        //handle invalid request
        req.flash("message", "Invalid Request.");
        res.redirect("/adminRequests");
      } else {
        var bookId = result[0].bookId;
        if (bookId === -1) {
          db.query(
            `DELETE FROM requests WHERE requestId= ${db.escape(
              requestId
            )} AND state = 'AdminRequest';`,
            (error, result) => {
              if (error || !result) throw error;
              else {
                db.query(
                  `UPDATE users SET isAdmin = 1 WHERE userId = ${userId}`
                );
                req.flash("message", "Admin Request Approved.");
                res.redirect("/adminRequests");
              }
            }
          );
        } else {
          //handle invalid request
          req.flash("message", "Invalid Request.");
          res.redirect("/adminRequests");
        }
      }
    }
  );
});

app.post("/rejectAdmin", authenticateAdmin, async (req, res, next) => {
  var requestId = req.body.requestId;
  var userId = req.userId;

  db.query(
    `SELECT * FROM requests WHERE requestId = ${db.escape(
      requestId
    )} AND state = 'AdminRequest';`,
    (error, result) => {
      if (error) throw error;
      else if (result.length === 0) {
        //handle invalid request
        req.flash("message", "Invalid Request.");
        res.redirect("/adminRequests");
      } else {
        var bookId = result[0].bookId;
        if (bookId === -1) {
          db.query(
            `DELETE FROM requests WHERE requestId= ${db.escape(
              requestId
            )} AND state = 'AdminRequest';`,
            (error, result) => {
              if (error || !result) throw error;
              else {
                req.flash("message", "Admin Request Rejected.");
                res.redirect("/adminRequests");
              }
            }
          );
        } else {
          //handle invalid request
          req.flash("message", "Invalid Request.");
          res.redirect("/adminRequests");
        }
      }
    }
  );
});
