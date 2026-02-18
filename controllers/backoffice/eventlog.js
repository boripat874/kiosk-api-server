const {db} = require("../../db/postgresql");
const fs = require("fs");
const date = require("date-and-time");
const { uuid } = require("uuidv4");
// const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken"); // ใช้สําหรับสร้างและตรวจสอบ JWT
// const { console } = require("inspector");

const {
    upload,
    checkString,
    handleError,
    validateApiKey,
    deleteUploadedFile,
    checkAuthorizetion
} = require("../../modules/fun");
const { default: id } = require("date-and-time/locale/id");

require("dotenv").config();

const timeout = 60000; // Timeout in milliseconds (e.g., 60 seconds)

// eventlog list all
exports.eventloglistAll = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const eventloglistAllLogic = new Promise(async (resolve, reject) => {

        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const search = req.query.search || '';
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            const eventloglistall = await db("eventloginfo") // 1. Start query on 'registerinfo' table
                .select({
                    id: "eventloginfo.id",
                    userid: "eventloginfo.userid",
                    create_at: "eventloginfo.create_at",
                    name: "userinfo.name",
                    username: "userinfo.username",
                    level: "userinfo.level",
                    ipaddress: "eventloginfo.ipaddress",
                    remark: "eventloginfo.remark"
                }) // 2. Select all columns from both tables
                .join("userinfo", "eventloginfo.userid", "userinfo.userid") // 3. Join with 'registergroupinfo'
                .where(function () {
                    this.where("userinfo.name", "like", `%${search}%`)
                        .orWhere("userinfo.username", "like", `%${search}%`)
                        .orWhere("userinfo.level", "like", `%${search}%`)
                        .orWhere("userinfo.remark", "like", `%${search}%`)
                        .orWhere("eventloginfo.ipaddress", "like", `%${search}%`)
                })
                // .limit(limit)
                .offset(offset)
                .orderBy("eventloginfo.create_at", "desc")

            const resulteventloh = eventloglistall.map((eventlog) => {

                return {
                    id: eventlog.id,
                    userid: eventlog.userid,
                    create_at: date.format(new Date(eventlog.create_at*1000), "YYYY-MM-DD HH:mm:ss"),
                    name: eventlog.name,
                    username: eventlog.username,
                    level: eventlog.level,
                    ipaddress: eventlog.ipaddress,
                    remark: eventlog.remark
                }
            });

            resolve({
                total: resulteventloh.length,
                result: resulteventloh
            });
            
        }
        catch (error) {
            reject(error);
        }
    });

    Promise.race([eventloglistAllLogic, timeoutPromise])
        .then((result) => {

            res.status(200).json(result);
        })
        .catch((error) => {

            if (error.status) {
                res.status(error.status).json({ message: error.message });
            } else if (error.message === "Request timed out") {
                res.status(402).json({ message: "Request timed out" });
            } else {
                handleError(error, res);
            }

        });
}