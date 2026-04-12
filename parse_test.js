const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('wiki.html', 'utf8');
const $ = cheerio.load(html);

const validTeamsList = [
    "Chennai Super Kings", "Delhi Capitals", "Gujarat Titans", 
    "Kolkata Knight Riders", "Lucknow Super Giants", "Mumbai Indians", 
    "Punjab Kings", "Rajasthan Royals", "Royal Challengers Bengaluru", "Sunrisers Hyderabad"
];

let matches = [];
$('table').each((index, element) => {
    const text = $(element).text().replace(/\s+/g, ' ');
    // Match boxes usually have "won by" or "No result"
    if (text.includes('won by') || text.includes('No result') || text.includes('abandoned')) {
        // Also must contain at least two valid teams
        let matchTeams = validTeamsList.filter(t => text.includes(t));
        if (matchTeams.length >= 2) {
             // Let's print out the first one to see its structure
             if(matches.length === 0) {
                 console.log("Found match container:", text.substring(0, 150));
             }
             matches.push(text.substring(0, 50));
        }
    }
});
console.log("Total matched tables:", matches.length);
