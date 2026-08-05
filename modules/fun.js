//lib ที่ต้องใช้
const {db} = require("../db/postgresql");

const {uuid} = require("uuidv4");
// const fs = require("fs");
const multer = require("multer");
const jwt = require("jsonwebtoken"); // ใช้สําหรับสร้างและตรวจสอบ JWT

const { DateTime } = require('luxon');

const winston = require('winston');
require('winston-syslog').Syslog;

const os = require('os');

require("dotenv").config();

// 1. กำหนดเขตเวลาท้องถิ่น (UTC+7)
const TIMEZONE = 'Asia/Bangkok';

// 2. หาวันที่/เวลาปัจจุบันในเขตเวลาท้องถิ่น
const nowInLocalTime = DateTime.local().setZone(TIMEZONE);

// 3. หาวันที่เริ่มต้นของวันนี้ (เที่ยงคืน 00:00:00 น.) และแปลงเป็น Unix Timestamp (วินาที)
const startOfTodayTimestamp = nowInLocalTime.startOf('day').toSeconds(); 
// startOfTodayTimestamp คือ Unix Time ของ 00:00:00 น. วันนี้ (ใน UTC+7)

// const path = require("path");

// ฟังก์ชันดึง IP Address หลักของเครื่อง
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            // กรองหา IPv4 ที่ไม่ใช่ loopback (127.0.0.1)
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1'; // ค่าเริ่มต้นถ้าหาไม่เจอ
}

// ใช้งาน:
const currentIP = getLocalIP();

const cefFormatter = winston.format.printf((info) => {
    // แยกส่วนประกอบ
    // info.message จะได้ค่า 'Failed Login Attempt'
    // ข้อมูลที่เหลือจะอยู่ใน info ตัวเอง
    const { level, message, timestamp, ...ext } = info;

    // ลบค่าที่ไม่จำเป็นออกจาก ext เพื่อไม่ให้ไปปนกับ CEF Header
    delete ext.level;
    delete ext.message;
    delete ext.timestamp;

    // จัดการ Header (ถ้าใน ext ไม่มี ให้ใช้ค่า default)
    const vendor = ext.vendor || 'DITTO';
    const product = ext.product || 'Kiosk WIFI';
    const version = ext.version || 'V1.0';
    const eventId = ext.eventId || '100';
    const eventName = ext.eventName || 'Registration successful.';
    // const eventName = ext.eventName || message || 'General Event';
    const severity = ext.severity || '3';

    // ลบ Header keys ออกจาก ext เพื่อเหลือไว้แต่ Extension จริงๆ
    ['vendor', 'product', 'version', 'severity'].forEach(k => delete ext[k]);

    // Escape และแปลงเป็น String
    const escapeCEF = (str) => {
        if (typeof str !== 'string') str = String(str);
        return str.replace(/\\/g, '\\\\').replace(/=/g, '\\=').replace(/\|/g, '\\|');
    };

    const extString = Object.entries(ext)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${escapeCEF(v)}`)
        .join(' ');

    return `CEF:0|${vendor}|${product}|${version}|${eventId}|${eventName}|${severity}|${extString}`;
});

//ตั้งค่า Logger
const logger = winston.createLogger({
    levels: winston.config.syslog.levels, // เพิ่มส่วนนี้เพื่อให้รู้จักระดับ syslog
    transports: [
        new winston.transports.Syslog({
            host: process.env.SYSLOG_HOST,
            port: process.env.SYSLOG_PORT,
            protocol: 'udp4',
            app_name: 'Kiosk_WIFI',
            facility: 'local0',
            format: winston.format.combine(cefFormatter) 
        }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// ตั้งค่าการจัดเก็บไฟล์
const storage = ()=>{
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "uploads/"); // โฟลเดอร์สำหรับเก็บไฟล์
    },
  
    // ตั้งชื่อไฟล์
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9); // สร้างชื่อไฟล์ที่ไม่ซ้ำกัน
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      ); // ตั้งชื่อไฟล์ใหม่
    },
  });
}

// ฟิลเตอร์ไฟล์ (อนุญาตเฉพาะไฟล์รูปภาพ)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."));
  }
};

// สร้าง middleware สำหรับอัปโหลด
exports.upload = multer({ storage, fileFilter });

const regex = /^[0-9a-zA-Z_-]+$/;

// ฟังก์ชันสําหรับตรวจสอบข้อความ
exports.checkString = function checkString(str) {
    return regex.test(str);
}

// ฟังก์ชันสําหรับจัดการข้อผิดพลาด
exports.handleError = function handleError(error, res) {
  console.error(error); // แสดงข้อผิดพลาดใน console
  res.status(500).json({ message: "Internal Server Error", error: error.message });
}

// ฟังก์ชันสําหรับตรวจสอบ API key
exports.validateApiKey = async function validateApiKey(req) {
  const X_API_KEY = req.headers["x-api-key"]||"";

  const autihorized = await db.select("apikey").where({ "apikey": X_API_KEY }).from("securitysystem");

  if (!autihorized.length) {

    // return res.status(401).json({ message: "Unauthorized" });
    throw { status: 401, message: "Unauthorized" };
    
  }
}

// ฟังก์ชันสําหรับลบไฟล์ที่อัปโหลด
exports.deleteUploadedFile = async function deleteUploadedFile(filePath) {
  if (filePath) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Failed to delete uploaded file:", err);
      } else {
        // console.log("Uploaded file deleted successfully:", filePath);
      }
    });
  }
}

// eventlog add
exports.eventlog = async function eventlog(req,remark) {

    try {
  
      const headers = req.headers.authorization;
      let token;
      let decoded;
      let userid = null;

      if (headers && headers.startsWith("Bearer ")) {

        token = headers.split(" ")[1];
        
        if (token) {

          try {

            // พยายาม verify แต่ถ้า error ก็ไม่ reject ทันที
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            userid = decoded?.userid; // ใช้ optional chaining

          } catch (jwtError) {

            // *** จุดที่ "ข้าม" error ***
            console.warn("JWT verification failed (ignored):", jwtError.message);

            // ไม่ reject แต่ปล่อยให้ userid เป็น null หรือค่าเริ่มต้น
          }
        }
  
        if (userid) {
          
          await db("eventloginfo").insert({
            id: uuid(),
            userid,
            ipaddress: req.ip,
            remark,
          }).then(()=>{
            // console.log("Log Success")
            return "Log Success";
          }
            
          );

        }else{
          console.warn("User not found (ignored)");
          return "User not found";
        }

      }

  
    } catch (error) {
      return error;
    }
}

exports.eventlog_kiosk = async function eventlog_kiosk(req,remark,id) {

    try {

      await db("eventloginfo").insert({
        id: uuid(),
        "userid": id,
        ipaddress: req.ip,
        remark,
      }).then(()=>{
        // console.log("Log Success")
        return "Log Success";
      }
        
      );
  
    } catch (error) {
      return error;
    }
}

// checkAuthorizetion
exports.checkAuthorizetion = async (req) => {

  try {

    if(!req.headers.authorization){

      return Promise.reject({ status: 401, message: "Token is missing." });
    }

    
    const headers = req.headers.authorization;
    let token;
    let decoded;
    let userid = "";
    
    if (headers) {
      const parts = headers.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }
    
    if (token) {
      try {
        
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        userid = decoded.userid; // ใช้ optional chaining
        
      } catch (jwtError) {
        
        return Promise.reject({ status: 401, message: `JWT verification failed (ignored):${jwtError.message}` });
        
      }
    }

    if (!userid) {

      return Promise.reject({ status: 401, message: `Unauthorized: Invalid token structure (missing userid).` });

    }

    let jti = decoded.jti;
    if (!jti) {

      return Promise.reject({ status: 401, message: `Token is missing required 'jti' claim for revocation.` });

    }

    await db("revoked_tokens")
      .select("jti")
      .where({ jti })
      .first()
      .then((tokenExists) => {
        if (tokenExists) {  

          return Promise.reject({ status: 401, message: `Token has already been revoked.` });
        }
      }
    );

    await db("userinfo")
      .select("userid")
      .where({ userid })
      .then((result) => {
        if (result.length === 0) {

          return Promise.reject({ status: 401, message: `userid not found.` });
        }
      }
    );

    return ;

  } catch (error) {

    return Promise.reject({ status: 401, message: error });

  }
 
}

exports.createUniqueIdUesr = async function () {
  let newId;

    const timedate = new Date();
    
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randomString = "";
    for (let i = 1; i <= 3; i++) {
      randomString += characters.charAt(Math.floor(Math.random() * characters.length));
    }

  newId = (timedate.getFullYear() % 100) + timedate.getMonth() + timedate.getDate() + timedate.getHours() + timedate.getMinutes() + randomString;

  // ใช้ startOfTodayTimestamp ที่คำนวณไว้ข้างบน
  const rowsUpdated = await db("runnumber")
      .where({id: "kiosknumber"})
      .andWhere("date_time", "<", startOfTodayTimestamp) // <--- แก้ไขเงื่อนไขตรงนี้
      .update({
          number: 0,
          // อัปเดต date_time ให้เป็นเวลาปัจจุบันที่รีเซ็ต
          date_time: Math.floor(Date.now() / 1000)
      });

  if (rowsUpdated > 0) {
      console.log(`Reset number to 0 because the recorded date was before ${nowInLocalTime.toISODate()}`);
  }

  await db("runnumber")
    .where({id:"kiosknumber"})
    .first()
    .then(async (row) => {
      if (row) {

        newId = "zoo" + (timedate.getFullYear() % 100) + (timedate.getMonth()+1) + timedate.getDate() + (Number(row.number) + 1).toString().padStart(4, "0");
        
        await db("runnumber")
          .where({id:"kiosknumber"})
          .update({
            number: Number(row.number) + 1,
            date_time: Math.floor(Date.now() / 1000)
        });

      } else {
        // await db("runnumber")
        //   .insert({
        //     id: "kiosknumber",
        //     runnumber: newId,
        //     date_time: Math.floor(Date.now() / 1000)
        //   });
      }
    });

  return newId;
}

exports.createUniqueIdPassword = async function () {
    let newId;
    
    const characters = "0123456789";
    let randomString = "";
    
    for (let i = 1; i <= 6; i++) {
        randomString += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    newId = "zoo@" + randomString;
        
    return newId;
}

exports.getUTCFormattedDate = function getUTCFormattedDate(dateObj) {

  // toISOString() จะให้ผลลัพธ์ในรูปแบบ 'YYYY-MM-DDTHH:mm:ss.sssZ'
  // ซึ่ง Cisco ISE อาจไม่ชอบ หาก ISE ต้องการแค่ MM/DD/YYYY HH:mm
  // เราอาจจะต้องปรับให้ตรงตามที่ Cisco ISE ต้องการมากที่สุด (ดูหมายเหตุด้านล่าง)
  
  // สำหรับการทดลอง ให้ใช้ toISOString() ไปก่อน
  return dateObj.toISOString(); 
};

exports.sendlogArcSight = async function sendlog(title,eventId,severity,payload = {}) {

  logger.warning(title, {
    vendor: 'DITTO',
    product: 'Kiosk WIFI',
    eventName: title,
    severity: severity,
    eventId: eventId, // ใช้ eventId จาก parameter ที่ส่งเข้ามา
    src: currentIP,   // ดึง IP ล่าสุด
    ...payload        // นำ property ทั้งหมดใน payload มากระจายใส่ใน object นี้
  });
}
