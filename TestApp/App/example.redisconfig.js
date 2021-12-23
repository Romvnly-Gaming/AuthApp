const fs = require('fs');

// For TLS usage, view https://docs.redis.com/latest/rs/references/client_references/client_nodejs/#tls
module.exports = {
    "host": "127.0.0.1",
    "port": 6379,
    "username": "",
    "password": "",
    "url": "",
    // tls: {
    //     key: fs.readFileSync('path_to_keyfile', encoding='ascii'),
    //     cert: fs.readFileSync('path_to_certfile', encoding='ascii'),
    //     ca: [ fs.readFileSync('path_to_ca_certfile', encoding='ascii') ]
    // }
}