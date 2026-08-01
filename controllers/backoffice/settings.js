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

// get Setting ✅
exports.listkioskSettings = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const ListkioskSettingsLogic = new Promise(async (resolve, reject) => {

        try {

             // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const kioskpropertylistall = await db("kioskproperty")
                .select("*")
                .where("status", "=", "active")
                .orderBy("create_at", "asc")

            const resultkioskproperty = kioskpropertylistall.map((e)=>{

                const seconds = e.duration;

                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);

                // Format to two digits with leading zero if needed
                const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

                e.duration = timeString;

                return {...e}
            })

            resolve({
                total: resultkioskproperty.length,
                result: resultkioskproperty
            });
            
        } catch (error) {
            
            reject(error);
        }
    })

    Promise.race([ListkioskSettingsLogic, timeoutPromise])
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

// Setting update ✅
exports.kioskSettings = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );
    
    const settingLogic = new Promise(async (resolve, reject) => {

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

            if (!kioskid) {
                return reject({ status: 402, message: "kioskid not required" });
            }

            if (!terminalid) {
                return reject({ status: 402, message: "terminalid not required" });
            }

            if (!duration === undefined || isNaN(Date.parse(`2000-01-01 ${duration}`))) {
                return reject({
                status: 402,
                message: "duration not required or duration format Invalid",
                });
            }

            const updateData = {};

            if (duration !== undefined) {

                const [hours, minutes] = duration.split(":").map(Number);
                const totalSeconds = hours * 3600 + minutes * 60;

                updateData.terminalid = terminalid;
                updateData.duration = totalSeconds;
                updateData.details = details;

                updateData.update_at = Date.parse(new Date())/1000;

                await db("kioskproperty")
                    .where({ kioskid: kioskid })
                    .update(updateData);
                }

            return resolve({
                status: 200,
                message: "Seting successful"
            })

        }

        catch (error) {

            return reject(error);
        }
    });

    Promise.race([settingLogic, timeoutPromise])
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
