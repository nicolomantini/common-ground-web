const assert = require('node:assert/strict');
const {httpsURL,videoEmbed} = require('../js/journal-common.js');
for(const value of ['javascript:alert(1)','data:text/html,test','http://example.com','https://user:pass@example.com','not a url']) assert.equal(httpsURL(value),null);
assert.equal(httpsURL('https://example.com/a'), 'https://example.com/a');
for(const value of ['https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ','https://evil.example/dQw4w9WgXcQ','https://youtube.com/watch?v=<script>','https://youtu.be/dQw4w9WgXcQ/evil']) assert.equal(videoEmbed(value),null);
for(const value of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30','https://youtu.be/dQw4w9WgXcQ?si=test','https://youtube.com/shorts/dQw4w9WgXcQ']) assert.equal(videoEmbed(value),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
console.log('Journal URL and video validation passed.');
