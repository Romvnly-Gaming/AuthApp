/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const path = require('path');
const redis = require('redis');
const typeorm = require("typeorm"); // import * as typeorm from "typeorm";
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis')(session); // persist session in redis
const msalWrapper = require('msal-express-wrapper/dist/AuthProvider');
const appSettings = require('../appSettings.json');
const router = require('./routes/router');
const eta = require("eta");
const util = require('util');
const redisConfig = require('./redisconfig');

redisConfig.legacyMode = true;

const strippedRedisConfig = {
    host: redisConfig.host,
    port: redisConfig.port,
    legacyMode: redisConfig.legacyMode
}
if (redisConfig.url) strippedRedisConfig.url = redisConfig.url;
const env = process.env.NODE_ENV || 'development';

eta.configure({
    useWith: true
})
const SERVER_PORT = process.env.PORT || 4545;
(async () => {
console.log(`${env == 'production' ? '' : "Do not use development mode in production! It's not as secure."}`)
/**
* Instantiate the redis client, which is used in our project for caching
*/
const redisClient = redis.createClient(strippedRedisConfig);
if (redisConfig.username) {
// Disable client's AUTH command.
redisClient['auth'] = null;

// send_command expects a command name and array of parameters.
redisClient.sendCommand('AUTH', [redisConfig.username, redisConfig.password]);
}
redisClient.getAsync = util.promisify(redisClient.get);
redisClient.setAsync = util.promisify(redisClient.set);
await redisClient.connect();
await typeorm.createConnection(require('./ormconfig'));
const db = typeorm.getConnection();
redisClient.on('error', (err) => {
// Handle errors immediately. Errors on sockets, or errors between server and
//  client, propagate back to the top of the stack. If not handled, the process
//  will exit. Failure to handle errors properly will also leave DB connections
//  open (memory leaks, unresponsiveness).
throw err;
});
redisClient.on("ready", () => {
    console.log('✅ 💃 Redis is ready !')
}) 
redisClient.on("connect", () => {
    console.log('Connected to redis');
})

const app = express();
// trust proxy
// I don't want to be responsible for idiots that don't have a firewall so localhost only unless they change the the proxy thingy to whatever they want
app.set('trust proxy', appSettings.settings.proxyMode ? appSettings.settings.proxyMode == true ? '127.0.0.1' : appSettings.settings.proxyMode : 0); 
  
app.set('views', path.join(__dirname, './views'));

app.engine("eta", eta.renderFile)
app.set("redisClient", redisClient);
app.set("view engine", "eta")
app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// We should be letting Nginx handle this, it's known to be better for serving static files.
app.use(express.static(path.join(__dirname, './public'), {extensions: ["html", "json"]}));
/**
 * Using express-session middleware. Be sure to familiarize yourself with available options
 * and set the desired options. Visit: https://www.npmjs.com/package/express-session
 */
app.use(session({
    store: new RedisStore({ client: redisClient, ttl: 86400, logErrors:true, prefix: `${env}-`, secret: env + appSettings.credentials.cookieSecret }),
    secret: appSettings.credentials.cookieSecret, 
    resave: true, 
    saveUninitialized: false,
    cookie: {
        secure: env == "production" ? true : false, // setting this to true when deploying
        maxAge: 6.048e+8, // a week, probably
        httpOnly: true,
        sameSite: 'lax'
    }
}));
if (env == 'development' || process.env.LOG_ANYWAY) {
    app.use((req, res, next) => {
        console.log(req.ip, req.session)
        next()
    })    
}
const authProvider = new msalWrapper.AuthProvider(appSettings);


app.use(router(authProvider, db));

// 404
app.all('*', (req, res) => res.send('Page Not Found'));
const server = app.listen(SERVER_PORT, () => console.log(`AuthApp app listening on port ${SERVER_PORT}!`));

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);


function shutDown() {
    console.log('Received kill signal, shutting down gracefully');
    server.close(async() => {
        console.log('Closed out remaining connections');
        await redisClient.disconnect();
        await db.close();
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}
})();