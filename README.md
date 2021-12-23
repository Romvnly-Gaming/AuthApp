# Overview

This project is a Node.js & Express web application that authenticates users against [Azure Active Directory](https://docs.microsoft.com/azure/active-directory/fundamentals/active-directory-whatis) (Azure AD) and obtains [Access Tokens](https://docs.microsoft.com/azure/active-directory/develop/access-tokens) to call the [Xbox Live API](https://docs.microsoft.com/en-us/gaming/xbox-live/api-ref/xbox-live-rest/atoc-xboxlivews-reference) and the [Mojang API](https://mojang-api-docs.netlify.app/), with the help of [Microsoft Authentication Library for Node.js](https://aka.ms/msalnode) (MSAL Node). It uses Redis for caching sessions and tokens.

Discord's [oAuth2 system](https://discord.com/developers/docs/topics/oauth2) is used just for accessing Discord profile information, which is used for saving who you are in DiscordSRV's MySQL database.

## Scenario
1. The client application uses the **MSAL Node** to sign-in a user redirects them to the Discord oAuth2 page
1. User gets redirected to Microsoft authorization page to obtain an JWT **Access Token** from **Microsoft**.
1. The **Access Token** is used as a *bearer* token to authorize the server to access the **Xbox Live API**.
1. The **Xbox Access Token** is used as a *bearer* token to authorize the server  to access **Mojang's API**
1. The server responds with the data that the server has access to.

## Contents

| File/folder                         | Description                                                   |
|-------------------------------------|---------------------------------------------------------------|
| `App/app.js`                        | Application entry point.                                      |
| `App/appSettings.json`              | Application settings and authentication parameters.           |
| `App/routes/router.js`              | Application routes are defined here.                          |
| `App/controllers/mainController.js` | Main application controllers.                                 |

## Prerequisites

- [Node.js](https://nodejs.org/en/download/) must be installed to run this project.
- [Visual Studio Code](https://code.visualstudio.com/download) is recommended for running and editing this project.
- [Redis](https://redis.io/) for caching persist sessions.
- [MariaDB/MySQL](https://www.digitalocean.com/community/tutorials/how-to-install-mariadb-on-ubuntu-20-04) for accessing DiscordSRV's database.
- [Minecraft Server](https://purpurmc.org/) running [DiscordSRV](https://docs.discordsrv.com/) with MariaDB/MySQL as the database for linking.
- [PM2](https://pm2.keymetrics.io/docs/usage/quick-start/) if you want to run this web application clustered.
- An **Azure AD** tenant. For more information, see: [How to get an Azure AD tenant](https://docs.microsoft.com/azure/active-directory/develop/quickstart-create-new-tenant)
- A user account in your **Azure AD** tenant.

## Setup

Locate the root of the project folder (i.e. `AuthApp`). Then:

```console
    npm install
    cd TestApp
    vim example.appSettings.json
    mv example.appSettings.json appSettings.json
    cd App
    vim example.ormconfig.js
    vim example.redisconfig.js
    mv example.ormconfig.js ormconfig.js
    mv example.redisconfig.js redisconfig.js
```

## Registration

### Register Discord oAuth2 application
1.  [Open your Discord applications](https://discord.com/developers/applications/), create or select an application, and head over to the "OAuth2" page.
1. Take note of the `client id` and `client secret` fields. Copy these values into your appSettings.json file; you'll need them later. Next, add a redirect URL to http://localhost:4545/callback

### Register the web app

1. Navigate to the [Azure portal](https://portal.azure.com) and select the **Azure AD** service.
1. Select the **App Registrations** blade on the left, then select **New registration**.
1. In the **Register an application page** that appears, enter your application's registration information:
   - In the **Name** section, enter a meaningful application name that will be displayed to users of the app, for example `AuthApp`.
   - Under **Supported account types**, select **Personal Microsoft account users**.
   - In the **Redirect URI (optional)** section, select **Web** in the combo-box and enter the following redirect URI: `http://localhost:4545/redirect`.
1. Select **Register** to create the application.
1. In the app's registration screen, find and note the **Application (client) ID**. You use this value in your app's configuration file(s) later in your code.
1. Select **Save** to save your changes.
1. In the app's registration screen, select the **Certificates & secrets** blade in the left to open the page where we can generate secrets and upload certificates.
1. In the **Client secrets** section, select **New client secret**:
   - Type a key description (for instance `app secret`),
   - Select one of the available key durations (**In 1 year**, **In 2 years**, or **Never Expires**) as per your security posture.
   - The generated key value will be displayed when you select the **Add** button. Copy the generated value for use in the steps later.
   - You'll need this key later in your code's configuration files. This key value will not be displayed again, and is not retrievable by any other means, so make sure to note it from the Azure portal before navigating to any other screen or blade.
1. In the app's registration screen, select the **Authentication** blade in the left to open the page where we add access to the APIs that your application needs.
   - Scroll down to the **Advanced settings** section.
   - Ensure that the **Live SDK support** button set as Yes.
### Configure the web app to use your app registration

Open the project in your IDE (like Visual Studio or Visual Studio Code) to configure the code.

> In the steps below, "ClientID" is the same as "Application ID" or "AppId".

1. Open the `./App/appSettings.json` file.
1. Find the key `clientId` and replace the existing value with the **application ID** (clientId) of the `AuthApp` application copied from the Azure Portal.
1. Find the key `tenantId` and replace the existing value with your Azure AD **tenant ID**.
1. Find the key `clientSecret` and replace the existing value with the key you saved during the creation of the `AuthApp` app, in the Azure Portal.
1. Find the key `homePageRoute` and replace the existing value with the route that you wish to be redirected after sign-in, e.g. `/home`.
1. Find the key `redirectUri` and replace the existing value with the **Redirect URI** for `AuthApp` app. For example, `http://localhost:4545/redirect`.
1. Find the `postLogoutRedirectUri` and replace the existing value with the URI that you wish to be redirected after sign-out, e.g. `http://localhost:4545/`
1. Find example.ormconfig.js and change the data to your liking and rename the file name to ormconfig.js
1. Find example.redisconfig.js and change the data to your setup for Redis and rename the file name to redisconfig.js

## Running the project

Make sure that Redis server is currently running. Start the Redis server if needed. You will need [WSL](https://docs.microsoft.com/windows/wsl/install-win10) if on Windows:

```console
    redis-server
```

> : information_source: On Windows, you may use [WSL](https://docs.microsoft.com/windows/wsl/install-win10) to run above

Locate the root of the project folder (i.e. `TestApp`). Then:

```console
    npm start
```

## Explore the webpage

1. Open your browser and navigate to `http://localhost:4545`.
1. Click the **Sign-in** button on the top right corner.
1. Once you sign-in, click on the **See my Xbox profile** button to call **Xbox Live**.
1. Once you sign-in, click on the **See my Java account** button to call **Mojang's API**.
1. Once you sign-in, click on the **See my Discord account** button to call **Discord's API**
