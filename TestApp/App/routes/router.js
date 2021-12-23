const express = require('express');

const mainController = require('../controllers/mainController');
const {
    LinkedAccount
} = require("../model/LinkedAccount");
const getDiscordUserFromUserCacheOrSet = async(req) => {
    const redisClient = req.app.get("redisClient");
    const user = req.session?.discord?.accessToken;
    if (!user) return null;
    const cachedUser = await redisClient.getAsync(user)
    if (cachedUser) return JSON.parse(cachedUser);
    var fetchedUser = await oauth.getUser(user).catch(() => null);
    const tokenExpirationDate = req.session?.discord?.expires || 0;
    let diff = new Date().getTime() - tokenExpirationDate;
    if (!fetchedUser && diff < 0) return null;
    else if (!fetchedUser && diff > 0) {
        const tokenRequest = await oauth.tokenRequest({
            refreshToken: req.session?.discord?.refreshToken,
            grantType: "refresh_token",
            scope: ["identify"],
        });
        if (!tokenRequest) return null;
        req.session.discord = {
            accessToken: tokenRequest.access_token,
            refreshToken: tokenRequest.refresh_token,
            expires: new Date(new Date().getTime() + tokenRequest.expires_in * 1000)
        }
        fetchedUser = await oauth.getUser(user);
    }
    await redisClient.setAsync(user, JSON.stringify(fetchedUser), 'EX', 300);
    console.log(`${fetchedUser.username}#${fetchedUser.discriminator} (${fetchedUser.id}) is now in our evil cache >:)`)
    return fetchedUser;
}
module.exports = (authProvider, db) => {
    // initialize router
    const router = express.Router();
    // app routes
    router.get(['/', '/index.html', '/index.php', '/homepage'], (req, res, next) => res.redirect('/home'));
    router.get('/home', mainController.getHomePage);
    router.get('/link', async(req, res, next) => {
        await mainController.getLinkPage(req, res, next, db)
    });
    router.post('/api/discord-link', async(req, res) => {
        const isDeleting = req.body.delete == true ? true :  false 
        const platform = req.body?.platform?.toLowerCase();
        const uuid = platform == "bedrock" ? req.session.xboxUser?.uuid : req.session.javaUser?.uuid
        if (!isDeleting) {
            if (!platform) return res.status(400).json({success: false, message: "No platform variable specified in request body."});
            if (platform !== "bedrock" && platform !== "java") return res.status(400).json({success: false, message: "Invalid platform, valid platforms are: bedrock or java"});
            if (!uuid) return res.status(400).json({success: false, message: "No UUID is attached to your account."});
        }
        const discordUser = await getDiscordUserFromUserCacheOrSet(req);
        const discord = discordUser?.id;
        const linkedAccountRepo = db.getRepository(LinkedAccount);
        if (isDeleting) {
            const result = await linkedAccountRepo.delete({discord: discord})
            return res.status(200).json({
                success: true, 
                result
            })
        }
        var linkedAccount = await linkedAccountRepo.findOne({discord: discord})
        const newUser = {
            discord: discord,
            uuid: uuid
        }
        if (!linkedAccount) {
            linkedAccount = await linkedAccountRepo.create(newUser);
        }
        else {
            linkedAccountRepo.merge(linkedAccount, newUser)
        }
        const result = await linkedAccountRepo.save(linkedAccount);
        return res.status(200).json({
            success: true, 
            result
        })

    });
    // authentication routes
    router.get('/signin', authProvider.signIn);
    router.get('/signout', authProvider.signOut);
    router.get('/redirect', authProvider.handleRedirect);
    router.get('/callback', authProvider.handleDiscordCallback);
    router.get('/discord', authProvider.redirectToDiscord);

    // secure routes
    router.get('/profile', authProvider.isAuthenticated, mainController.getProfilePage); // get token for this route to call web API
    router.get('/xbox', authProvider.isAuthenticated, mainController.getXboxPage) // get token for this route to call web API
    router.get('/java', authProvider.isAuthenticated, mainController.getJavaPage) // get token for this route to call web API

    return router;
};