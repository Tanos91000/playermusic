const scdl = require('soundcloud-downloader').default;
console.log("Axios exists?", !!scdl.axios);
console.log("Interceptors?", !!scdl.axios?.interceptors);
