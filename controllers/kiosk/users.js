const {db} = require("../../db/postgresql");
const date = require("date-and-time");
const { uuid } = require("uuidv4");
// const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken"); // ใช้สําหรับสร้างและตรวจสอบ JWT
const axios = require('axios');
const fs = require("fs");
const https = require('https');
// const { console } = require("inspector");

const {
    upload,
    checkString,
    handleError,
    validateApiKey,
    deleteUploadedFile,
    createUniqueIdUesr,
    createUniqueIdPassword,
    eventlog_kiosk
} = require("../../modules/fun");
const { default: id } = require("date-and-time/locale/id");

require("dotenv").config();

const timeout = 60000; // Timeout in milliseconds (e.g., 60 seconds)

const ciscoAgent = new https.Agent({
    rejectUnauthorized: false,
    ca: fs.readFileSync(path.join(__dirname, '../../cisco-root/Defaultselfsignedservercerti.pem'))
});

const AuthCisco = {
    headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Accept": "application/json;charset=utf-8",
    },
    auth: {
        username: process.env.CISCO_USER,
        password: process.env.CISCO_PASSWORD
    },
    httpsAgent: ciscoAgent
    
}

// Users add ✅
exports.userscreate = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );
    
    const usersaddLogic = new Promise(async (resolve, reject) => {
        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            // await checkAuthorizetion(req);

            const {
                // routerid,
                // ugroupid,
                visitortype,
                // Username,
                name,
                surname,
                // password,
                idcardnumber,
                passportnumber,
                phone,
                expiredate
            } = req.body;

            var ugroupid = "kiosk2025";
            var routerid = "";
            var Username = await createUniqueIdUesr();
            var password = await createUniqueIdPassword();

            if(!ugroupid){
                return reject({status: 402, message: "ugroupid not required" });
            }

            if(!name){
                return reject({status: 402, message: "name not required" });
            }

            if(!surname){
                return reject({status: 402, message: "surname not required"})
            }

            if(!password){
                return reject({status: 402, message: "password not required"})
            }

            if(!idcardnumber && !passportnumber){
                return reject({status: 402, message: "nationalidcard or passportcard not required"})
            }

            if (expiredate === null || isNaN(Date.parse(`${expiredate} 00:00`))) {
                return reject({ status: 402, message: "expiredate not required or expiredate format Invalid" });
            }

            let phoneNumber = "+66" + phone.slice(1, 10);
            
            //### Cisco สร้าง User

            //ขอ Portal ID
            // await axios.get(`https://${process.env.CISCO_IP}:${process.env.CISCO_POST}/ers/config/sponsorportal`)
            // .then( async(response) => {
                // console.log(response.data);

                var portalId = "";

                // parser.parseString(response.data, (err, result) => {
                //     if (err) {
                //         console.error('Error parsing XML:', err);
                //         return;
                //     }

                //     // Access the id
                //     portalId = result['ns3:searchResult']['ns3:resources']['ns5:resource']['ns5:resource'].id;
                
                // });

                // const CiscoUserBody = {
                //     "guesInfo": {
                //         "userName": Username,
                //         "firstName": name,
                //         "lastName": surname,
                //         "emailAdddress": "-",
                //         "company": "-",
                //         "phoneNumber": phone,
                //         "password": password,
                //         "creationTime": date.format(new Date(), "MM/DD/YYYY HH:mm"),
                //         "enabled": true,
                //         "notificationLanguage": "English",
                //         "smsServiceProvider": "Global Default"
                //     },
                //     "guestAccessInfo": {
                //         "validDays": 1,
                //         "fromDate": date.format(new Date(), "MM/DD/YYYY"),
                //         "toDate": date.format(currentDate, "MM/DD/YYYY"),
                //         "location": "thailand"
                //     }
                // }

                // const CiscoUserBody = 
                // `<guestAccessInfo>
                //     <fromDate>${date.format(new Date(), "MM/DD/YYYY")}</fromDate>
                //     <location>thailand</location>
                //     <toDate>${date.format(currentDate, "MM/DD/YYYY")}</toDate>
                //     <validDays>1</validDays>
                // </guestAccessInfo>
                // <guestInfo>
                //     <emailAddress>"-"</emailAddress>
                //     <firstName>${name}</firstName>
                //     <lastName>${surname}</lastName>
                //     <notificationLanguage>English</notificationLanguage>
                //     <password>${password}</password>
                //     <phoneNumber>${phone}</phoneNumber>
                //     <userName>${Username}</userName>
                // </guestInfo>
                // <guestType>Daily (default)</guestType>
                // <portalId>${portalId}</portalId>`

                // *****************************
                // const startDateTime = date.format((new Date()), "MM/DD/YYYY HH:mm"); // วันที่เริ่มต้น
                // const endDateTime = date.format((new Date(expiredate)), "MM/DD/YYYY 23:59"); // วันที่สิ้นสุด

                // const startDateTime =  new Date(); // New Date() คือ วันที่เริ่มต้น
                // const endDate = new Date(endDateTime); // New Date(expiredate) คือ วันที่สิ้นสุด

                // // ผลต่างเป็นมิลลิวินาที (Difference in milliseconds)
                // const timeDifference = endDate.getTime() - startDateTime.getTime();

                // startDateTime.getDate();

                // // Math.ceil() ถูกใช้เพื่อให้แน่ใจว่าถ้ามีเศษของวัน (เช่น 1 วัน 2 ชั่วโมง) จะนับเป็น 2 วันเต็ม
                // // เพื่อให้ครอบคลุมช่วงเวลาถึง 'toDate'
                // const calculatedValidDays = Math.ceil(timeDifference / (1000 * 3600 * 24));
                // *****************************


                // A. กำหนดตัวแปรวันที่ตามที่คุณทำไว้
                const startDateTime = date.format((new Date()), "MM/DD/YYYY HH:mm"); // วันที่เริ่มต้น
                const endDateTime = date.format((new Date(expiredate)), "MM/DD/YYYY 23:59"); // วันที่สิ้นสุด

                const startDate =  new Date(); // New Date() คือ วันที่เริ่มต้น

                // B. สร้าง Date Object ที่มีแต่ วัน ที่เราสนใจ (00:00:00 น. ของวันนั้นๆ)

                // 1. วันที่เริ่มต้น (เที่ยงคืนของวันนี้)
                const dateOnlyStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

                // 2. วันที่สิ้นสุด (เที่ยงคืนของวันหมดอายุ)
                // ใช้ endDateTime ในการสร้างวันสิ้นสุด แต่ให้ตั้งเวลาเป็น 00:00:00 น. 
                // โดยการสร้างจากองค์ประกอบ (Year, Month, Day) แทนการใช้สตริง
                const endDateRef = new Date(expiredate); 
                const dateOnlyEnd = new Date(endDateRef.getFullYear(), endDateRef.getMonth(), endDateRef.getDate());


                // C. คำนวณผลต่างระหว่างวันที่ (00:00:00 น. ทั้งคู่)

                // ผลต่างเป็นมิลลิวินาทีระหว่างเที่ยงคืนถึงเที่ยงคืน
                const normalizedTimeDifference = dateOnlyEnd.getTime() - dateOnlyStart.getTime();

                // แปลงเป็นจำนวนวันเต็ม (ไม่ต้องปัดขึ้น/ลง เพราะเป็นผลต่างระหว่างเที่ยงคืนถึงเที่ยงคืน)
                // ผลลัพธ์ที่ได้คือ 'จำนวนคืน' หรือ 'จำนวนวันเต็มที่ผ่านไประหว่างสองวัน'
                const daysBetween = normalizedTimeDifference / (1000 * 3600 * 24); 

                // D. คำนวณ validDays
                // validDays คือ จำนวนวันทั้งหมดที่สิทธิ์นี้ครอบคลุม (รวมวันเริ่มต้น)
                const calculatedValidDays = daysBetween <= 0 ? 1 : daysBetween;

                const CiscoUserBody = {
                    "GuestUser": {
                        "guestType": "Daily (default)",
                        "portalId": process.env.PORTAl_ID,
                        "guestAccessInfo": {
                            "validDays": calculatedValidDays,
                            "fromDate": startDateTime,
                            "toDate": endDateTime,
                            "location": "thailand"
                        },
                        "guestInfo":{
                                "company":"Cisco",
                                "emailAddress":"thailand@cisco.com",
                                "firstName":name,
                                "lastName":surname,
                                "notificationLanguage":"English",
                                "password":password,
                                "phoneNumber":phoneNumber,
                                "userName":Username,
                                "smsServiceProvider":"Global Default"
                        },
                    }
                };

                console.log(CiscoUserBody);

                // ส่งคำขอสร้าง User
                await axios.post(`https://${process.env.CISCO_IP}:${process.env.CISCO_POST}/ers/config/guestuser`,
                    CiscoUserBody,
                    AuthCisco
                )
                .then((response) => {

                    console.log(response.data);

                }).catch((error) => {

                    console.log(error.response.data.ERSResponse.messages[0].title);

                    let ciscoErrorTitle = '';
                    let httpStatus = 402; // ค่า default ที่คุณต้องการ

                    // 1. ตรวจสอบว่ามี response error จาก Cisco/Axios หรือไม่
                    if (error.response) {
                        
                        httpStatus = error.response.status; // ดึง HTTP Status จริง (เช่น 400)
                        const responseData = error.response.data;
                        
                        // 2. พยายามแยก 'title' จากโครงสร้าง response ของ Cisco ERS (JSON)
                        // โครงสร้าง error JSON มักจะเป็น: { ERSResponse: { messages: [ { title: '...' } ] } }
                        try {
                            ciscoErrorTitle = responseData.ERSResponse.messages[0].title;
                        } catch (parseError) {
                            // หากโครงสร้าง JSON ไม่เป็นไปตามที่คาดหวัง 
                            ciscoErrorTitle = `[Failed to parse CISCO message title]`;
                            console.error("Cisco response structure unexpected:", responseData);
                        }
                    }

                    // 3. รวมข้อความทั้งหมดและส่งคืน (reject)
                    return reject({
                        status: httpStatus, 
                        message: `CISCO error: ${ciscoErrorTitle} - ${error.message}` 
                    });
                })

                // ดึง routerid
                await axios.get(
                    `https://${process.env.CISCO_IP}:${process.env.CISCO_POST}/ers/config/guestuser/name/${Username}`,
                    AuthCisco // Correctly passed as the second argument
                )
                .then(async (Usesresponse) => {

                    const searchResult = Usesresponse.data;

                    console.log(Usesresponse.data);

                    // 1. Check if SearchResult and resources exist and are not empty
                    if (!searchResult || !searchResult.GuestUser) {
                        return reject({status: 402, message: "CISCO User not found or Usesresponse data is unexpected." });
                    }

                    // 2. Safely find the user
                    const userID = searchResult.GuestUser.id;

                    if(!userID){
                        return reject({status: 402, message: "CISCO User not found." });
                    }

                    await db("registerinfo").insert({
                        id : uuid(),
                        routerid : userID || "0",
                        ugroupid,
                        visitortype,
                        name,
                        surname,
                        user: Username,
                        password,
                        idcardnumber : idcardnumber || null,
                        passportnumber : passportnumber || null,
                        phone,
                        expiredate: new Date(`${expiredate} 23:59`).getTime() / 1000,
                    })

                }).catch((error) => {
                    let ciscoErrorTitle = '';
                    let httpStatus = 402; // ค่า default ที่คุณต้องการ

                    // 1. ตรวจสอบว่ามี response error จาก Cisco/Axios หรือไม่
                    if (error.response) {
                        
                        httpStatus = error.response.status; // ดึง HTTP Status จริง (เช่น 400)
                        const responseData = error.response.data;
                        
                        // 2. พยายามแยก 'title' จากโครงสร้าง response ของ Cisco ERS (JSON)
                        // โครงสร้าง error JSON มักจะเป็น: { ERSResponse: { messages: [ { title: '...' } ] } }
                        try {
                            ciscoErrorTitle = responseData.ERSResponse.messages[0].title;
                        } catch (parseError) {
                            // หากโครงสร้าง JSON ไม่เป็นไปตามที่คาดหวัง 
                            ciscoErrorTitle = `[Failed to parse CISCO message title]`;
                            console.error("Cisco response structure unexpected:", responseData);
                        }
                    }

                    // 3. รวมข้อความทั้งหมดและส่งคืน (reject)
                    return reject({
                        status: httpStatus, 
                        message: `CISCO error Get User: ${ciscoErrorTitle} - ${error.message}` 
                    });
                })

            // console.log("Next Get User");

            // }).catch((error) => {
            //     return reject({status: 402, message: `CISCO error : ${error.message}` });
            // })

            // let visitortype = "คนไทย";

            // if(nationalidcard){

            //     visitortype = "คนไทย";

            // }else if(passportcard){

            //     visitortype = "คนต่างชาติ";
            // }
            

            

            resolve({
                status: 200,
                message: "User Add successful"
            })

        }

        catch (error) {

            return reject(error);
        }
    });

    Promise.race([usersaddLogic, timeoutPromise])
    .then(async(result) => {

        await eventlog_kiosk(req,"เพิ่มรายการผู้เข้าใช้งานใหม่", "kioskuser"); // เก็บ eventlog

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

// User get ✅ method post
exports.userget = async (req, res) => {
    
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );
    
    const usergetLogic = new Promise(async (resolve, reject) => {
        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
           // await checkAuthorizetion(req);

            const searchUser = req.body.searchUser || "";

            const nowInLocalTime = Math.floor(Date.now() / 1000);

            // console.log("nowInLocalTime: ", nowInLocalTime);

            const userData = await db("registerinfo")
            .select("*")
            .where("status", "active")
            .andWhere(function() {

                this.where("idcardnumber", `${searchUser}`)
                this.orWhere("passportnumber", `${searchUser}`)

            })
            .andWhere("expiredate", ">", nowInLocalTime)
            .first();

           // let lastactivedate = userData ? userData.lastactivedate : null;

            if(!userData){
                return resolve({message: "User not found" });
            }else{
                await db("registerinfo")
                .where("id", userData.id)
                .update({
                    lastactivedate : Math.floor(Date.now() / 1000)
                }).then(async () => {

                    /*await db("registerinfo")
                    .select("lastactivedate")
                    .where("id", userData.id)
                    .first()
                    .then((resolve) => {
                        lastactivedate = resolve.lastactivedate;
                    })*/

                });
            }

            const resultUserData = {
                id: userData.id,
                routerid: userData.routerid,
                ugroupid: userData.ugroupid,
                visitortype: userData.visitortype,
                name: userData.name,
                surname: userData.surname,
                user: userData.user,
                password: userData.password,
                idcardnumber: userData.idcardnumber,
                passportnumber: userData.passportnumber,
                phone: userData.phone,
                expiredate: userData.expiredate,
                lastactivedate: userData.lastactivedate,
            };

            resolve({
                //message: "User get successful",
                data: resultUserData
            })

        }

        catch (error) {

            return reject(error);
        }
    });

    Promise.race([usergetLogic, timeoutPromise])
    .then(async(result) => {

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

// Get specifications ✅
exports.kioskspecifications = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );
    
    const userspecificationsLogic = new Promise(async (resolve, reject) => {
        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            // await checkAuthorizetion(req);

            const specificationsData = await db("specifications")
            .select("*")
            .where("status", "active")
            .andWhere("number_serial", 1)
            .first();

            console.log(specificationsData);
            // .where("status", "active");

            const resultSpecificationsData = {
                // id: specificationsData.id,
                ssid: specificationsData.ssid,
                description: specificationsData.description,
            };

            resolve(resultSpecificationsData)

        }

        catch (error) {
            return reject(error);
        }
    });

    Promise.race([userspecificationsLogic, timeoutPromise])

    .then(async(result) => {

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