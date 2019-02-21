const fs = require('fs');
const config = require('./src/app/config.development.json');
const spotifyClientid = process.env.SPOTIFYID;
const youtubeKey = process.env.YOUTUBE_API_KEY;

module.exports = () => {
    if (!spotifyClientid) throw new Error('Spotify Client ID not set in environment.');
    if (!youtubeKey) throw new Error('Youtube API Key not set in environment.')

    config.spotify.clientid = spotifyClientid;
    config.youtube.apikey = youtubeKey;

    fs.writeFileSync('./src/app/config.development.json', JSON.stringify(config));
}