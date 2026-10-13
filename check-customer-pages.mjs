import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:8790';
for (const route of ['/account/login', '/account/register', '/account', '/account/forgot', '/account/reset', '/account/confirm']) {
  const response = await fetch(origin + route);
  assert.equal(response.status, 200, route);
  assert.match(await response.text(), /account\.js/, route);
  console.log(`${route} OK`);
}
const home = await fetch(`${origin}/?demo=1`);
assert.match(await home.text(), /id="account-link"/);
const session = await fetch(`${origin}/api/auth/me`);
assert.equal(session.status, 200);
assert.deepEqual(await session.json(), {user: null});
console.log('Header account link and anonymous session OK');
