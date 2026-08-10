const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');

process.env.HUBSPOT_PRIVATE_APP_TOKEN = 'test-token';
process.env.HUBSPOT_CUSTOM_OBJECT_TYPE = '2-123456';

const axios = require('axios');
const app = require('../index');

let server;
let baseUrl;

before(async () => {
    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
});

test('GET / retrieves and renders custom-object records', async (t) => {
    const originalGet = axios.get;
    t.after(() => {
        axios.get = originalGet;
    });

    let request;
    axios.get = async (url, config) => {
        request = { url, config };
        return {
            data: {
                results: [
                    {
                        id: '101',
                        properties: {
                            name: 'SpaceX Launch Dashboard',
                            technology: 'Python and Flask',
                            summary: 'Tracks launches using a public REST API.'
                        }
                    }
                ]
            }
        };
    };

    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Portfolio Project Table/);
    assert.match(html, /SpaceX Launch Dashboard/);
    assert.equal(request.url, 'https://api.hubapi.com/crm/v3/objects/2-123456');
    assert.equal(request.config.params.properties, 'name,technology,summary');
    assert.equal(request.config.headers.Authorization, 'Bearer test-token');
});

test('GET /update-cobj renders the three-field form', async () => {
    const response = await fetch(`${baseUrl}/update-cobj`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Add a portfolio project/);
    assert.match(html, /name="name"/);
    assert.match(html, /name="technology"/);
    assert.match(html, /name="summary"/);
});

test('POST /update-cobj creates a record and redirects home', async (t) => {
    const originalPost = axios.post;
    t.after(() => {
        axios.post = originalPost;
    });

    let request;
    axios.post = async (url, body, config) => {
        request = { url, body, config };
        return { data: { id: '102' } };
    };

    const response = await fetch(`${baseUrl}/update-cobj`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            name: 'CRM Integration Demo',
            technology: 'Node.js and Express',
            summary: 'Creates and retrieves custom-object records.'
        })
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/?created=1');
    assert.deepEqual(request.body, {
        properties: {
            name: 'CRM Integration Demo',
            technology: 'Node.js and Express',
            summary: 'Creates and retrieves custom-object records.'
        }
    });
    assert.equal(request.config.headers.Authorization, 'Bearer test-token');
});

test('POST /update-cobj rejects an incomplete form', async () => {
    const response = await fetch(`${baseUrl}/update-cobj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            name: 'Incomplete project',
            technology: '',
            summary: ''
        })
    });
    const html = await response.text();

    assert.equal(response.status, 400);
    assert.match(html, /Complete all three fields/);
});
