const express = require("express")
const router = express.Router()

const users = require("../controllers/kiosk/users");

const rateLimit = require('express-rate-limit');

// กำหนดเงื่อนไข: 1 IP ยิง API สร้าง User ได้แค่ 1 ครั้ง ภายใน 3 วินาที
const createUserLimiter = rateLimit({
  windowMs: 3 * 1000, // 3 วินาที
  max: 1, // รับแค่ 1 Request
  message: { status: 429, message: "คุณทำรายการเร็วเกินไป กรุณารอสักครู่" },
  standardHeaders: true, 
  legacyHeaders: false,
});

// users
router.post("/userscreate", createUserLimiter , users.userscreate);
router.post("/userget", users.userget);
router.get("/kioskspecifications", users.kioskspecifications);
// router.put("/kiosk/usersupdate", users.usersupdate);

module.exports = router