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

// forgot-email ✓
exports.forgotemail = async(req, res) => {

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), timeout)
  );

  const forgotemailLogic = new Promise(async (resolve, reject) => {
    try {
      await validateApiKey(req); // ตรวจสอบ API key

      const {email} = req.body;

      if(!email){
        reject({ status: 402, message: "Email not required" });
      }
      
      const forgotemailid = uuid();

      await db("userinfo")
      .select("*")
      .where({ "uinfoemail": email })
      .andWhere({ "status": true })
      .first()
      .then(async(user) => {
        
        if (!user) {
          return reject({ status: 402, message: "User not found" });
        }


        await db("forgotemail")
        .insert({
          forgotemailid: forgotemailid,
          uinfoid: user.uinfoid,
        });

      });

      // Send email using Nodemailer
      const nodemailer = require("nodemailer");
      let transporter = nodemailer.createTransport({
          service: "gmail", // Adjust the service if needed
          auth: {
              user: process.env.EMAIL_USER, // Your email address
              pass: process.env.EMAIL_PASS, // Your email password or app password
          },
      });

      const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: "คำขอรีเซ็ตรหัสผ่าน Kiosk",
          html: `
            <p>คุณได้รับคําขอรีเซ็ตรหัสผ่านใหม่สำหรับบัญชีของคุณได้โดยคลิกที่ลิงก์ด้านล่างนี้:</p>
            <a href="${process.env.SITE_URL_FORGOTPASSWORD}/${forgotemailid}">คลิกที่นี่เพื่อรีเซ็ตรหัสผ่าน</a>
            <p>หากคุณไม่ได้ร้องขอการรีเซ็ตรหัสผ่าน โปรดเพิกเฉยอีเมลนี้</p>
          `
      };

      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              console.error("Error sending email:", error);
              // You might choose to reject here or simply log the error.
          } else {
              console.log("Email sent successfully:", info.response);
          }
      });

      resolve({message: "Success" });
    } catch (error) {
      reject(error);
    }
  });

  Promise.race([forgotemailLogic, timeoutPromise])
    .then((result) => {

      res.send(result);

    })
    .catch((error) => {

      if (error.status) {

        return res.status(error.status).json({ message: error.message });
  
      } else if (error.message === "Request timed out") {
  
        return res.status(402).json({ message: "Request timed out" });
  
      } else {
  
        return handleError(error, res);
      }
    })
}

// update-password ✓
exports.updatepassword = async(req, res) => {

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), timeout)
  );

  const updatepasswordLogic = new Promise(async (resolve, reject) => {
    try {
      await validateApiKey(req); // ตรวจสอบ API key

      const {forgotemailid, newPassword} = req.body;

      if(!forgotemailid){
        reject({ status: 402, message: "forgotemailid not required" });
      }

      if(!newPassword){
        reject({ status: 402, message: "newPassword not required" });
      }

      await db("forgotemail")
      .select("*")
      .where({ "forgotemailid": forgotemailid })
      .andWhere({ "status": true })
      .first()
      .then(async(forgotemail) => {
        console.log(forgotemail);
        if (!forgotemail) {
          reject({ status: 402, message: "forgot email not required" });
        }

        await db("userinfo")
        .update({
          uinfologinpass: newPassword,
        })
        .where({ "uinfoid": forgotemail.uinfoid });

        await db("forgotemail")
        .update({status: false , update_at: Math.floor(Date.now() / 1000)})
        .where({ "forgotemailid": forgotemailid });

        resolve({message: "Success" });
      })

    } catch (error) {
      reject(error);
    }

  });

    Promise.race([updatepasswordLogic, timeoutPromise])
    .then((result) => {

      res.send(result);

    })
    .catch((error) => {

      if (error.status) {

        return res.status(error.status).json({ message: error.message });
  
      } else if (error.message === "Request timed out") {
  
        return res.status(402).json({ message: "Request timed out" });
  
      } else {
  
        return handleError(error, res);
      }
    })

}

// Users Import
exports.usersImport = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const usersimportLogic = new Promise(async (resolve, reject) => {

        try {

            // Check API key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const { ugroupid, users } = req.body;

            if (!ugroupid) {
                return reject({ status: 402, message: "ugroupid is required" });
            }
            if (!users || !Array.isArray(users) || users.length === 0) {
                return reject({ status: 402, message: "users array is required and cannot be empty" });
            }

            const groupExists = await db("registergroupinfo")
                .where({ ugroupid: ugroupid, status: "active" }) // Check if group exists and is active
                .first(); // Get only one record or undefined

            if (!groupExists) {
                return reject({ status: 402, message: `Group with ugroupid ${ugroupid} not found` }); // Use 404 Not Found
            }

            const usersToInsert = [];
            const validationErrors = [];
            const nowTimestamp = Math.floor(Date.now() / 1000); // Get current timestamp in seconds

            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const userIndex = i + 1; // For user-friendly error messages

                // Basic validation for each user object
                if (!user.name) {
                    validationErrors.push(`User #${userIndex}: name is required.`);
                }
                if (!user.surname) {
                    validationErrors.push(`User #${userIndex}: surname is required.`);
                }
                if (!user.password) {
                    validationErrors.push(`User #${userIndex}: password is required.`);
                }
                if (!user.idcardnumber && !user.passportnumber) {
                    validationErrors.push(`User #${userIndex}: idcardnumber or passportnumber is required.`);
                }
                // Add more specific validations if needed (e.g., format checks)

                // If no validation errors for this user, prepare the object
                if (validationErrors.length === 0) {
                    usersToInsert.push({
                        id: uuid(), // Generate a unique ID for each user
                        routerid: user.routerid || "0", // Assuming routerid might be optional
                        ugroupid: ugroupid, // Assign the common group ID
                        visitortype: user.visitortype || "-", // Use provided or null
                        name: user.name,
                        surname: user.surname,
                        password: user.password,
                        idcardnumber: user.idcardnumber || null,
                        passportnumber: user.passportnumber || null,
                        phone: user.phone || null,
                        create_at: nowTimestamp,
                        update_at: nowTimestamp, // Set update_at on creation as well
                        // lastactivedate: nowTimestamp, // Assume user is active upon import
                        status: "active" // Default status
                    });
                }
            }

            // If there were any validation errors during the loop, reject the whole batch
            if (validationErrors.length > 0) {
                return reject({ status: 402, message: "Validation failed for some users.", errors: validationErrors });
            }

            // 4. Perform Bulk Insert if there are users to insert
            if (usersToInsert.length > 0) {
                await db("registerinfo").insert(usersToInsert);
                resolve({
                    message: `Imported ${usersToInsert.length} users successfully.`,
                    importedCount: usersToInsert.length
                });
            } else {
                // This case should ideally not be reached if input validation is correct
                 resolve({ message: "No valid users found in the input to import.", importedCount: 0 });
            }


        } catch (error) {
            // Handle potential database errors (e.g., constraint violations)
            if (error.code) { // Check if it's a database error object
                console.error("Database Error during user import:", error);
                reject({ status: 500, message: `Database error during import: ${error.message || error.detail || 'Unknown DB error'}` });
            } else {
                // Handle other errors (like unexpected issues)
                reject(error); // Pass the original error object
            }
        }
    });

    Promise.race([usersimportLogic, timeoutPromise])
        .then(async(result) => {

            
            const querygroupname = await db("registergroupinfo").select("groupname").where({ ugroupid: req.body.ugroupid }).first();
            // console.log(groupname);

            // Log only on successful import
            if (result.importedCount > 0) {
                 await eventlog(req, `นำเข้าข้อมูลผู้ใช้จำนวน ${result.importedCount} รายการ สำหรับกลุ่มผู้ใช้ ${querygroupname.groupname}`); // เก็บ eventlog
            }
            res.status(200).json(result);
        })
        .catch((error) => {
            if (error.status) {
                // Include validation errors in the response if available
                const responseBody = { message: error.message };
                if (error.errors) {
                    responseBody.errors = error.errors;
                }
                res.status(error.status).json(responseBody);
            } else if (error.message === "Request timed out") {
                res.status(408).json({ message: "Request timed out" }); // Use 408 Request Timeout
            } else {
                handleError(error, res); // Use generic error handler
            }
        });


};

// Users List All
exports.userslistAll = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const userslistAllLogic = new Promise(async (resolve, reject) => {

        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const search = req.query.search || '';
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 100;
            const offset = (page - 1) * limit;

            const userslistall = await db("registerinfo")
                .select(
                    "registerinfo.id",
                    "registerinfo.routerid",
                    "registerinfo.ugroupid",
                    "registergroupinfo.groupname",
                    "registerinfo.name",
                    "registerinfo.surname",
                    "registerinfo.user",
                    "registerinfo.password",
                    "registerinfo.idcardnumber",
                    "registerinfo.passportnumber",
                    "registerinfo.phone",
                    "registerinfo.visitortype",
                    "registerinfo.create_at",
                    "registerinfo.status",
                    "registerinfo.expiredate",
                    "registergroupinfo.duration",
                    )
                .join("registergroupinfo", "registerinfo.ugroupid", "registergroupinfo.ugroupid")
                .where({"registerinfo.status":"active"})
                .andWhere(function() { // ใช้ andWhere เพื่อเพิ่มเงื่อนไข และใช้ function เพื่อจัดกลุ่ม OR
                    // เงื่อนไขภายในกลุ่มนี้จะเป็น OR ต่อกัน
                    this.where("registerinfo.name", "like", `%${search}%`)
                        .orWhere("registerinfo.surname", "like", `%${search}%`)
                        .orWhere("registerinfo.idcardnumber", "like", `%${search}%`)
                        .orWhere("registerinfo.passportnumber", "like", `%${search}%`)
                        .orWhere("registerinfo.phone", "like", `%${search}%`)
                        .orWhere("registergroupinfo.groupname", "like", `%${search}%`);
                })
                .orderBy("registerinfo.create_at", "desc")
                // .limit(limit)
                .offset(offset);

            const resultusers = userslistall.map((user) => {

                const seconds = user.duration;

                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);

                // Format to two digits with leading zero if needed
                const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

                // console.log(timeString); // Output: '02:00'

                return {
                    id: user.id,
                    routerid: user.routerid,
                    ugroupid: user.ugroupid,
                    groupname: user.groupname,
                    name: user.name,
                    surname: user.surname,
                    user: user.user,
                    password: user.password,
                    idcardnumber: user.idcardnumber,
                    passportnumber: user.passportnumber,
                    phone: user.phone,
                    visitortype: user.visitortype,
                    create_at: date.format(new Date(user.create_at*1000), "YYYY-MM-DD HH:mm"),
                    expirationdate: date.format(new Date(user.expiredate*1000), "YYYY-MM-DD"),
                    duration: timeString
                }
            })

            // console.log(resultusers);

            resolve({
                total: resultusers.length,
                // page,
                // limit,
                // offset,
                result: resultusers
            });

        }
        catch (error) {
            reject(error);
        }
    });

    Promise.race([userslistAllLogic, timeoutPromise])
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
            await checkAuthorizetion(req);

            const {
                // routerid,
                ugroupid,
                visitortype,
                // Username,
                name,
                surname,
                password,
                idcardnumber,
                passportnumber,
                phone,
                expiredate
            } = req.body;

            var Username = await createUniqueIdUesr();

            let phoneNumber = "+66" + phone.slice(1, 10);

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

            //### Cisco สร้าง User

            //ขอ Portal ID
            // await axios.get(`https://${process.env.CISCO_IP}:${process.env.CISCO_POST}/ers/config/sponsorportal`,{}, AuthCisco)
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
                .then(async(Usesresponse) => {
                    
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


                    // const currentDate = new Date();
                    // currentDate.setDate(currentDate.getDate() + 1);

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
                        message: `CISCO error: ${ciscoErrorTitle} - ${error.message}` 
                    });
                })

            // }).catch((error) => {
            //     return reject({status: 402, message: `CISCO error : ${error.message}` });
            // })

            

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

        await eventlog(req,"เพิ่มรายการผู้เข้าใช้งานใหม่"); // เก็บ eventlog

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

// Users update ✅
exports.usersupdate = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const usersupdateLogic = new Promise(async (resolve, reject) =>{

        try {
            
            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const { 
                id, 
                // routerid, 
                ugroupid, 
                Username,
                name, 
                surname, 
                password, 
                idcardnumber, 
                passportnumber, 
                phone,
                visitortype, 
                expiredate

            } = req.body;

            // console.log(req.body);

            let phoneNumber = "+66" + phone.slice(1, 10);

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

            // Cisco แก้ไข User
            await db("registerinfo")
            .select("id", "routerid", "ugroupid")
            .where({ id: id })
            // .first()
            .then( async(rows) => {

                if (!rows[0] || rows[0] === undefined) {
                    return reject({ status: 402, message: "User not found." });
                }

                // console.log(rows);

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

                await axios.put(`https://${process.env.CISCO_IP}:${process.env.CISCO_POST}/ers/config/guestuser/${rows[0].routerid}`, CiscoUserBody,AuthCisco)
                .then((response) => {
                    console.log(response.data);
                })
                .catch((error) => {
                    return reject({status: 402, message: `CISCO error : ${error.message}` });
                });
            });
            

            await db("registerinfo").where({ id }).then((rows) => {
                if (rows.length === 0) {
                    return reject({ status: 402, message: "User not found." });
                }
            });

            // if (routerid) {
            //     await db("registerinfo").where({ id }).update({ routerid });
            // }

            if (ugroupid) {
                await db("registerinfo").where({ id }).update({ ugroupid });
            }

            if (name) {
                await db("registerinfo").where({ id }).update({ name });
            }

            if (surname) {
                await db("registerinfo").where({ id }).update({ surname });
            }

            if (password) {
                await db("registerinfo").where({ id }).update({ password });
            }

            if (idcardnumber) {
                await db("registerinfo").where({ id }).update({ idcardnumber });
            }

            if (passportnumber) {
                await db("registerinfo").where({ id }).update({ passportnumber });
            }

            if (phone) {
                await db("registerinfo").where({ id }).update({ phone });
            }

            if (visitortype) {
                await db("registerinfo").where({ id }).update({ visitortype });
            }

            if (expiredate) {

                if (expiredate === null || isNaN(Date.parse(`${expiredate} 00:00`))) {
                    return reject({ status: 402, message: "expiredate not required or expiredate format Invalid" });
                }

                await db("registerinfo").where({ id })
                .update({ 
                    expiredate: new Date(`${expiredate} 23:59`).getTime() / 1000 
                });
            }

            await db("registerinfo").where({ id }).update({ update_at: Date.parse(new Date())/1000 });

            return resolve({message: "Users Update successful"});
        } catch (error) {
            reject(error);
        }
    })

    Promise.race([usersupdateLogic, timeoutPromise])
        .then(async(result) => {

            await eventlog(req,"แก้ไขรายการผู้เข้าใช้งาน"); // เก็บ eventlog

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

// Users delete ✅
exports.usersdelete = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const usersdeleteLogic = new Promise(async (resolve, reject) => {
        try {
            
            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const { id } = req.body;

            await db("registerinfo")
            .select("id", "routerid", "ugroupid")
            .where({ id })
            .first()
            .then( async(rows) => {

                if (!rows || rows === undefined) {
                    return reject({ status: 402, message: "User not found." });
                }

                await axios.delete(`https://${process.env.CISCO_IP}:${process.env.CISCO_POST}/ers/config/guestuser/${rows.routerid}`,AuthCisco)
                .then((response) => {
                    console.log(response.data);
                })
                .catch((error) => {
                    return reject({status: 402, message: `CISCO error : ${error.message}` });
                })

            });

            await db("registerinfo")
              .select("id")
              .where({ id })
              .then((rows) => {
                if (rows.length === 0) {
                  return reject({ status: 402, message: "User not found." });
                }
              });

            await db("registerinfo").where({ id })
                .update({ 
                    status: "inactive" ,
                    update_at: Date.parse(new Date())/1000
                });

            resolve({ message: "User Delete successful" });
        } catch (error) {
            reject(error);
        }
    });

    Promise.race([usersdeleteLogic, timeoutPromise])
        .then(async(result) => {

            await eventlog(req,"ลบรายการผู้เข้าใช้งาน"); // เก็บ eventlog
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

// Users List All
exports.groupuserslistAll = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const groupuserslistAllLogic = new Promise(async (resolve, reject) => {

        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const search = req.query.search || '';
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 100;
            const offset = (page - 1) * limit;

            const groupuserslistall = await db("registergroupinfo")
                .select("*")
                .where("status", "=", "active")
                .andWhere(function () {
                    this.where("groupname", "like", `%${search}%`)

                })
                // .limit(limit)
                .offset(offset)
                .orderBy("create_at", "desc")

            const resultgroupusers = groupuserslistall.map((groupuserslistall) => {

                const seconds = groupuserslistall.duration;

                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);

                // Format to two digits with leading zero if needed
                const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

                // console.log(timeString); // Output: '02:00'

                return {
                    ugroupid: groupuserslistall.ugroupid,
                    groupname: groupuserslistall.groupname,
                    // remark: groupuserslistall.remark,
                    duration: timeString,
                    create_at: date.format(new Date(groupuserslistall.create_at*1000), "YYYY-MM-DD HH:mm"),
                }
            })

            resolve({
                total: resultgroupusers.length,
                result: resultgroupusers
            });
            

        }
        catch (error) {
            reject(error);
        }
    });

    Promise.race([groupuserslistAllLogic, timeoutPromise])
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

// GroupUsers add ✅
exports.groupuserscreate = async (req, res) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), timeout)
  );

  const usersgroupusersaddLogic = new Promise(async (resolve, reject) => {
    try {
      // check api key
      await validateApiKey(req);

      // ยีนยันตัวตนการเข้าสู่ระบบ
      await checkAuthorizetion(req);

      const { groupname, remark, duration } = req.body;

      if (!groupname) {
        return reject({ status: 402, message: "groupname not required" });
      }

      if (!duration === undefined || isNaN(Date.parse(`2000-01-01 ${duration}`))) {
        return reject({
          status: 402,
          message: "duration not required or duration format Invalid",
        });
      }

    //   const timeString = "02:00";
    //   const [hours, minutes] = timeString.split(":").map(Number);
    //   const totalSeconds = hours * 3600 + minutes * 60;
      const [hours, minutes] = duration.split(":").map(Number);
      const totalSeconds = hours * 3600 + minutes * 60;

    //   console.log(totalSeconds); // Output: 7200(12 hours in seconds)

      await db("registergroupinfo").insert({
        ugroupid: uuid(),
        groupname,
        remark: remark || "-",
        duration: totalSeconds,
      });

      //   console.log(Date.parse(expirationdate));

      resolve({ message: "GroupUsers Add successful" });
    } catch (error) {
      reject(error);
    }
  });

  Promise.race([usersgroupusersaddLogic, timeoutPromise])
    .then(async (result) => {
      await eventlog(req, "เพิ่มรายการกลุ่มผู้เข้าใช้งาน"); // เก็บ eventlog

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

// GroupUsers update ✅
exports.groupusersupdate = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const groupusersupdateLogic = new Promise(async (resolve, reject) => {
        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            // *** Assuming ugroupid identifies the group *row* to update within the 'users' table ***
            const { ugroupid } = req.body; // Get group ID from URL parameters
            const {
                groupname,
                remark,
                duration, // Expecting a string parseable by new Date()
            } = req.body;

            if (!ugroupid) {
                return reject({ status: 402, message: "ugroupid not required" });
            }

            if (!duration === undefined || isNaN(Date.parse(`2000-01-01 ${duration}`))) {
                return reject({
                status: 402,
                message: "duration not required or duration format Invalid",
                });
            }

            await db("registergroupinfo").where({ ugroupid }).then((rows) => {
                if (rows.length === 0) {
                    return reject({ status: 402, message: "GroupUser not found." });
                }
            });

            const updateData = {};

            if (groupname !== undefined) updateData.groupname = groupname;

            if (remark !== undefined) updateData.remark = remark;

            if (duration !== undefined) {

                const [hours, minutes] = duration.split(":").map(Number);
                const totalSeconds = hours * 3600 + minutes * 60;

                updateData.duration = totalSeconds;
            }

            updateData.update_at = Date.parse(new Date())/1000;
            
            // *** SCHEMA WARNING *** : Updating a row in 'users' table assumed to be a group definition.
            await db("registergroupinfo")
                .where({ ugroupid: ugroupid }) // Target the group row by its ugroupid
                .update(updateData);

            resolve({ message: "GroupUser update successful"});

        } catch (error) {
             if (error.code === '23505') { // Example: PostgreSQL unique violation code for groupname if unique constraint exists
                reject({ status: 402, message: "Update failed: Another group with this name might already exist." }); // 409 Conflict
            } else {
                reject(error); // Pass other errors to the generic handler
            }
        }
    });

    Promise.race([groupusersupdateLogic, timeoutPromise])
        .then(async(result) => {

            await eventlog(req,"แก้ไขรายการกลุ่มผู้เข้าใช้งาน"); // เก็บ eventlog
            res.status(200).json(result);
        })
        .catch((error) => {
            if (error.status) {
                res.status(error.status).json({ message: error.message });
            } else if (error.message === "Request timed out") {
                res.status(402).json({ message: "Request timed out" }); // Use 408
            } else {
                handleError(error, res);
            }
        });
}


// GroupUsers delete (Soft Delete) ✅
exports.groupusersdelete = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const groupusersdeleteLogic = new Promise(async (resolve, reject) => {
        try {
            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            // *** Assuming ugroupid identifies the group *row* to delete within the 'users' table ***
            const { ugroupid } = req.body; // Get group ID from URL parameters

            if (!ugroupid) {
                return reject({ status: 402, message: "ugroupid not required" });
            }

            await db("registergroupinfo").where({ ugroupid }).then((rows) => {
                if (rows.length === 0) {
                    return reject({ status: 402, message: "GroupUser not found." });
                }
            });

            // *** SCHEMA WARNING *** : Soft-deleting a row in 'users' table assumed to be a group definition.
            await db("registergroupinfo")
                .where({ ugroupid: ugroupid }) // Target the group row by its ugroupid
                .update({
                    status: "inactive",
                    update_at: Date.parse(new Date())/1000,
                 });



            resolve({ message: "GroupUser deleted successfully" });
        } catch (error) {
            reject(error);
        }
    });

    Promise.race([groupusersdeleteLogic, timeoutPromise])
        .then(async(result) => {

            await eventlog(req, "ลบรายการกลุ่มผู้เข้าใช้งาน"); // เก็บ eventlog

            res.status(200).json(result); // 200 OK is suitable
        })
        .catch((error) => {
            if (error.status) {
                res.status(error.status).json({ message: error.message });
            } else if (error.message === "Request timed out") {
                res.status(402).json({ message: "Request timed out" }); // Use 408
            } else {
                handleError(error, res);
            }
        });
}
