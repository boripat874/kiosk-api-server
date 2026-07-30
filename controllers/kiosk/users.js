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

// เก็บ Promise ของ Request ที่กำลังประมวลผลอยู่ (Key: เลขบัตร/พาสปอร์ต, Value: Promise)
const activeRequests = new Map();

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
  const {
    visitortype,
    name,
    surname,
    idcardnumber,
    passportnumber,
    phone,
    
  } = req.body;

  const terminalid_ = req.body.terminalid || "";
  const transactionid_ = req.body.transactionid || "";

  const identifierKey = idcardnumber || passportnumber;

  if(terminalid_ == null || terminalid_ == ""){
    return res.status(402).json({
      message: "terminalid not found",
    })
  }

  if(transactionid_ == null || transactionid_ == ""){
    return res.status(402).json({
      message: "transactionid not found",
    })
  }

  const db_transactionid = await db
  .select("transactionid")
  .from("registerinfo")
  .where({ transactionid: transactionid_ });

  if (db_transactionid.length) {
    return res.status(402).json({
      message: "You have already completed this transaction.",
    })
  }

  // 1. ถ้ามี Request ของเลขบัตรนี้กำลังรันอยู่ ให้รอผลลัพธ์จาก Request นั้นเลย (ไม่ยิง Cisco ซ้ำ)
  if (identifierKey && activeRequests.has(identifierKey)) {
    try {
      const existingResult = await activeRequests.get(identifierKey);
      return res.status(200).json(existingResult);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      return handleError(err, res);
    }
  }

  // ตั้งค่า Timeout Promise
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject({ status: 402, message: "Request timed out" }), timeout)
  );

  const usersaddLogic = (async () => {
    // Validate API Key
    await validateApiKey(req);

    const ugroupid = "kiosk2025";
    const routerid = "";

    // Validate Inputs
    if (!name) throw { status: 402, message: "name is required" };
    if (!surname) throw { status: 402, message: "surname is required" };
    if (!idcardnumber && !passportnumber) {
      throw { status: 402, message: "nationalidcard or passportcard is required" };
    }
    // if (!expiredate || isNaN(Date.parse(`${expiredate} 00:00`))) {
    //   throw { status: 402, message: "expiredate is invalid or required" };
    // }

    let phoneNumber = "+66" + phone.slice(1, 10);

    const now_Oldaccount = new Date();

    const startOfDay = Math.floor(new Date(now_Oldaccount.getFullYear(), now_Oldaccount.getMonth(), now_Oldaccount.getDate(), 0, 0, 0).getTime() / 1000);
    const endOfDay = Math.floor(new Date(now_Oldaccount.getFullYear(), now_Oldaccount.getMonth(), now_Oldaccount.getDate(), 23, 59, 59).getTime() / 1000);

    // Check Existing Account ใน DB
    const Oldaccount = await db("registerinfo")
      .select("*")
      .where("status", "active")
      .whereBetween("expiredate", [startOfDay, endOfDay])
      .andWhere(function () {

        if (idcardnumber) {

          this.where("idcardnumber", idcardnumber);

        } else if (passportnumber) {

          this.where("passportnumber", passportnumber);

        }

      })
      .orderBy("create_at", "desc")
      .first();
      
    // ดึงข้อมูล duration
    let durationTime = 14400;
    const usergroup = await db("registergroupinfo")
      .select("*")
      .where("ugroupid", "kiosk2025")
      .andWhere("status", "active")
      .first();

    if (usergroup) {
      durationTime = usergroup.duration;
    }

    const hours = Math.floor(durationTime / 3600);
    const minutes = Math.floor((durationTime % 3600) / 60);
    const formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    // เช็คก่อนว่ามี Oldaccount หรือไม่
    if (Oldaccount) {

      const createdAt = new Date(Number(Oldaccount.create_at) * 1000);
      const now = new Date();
      
      // ลบกันได้ตัวเลขมิลลิวินาที -> แปลงเป็นวินาที
      const timeDifferenceInSeconds = Math.floor((now - createdAt) / 1000);
      const remainingTimeInSeconds = durationTime - timeDifferenceInSeconds;

      // console.log("durationTime >>: ",durationTime);
      // console.log("now >>: ",now);
      // console.log("createdAt >>: ",createdAt);
      // console.log("remainingTimeInSeconds >>: ",remainingTimeInSeconds);

      // ถ้ายังไม่หมดอายุ
      if (remainingTimeInSeconds > 0) {

        return {
          status: 200,
          message: "User already exists",
          user: Oldaccount.user,
          password: Oldaccount.password,
          duration: formattedTime // เวลาที่เหลืออยู่จริง
        };
      }

      // ถ้าหมดอายุแล้ว (remainingTimeInSeconds <= 0)
      // สามารถอัปเดต status เป็น inactive หรือปล่อยไหลไปสร้าง accountใหม่
      // await db("registerinfo").where("id", Oldaccount.id).update({ status: "inactive" });
    }

    // Generate New User Credentials
    const Username = await createUniqueIdUesr();
    const password = await createUniqueIdPassword();

    // คำนวณวันที่สำหรับ Cisco
    const durationInMilliseconds = durationTime * 1000;
    const startDateTime = date.format(new Date(), "MM/DD/YYYY HH:mm");
    const endDateTime = date.format(new Date(Date.now() + durationInMilliseconds), "MM/DD/YYYY HH:mm");

    const startDate = new Date();
    const dateOnlyStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDateRef = new Date(Date.now() + durationInMilliseconds);
    const dateOnlyEnd = new Date(endDateRef.getFullYear(), endDateRef.getMonth(), endDateRef.getDate());

    const normalizedTimeDifference = dateOnlyEnd.getTime() - dateOnlyStart.getTime();
    const daysBetween = normalizedTimeDifference / (1000 * 3600 * 24);
    const calculatedValidDays = daysBetween <= 0 ? 1 : daysBetween;

    const CiscoUserBody = {
      GuestUser: {
        guestType: "Daily (default)",
        portalId: process.env.PORTAl_ID,
        guestAccessInfo: {
          validDays: calculatedValidDays,
          fromDate: startDateTime,
          toDate: endDateTime,
          location: "Bangkok"
        },
        guestInfo: {
          company: "Cisco",
          emailAddress: "thailand@cisco.com",
          firstName: name,
          lastName: surname,
          notificationLanguage: "English",
          password: password,
          phoneNumber: phoneNumber,
          userName: Username,
          smsServiceProvider: "Global Default"
        }
      }
    };

    // Create User in Cisco ISE
    try {
      await axios.post(
        `https://${process.env.CISCO_IP}:${process.env.CISCO_POST}/ers/config/guestuser`,
        CiscoUserBody,
        AuthCisco
      );
    } catch (error) {
      let ciscoErrorTitle = error.response?.data?.ERSResponse?.messages[0]?.title || error.message;
      let httpStatus = error.response?.status || 402;
      throw {
        status: httpStatus,
        message: `CISCO error: ${ciscoErrorTitle}`
      };
    }

    // Get Created User Info from Cisco ISE
    let userID = "0";
    try {
      const Usesresponse = await axios.get(
        `https://${process.env.CISCO_IP}:${process.env.CISCO_POST}/ers/config/guestuser/name/${Username}`,
        AuthCisco
      );

      const searchResult = Usesresponse.data;
      if (!searchResult || !searchResult.GuestUser || !searchResult.GuestUser.id) {
        throw { status: 402, message: "CISCO User not found after creation." };
      }
      userID = searchResult.GuestUser.id;
    } catch (error) {
      if (error.status) throw error;
      let ciscoErrorTitle = error.response?.data?.ERSResponse?.messages[0]?.title || error.message;
      let httpStatus = error.response?.status || 402;
      throw {
        status: httpStatus,
        message: `CISCO error Get User: ${ciscoErrorTitle}`
      };
    }

    

    // Insert into Database
    await db("registerinfo").insert({
      id: uuid(),
      routerid: userID,
      ugroupid,
      visitortype,
      name,
      surname,
      user: Username,
      password,
      idcardnumber: idcardnumber || null,
      passportnumber: passportnumber || null,
      phone,
      expiredate: Math.floor((Date.now() / 1000) + durationTime),
      terminalid: terminalid_,
      transactionid: transactionid_
    });

    return {
      status: 200,
      message: "User Add successful",
      user: Username,
      password: password,
      duration: formattedTime
    };
  })();

  // 2. ผูก Promise ของ Request นี้ลง Map
  const executionPromise = Promise.race([usersaddLogic, timeoutPromise]);
  if (identifierKey) {
    activeRequests.set(identifierKey, executionPromise);
  }

  try {
    const result = await executionPromise;
    await eventlog_kiosk(req, "เพิ่มรายการผู้เข้าใช้งานใหม่", "kioskuser");
    return res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    } else {
      return handleError(error, res);
    }
  } finally {
    // 3. ปลด Lock เมื่อทำงานจบเสมอ (ไม่ว่าจะสำเร็จหรือล้มเหลว)
    if (identifierKey) {
      activeRequests.delete(identifierKey);
    }
  }
};

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
            const nowDate = new Date();

            const userData = await db("registerinfo")
            .select("*")
            .where("status", "active")
            .andWhere(function() {
                this.where("idcardnumber", `${searchUser}`)
                this.orWhere("passportnumber", `${searchUser}`)
            })
            .andWhere("expiredate", ">=", nowInLocalTime)
            .orderBy("create_at","desc")
            .first();

           // let lastactivedate = userData ? userData.lastactivedate : null;

            if(!userData){
                return resolve({message: "User not found" });
            }
            // else{
            //     await db("registerinfo")
            //     .where("id", userData.id)
            //     .update({
            //         lastactivedate : Math.floor(Date.now() / 1000)
            //     }).then(async () => {

            //         /*await db("registerinfo")
            //         .select("lastactivedate")
            //         .where("id", userData.id)
            //         .first()
            //         .then((resolve) => {
            //             lastactivedate = resolve.lastactivedate;
            //         })*/

            //     });
            // }

            // const lastactivedate_ = userData.lastactivedate || false ? date.format(new Date(userData.lastactivedate *1000, "YYYY-MM-DD HH:mm")) : "-";

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
              created_at: date.format(new Date(userData.create_at * 1000), "YYYY-MM-DD HH:mm"),
              expiredate: date.format(new Date(userData.expiredate * 1000), "YYYY-MM-DD HH:mm"),
              // lastactivedate: lastactivedate_,

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

            // console.log(specificationsData);
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