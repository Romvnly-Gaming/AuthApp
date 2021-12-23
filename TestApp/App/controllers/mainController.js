const appSettings = require('../../appSettings.json');
const Discordo = require("discord-oauth2");
const {
    LinkedAccount
} = require("../model/LinkedAccount");

const oauth = new Discordo(appSettings.discord);
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
    console.log(`${fetchedUser.username}#${fetchedUser.discriminator} (${fetchedUser.id}) is now in our evil user cache >:)`)
    return fetchedUser;
}
exports.getHomePage = async(req, res, next) => {
    const discordUser = await getDiscordUserFromUserCacheOrSet(req);
    res.render('home', { isAuthenticated: req.session.isAuthenticated === undefined ? false : req.session.isAuthenticated, discordUser: discordUser, session: req.session });
}
exports.getLinkPage = async(req, res, next, db) => {
    const discordUser = await getDiscordUserFromUserCacheOrSet(req) || {};
        if (req.session.discord) {
            const linkedAccountRepo = db.getRepository(LinkedAccount);
            const linkedAccount = await linkedAccountRepo.findOne({discord: discordUser.id}).catch(console.error);
            if (linkedAccount) {
                if (req.session.xboxUser?.uuid == linkedAccount.uuid) { 
                    req.session.xboxUser.isLinked = true; 
                    if (req.session.javaUser) req.session.javaUser.isLinked = false;
                }
                if (req.session.javaUser?.uuid == linkedAccount.uuid) {
                     req.session.javaUser.isLinked = true; 
                     if (req.session.xboxUser) req.session.xboxUser.isLinked = false;
                }
            }
        }
        res.render('link', {isAuthenticated: req.session.isAuthenticated, discordUser: discordUser, session: req.session});
}

exports.getProfilePage = async(req, res, next) => {
    const discordUser = await getDiscordUserFromUserCacheOrSet(req);

    try {
        res.render('profile', { isAuthenticated: req.session.isAuthenticated, profile: discordUser });       
    } catch (error) {
        console.log(error);
        next(error);
    }
}

exports.getXboxPage = async(req, res, next) => {
    try {
        res.render('xbox', { isAuthenticated: req.session.isAuthenticated, profile: req.session.xboxUser });
    } catch (error) {
        console.log(error);
        next(error);
    }
}
exports.getJavaPage = async(req, res, next) => {
    try {
        res.render('java', { isAuthenticated: req.session.isAuthenticated, profile: req.session.javaUser });
    } catch (error) {
        console.log(error);
        next(error);
    }
}