const {db} = require("../../db/postgresql");
const fs = require("fs");
const date = require("date-and-time");
const { uuid } = require("uuidv4");
// const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken"); // ใช้สําหรับสร้างและตรวจสอบ JWT
const cron = require('node-cron');
// const { console } = require("inspector");

const {
    upload,
    checkString,
    handleError,
    validateApiKey,
    deleteUploadedFile,
    eventlog,
    checkAuthorizetion
} = require("../../modules/fun");
const { default: id } = require("date-and-time/locale/id");

require("dotenv").config();

const timeout = 60000; // Timeout in milliseconds (e.g., 60 seconds)

// ตั้งเวลาให้รันทุกวันตอนตี 1
cron.schedule('0 1 * * *', async () => {
    console.log('Running cleanup task for revoked tokens...');
    try {
      const now = new Date();
      const { rowCount } = await db('revoked_tokens') // Knex v0.21+ returns { rowCount } for DELETE on PostgreSQL
        .where('expires_at', '<', now)
        .del();
      // สำหรับ Knex เวอร์ชันเก่า อาจจะคืนค่าจำนวนแถวโดยตรง
      // const deletedCount = await db('revoked_tokens').where('expires_at', '<', now).del();
      console.log(`Cleanup task completed. Deleted ${rowCount ?? 0} expired revoked tokens.`);
    } catch (error) {
      console.error('Error during revoked tokens cleanup:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Bangkok" // ตั้ง timezone ให้เหมาะสม
  });
  
// ฟังก์ชันสําหรับตรวจสอบการเข้าสู่ระบบ ✓
exports.checklogin = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) => {

        setTimeout(() => {
        reject(new Error('Request timed out'));
        }, timeout);

    });
    
    const checkloginLogic = new Promise(async(resolve, reject) => {
    
    try {
        // ตรวจสอบ API key
        await validateApiKey(req);

        // ยีนยันตัวตนการเข้าสู่ระบบ
        // await checkAuthorizetion(req);

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
        }

        // *** ขั้นตอนที่ 2: ตรวจสอบ Denylist (ถ้า jwt.verify ผ่าน) ***
        const jti = decoded.jti;
        if (!jti) {
            // Token ไม่มี jti? อาจเป็น token เก่า หรือระบบมีปัญหา
            console.error("Token verification succeeded but 'jti' claim is missing.");
            return reject({ status: 401, message: "Unauthorized: Invalid token structure (missing jti)." });
        }

        const isRevoked = await db('revoked_tokens')
            .select('jti')
            .where({ jti: jti })
            .first(); // ใช้ first() เพื่อหาแค่ record เดียว

        if (isRevoked) {
            // *** ถ้า Token อยู่ใน Denylist -> Reject ***
            console.log(`Access denied: Token ${jti} is revoked.`);
            return reject({ status: 401, message: "Unauthorized: Token has been revoked" });
        }

        // console.log(userid);

        // --- ตรวจสอบ userid ถ้ามี ---
        if (userid) {
        const userExists = await db("userinfo")
            .select("*")
            .where({ userid })
            .first(); // ใช้ first() เพื่อประสิทธิภาพที่ดีกว่า

        if (!userExists) {
            // ถ้า verify ผ่าน แต่หา user ไม่เจอ ก็ควร reject
            return reject({ status: 402, message: "User associated with token not found" });
        }

        // ถ้า verify ผ่าน และเจอ user
        resolve({
            name: userExists.name,
            level: userExists.level,
            message: "User is logged in"
        });

    } else {
        // ถ้าไม่มี token หรือ verify ไม่ผ่าน (และเราเลือกที่จะข้าม error)
        // อาจจะ reject หรือ resolve ด้วยสถานะอื่น ขึ้นอยู่กับว่าต้องการให้ระบบทำงานต่ออย่างไร
        // ในที่นี้เลือก reject เพื่อบ่งบอกว่าการตรวจสอบไม่สำเร็จ
        reject({ status: 401, message: "Unauthorized: Invalid or missing token" });
    }

    } catch (error) {

        reject(error);

    }

    })

    Promise.race([checkloginLogic, timeoutPromise])
    .then((data) => {

        return res.send(data); // ส่ง response และหยุดการทำงาน
    })
    .catch((error) => {

    if (error.status) {

        return res.status(error.status).json({ message: error.message });

    } else if (error.message === "Request timed out") {

        return res.status(402).json({ message: "Request timed out" });

    } else {
        
        handleError(error, res);
    }
    });

}

  //signin ✓
exports.signin = async(req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    let userid_ = null;
  
    const signinLogic = new Promise(async (resolve, reject) => {
      try {
  
        await validateApiKey(req); // ตรวจสอบ API key
  
        if(!req.body.username){
            reject({ status: 402, message: "Username not required" });
        }

        if(!req.body.password){
            reject({ status: 402, message: "Password not required" });
        }
  
        // ตรวจสอบชื่อผู้ใช้งานและรหัสผ่าน
        const user = await db("userinfo")
        .select("*")
        .where({ "username": req.body.username })
        .andWhere({ "password": req.body.password })
        .andWhere({ "status": "active" })
        .first();
  
        if (!user) {
          reject({ status: 402, message: "User not found" });
        }

        const tokenId = uuid(); 
        userid_ = user.userid;
  
        // console.log(user);
  
        const token = jwt.sign(
          {
            userid: user.userid,
            jti: tokenId
          },
          process.env.JWT_SECRET,
          { expiresIn: "1d" }
        );
  
        resolve({
          token: token,
          message:"Login successfully"
        });
  
      } catch (error) {
        reject(error, res);
      }
    });
  
    Promise.race([signinLogic, timeoutPromise])
        .then(async(result) => {

            // console

            await db("eventloginfo").insert({
                id: uuid(),
                userid: userid_ ,
                ipaddress: req.ip,
                remark: "เข้าสู่ระบบ"
            })

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

// logout
exports.logout = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const logoutLogic = new Promise(async (resolve, reject) => {
        try {
            await validateApiKey(req); // ตรวจสอบ API key

            const headers = req.headers.authorization;
            const token = headers.split(" ")[1]; // แยก token จาก Authorization header

            // ตรวจสอบ token ด้วย jwt.verify
            let decoded;
            try {
                // *** ขั้นตอนที่ 1: ตรวจสอบ Token พื้นฐาน ***
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (jwtError) {
                // ถ้า jwt.verify ไม่ผ่าน (หมดอายุ, ลายเซ็นผิด) -> Reject ทันที
                console.warn(`JWT verification failed: ${jwtError.message}`);
                // ไม่ต้องเช็ค denylist เพราะ token ไม่ valid อยู่แล้ว
                return reject({ status: 401, message: `Unauthorized: ${jwtError.message}` });
            }

            // ตรวจสอบว่า User ยังมีอยู่จริงหรือไม่ ***
            const userid = decoded.userid;
            if (!userid) {
                console.error("Token verification succeeded but 'userid' claim is missing.");
                return reject({ status: 401, message: "Unauthorized: Invalid token structure (missing userid)." });
            }
                
            const jti = decoded.jti;

            if (!jti) {
                // Token นี้ไม่ได้สร้างด้วยระบบใหม่ที่ใส่ jti? หรือมีปัญหา?
                console.warn("Logout attempt with token missing 'jti' claim.");
                // อาจจะ reject หรือ แค่ log ไว้ ขึ้นอยู่กับนโยบาย
                return reject({ status: 400, message: "Token is missing required 'jti' claim for revocation." });
            }

            await db("revoked_tokens")
                .select("jti")
                .where({ jti: jti })
                .first()
                .then((tokenExists) => {
                    if (tokenExists) {
                        console.warn(`Token ${jti} already exists in denylist.`);
                        return reject({ status: 402, message: "Token has already been revoked." });
                    }
                });

            // เพิ่ม token jti เข้าไปใน denylist
            await db('revoked_tokens')
                .insert({ jti: jti})
                .onConflict('jti') // ถ้ามี jti นี้อยู่แล้ว (อาจจะ logout ซ้ำ)
                .ignore();         // ไม่ต้องทำอะไร (หรือ .doNothing() ขึ้นอยู่กับเวอร์ชัน Knex/DB)

            await db("userinfo")
                .select("userid")
                .where({ userid: userid, status: "active" }) // เช็ค status ด้วย
                .first()

            .then((userExists) => { 
                if(!userExists) {
                // User ที่เคยออก token ให้ อาจถูกลบ หรือ inactive ไปแล้ว
                console.warn(`User ${userid} associated with token not found or inactive.`);
                return reject({ status: 401, message: "Unauthorized: User associated with token not found or inactive" });
            }});
        
            resolve({message: "Logout successfully" });
        } catch (error) {
            reject(error);
        }
    });

    Promise.race([logoutLogic, timeoutPromise])
        .then(async(result) => {

            // ออกจากระบบ eventlog
            await eventlog(req,"ออกจากระบบ"); // เก็บ eventlog

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
        