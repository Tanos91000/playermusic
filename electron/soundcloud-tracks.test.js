const assert = require('node:assert/strict');
const test = require('node:test');

const { rankTracks, scoreTrack } = require('./soundcloud-tracks');

const t = (title, artist, playbackCount = 0, extra = {}) => ({
  title,
  artist,
  playbackCount,
  ...extra
});

test('rankTracks fait remonter la correspondance exacte du titre', () => {
  const tracks = [
    t('Meant To Be - Hardstyle Ultra Slowed Reverb Remix', 'someone', 900000),
    t('misery.', 'pupsies', 5000000),
    t('Meant To Be', 'prodArvee', 12000)
  ];
  const ranked = rankTracks(tracks, 'Meant To Be');
  assert.equal(ranked[0].title, 'Meant To Be');
});

test('rankTracks écarte les résultats qui ne couvrent pas la requête', () => {
  const tracks = [
    t('Totally Unrelated Banger', 'dj', 9000000),
    t('Nuit Blanche', 'artiste', 100)
  ];
  const ranked = rankTracks(tracks, 'Nuit Blanche');
  assert.equal(ranked[0].title, 'Nuit Blanche');
});

test('scoreTrack tient compte de l’artiste', () => {
  const withArtist = scoreTrack(t('Track', 'prodArvee', 1000), 'prodArvee');
  const withoutArtist = scoreTrack(t('Track', 'autre', 1000), 'prodArvee');
  assert.ok(withArtist > withoutArtist);
});

test('scoreTrack départage deux titres identiques par la popularité', () => {
  const popular = scoreTrack(t('Same Title', 'a', 5_000_000), 'Same Title');
  const obscure = scoreTrack(t('Same Title', 'b', 10), 'Same Title');
  assert.ok(popular > obscure);
});

test('la casse et les accents ne changent pas le classement', () => {
  const ranked = rankTracks([t('Autre chose', 'x'), t('ÉTÉ INDIEN', 'y')], 'ete indien');
  assert.equal(ranked[0].title, 'ÉTÉ INDIEN');
});
