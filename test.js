// const date = require("date-and-time");
// // console.log(Math.floor(Date.now() / 1000));
// let durationTime = 14400;

// const durationInMilliseconds = durationTime * 1000;

// const futureDate = date.format(new Date(Date.now() + durationInMilliseconds), "MM/DD/YYYY HH:mm");

// console.log(futureDate);

let durationTime = 14520; // วินาที

// คำนวณชั่วโมงและนาที
const hours = Math.floor(durationTime / 3600);
const minutes = Math.floor((durationTime % 3600) / 60);

// จัดรูปแบบให้เป็น 00:00
const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

console.log(formattedTime); // ผลลัพธ์: "04:00"