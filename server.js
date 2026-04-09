const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());

// Serve production static files
app.use(express.static('dist'));

const PORT = process.env.PORT || 3000;

const mockMatches = [
    { team1: "Chennai Super Kings", team2: "Royal Challengers Bengaluru", winner: "Chennai Super Kings", status: "completed" },
    { team1: "Punjab Kings", team2: "Delhi Capitals", winner: "Punjab Kings", status: "completed" },
    { team1: "Kolkata Knight Riders", team2: "Sunrisers Hyderabad", winner: "Kolkata Knight Riders", status: "completed" },
    { team1: "Rajasthan Royals", team2: "Lucknow Super Giants", winner: "Rajasthan Royals", status: "completed" },
    { team1: "Gujarat Titans", team2: "Mumbai Indians", winner: "Gujarat Titans", status: "completed" },
    { team1: "Sunrisers Hyderabad", team2: "Rajasthan Royals", winner: "None", status: "no_result" }
];

app.get('/api/matches', async (req, res) => {
    try {
        // Wikipedia is the absolute best open source for scraping. 
        // It rarely throws 403 Forbidden on simple fetch requests unlike ESPN WAF.
        // We use the 2024 page here as a proxy for the latest active season to guarantee data parses.
        const url = 'https://en.wikipedia.org/wiki/2026_Indian_Premier_League';
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0'} });
        const $ = cheerio.load(response.data);
        
        let liveMatches = [];
        
        $('div[style*="clear:both"]').each((index, element) => {
            const tables = $(element).find('table');
            if (tables.length >= 3) {
                const t2 = $(tables[1]);
                let team1 = t2.find('td').eq(0).find('b a').text().trim();
                let team2 = t2.find('td').eq(2).find('b a').text().trim();
                
                const t3Text = $(tables[2]).text().replace(/\s+/g, ' ').trim();
                
                if (team1 && team2) {
                    if (t3Text.includes('won by')) {
                        const possibleWinner = t3Text.substring(0, t3Text.indexOf('won by')).trim();
                        const winner = [team1, team2].find(t => possibleWinner.includes(t)) || "None";
                        if (winner !== "None") {
                            liveMatches.push({ team1, team2, winner, status: 'completed' });
                        }
                    } else if (t3Text.includes('No result') || t3Text.includes('abandoned')) {
                         liveMatches.push({ team1, team2, winner: "None", status: 'no_result' });
                    }
                }
            }
        });

        // Filter valid teams
        const validTeamsList = [
            "Chennai Super Kings", "Delhi Capitals", "Gujarat Titans", 
            "Kolkata Knight Riders", "Lucknow Super Giants", "Mumbai Indians", 
            "Punjab Kings", "Rajasthan Royals", "Royal Challengers Bengaluru", "Sunrisers Hyderabad"
        ];
        
        liveMatches = liveMatches.filter(m => 
            validTeamsList.includes(m.team1) && validTeamsList.includes(m.team2)
        );

        if (liveMatches.length > 0) {
            console.log("Successfully scraped Wikipedia! Matches found:", liveMatches.length);
            // Reverse so latest matches are first
            return res.json({ source: 'live_wikipedia', matches: liveMatches.reverse().slice(0, 15) });
        } else {
            console.log("Wikipedia parsers missed, falling back to mock.");
            return res.json({ source: 'mock', matches: mockMatches });
        }

    } catch (error) {
        console.error("Live fetch failed:", error.message);
        res.json({ source: 'mock', matches: mockMatches });
    }
});

app.get('/api/teams', (req, res) => {
    res.json({
        teams: [
            "Chennai Super Kings", "Delhi Capitals", "Gujarat Titans", 
            "Kolkata Knight Riders", "Lucknow Super Giants", "Mumbai Indians", 
            "Punjab Kings", "Rajasthan Royals", "Royal Challengers Bengaluru", "Sunrisers Hyderabad"
        ]
    });
});

// Dynamic player endpoints removed for Stateless Architecture

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
