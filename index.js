require('dotenv').config();

const express = require('express');
const axios = require('axios');

const app = express();

app.set('view engine', 'pug');
app.use(express.static(`${__dirname}/public`));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PRIVATE_APP_ACCESS = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
const CUSTOM_OBJECT_TYPE = process.env.HUBSPOT_CUSTOM_OBJECT_TYPE;
const PORT = process.env.PORT || 3000;
const CUSTOM_PROPERTIES = ['name', 'technology', 'summary'];

function getHubSpotConfig() {
    if (!PRIVATE_APP_ACCESS || !CUSTOM_OBJECT_TYPE) {
        throw new Error(
            'Add HUBSPOT_PRIVATE_APP_TOKEN and HUBSPOT_CUSTOM_OBJECT_TYPE to your .env file.'
        );
    }

    return {
        endpoint: `https://api.hubapi.com/crm/v3/objects/${CUSTOM_OBJECT_TYPE}`,
        headers: {
            Authorization: `Bearer ${PRIVATE_APP_ACCESS}`,
            'Content-Type': 'application/json'
        }
    };
}

function getErrorMessage(error) {
    return error.response?.data?.message || error.message || 'An unexpected error occurred.';
}

// Route 1: retrieve the custom object records and render the homepage table.
app.get('/', async (req, res) => {
    try {
        const { endpoint, headers } = getHubSpotConfig();
        const response = await axios.get(endpoint, {
            headers,
            params: {
                properties: CUSTOM_PROPERTIES.join(','),
                limit: 100,
                archived: false
            }
        });

        res.render('homepage', {
            title: 'Portfolio Projects | HubSpot APIs',
            data: response.data.results,
            created: req.query.created === '1'
        });
    } catch (error) {
        console.error('Unable to retrieve portfolio projects:', getErrorMessage(error));
        res.status(error.response?.status || 500).render('homepage', {
            title: 'Portfolio Projects | HubSpot APIs',
            data: [],
            error: getErrorMessage(error)
        });
    }
});

// Route 2: render the form used to create a new custom object record.
app.get('/update-cobj', (req, res) => {
    res.render('updates', {
        title: 'Update Custom Object Form | Integrating With HubSpot Practicum'
    });
});

// Route 3: create a record from the submitted form, then return to the homepage.
app.post('/update-cobj', async (req, res) => {
    const formData = {
        name: req.body.name?.trim(),
        technology: req.body.technology?.trim(),
        summary: req.body.summary?.trim()
    };

    if (Object.values(formData).some((value) => !value)) {
        return res.status(400).render('updates', {
            title: 'Update Custom Object Form | Integrating With HubSpot Practicum',
            error: 'Complete all three fields before submitting the form.',
            formData
        });
    }

    try {
        const { endpoint, headers } = getHubSpotConfig();
        await axios.post(endpoint, { properties: formData }, { headers });
        return res.redirect('/?created=1');
    } catch (error) {
        console.error('Unable to create a portfolio project:', getErrorMessage(error));
        return res.status(error.response?.status || 500).render('updates', {
            title: 'Update Custom Object Form | Integrating With HubSpot Practicum',
            error: getErrorMessage(error),
            formData
        });
    }
});

if (require.main === module) {
    app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
}

module.exports = app;
