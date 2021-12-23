const {EntitySchema} = require("typeorm"); // import {EntitySchema} from "typeorm";
const {LinkedAccount} = require("../model/LinkedAccount"); // import {LinkedAccount} from "../model/LinkedAccount";

module.exports = new EntitySchema({
    tableName: "discordsrv_accounts",
    target: LinkedAccount,
    columns: {
        link: {
            primary: true,
            type: "int",
            generated: true // auto_increment
        },
        discord: {
            type: "varchar",
            length: 32
        },
        uuid: {
            type: "varchar",
            length: 36
        },
    }
});