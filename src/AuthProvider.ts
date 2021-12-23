import {
    Request,
    Response,
    NextFunction
} from "express";
import axios from 'axios';

import { ConfigurationUtils } from './ConfigurationUtils';
import { xbl } from '@xboxreplay/xboxlive-auth';
const Uuid = require('uuid-tool').Uuid;
const uuid = require('uuid').uuidv4;
const bytesToUuid = (byte) => new Uuid(byte);
// Modified from https://coolaj86.com/articles/convert-js-bigints-to-typedarrays/
function bnToBuf(bn, length) {
let hex = BigInt(bn).toString(16);
if (hex.length % 2) { hex = '0' + hex; }

let len = hex.length / 2;
let array = [];

let i = 0;
let j = 0;
while (i < len) {
array.push(parseInt(hex.slice(j, j+2), 16));
i += 1;
j += 2;
}

while (array.length < length) {
array.unshift(0);
}

return array;
}

function decimalToUUID(number) {
uuid({random: bnToBuf(number, 16)})
}
import {
    AppSettings,
    Resource,
    AuthCodeParams,
    User
} from './Types';

import { ErrorMessages } from './Constants';
import Discordo from "discord-oauth2";
import crypto from 'crypto';
/**
 * Offers a collection of middleware and utility methods that automate 
 * basic authentication and authorization tasks in Express MVC web apps. 
 * 
 * You must have express and express-sessions packages installed. Middleware here 
 * can be used with express sessions in route controllers.
 * 
 * Some Session variables accessible are as follows:
    * req.session.isAuthenticated: boolean
    * req.session.xboxUser: Object
    * req.session.discord.accessToken: string
 */
export class AuthProvider {

    appSettings: AppSettings;
    oauth: Discordo;

    constructor(appSettings: AppSettings) {
        ConfigurationUtils.validateAppSettings(appSettings);

        this.appSettings = appSettings;
        const oauth = new Discordo(appSettings.discord);
        this.oauth = oauth;
    }
    saveSession = async (request) => {
        //...
        // save session before redirecting
        return new Promise((resolve, reject) => {
          request.session.save((err) => {      
            if (err) {
              reject(err);
            }
            resolve(true);
          })
        });
    };
    // ========== MIDDLEWARE ===========

    /**
     * Initiate sign in flow
     * @param {Request} req: express request object
     * @param {Response} res: express response object
     * @param {NextFunction} next: express next 
     */
    signIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!req.session.discord) return await this.redirectToDiscord(req, res, next);
        if (!req.session.xboxUser && !req.session.javaUser) return await this.redirectToXboxLive(req, res, next);
        res.status(200).redirect('/');
    };

    /**
     * Initiate sign out and clean the session
     * @param {Request} req: express request object
     * @param {Response} res: express response object
     * @param {NextFunction} next: express next 
     */
    signOut = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        /**
         * Construct a logout URI and redirect the user to end the 
         * session with Azure AD/B2C. For more information, visit: 
         * (AAD) https://docs.microsoft.com/azure/active-directory/develop/v2-protocols-oidc#send-a-sign-out-request
         * (B2C) https://docs.microsoft.com/azure/active-directory-b2c/openid-connect#send-a-sign-out-request
         */
        const logoutURI = `https://login.microsoftonline.com/consumers/oauth2/v2.0/logout?post_logout_redirect_uri=${this.appSettings.settings.postLogoutRedirectUri}`;

        req.session.isAuthenticated = false;

        req.session.destroy(() => {
            res.redirect(logoutURI);
        });
    }
    redirectToDiscord = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
            req.session.state = crypto.randomBytes(16).toString("hex"); // Be aware that randomBytes is sync if no callback is provided
            const URL = this.oauth.generateAuthUrl({
                scope: ["identify"],
                state: req.session.state,
                prompt: "none"
            })
            await this.saveSession(req).catch((err) => {
                return res.status(500).json({success: false, message: err.message || err.toString()})
            });
            return res.status(200).send(`
            <html>
            <head>
            <!-- A meta tag that redirects after 1 second to the sign in page -->
                <meta http-equiv="refresh" content="0;url=${URL}">
            </head>
            <body>
            <h1>Redirecting to Discord..</h1>
            </body>
            </html>
            `);
    }
    redirectToXboxLive = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        req.session.state = crypto.randomBytes(16).toString("hex"); // Be aware that randomBytes is sync if no callback is provided
        const URL = `https://login.live.com/oauth20_authorize.srf?client_id=${this.appSettings.credentials.clientId}&response_type=code&redirect_uri=${this.appSettings.settings.redirectUri}&scope=XboxLive.signin%20offline_access&state=${req.session.state}`
        await this.saveSession(req).catch((err) => {
            return res.status(500).json({success: false, message: err.message || err.toString()})
        });
        return res.status(200).send(`
        <html>
        <head>
        <!-- A meta tag that redirects after 1 second to the sign in page -->
            <meta http-equiv="refresh" content="0;url=${URL}">
        </head>
        <body>
        <h1>Redirecting to Xbox Live..</h1>
        </body>
        </html>
        `);
    }
    handleDiscordCallback = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        const code = req.query.code?.toString();
        if (!code) return res.status(400).json({success: false, message: "No access code specified in query params!"});
        if (!req.session.state) return res.status(400).json({success: false, message: "Security error | No state set"});
        if (req.session.state !== req.query.state) return res.status(400).json({success: false, message: "Security error | request session state doesn't match request query state!"});
        const tokenRequest = await this.oauth.tokenRequest({
            code: code,
            grantType: "authorization_code",
            scope: ["identify"],
        }).catch(() => null);
        if (!tokenRequest) return res.status(500).json({success: false, message: "Something happended during processing of your code, that's all we know!"});
        const user: User = await this.oauth.getUser(tokenRequest.access_token).catch(() => null);
        if (!user) return res.status(500).json({success: false, message: "Something happended during processing of your Discord user, that's all we know!"});
        req.session.discord = {
            accessToken: tokenRequest.access_token,
            refreshToken: tokenRequest.refresh_token,
            expires: new Date(new Date().getTime() + tokenRequest.expires_in * 1000)
        }
        delete req.session.state
        await this.saveSession(req).catch((err) => {
            return res.status(500).json({success: false, message: err.message || err.toString()})
        });
        return res.status(200).send(`
        <html>
        <head>
        <!-- A meta tag that redirects after 1 second to the sign in page -->
            <meta http-equiv="refresh" content="0;url=/signin">
        </head>
        <body>
        <h1>Processing request</h1>
        </body>
        </html>
        `);

    }
    /**
     * Middleware that handles redirect depending on request state
     * There are basically 2 stages: sign-in and acquire token
     * @param {Request} req: express request object
     * @param {Response} res: express response object
     * @param {NextFunction} next: express next 
     */
    handleRedirect = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        if (!req.session.state) return res.status(400).json({success: false, message: "Security error | No state set"});
        if (req.session.state !== req.query.state) return res.status(400).json({success: false, message: "Security error | request session state doesn't match request query state!"});
        if (!req.query.code) return res.status(400).json({success: false, message: "No code from Microsoft"})
        const code = req.query.code.toString();
        delete req.session.state;
        const paramsString = "";
        const queryParams = new URLSearchParams();
        queryParams.set("client_id", encodeURIComponent(this.appSettings.credentials.clientId))
        queryParams.set("client_secret", encodeURIComponent(this.appSettings.credentials.clientSecret))
        queryParams.set("code", encodeURIComponent(code));
        queryParams.set("grant_type", "authorization_code")
        queryParams.set("redirect_uri", this.appSettings.settings.redirectUri)
        const rawClientData2 = await axios({
            method: "POST",
            url: "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
            headers: {
                "Content-Type": 'application/x-www-form-urlencoded'
            },
            data: queryParams.toString(),
            maxRedirects: 10
        })
        .catch((e) => {
            console.error(e);
            return res.status(500).json({success: false, message: e.response?.data?.error_description || e.message})
        });
        // @ts-ignore
        if (!rawClientData2 || !rawClientData2?.data) return res.status(500).json({success: false, message: "Got no response or error? IDK"})
        // @ts-ignore
        const clientData = rawClientData2.data; 
        // @ts-ignore
        const {refresh_token: refreshToken, access_token: accessToken} = clientData;
        const xboxDataBs =  {
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": `d=${accessToken}` // your access token from step 2 here
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
         }
        const rawAuthWithXBLData = await axios({
            method: "POST",
            url: "https://user.auth.xboxlive.com/user/authenticate",
            data: xboxDataBs
        })
        .catch((error) => {
            console.error(error);
        });
        // @ts-ignore
        const authWithXBLData = rawAuthWithXBLData.data;
        const {Token: token} = authWithXBLData;
        var bedrockUser;
        try {
            const bedrockData = await xbl.exchangeTokenForXSTSToken(token, {
                optionalDisplayClaims: [
                "mgt", "umg"
            ],
        });
            bedrockUser = {
                gamertag: bedrockData.DisplayClaims.xui[0].umg,
                xuid: bedrockData.DisplayClaims.xui[0].xid,
                accountAge: bedrockData.DisplayClaims.xui[0].agg,
                uuid: bytesToUuid(bnToBuf(bedrockData.DisplayClaims.xui[0].xid, 16)).toString()
            }
        }
        catch(e) {
            console.error(`Error occured getting user's bedrock account.`, e)
        }
        const uhs = authWithXBLData.DisplayClaims.xui[0].uhs; // confusing bs
        const confusingXboxData =  {
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [
                    token
                ]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
         }
        const rawXSTSData = await axios({
            method: "POST",
            url: "https://xsts.auth.xboxlive.com/xsts/authorize",
            data: confusingXboxData,
            validateStatus: (status) => true
        }).catch((e) => {
            console.error(e);
            return res.status(500).json({success: false, message: e.response?.data?.error_description || e.message})
        })
        if (!rawXSTSData) return res.status(500).json({success: false, message: "Something bad happended, didnt get the request back in time!!1"})
        // @ts-ignore
        const XSTSData = rawXSTSData.data;
        if (rawXSTSData.status == 401) {
            if (XSTSData.XErr == 2148916233) {
                return res.status(400).json({success: false, message: "The account doesn't have an Xbox account. Once they sign up for one (or login through minecraft.net to create one) then they can proceed with the login. This shouldn't happen with accounts that have purchased Minecraft with a Microsoft account, as they would've already gone through that Xbox signup process."}) // i am that lazy
            }
            else if (XSTSData.XErr == 2148916235) {
                return res.status(400).json({success: false, message: "2148916235"})
            }
            else if (XSTSData.XErr == 2148916238) {
                return res.status(400).json({success:false, message: "The account is a child (under 18) and cannot proceed unless the account is added to a Family by an adult."})
            }
            return res.status(400).json({success: false, message: "Unknown error message, sorry can't help!"})
        }
        const xstsToken = XSTSData.Token;
        const theKeyToEverything = `XBL3.0 x=${uhs};${xstsToken}`
        const goodOlMcData =  {
            "identityToken": theKeyToEverything
         }
        const rawMcData = await axios({
            method: "POST",
            url: "https://api.minecraftservices.com/authentication/login_with_xbox",
            data: goodOlMcData
        })
        .catch((e) => {
            console.error(e);
            return res.status(500).json({success: false, message: e.response?.data?.error_description || e.message})
        })
        // @ts-ignore
        const mcData = rawMcData.data;
        const {access_token: minecraftAccessToken} = mcData;
        const rawEntitlementData = await axios.get("https://api.minecraftservices.com/entitlements/mcstore", {
            headers: {
                "Authorization": `Bearer ${minecraftAccessToken}`
            }
        })
        .catch((e) => {
            console.error(e);
            return res.status(500).json({success: false, message: e.response?.data?.error_description || e.message})
        })
        var javaUser;
        // @ts-ignore
        const entitlementData = rawEntitlementData.data;
        if (!entitlementData.items[0] && !bedrockUser) return res.status(400).json({success: false, message: "You probably don't own Minecraft, POOR BOOZOZO LOLOLO"});
        if (entitlementData.items[0]) {
            // if they own java
            const rawProfile = await axios.get("https://api.minecraftservices.com/minecraft/profile", {
                headers: {
                    "Authorization": `Bearer ${minecraftAccessToken}`
                }
            })
            .catch((e) => {
                console.error(e);
                return res.status(500).json({success: false, message: e.response?.data?.errorMessage || e.message})
            })
            // @ts-ignore
            const profile = rawProfile.data;
            const dashedUUID = i=>i.substr(0,8)+"-"+i.substr(8,4)+"-"+i.substr(12,4)+"-"+i.substr(16,4)+"-"+i.substr(20);
            const uuid = dashedUUID(profile.id);
            profile.uuid = uuid;
            javaUser = profile;
        }
        req.session.xboxUser = bedrockUser;
        req.session.javaUser = javaUser;
        req.session.isAuthenticated = true;
        return res.status(200).send(`
        <html>
        <head>
        <!-- A meta tag that redirects after 1 second to the homepage -->
            <meta http-equiv="refresh" content="0;url=/home">
        </head>
        <body>
        <h1>Processing request</h1>
        </body>
        </html>
        `);
    };

    /**
     * Middleware that gets tokens and calls web APIs
     * @param {Request} req: express request object
     * @param {Response} res: express response object
     * @param {NextFunction} next: express next 
     */
    getToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    }

    // ============== GUARD ===============

    /**
     * Check if authenticated in session
     * @param {Request} req: express request object
     * @param {Response} res: express response object
     * @param {NextFunction} next: express next 
     */
    isAuthenticated = (req: Request, res: Response, next: NextFunction): Response | void => {
        if (req.session) {
            if (req.path == '/xbox' && req.session.xboxUser) {
                return next();
            }
            if (req.path == '/java' && req.session.javaUser) {
                return next();
            }
            if (req.path == '/profile' && req.session.discordUser) {
                return next();
            }
            if (req.path == '/api/discord-link' && req.session.discordUser) {
                if (req.session.xboxUser || req.session.javaUser) {
                    return next();
                }
            }
            if (!req.session.isAuthenticated) {
                return res.status(401).send(ErrorMessages.NOT_PERMITTED);
            }
            next();
        } else {
            res.status(401).send(ErrorMessages.NOT_PERMITTED);
        }
    }
}






