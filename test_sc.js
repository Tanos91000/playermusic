const play = require('play-dl');

async function test() {
  try {
    const url = 'https://soundcloud.com/octobersveryown/drake-0-to-100';
    console.log("Fetching stream with play-dl...");
    const stream = await play.stream(url);
    console.log("Stream Type:", stream.type);
    console.log("Stream URL:", stream.url.substring(0, 100) + '...');
  } catch(e) {
    console.error(e);
  }
}
test();
