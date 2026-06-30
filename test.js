const date = require("date-and-time");
// console.log(Math.floor(Date.now() / 1000));
let durationTime = 14400;

const durationInMilliseconds = durationTime * 1000;

const futureDate = date.format(new Date(Date.now() + durationInMilliseconds), "MM/DD/YYYY HH:mm");

console.log(futureDate);