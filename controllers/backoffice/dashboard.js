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

require("dotenv").config();

const timeout = 60000; // Timeout in milliseconds (e.g., 60 seconds)

// Dashboard List All
exports.dashboardlistAll = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const dashboardlistAllLogic = new Promise(async (resolve, reject) => {

        try {
            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0); // Start of tomorrow

            // Convert milliseconds to seconds (Unix timestamp)
            const startOfTodayMillis =  Math.floor(startOfToday.getTime() / 1000);
            const endOfTodayMillis =  Math.floor(endOfToday.getTime() / 1000);

            const countnationalidcard = await db("registerinfo")
                .where("idcardnumber", "!=", "null")
                .where("lastactivedate", ">=", startOfTodayMillis) // Records created from the beginning of today
                .where("lastactivedate", "<", endOfTodayMillis)    // Records created before the beginning of tomorrow
                .where("status", "=", "active")
                .count("* as count") 

            const countpassportcard = await db("registerinfo")
                .where("passportnumber", "!=", "null")
                .where("lastactivedate", ">=", startOfTodayMillis) // Records created from the beginning of today
                .where("lastactivedate", "<", endOfTodayMillis)    // Records created before the beginning of tomorrow
                .where("status", "=", "active")
                .count("* as count") 
 
            const users = await db("registerinfo")
              .select(
                "registerinfo.id as id",
                "registerinfo.routerid as routerid",
                "registerinfo.ugroupid as ugroupid",
                "registerinfo.visitortype as visitortype",
                "registergroupinfo.groupname as groupname",
                "registerinfo.name as name",
                "registerinfo.surname as surname",
                "registerinfo.password as password",
                "registerinfo.idcardnumber as idcardnumber",
                "registerinfo.passportnumber as passportnumber",
                "registerinfo.phone as phone",
                "registerinfo.lastactivedate as lastactivedate", 
                 "registerinfo.expiredate as expiredate",
                'registerinfo.status as status'
               )
              .leftJoin("registergroupinfo", "registerinfo.ugroupid", "=", "registergroupinfo.ugroupid")
              .where("lastactivedate", ">=", startOfTodayMillis) // Records created from the beginning of today
              .where("lastactivedate", "<", endOfTodayMillis)    // Records created before the beginning of tomorrow
              .where("registerinfo.status", "=", "active")
              .orderBy("lastactivedate", "desc");
            
              const resultusers = await Promise.all(
                users.map(async (user) => {
                    return {
                      id: user.id,
                      routerid: user.routerid,
                      ugroupid: user.ugroupid,
                      visitortype: user.visitortype,
                      groupname: user.groupname,
                      name: user.name,
                      surname: user.surname,
                      password: user.password,
                      idcardnumber: user.idcardnumber,
                      passportnumber: user.passportnumber,
                      phone: user.phone,
                      lastactivedate: date.format(new Date(user.lastactivedate*1000),"YYYY-MM-DD HH:mm:ss"),
                      expiredate: date.format(new Date(user.expiredate*1000),"YYYY-MM-DD"),
                    };
                }
            ));

            resolve({
                numberusers: {
                    period: "today",
                    countnationalidcard : countnationalidcard[0]['count'],
                    countpassportcard: countpassportcard[0]['count']

                },
                usertype:{
                    period: "today",
                    countnationalidcard : countnationalidcard[0]['count'],
                    countpassportcard: countpassportcard[0]['count']
                },
                users: {
                    period: "today",
                    total: resultusers.length,
                    result: resultusers
                }
                    

            });

        } catch (error) {

            reject(error);
        }
    });

    Promise.race([dashboardlistAllLogic, timeoutPromise])
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
};

// Dashboard Number Users
exports.dashboardnumberusers = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );  

    const dashboardnumberusersLogic = new Promise(async (resolve, reject) => {

        try {
            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            let period = req.query.period || "today"; // ค่าที่เป็นไปได้: "today", "thisweek", "thismonth", "thisyear"

            let startTimestamp;
            let endTimestamp;
            const now = new Date(); // รับวันที่และเวลาปัจจุบัน *เมื่อโค้ดทำงาน*

            // --- คำนวณ timestamp เริ่มต้นและสิ้นสุดตามช่วงเวลา (period) ---

            if (period === "thisyear") {
                // จุดเริ่มต้นของปีปัจจุบัน (1 มกราคม, 00:00:00)
                const startOfYear = new Date(now.getFullYear(), 0, 1); // เดือนเป็นแบบ 0-indexed (0 = มกราคม)
                startOfYear.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(startOfYear.getTime() / 1000);

                // จุดเริ่มต้นของปีถัดไป (1 มกราคม ของปีถัดไป, 00:00:00)
                const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1);
                startOfNextYear.setHours(0, 0, 0, 0);
                endTimestamp = Math.floor(startOfNextYear.getTime() / 1000);

            } else if (period === "thismonth") {
                // จุดเริ่มต้นของเดือนปัจจุบัน (วันที่ 1, 00:00:00)
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                startOfMonth.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(startOfMonth.getTime() / 1000);

                // จุดเริ่มต้นของเดือนถัดไป (วันที่ 1 ของเดือนถัดไป, 00:00:00)
                const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1); // JS จัดการการเปลี่ยนเดือน/ปีอัตโนมัติ
                startOfNextMonth.setHours(0, 0, 0, 0);
                endTimestamp = Math.floor(startOfNextMonth.getTime() / 1000);

            } else if (period === "thisweek") {
                // จุดเริ่มต้นของสัปดาห์ปัจจุบัน (สมมติว่าวันอาทิตย์เป็นวันแรก, วันที่ 0)
                const currentDayOfWeek = now.getDay(); // 0 สำหรับวันอาทิตย์, 1 สำหรับวันจันทร์, ..., 6 สำหรับวันเสาร์
                const startOfWeek = new Date(now); // สร้างสำเนา
                startOfWeek.setDate(now.getDate() - currentDayOfWeek); // ย้อนกลับไปหาวันอาทิตย์ล่าสุด
                startOfWeek.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(startOfWeek.getTime() / 1000);

                // จุดเริ่มต้นของสัปดาห์ถัดไป (วันอาทิตย์หน้า, 00:00:00)
                const startOfNextWeek = new Date(startOfWeek);
                startOfNextWeek.setDate(startOfWeek.getDate() + 7); // เพิ่ม 7 วัน
                // ชั่วโมงถูกตั้งค่าเป็น 00:00:00.000 แล้ว
                endTimestamp = Math.floor(startOfNextWeek.getTime() / 1000);

            } else { // กรณีเริ่มต้น, รวมถึง period === "today"
                // จุดเริ่มต้นของวันนี้ (00:00:00)
                const today = new Date(now); // สร้างสำเนา
                today.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(today.getTime() / 1000);

                // จุดเริ่มต้นของวันพรุ่งนี้ (00:00:00)
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                // ชั่วโมงถูกตั้งค่าเป็น 00:00:00.000 แล้ว
                endTimestamp = Math.floor(tomorrow.getTime() / 1000);
            }

            const countnationalidcard = await db("registerinfo")
                .where("idcardnumber", "!=", "null")
                .where("lastactivedate", ">=", startTimestamp) // Records created from the beginning of today
                .where("lastactivedate", "<", endTimestamp)    // Records created before the beginning of tomorrow
                .where("status", "=", "active")
                .count("* as count") 

            const countpassportcard = await db("registerinfo")
                .where("passportnumber", "!=", "null")
                .where("lastactivedate", ">=", startTimestamp) // Records created from the beginning of today
                .where("lastactivedate", "<", endTimestamp)    // Records created before the beginning of tomorrow
                .where("status", "=", "active")
                .count("* as count")
            

            resolve({
                numberusers: {
                    period: period,
                    countnationalidcard : countnationalidcard[0]['count'],
                    countpassportcard: countpassportcard[0]['count']
                }
            });

        } catch (error) {
            reject(error);
        }
    });

    Promise.race([dashboardnumberusersLogic, timeoutPromise])
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


};
// dashboardusertype
exports.dashboardusertype = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );  

    const dashboardusertypeLogic = new Promise(async (resolve, reject) => {

        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            let period = req.query.period || "today"; // ค่าที่เป็นไปได้: "today", "thisweek", "thismonth", "thisyear"

            let startTimestamp;
            let endTimestamp;
            const now = new Date(); // รับวันที่และเวลาปัจจุบัน *เมื่อโค้ดทำงาน*

            // --- คำนวณ timestamp เริ่มต้นและสิ้นสุดตามช่วงเวลา (period) ---

            if (period === "thisyear") {
                // จุดเริ่มต้นของปีปัจจุบัน (1 มกราคม, 00:00:00)
                const startOfYear = new Date(now.getFullYear(), 0, 1); // เดือนเป็นแบบ 0-indexed (0 = มกราคม)
                startOfYear.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(startOfYear.getTime() / 1000);

                // จุดเริ่มต้นของปีถัดไป (1 มกราคม ของปีถัดไป, 00:00:00)
                const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1);
                startOfNextYear.setHours(0, 0, 0, 0);
                endTimestamp = Math.floor(startOfNextYear.getTime() / 1000);

            } else if (period === "thismonth") {
                // จุดเริ่มต้นของเดือนปัจจุบัน (วันที่ 1, 00:00:00)
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                startOfMonth.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(startOfMonth.getTime() / 1000);

                // จุดเริ่มต้นของเดือนถัดไป (วันที่ 1 ของเดือนถัดไป, 00:00:00)
                const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1); // JS จัดการการเปลี่ยนเดือน/ปีอัตโนมัติ
                startOfNextMonth.setHours(0, 0, 0, 0);
                endTimestamp = Math.floor(startOfNextMonth.getTime() / 1000);

            } else if (period === "thisweek") {
                // จุดเริ่มต้นของสัปดาห์ปัจจุบัน (สมมติว่าวันอาทิตย์เป็นวันแรก, วันที่ 0)
                const currentDayOfWeek = now.getDay(); // 0 สำหรับวันอาทิตย์, 1 สำหรับวันจันทร์, ..., 6 สำหรับวันเสาร์
                const startOfWeek = new Date(now); // สร้างสำเนา
                startOfWeek.setDate(now.getDate() - currentDayOfWeek); // ย้อนกลับไปหาวันอาทิตย์ล่าสุด
                startOfWeek.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(startOfWeek.getTime() / 1000);

                // จุดเริ่มต้นของสัปดาห์ถัดไป (วันอาทิตย์หน้า, 00:00:00)
                const startOfNextWeek = new Date(startOfWeek);
                startOfNextWeek.setDate(startOfWeek.getDate() + 7); // เพิ่ม 7 วัน
                // ชั่วโมงถูกตั้งค่าเป็น 00:00:00.000 แล้ว
                endTimestamp = Math.floor(startOfNextWeek.getTime() / 1000);

            } else { // กรณีเริ่มต้น, รวมถึง period === "today"
                // จุดเริ่มต้นของวันนี้ (00:00:00)
                const today = new Date(now); // สร้างสำเนา
                today.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(today.getTime() / 1000);

                // จุดเริ่มต้นของวันพรุ่งนี้ (00:00:00)
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                // ชั่วโมงถูกตั้งค่าเป็น 00:00:00.000 แล้ว
                endTimestamp = Math.floor(tomorrow.getTime() / 1000);
            }

            const countnationalidcard = await db("registerinfo")
                .where("idcardnumber", "!=", "null")
                .where("lastactivedate", ">=", startTimestamp) // Records created from the beginning of today
                .where("lastactivedate", "<", endTimestamp)    // Records created before the beginning of tomorrow
                .where("status", "=", "active")
                .count("* as count") 

            const countpassportcard = await db("registerinfo")
                .where("passportnumber", "!=", "null")
                .where("lastactivedate", ">=", startTimestamp) // Records created from the beginning of today
                .where("lastactivedate", "<", endTimestamp)    // Records created before the beginning of tomorrow
                .where("status", "=", "active")
                .count("* as count")
            

            resolve({
                usertype : {
                    period: period,
                    countnationalidcard : countnationalidcard[0]['count'],
                    countpassportcard: countpassportcard[0]['count']
                }
            });

        } catch (error) {
            reject(error);
        }
    });

    Promise.race([dashboardusertypeLogic, timeoutPromise])
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
};

// dashboardusers
exports.dashboardusers = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );  

    const dashboardusersLogic = new Promise(async (resolve, reject) => {

        try {
            
            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            let period = req.query.period || "today"; // ค่าที่เป็นไปได้: "today", "thisweek", "thismonth", "thisyear"

            let startTimestamp;
            let endTimestamp;
            const now = new Date(); // รับวันที่และเวลาปัจจุบัน *เมื่อโค้ดทำงาน*

            // --- คำนวณ timestamp เริ่มต้นและสิ้นสุดตามช่วงเวลา (period) ---

            if (period === "thisyear") {
                // จุดเริ่มต้นของปีปัจจุบัน (1 มกราคม, 00:00:00)
                const startOfYear = new Date(now.getFullYear(), 0, 1); // เดือนเป็นแบบ 0-indexed (0 = มกราคม)
                startOfYear.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(startOfYear.getTime() / 1000);

                // จุดเริ่มต้นของปีถัดไป (1 มกราคม ของปีถัดไป, 00:00:00)
                const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1);
                startOfNextYear.setHours(0, 0, 0, 0);
                endTimestamp = Math.floor(startOfNextYear.getTime() / 1000);

            } else if (period === "thismonth") {
                // จุดเริ่มต้นของเดือนปัจจุบัน (วันที่ 1, 00:00:00)
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                startOfMonth.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(startOfMonth.getTime() / 1000);

                // จุดเริ่มต้นของเดือนถัดไป (วันที่ 1 ของเดือนถัดไป, 00:00:00)
                const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1); // JS จัดการการเปลี่ยนเดือน/ปีอัตโนมัติ
                startOfNextMonth.setHours(0, 0, 0, 0);
                endTimestamp = Math.floor(startOfNextMonth.getTime() / 1000);

            } else if (period === "thisweek") {
                // จุดเริ่มต้นของสัปดาห์ปัจจุบัน (สมมติว่าวันอาทิตย์เป็นวันแรก, วันที่ 0)
                const currentDayOfWeek = now.getDay(); // 0 สำหรับวันอาทิตย์, 1 สำหรับวันจันทร์, ..., 6 สำหรับวันเสาร์
                const startOfWeek = new Date(now); // สร้างสำเนา
                startOfWeek.setDate(now.getDate() - currentDayOfWeek); // ย้อนกลับไปหาวันอาทิตย์ล่าสุด
                startOfWeek.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(startOfWeek.getTime() / 1000);

                // จุดเริ่มต้นของสัปดาห์ถัดไป (วันอาทิตย์หน้า, 00:00:00)
                const startOfNextWeek = new Date(startOfWeek);
                startOfNextWeek.setDate(startOfWeek.getDate() + 7); // เพิ่ม 7 วัน
                // ชั่วโมงถูกตั้งค่าเป็น 00:00:00.000 แล้ว
                endTimestamp = Math.floor(startOfNextWeek.getTime() / 1000);

            } else { // กรณีเริ่มต้น, รวมถึง period === "today"
                // จุดเริ่มต้นของวันนี้ (00:00:00)
                const today = new Date(now); // สร้างสำเนา
                today.setHours(0, 0, 0, 0);
                startTimestamp = Math.floor(today.getTime() / 1000);

                // จุดเริ่มต้นของวันพรุ่งนี้ (00:00:00)
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                // ชั่วโมงถูกตั้งค่าเป็น 00:00:00.000 แล้ว
                endTimestamp = Math.floor(tomorrow.getTime() / 1000);
            }

            const users = await db("registerinfo")
              .select(
                "registerinfo.id as id",
                "registerinfo.routerid as routerid",
                "registerinfo.ugroupid as ugroupid",
                "registerinfo.visitortype as visitortype",
                "registergroupinfo.groupname as groupname",
                "registerinfo.name as name",
                "registerinfo.surname as surname",
                "registerinfo.password as password",
                "registerinfo.idcardnumber as idcardnumber",
                "registerinfo.passportnumber as passportnumber",
                "registerinfo.phone as phone",
                "registerinfo.lastactivedate as lastactivedate", 
                "registerinfo.expiredate as expiredate",
                'registerinfo.status as status'
               )
              .leftJoin("registergroupinfo", "registerinfo.ugroupid", "=", "registergroupinfo.ugroupid")
              .where("lastactivedate", ">=", startTimestamp) // Records created from the beginning of today
              .where("lastactivedate", "<", endTimestamp)    // Records created before the beginning of tomorrow
              .where("registerinfo.status", "=", "active")
              .orderBy("lastactivedate", "desc");

            //   console.log(users[0].expiredate);
            
              const resultusers = await Promise.all(
                users.map(async (user) => {
                    // const data_date = moment(user.expiredate*1000);
                    // console.log(user.expiredate);
                    return {
                      id: user.id,
                      routerid: user.routerid,
                      ugroupid: user.ugroupid,
                      visitortype: user.visitortype,
                      groupname: user.groupname,
                      name: user.name,
                      surname: user.surname,
                      password: user.password,
                      idcardnumber: user.idcardnumber,
                      passportnumber: user.passportnumber,
                      phone: user.phone,
                      lastactivedate: date.format(new Date(user.lastactivedate*1000),"YYYY-MM-DD HH:mm:ss"),
                      expiredate: date.format(new Date(user.expiredate*1000),"YYYY-MM-DD"),
                    }
                }
            ));

            // console.log(resultusers);

            resolve({
                users : {
                    period: period,
                    total: resultusers.length,
                    result: resultusers
                }
            });

        } catch (error) {
            reject(error);
        }
    });

    Promise.race([dashboardusersLogic, timeoutPromise])
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


};


