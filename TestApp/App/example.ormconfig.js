const fs = require("fs");

// This application is meant for MySQL setups for DiscordSRV.
// It can't use DiscordSRV's inconsistent local storage system (JSON).

// Want to use SSL to connect to your database? Okay!
// Add this past the cli object and add a comma after the bracket.
// "ssl": {
//   "ca": fs.readFileSync("/path/to/your/keys/ca-cert.pem"),
//   "cert": fs.readFileSync("/path/to/your/keys/client-cert.pem"),
//   "key": fs.readFileSync("/path/to/your/keys/client-key.pem")
// }

// Confused? View https://typeorm.io/#/connection-options/mysql--mariadb-connection-options
module.exports = {
    "type": "mysql",
    "host": "127.0.0.1",
    "port": 3306,
    "username": "username",
    "password": "password",
    "database": "discordsrv",
    "synchronize": false,
    "logging": process.env.NODE_ENV == 'development' ? true : false,
    "entities": [
      "entity/*.js"
    ],
    "subscribers": [
      "subscriber/*.js"
    ],
    "migrations": [
      "migration/*.js"
    ]
  }
  