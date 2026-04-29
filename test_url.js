const scdl = require('soundcloud-downloader').default;
async function test() {
  try {
    const url = 'https://soundcloud.com/octobersveryown/drake-0-to-100';
    const client_id = await scdl.getClientID();
    const info = await scdl.getInfo(url);
    const progressive = info.media.transcodings.find(t => t.format.protocol === 'progressive');
    if (progressive) {
      const res = await scdl.axios.get(progressive.url + '?client_id=' + client_id);
      console.log("Direct URL:", res.data.url.substring(0, 50));
    } else {
      console.log("No progressive format");
    }
  } catch(e) { console.error(e); }
}
test();
