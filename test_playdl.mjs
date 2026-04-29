import play from 'play-dl';

async function test() {
  try {
    const clientId = await play.getFreeClientID();
    await play.setToken({
        soundcloud : {
            client_id : clientId
        }
    });
    const results = await play.search('Drake', { source: { soundcloud: 'tracks' }, limit: 1 });
    console.log('Search Results:', results.map(r => ({ name: r.name, url: r.url })));

    if (results.length > 0) {
      const stream = await play.stream(results[0].url);
      console.log('Stream Data URL:', stream.url);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
