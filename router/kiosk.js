const express = require("express")
const router = express.Router()

const users = require("../controllers/kiosk/users");

// users
router.post("/userscreate", users.userscreate);
router.post("/userget", users.userget);
router.get("/kioskspecifications", users.kioskspecifications);
// router.put("/kiosk/usersupdate", users.usersupdate);

module.exports = router