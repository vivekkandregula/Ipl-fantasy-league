const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('wiki.html', 'utf8');
const $ = cheerio.load(html);

// Method 2: Scrape any TR that contains vs or v
let m2 = [];
$('tr').each((i, row) => {
    let text = $(row).text().replace(/\s+/g, ' ');
    if (text.includes('won by') && text.includes(' v ')) {
        m2.push(text.substring(0, 50));
    }
});
console.log("TR Match count:", m2.length);

// Method 3: Scrape '.vevent'
let vevents = $('.vevent').length;
console.log("vevent count:", vevents);

