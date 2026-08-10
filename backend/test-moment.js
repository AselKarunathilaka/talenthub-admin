const moment = require('moment'); 
const startStr = 'Jul 29'; 
const endStr = 'Aug 02'; 
const year = 2026; 
let startDate = moment(`${startStr} ${year}`, 'MMM DD YYYY'); 
let endDate = moment(`${endStr} ${year}`, 'MMM DD YYYY'); 
console.log(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));
