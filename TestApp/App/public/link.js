/// <reference path="jquery.js" />
// Shorthand for $( document ).ready()
$(async function() {
    if (expressSession && expressSession.xboxUser && !expressSession.xboxUser.settings) {
        const rawXblData = await fetch(`https://playerdb.co/api/player/xbox/${expressSession.xboxUser.xuid}`, {timeout: 5000}).catch(() => null);
        if (!rawXblData) return console.error("XBOX LIVE REQUEST FAILED! CRITICAL MELT DOWN!");
        else {
            const xblData = await rawXblData.json();
            if (!xblData) throw "No data"
            const settings = xblData.data.player;
            if (!settings) return console.error("No settings from the xbl api?? WTF MAN", xblData)
            expressSession.xboxUser.settings = settings;
            const gamertag = expressSession.xboxUser.gamertag;
            $(`h5:contains('${gamertag}')`).html(`${gamertag} (${settings.meta.gamerscore} Gamerscore)`)
        }   
    }
});

async function link(platform, button) {
    console.log("Button clicked.", platform)
    const properButton = $(button);
    const buttonHTML = properButton.html().toLowerCase();
    const buttonID = properButton.attr('id')
    const otherButtonID = buttonID == 'javaButton' ? 'bedrockButton' : 'javaButton';
    const otherButton = $(`#${otherButtonID}`);
    if (buttonHTML == 'link') {
        const res = await fetch("/api/discord-link", {
            method: "POST",
            mode: 'same-origin', // no-cors, *cors, same-origin
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: "include",
            body: JSON.stringify({
                platform: platform
            }) // body data type must match "Content-Type" header
        }).catch(() => null);
        if (!res) { 
            properButton.html("ERRORED")
            throw "No response recieved"
        }
        if (!res.ok) {
            properButton.html("ERRORED")
            throw "The response wasn't okay. there's a problem"
        }
        properButton.html("LINKED");
        otherButton.html("LINK");
    }
    else {
        const res = await fetch("/api/discord-link", {
            method: "POST",
            mode: 'same-origin', // no-cors, *cors, same-origin
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: "include",
            body: JSON.stringify({
                delete: true
            })
        }).catch(() => null);
        if (!res) { 
            properButton.html("ERRORED")
            throw "No response recieved"
        }
        if (!res.ok) {
            properButton.html("ERRORED")
            console.error(res);
            throw "The response wasn't okay. there's a problem";
        }
        properButton.html("LINK");
    }
}