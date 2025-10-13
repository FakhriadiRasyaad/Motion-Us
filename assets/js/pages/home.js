// Script khusus halaman Home: murni navigasi (tanpa charge token)
const $ = (s) => document.querySelector(s);

function gotoPhoto() { location.href = './MOTION-US/Photo.html'; }
function gotoVideo() { location.href = './MOTION-US/Video.html'; }

$('#btnPhoto')?.addEventListener('click', gotoPhoto);
$('#btnVideo')?.addEventListener('click', gotoVideo);
