
import {
    TokenClaims
} from "@azure/msal-common";

import {
    AccountInfo,
    AuthorizationUrlRequest,
    AuthorizationCodeRequest,
} from "@azure/msal-node";
export interface User {
    id: string;
    username: string;
    discriminator: string;
    tag: string;
    avatar: string | null | undefined;
    mfa_enabled?: true;
    locale?: string;
    verified?: boolean;
    email?: string | null | undefined;
    flags?: number;
    premium_type?: number;
    public_flags?: number;
}

// extending express Request object
declare module "express-session" {
    interface SessionData {
        isAuthenticated?: boolean;
        state?: string;
        discord?: {
            accessToken: string,
            refreshToken: string,
            expires: Date 
        },
        discordUser?: User;
        xboxUser?: object; // Both of these objects are really unpredictable due to our code..
        javaUser?: object;  
    }
}

export type AuthCodeParams = {
    authority: string;
    scopes: string[];
    state: string;
    redirect: string;
    prompt?: string;
    account?: AccountInfo;
};

export type Resource = {
    callingPageRoute: string,
    endpoint: string,
    scopes: string[]
}

export type Credentials = {
    clientId: string,
    tenantId: string,
    clientSecret: string,
    cookieSecret: string
}

export type Settings = {
    homePageRoute: string,
    redirectUri: string,
    postLogoutRedirectUri: string,
    proxyMode: boolean
}

export type AppSettings = {
    credentials: Credentials,
    settings: Settings,
    discord: {
        "clientId": string,
        "clientSecret": string,
        "redirectUri": string,
    },
    policies: any,
    protected: any,
}

export type IdTokenClaims = TokenClaims & {
    aud?: string,
}