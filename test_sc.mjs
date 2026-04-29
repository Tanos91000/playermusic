import SoundCloud from 'soundcloud-scraper';
const client = new SoundCloud.Client();

async function test() {
  try {
    const search = await client.search('Drake', 'track');
    if (!search.length) return console.log('No results found!');
    
    console.log('Search Results:', search[0]);
    const track = await client.getSongInfo(search[0].url);
    console.log('Stream URL:', track.streamURL);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
