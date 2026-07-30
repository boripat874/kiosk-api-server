const {db} = require("../../db/postgresql");
const date = require("date-and-time");
const { uuid } = require("uuidv4");
// const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken"); // ใช้สําหรับสร้างและตรวจสอบ JWT
// const { console } = require("inspector");
const axios = require('axios');
const fs = require("fs");
const https = require('https');
const xml2js = require('xml2js');
const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
const os = require('os');

const {
    upload,
    checkString,
    handleError,
    validateApiKey,
    deleteUploadedFile,
    eventlog,
    checkAuthorizetion,
    createUniqueIdUesr,
    createUniqueIdPassword
} = require("../../modules/fun");

require("dotenv").config();

const timeout = 60000; // Timeout in milliseconds (e.g., 60 seconds)

// Users add ✅
exports.kioskSettings = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );
    
    const usersaddLogic = new Promise(async (resolve, reject) => {

        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const {
                kioskid,
                terminalid,
                duration,
                details
            } = req.body;

            // await db("registergroupinfo").update({
            //     ugroupid: uuid(),
            //     groupname,
            //     remark: remark || "-",
            //     duration: totalSeconds,
            // });


            return resolve({
                status: 200,
                message: "Seting successful"
            })

        }

        catch (error) {

            return reject(error);
        }
    });

    Promise.race([usersaddLogic, timeoutPromise])
    .then(async(result) => {

        await eventlog(req,"มีการตั้งค่าเครื่อง kiosk wifi ใหม่"); // เก็บ eventlog

        return res.status(200).json(result);
    })
    .catch((error) => {
        
        if (error.status) {
            return res.status(error.status).json({ message: error.message });
        } else if (error.message === "Request timed out") {
            return res.status(402).json({ message: "Request timed out" });
        } else {
            return handleError(error, res);
        }

    });
}
