const {db} = require("../../db/postgresql");
const fs = require("fs");
const date = require("date-and-time");
const { uuid } = require("uuidv4");
// const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken"); // ใช้สําหรับสร้างและตรวจสอบ JWT
const axios = require('axios');
const xml2js = require('xml2js');
const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
const https = require('https');
// const { console } = require("inspector");

const {
    upload,
    checkString,
    handleError,
    validateApiKey,
    deleteUploadedFile,
    checkAuthorizetion
} = require("../../modules/fun");

const { convertTotimestamp } = require("../../modules/convertTotimestamp");

require("dotenv").config();

const timeout = 60000; // Timeout in milliseconds (e.g., 60 seconds)

const ciscoAgent = new https.Agent({
    rejectUnauthorized: false,
    ca: fs.readFileSync(path.join(__dirname, '../../cisco-root/Defaultselfsignedservercerti.pem'))
});

const AuthCisco = {
    // headers: {
    //     "Content-Type": "application/json;charset=utf-8",
    //     "Accept": "application/json;charset=utf-8",
    // },
    auth: {
        username: process.env.CISCOLOG_USER,
        password: process.env.CISCOLOG_PASSWORD
    },
    httpsAgent: ciscoAgent
    
}


// Traffic volume
exports.traffic_volume = async (req, res) => {
    
    timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const traffic_volumeLogic = new Promise(async (resolve, reject) => {

        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            let period_ = req.query.period || "today"; // ค่าที่เป็นไปได้: "today", "thisweek", "thismonth", "thisyear"

            const selectedDate =  await convertTotimestamp(req);

            const countnationalidcard = await db("registerinfo")
                .where("idcardnumber", "!=", "null")
                // .where("lastactivedate", ">=", selectedDate.startTimestamp) // Records created from the beginning of today
                // .where("lastactivedate", "<", selectedDate.endTimestamp)    // Records created before the beginning of tomorrow
                .where("create_at", ">=", selectedDate.startTimestamp) // Records created from the beginning of today
                .where("create_at", "<", selectedDate.endTimestamp)    // Records created before the beginning of tomorrow
                .where("status", "=", "active")
                .count("* as count") 

            const countpassportcard = await db("registerinfo")
                .where("passportnumber", "!=", "null")
                // .where("lastactivedate", ">=", selectedDate.startTimestamp) // Records created from the beginning of today
                // .where("lastactivedate", "<", selectedDate.endTimestamp)    // Records created before the beginning of tomorrow
                .where("create_at", ">=", selectedDate.startTimestamp) // Records created from the beginning of today
                .where("create_at", "<", selectedDate.endTimestamp)    // Records created before the beginning of tomorrow
                .where("status", "=", "active")
                .count("* as count") 

        resolve({
            numberusers: {
                period: period_,
                countnationalidcard : countnationalidcard[0]['count'],
                countpassportcard : countpassportcard[0]['count']
            },
            usertype:{
                period: period_,
                countnationalidcard : countnationalidcard[0]['count'],
                countpassportcard: countpassportcard[0]['count']
            },
        });

        } catch (error) {
            reject(error);
        }
    }); 

    Promise.race([traffic_volumeLogic, timeoutPromise])
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

// report list all
exports.reportlistAll = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const reportlistAllLogic = new Promise(async (resolve, reject) => {

        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const search = req.query.search || '';
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            const selectedDate =  await convertTotimestamp(req);

            // console.log(selectedDate);

            const reportlistall = await db("registerinfo") // 1. Start query on 'registerinfo' table
                .select({
                    id: "registerinfo.id",
                    routerid: "registerinfo.routerid",
                    ugroupid: "registerinfo.ugroupid",
                    create_at: "registerinfo.create_at",
                    visitortype: "registerinfo.visitortype",
                    groupname: "registergroupinfo.groupname",
                    name: "registerinfo.name",
                    surname: "registerinfo.surname",
                    password: "registerinfo.password",
                    idcardnumber: "registerinfo.idcardnumber",
                    passportnumber: "registerinfo.passportnumber",
                    user: "registerinfo.user",
                    phone: "registerinfo.phone",
                    lastactivedate: "registerinfo.lastactivedate",
                    expiredate: "registerinfo.expiredate",
                    duration: "registergroupinfo.duration"

                }) // 2. Select all columns from both tables
                .join("registergroupinfo", "registerinfo.ugroupid", "registergroupinfo.ugroupid") // 3. Join with 'registergroupinfo'
                .where("registerinfo.status", "=", 'active') // 4. Filter results
                .andWhere("registerinfo.create_at", ">=",selectedDate.startTimestamp)
                .andWhere("registerinfo.create_at", "<",selectedDate.endTimestamp)
                .andWhere(function() { // ใช้ andWhere เพื่อเพิ่มเงื่อนไข และใช้ function เพื่อจัดกลุ่ม OR
                    this.where("registerinfo.name", "like", `%${search}%`)
                        .orWhere("registerinfo.surname", "like", `%${search}%`)
                        .orWhere("registerinfo.idcardnumber", "like", `%${search}%`)
                        .orWhere("registerinfo.passportnumber", "like", `%${search}%`)
                        .orWhere("registerinfo.phone", "like", `%${search}%`)
                        .orWhere("registergroupinfo.groupname", "like", `%${search}%`)
                    })
                // .limit(limit)
                .offset(offset)
                .orderBy("registerinfo.lastactivedate", "desc")
                .orderBy("registerinfo.create_at", "desc")
                // .orderBy(".registerinfo.ugroupid", "desc"); // 5. Sort results

            // console.log("reportlistall.length >.",reportlistall.length);
            

            const resultreports = reportlistall.map(report => {

                const seconds = report.duration;

                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);

                // Format to two digits with leading zero if needed
                const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

                return {
                    id: report.id,
                    routerid: report.routerid,
                    ugroupid: report.ugroupid,
                    create_at: date.format(new Date(report.create_at*1000), "YYYY-MM-DD HH:mm:ss"),
                    visitortype: report.visitortype,
                    groupname: report.groupname,
                    name: report.name,
                    surname: report.surname,
                    password: report.password,
                    idcardnumber: report.idcardnumber,
                    passportnumber: report.passportnumber,
                    user: report.user,
                    phone: report.phone,
                    lastactivedate: report.lastactivedate ? date.format(new Date(report.lastactivedate*1000), "YYYY-MM-DD HH:mm:ss") : "-",
                    expiredate: date.format(new Date(report.expiredate*1000), "YYYY-MM-DD"),
                    duration: timeString
                }
            });

            resolve({
                total: resultreports.length,
                result: resultreports
            });
            
        }
        catch (error) {
            reject(error);
        }
    });

    Promise.race([reportlistAllLogic, timeoutPromise])
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

// report user details
exports.reportUserDetails = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const reportUserDetailsLogic = new Promise(async (resolve, reject) => {

        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const selectedDate =  await convertTotimestamp(req);

            // const Username = req.body.username;
            // const id = req.body.id || "";
            // const Username = req.query.user || "-";
            const id = req.query.id || "-";

            // console.log("ID >> ", id);

            var result = [];
            var resultreportsTital = {};
            // let result = [{
            //     "auth_acs_timestamp": "2025/01/01 08:00",
            //     "framed_ip_address": "127.0.0.1"
            // },
            // {
            //     "auth_acs_timestamp": "2025/01/02 08:00",
            //     "framed_ip_address": "127.0.0.1"
            // },
            // {
            //     "auth_acs_timestamp": "2025/01/03 08:00",
            //     "framed_ip_address": "127.0.0.1"
            // }];

            // console.log("ID >> ", id);
            try {

                const reportlistall = await db("registerinfo") // 1. Start query on 'registerinfo' table
                    .select({
                        id: "registerinfo.id",
                        routerid: "registerinfo.routerid",
                        ugroupid: "registerinfo.ugroupid",
                        create_at: "registerinfo.create_at",
                        visitortype: "registerinfo.visitortype",
                        groupname: "registergroupinfo.groupname",
                        name: "registerinfo.name",
                        surname: "registerinfo.surname",
                        user: "registerinfo.user",
                        password: "registerinfo.password",
                        idcardnumber: "registerinfo.idcardnumber",
                        passportnumber: "registerinfo.passportnumber",
                        phone: "registerinfo.phone",
                        lastactivedate: "registerinfo.lastactivedate",
                        expiredate: "registerinfo.expiredate",
                        duration: "registergroupinfo.duration"
                    }) // 2. Select all columns from both tables
                    .join("registergroupinfo", "registerinfo.ugroupid", "registergroupinfo.ugroupid") // 3. Join with 'registergroupinfo'
                    .where("registerinfo.status", "=", 'active') // 4. Filter results
                    .andWhere("registerinfo.id", "=", id)
                    .first()

                // .orderBy(".registerinfo.ugroupid", "desc"); // 5. Sort results

                // if (!reportlistall) {
                //     return res.status(402).json({ message: "Data Not found" });
                // }

                const report = reportlistall;
                    
                // console.log(report); 

                const resultreports = async() => {

                    const seconds = report.duration; // Assuming 'duration' is in seconds

                    const hours = Math.floor(seconds / 3600);
                    const minutes = Math.floor((seconds % 3600) / 60);

                    // Format to two digits with leading zero if needed
                    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

                    return {
                        id: report.id,
                        routerid: report.routerid,
                        ugroupid: report.ugroupid,
                        create_at: date.format(new Date(report.create_at*1000), "YYYY-MM-DD HH:mm:ss"),
                        visitortype: report.visitortype,
                        groupname: report.groupname,
                        name: report.name,
                        surname: report.surname,
                        user: report.user,
                        password: report.password,
                        idcardnumber: report.idcardnumber,
                        passportnumber: report.passportnumber,
                        phone: report.phone,
                        lastactivedate: date.format(new Date(report.lastactivedate*1000), "YYYY-MM-DD HH:mm:ss"),
                        expiredate: date.format(new Date(report.expiredate*1000), "YYYY-MM-DD"),
                        duration: timeString
                    }
                };

                resultreportsTital = await resultreports();

            } catch (error) {
                console.log(error);
            }

            const Username = resultreportsTital.user || "-";

            // console.log("Username ====>>>> ", Username);

            // 1. สร้างโครงสร้างฟังก์ชันแปลง XML ครอบไว้ให้เป็น Promise เพื่อให้สามารถใช้ await ร่วมกับลำดับโค้ดได้
            const parseXmlPromise = (xmlString) => {
                return new Promise((resolveParse, rejectParse) => {
                    parser.parseString(xmlString, (err, parsedResult) => {
                        if (err) {
                            console.error('Error parsing XML:', err);
                            return rejectParse(err);
                        }
                        
                        const sessionParams = parsedResult?.sessionParameters;
                        
                        // ดึงค่าออกมาตรงๆ (เพราะมี explicitArray: false แล้ว)
                        // หาก API มีสิทธิ์คืนค่ามาเป็นตัวเดี่ยว หรือ เป็น Array ให้สกัดให้ปลอดภัยแบบนี้ครับ
                        const framedIp = sessionParams?.framed_ip_address;
                        const authTimestamp = sessionParams?.auth_acs_timestamp;

                        // ถ้าต้องการส่งออกเป็นรูปแบบ Array ตามเป้าหมายเดิมของคุณ
                        const formattedResult = [{
                            "framed_ip_address": framedIp || "-",
                            "auth_acs_timestamp": authTimestamp || "-"
                        }];

                        resolveParse(formattedResult);
                    });
                });
            };

            try {
                // 2. ใส่ await หน้า axios.get สำคัญมาก! เพื่อให้โค้ดหยุดรอ Response จริงๆ
                const response = await axios.get(`https://${process.env.CISCO_IP}/admin/API/mnt/Session/UserName/${Username}`, AuthCisco)
                // await axios.get(`https://${process.env.CISCO_IP}:443/ers/config/guestuser?size=1000&page=1`, AuthCisco)
                //  http://IP-server:port /ers/config/guestuser?size={{size}} &{{page}} 

                .then( async(response) => {

                    // console.log("CISCOLOG_USER >> ", process.env.CISCOLOG_USER);
                    // console.log("CISCOLOG_PASSWORD >> ", process.env.CISCOLOG_PASSWORD);

                    // console.log("response >> ", response.data);

                    if(response.status === 404){
                        resolve({
                            status:200,
                            message: "Data Not found or Invalid Username"
                        });
                    }

                    if(response.data && response.data !== ""){

                        // 3. ใส่ await เพื่อรอให้แปลง XML และดึงค่าลงตัวแปรสำเร็จก่อนไหลต่อไปยังคำสั่งถัดไป
                        result = await parseXmlPromise(response.data);
                        console.log("result จากการแปลงเสร็จจริง >> ", result);

                    }else{
                        result = [];
                    }
                })

            } catch (error) {
                // เช็คกรณี axios ยิงแล้วฝั่งนู้นพ่น 404 หรือ error กลับมา
                if (error.response && error.response.status === 404) {
                    return resolve({
                        status: 200,
                        message: "Data Not found or Invalid Username"
                    });
                }
                console.log("Error Cisco >> ", error);
                result = []; // ป้องกันค่าพัง
            }
                

            return resolve({

                tital: resultreportsTital,
                result: result
            });
            
        }
        catch (error) {
            reject(error);
        }
    });

    Promise.race([reportUserDetailsLogic, timeoutPromise])
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

