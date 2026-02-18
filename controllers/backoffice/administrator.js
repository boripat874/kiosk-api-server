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
    eventlog,
    checkAuthorizetion
} = require("../../modules/fun");

require("dotenv").config();

const timeout = 60000; // Timeout in milliseconds (e.g., 60 seconds)

// administrator list all
exports.administratorlistAll = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const administratorlistAllLogic = new Promise(async (resolve, reject) => {

        try {
          // check api key
          await validateApiKey(req);

          // ยีนยันตัวตนการเข้าสู่ระบบ
          await checkAuthorizetion(req);

          const search = req.query.search || "";
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 10;
          const offset = (page - 1) * limit;

          const administratorlistall = await db("userinfo")
            .select("*")
            .where("status", "=", "active")
            .andWhere(function () {
              this.where("name", "like", `%${search}%`)
                .orWhere("username", "like", `%${search}%`)
                .orWhere("level", "like", `%${search}%`);
            })
            // .limit(limit)
            .offset(offset)
            .orderBy("create_at", "desc");

          const resultadminstrator = administratorlistall.map(
            (administratorlistall) => ({
              userid: administratorlistall.userid,
              name: administratorlistall.name,
              username: administratorlistall.username,
              password: administratorlistall.password,
              level: administratorlistall.level,
              create_at: date.format(
                new Date(administratorlistall.create_at * 1000),
                "YYYY-MM-DD HH:mm"
              ),
            })
          );

          resolve({
            total: resultadminstrator.length,
            result: resultadminstrator,
          });
        }
        catch (error) {
            reject(error);
        }
    });

    Promise.race([administratorlistAllLogic, timeoutPromise])    
        .then((result) => {
            res.status(200).json(result);
        })
        .catch((error) => {
            res.status(500).json({ error: error.message });
        });
}

// administrator add ✅
exports.administratorcreate = async (req, res) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), timeout)
  );

  const administratoraddLogic = new Promise(async (resolve, reject) => {
    try {

      // check api key
      await validateApiKey(req);

      // ยีนยันตัวตนการเข้าสู่ระบบ
      await checkAuthorizetion(req);

      const { name, username, password, level, remark } = req.body;

      if (!username) {
        reject({ status: 402, message: "username not required" });
      }
      if (!password) {
        reject({ status: 402, message: "password not required" });
      }
      if (!level) {
        reject({ status: 402, message: "level not required" });
      }

      await db("userinfo").insert({
        userid: uuid(),
        name,
        username,
        password,
        level,
        // remark,
      });

      resolve({ message: "Administrator Add successful" });
    } catch (error) {
      reject(error);
    }
  });

  Promise.race([administratoraddLogic, timeoutPromise])
    .then(async (result) => {

      await eventlog(req, "เพิ่มรายการ Administrator ใหม่"); // เก็บ eventlog

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

// administrator update ✅
exports.administratorupdate = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const administratorupdateLogic = new Promise(async (resolve, reject) => {
        try {
            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const {
                userid,
                name,
                username,
                password,
                level,
                // remark
            } = req.body;

            await db("userinfo").where({ userid }).then((rows) => {
                if (rows.length === 0) {
                    return reject({ status: 402, message: "Administrator not found." });
                }
            });

            if (name) {
                await db("userinfo").where({ userid }).update({ name });
            }

            if (username) {
                await db("userinfo").where({ userid }).update({ username });
            }

            if (password) {
                await db("userinfo").where({ userid }).update({ password });
            }

            if (level) {
                await db("userinfo").where({ userid }).update({ level });
            }

            await db("userinfo")
              .where({ userid:req.body.userid })
              .update({
                update_at: Date.parse(new Date())/1000
              });
            // if (remark) {
            //     await db("userinfo").where({ userid }).update({ remark });
            // }

            resolve({ message: "Administrator Update successful" });
        } catch (error) {
            reject(error);
        }
        });

    Promise.race([administratorupdateLogic, timeoutPromise])
        .then(async(result) => {

            await eventlog(req,"แก้ไขรายการ Administrator"); // เก็บ eventlog

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

// administrator delete ✅
exports.administratordelete = async (req, res) => {

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const administratordeleteLogic = new Promise(async (resolve, reject) => {
        try {
            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const { userid } = req.body;

            await db("userinfo").where({ userid }).then((rows) => {
                if (rows.length === 0) {
                    return reject({ status: 402, message: "Administrator not found." });
                }
            });

            // *** SCHEMA WARNING *** : Soft-deleting a row in 'users' table assumed to be a group definition.
            await db("userinfo").where({ userid })
              .update({ 
                status: "inactive" ,
                update_at: Date.parse(new Date())/1000
              });

            resolve({ message: "Administrator Delete successful" });
        } catch (error) {
            reject(error);
        }
    });

    Promise.race([administratordeleteLogic, timeoutPromise])
        .then(async(result) => {

            await eventlog(req,"ลบรายการ Administrator"); // เก็บ eventlog

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


