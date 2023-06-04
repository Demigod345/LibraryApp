DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `books`;
DROP TABLE IF EXISTS `requests`;


CREATE TABLE `users` (
  `userId` int(12) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userName` varchar(255) NOT NULL,
  `salt` varchar(255) NOT NULL,
  `hash` varchar(255) NOT NULL,
  `isAdmin` BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB;

CREATE TABLE `books` (
  `bookId` int(12) AUTO_INCREMENT NOT NULL,
  `title` varchar(255) NOT NULL UNIQUE,
  `totalQuantity` int(11)  DEFAULT 1,
  `available` int(11)  DEFAULT 1 CONSTRAINT non_negative_constraint CHECK (available >= 0),
  PRIMARY KEY (`bookId`)
  )ENGINE=InnoDB;

ALTER TABLE books
ADD CONSTRAINT checkQuantity CHECK (available <= totalQuantity);

CREATE TABLE `requests` (
  `requestId` int(12) AUTO_INCREMENT PRIMARY KEY,
  `bookId` int(12),
  `userId` int(12),
  `state` ENUM('requested','issued','checkedIn') DEFAULT 'requested',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (bookId) REFERENCES books(bookId),
  FOREIGN KEY (userId) REFERENCES users(userId)
)ENGINE=InnoDB;