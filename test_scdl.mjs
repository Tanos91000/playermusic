import scdl from 'soundcloud-downloader';

async function test() {
  try {
    const search = await scdl.default.search({ query: 'Drake', resourceType: 'tracks', limit: 1 });
    console.log('Search Results:', search.collection[0].title);
    
    const trackUrl = search.collection[0].permalink_url;
    console.log('Track URL:', trackUrl);

    const stream = await scdl.default.download(trackUrl);
    console.log('Stream obtained');
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
