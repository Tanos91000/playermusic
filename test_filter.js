const scdl = require('soundcloud-downloader').default;

async function test() {
  const searchResults = await scdl.search({
      query: 'Drake',
      resourceType: 'tracks',
      limit: 30
  });
  console.log("Total found:", searchResults.collection.length);
  const filtered = searchResults.collection.filter(track => track.policy !== 'BLOCK' && track.policy !== 'SNIP' && track.monetization_model !== 'GO_PLUS');
  console.log("After filter:", filtered.length);
  if (filtered.length === 0 && searchResults.collection.length > 0) {
      console.log("First item:", searchResults.collection[0].policy, searchResults.collection[0].monetization_model);
  }
}
test();
