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
                reject({ status: 402, message: `Database error during import: ${error.message || error.detail || 'Unknown DB error'}` });
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
                res.status(402).json({ message: "Request timed out" }); // Use 408 Request Timeout
            } else {
                handleError(error, res); // Use generic error handler
            }
        });


};

// User Export
exports.userExport = (req, res) => {
    
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const userExportLogic = new Promise(async (resolve, reject) => {

        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const { ugroupid } = req.body;

            if (!ugroupid) {
                return reject({ status: 402, message: "ugroupid is required" });
            }

            const users = await db("registerinfo").select("*");

            if (!users || users.length === 0) {
                return reject({ status: 404, message: "No users found for the specified group." });
            }
 
            const usersToExport = users.map(user => ({
                id: user.id,
                routerid: user.routerid,
                ugroupid: user.ugroupid,
                visitortype: user.visitortype,
                name: user.name,
                surname: user.surname,
                password: user.password,
                idcardnumber: user.idcardnumber || null,
                passportnumber: user.passportnumber || null,
                phone: user.phone || null,
                expiredate: date.format(new Date(user.expiredate*1000), "YYYY-MM-DD")
                // Include other relevant fields
            }));

            resolve({ 
                total: usersToExport.length,
                result: usersToExport
            });

        } catch (error) {
            // Handle potential errors
            if (error.status) {
                reject(error);
            } else {
                reject({ status: 500, message: "Internal server error" });
            }
        }
    });

    Promise.race([userExportLogic, timeoutPromise])
        .then(result => {
            // Handle successful export
            res.status(200).json(result);
        })
        .catch(error => {
            if (error.status) {
                // Include validation errors in the response if available
                const responseBody = { message: error.message };
                if (error.errors) {
                    responseBody.errors = error.errors;
                }
                res.status(error.status).json(responseBody);
            } else if (error.message === "Request timed out") {
                res.status(402).json({ message: "Request timed out" }); // Use 408 Request Timeout
            } else {
                handleError(error, res); // Use generic error handler
            }
        });
};

// Adminstrator Import
exports.administratorImport = async (req, res) => {


    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const administratorImportLogic = new Promise(async (resolve, reject) => {

        try {

            // Check API key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const { administrators } = req.body;

            if (!administrators || !Array.isArray(administrators) || administrators.length === 0) {
                return reject({ status: 402, message: "administrators array is required and cannot be empty" });
            }

            const administratorsToInsert = [];
            const validationErrors = [];
            const nowTimestamp = Math.floor(Date.now() / 1000); // Get current timestamp in seconds

            for (let i = 0; i < administrators.length; i++) {
                const admin = administrators[i];
                const adminIndex = i + 1; // For user-friendly error messages

                if (!admin.name) {
                    validationErrors.push(`Administrator #${adminIndex}: name is required.`);
                }

                if (!admin.username) {
                    validationErrors.push(`Administrator #${adminIndex}: username is required.`);
                }

                if (!admin.password) {
                    validationErrors.push(`Administrator #${adminIndex}: password is required.`);
                }

                if (!admin.status) {
                    validationErrors.push(`Administrator #${adminIndex}: status is required.`);
                }

                if (!admin.level) {
                    validationErrors.push(`Administrator #${adminIndex}: level is required.`);
                }


                // If no validation errors for this admin, prepare the object
                if (validationErrors.length === 0) {

                    administratorsToInsert.push({
                        id: uuid(), // Generate a unique ID for each admin
                        name: admin.name,
                        username: admin.username,
                        password: admin.password,
                        remark: admin.remark,
                        status: admin.status,
                        level: admin.level,
                    });
                }
            }

            // If there were any validation errors during the loop, reject the whole batch
            if (validationErrors.length > 0) {
                return reject({ status: 402, message: "Validation failed for some administrators.", errors: validationErrors });
            }

            // 4. Perform Bulk Insert if there are administrators to insert
            if (administratorsToInsert.length > 0) {
                await db("userinfo").insert(administratorsToInsert);

                resolve({
                    message: `Imported ${administratorsToInsert.length} administrators successfully.`,
                    importedCount: administratorsToInsert.length
                });

            } else {

                // This case should ideally not be reached if input validation is correct
                resolve({ 
                    message: "No valid administrators found in the input to import.",
                    importedCount: 0
                });
            }


        } catch (error) {

            // Handle potential database errors (e.g., constraint violations)
            if (error.code) { // Check if it's a database error object
                console.error("Database Error during administrator import:", error);
                reject({ status: 402, message: `Database error during import: ${error.message || error.detail || 'Unknown DB error'}` });
            } else {
                // Handle other errors (like unexpected issues)
                reject(error); // Pass the original error object
            }
        }
    });

    Promise.race([administratorImportLogic, timeoutPromise])

        .then(async(result) => {

            // Log only on successful import
            if (result.importedCount > 0) {
                await eventlog(req, `นำเข้าข้อมูลผู้ดูแลระบบจำนวน ${result.importedCount} รายการ`); // เก็บ eventlog
            }

            res.status(200).send(result);
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
                res.status(402).json({ message: "Request timed out" }); // Use 408 Request Timeout
            } else {
                handleError(error, res); // Use generic error handler
            }
        });
};

// Administrator Export
exports.administratorExport = (req, res) => {

    // Implementation for exporting administrator data
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
    );

    const administratorExportLogic = new Promise(async (resolve, reject) => {

        try {

            // check api key
            await validateApiKey(req);

            // ยีนยันตัวตนการเข้าสู่ระบบ
            await checkAuthorizetion(req);

            const administrators = await db("userinfo").select("*");

            if (!administrators || administrators.length === 0) {
                return reject({ status: 402, message: "No administrators found." });
            }

            const administratorsToExport = administrators.map(admin => ({
                id: admin.id,
                name: admin.name,
                username: admin.username,
                password: admin.password,
                remark: admin.remark,
                status: admin.status,
                level: admin.level
            }));

            resolve({
                total: administratorsToExport.length,
                result: administratorsToExport
            });

        } catch (error) {
            // Handle potential errors
            if (error.status) {
                reject(error);
            } else {
                reject({ status: 500, message: "Internal server error" });
            }
        }
    })

    Promise.race([administratorExportLogic, timeoutPromise])

        .then((result) => {

            res.status(200).send(result);

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
                res.status(402).json({ message: "Request timed out" });
            } else {
                handleError(error, res);
            }
        });
};
