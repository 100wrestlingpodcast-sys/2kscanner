const fs = require('fs');
const path = require('path');

const buffer = fs.readFileSync(path.join(process.cwd(), 'public', 'cropped_debug.jpg'));
console.log("First 20 bytes of cropped_debug.jpg:", buffer.slice(0, 20));
console.log("Is PNG:", buffer.slice(1, 4).toString() === 'PNG');
