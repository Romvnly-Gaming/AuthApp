/*export */ class LinkedAccount {
    constructor(link, discord, uuid) {
        this.link = link;
        this.discord = discord;
        this.uuid = uuid;
    }
}

module.exports = {
    LinkedAccount: LinkedAccount
};