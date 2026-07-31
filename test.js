// const date = require("date-and-time");
// // console.log(Math.floor(Date.now() / 1000));
// let durationTime = 14400;

// const durationInMilliseconds = durationTime * 1000;

// const futureDate = date.format(new Date(Date.now() + durationInMilliseconds), "MM/DD/YYYY HH:mm");

// console.log(futureDate);

// let durationTime = 14520; // วินาที

// // คำนวณชั่วโมงและนาที
// const hours = Math.floor(durationTime / 3600);
// const minutes = Math.floor((durationTime % 3600) / 60);

// // จัดรูปแบบให้เป็น 00:00
// const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

// console.log(formattedTime); // ผลลัพธ์: "04:00"

// const createdAt = new Date("2026-07-23T08:24:00.000Z"); // เวลาสมมติ
// const now = new Date(); // เวลาปัจจุบัน

// // 1. ลอง log ดูทีละตัว (จะเห็นเป็นข้อความเวลา)
// console.log("now:", now);
// console.log("createdAt:", createdAt);

// // 2. จับมาลบกันตรงๆ (จะออกมาเป็นตัวเลขมิลลิวินาที)
// const timeDifference = Math.floor((now - createdAt));
// console.log("เวลาที่ลบกันได้ (มิลลิวินาที):", timeDifference);

// // 3. แปลงเป็นวินาที (จะได้ตัวเลขวินาที)
// const seconds = Math.floor(timeDifference / 1000);
// console.log("แปลงเป็นวินาที:", seconds);

// // 4. แปลงเป็นชั่วโมงและนาที
// const hours = Math.floor(seconds / 3600);
// const minutes = Math.floor((seconds % 3600) / 60);
// console.log(`เวลาที่ผ่านไป: ${hours} ชั่วโมง ${minutes} นาที`);

// const durationInSeconds = 3600; // 1 ชั่วโมงในวินาที

// console.log("เวลาปัจจุบัน:",Math.floor(Date.now() / 1000));
// console.log("เวลาหลังจาก 1 ชั่วโมง:", new Date(Date.now() + durationInSeconds * 1000));
// console.log("เวลาหลังจาก 1 ชั่วโมง:", Math.floor(Date.now() / 1000 + durationInSeconds));

const duration = "01:00";

const [hours, minutes] = duration.split(":").map(Number);
    const totalSeconds = hours * 3600 + minutes * 60;

    console.log(crypto.randomUUID());
