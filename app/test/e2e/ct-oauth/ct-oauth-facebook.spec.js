const nock = require('nock');
const chai = require('chai');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserModel = require('plugins/sd-ct-oauth-plugin/models/user.model');
const { getTestAgent, closeTestAgent } = require('./../test-server');
const { setPluginSetting } = require('./../utils');

const should = chai.should();

let requester;

// https://github.com/mochajs/mocha/issues/2683
let skipTests = false;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('Facebook auth endpoint tests', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        // We need to force-start the server, to ensure mongo has plugin info we can manipulate in the next instruction
        await getTestAgent(true);

        await setPluginSetting('oauth', 'defaultApp', 'rw');
        await setPluginSetting('oauth', 'thirdParty.rw.facebook.active', true);

        if (!process.env.TEST_FACEBOOK_OAUTH2_APP_ID || !process.env.TEST_FACEBOOK_OAUTH2_APP_SECRET) {
            skipTests = true;
            await setPluginSetting('oauth', 'thirdParty.rw.facebook.clientID', 'TEST_FACEBOOK_OAUTH2_APP_ID');
            await setPluginSetting('oauth', 'thirdParty.rw.facebook.clientSecret', 'TEST_FACEBOOK_OAUTH2_APP_SECRET');
        } else {
            await setPluginSetting('oauth', 'thirdParty.rw.facebook.clientID', process.env.TEST_FACEBOOK_OAUTH2_APP_ID);
            await setPluginSetting('oauth', 'thirdParty.rw.facebook.clientSecret', process.env.TEST_FACEBOOK_OAUTH2_APP_SECRET);
        }

        requester = await getTestAgent(true);

        UserModel.deleteMany({}).exec();

        nock.cleanAll();
    });

    beforeEach(async () => {
        requester = await getTestAgent(true);
    });

    it('Visiting /auth/facebook while not being logged in should redirect to the login page', async () => {
        if (skipTests) {
            return;
        }

        const response = await requester
            .get(`/auth/facebook`)
            .send();

        response.status.should.equal(200);
        response.header['content-type'].should.equal('application/xhtml+xml; charset=utf-8');
        response.redirects.should.be.an('array').and.length(3);
        response.redirects[0].should.match(/^https:\/\/www\.facebook\.com\/dialog\/oauth/);
        response.redirects[1].should.match(/^https:\/\/m\.facebook\.com\/v2\.11\/dialog\/oauth/);
        response.redirects[2].should.match(/^https:\/\/m\.facebook\.com\/login\.php/);
    });

    it('Visiting /auth/facebook/callback ', async () => {
        if (skipTests) {
            return;
        }

        const missingUser = await UserModel.findOne({ email: 'john.doe@vizzuality.com' }).exec();
        should.not.exist(missingUser);

        nock('https://graph.facebook.com')
            .post('/oauth/access_token', {
                grant_type: 'authorization_code',
                redirect_uri: `${process.env.PUBLIC_URL}/auth/facebook/callback`,
                client_id: process.env.TEST_FACEBOOK_OAUTH2_APP_ID,
                client_secret: process.env.TEST_FACEBOOK_OAUTH2_APP_SECRET,
                code: 'TEST_FACEBOOK_OAUTH2_CALLBACK_CODE'
            })
            .reply(200, {
                access_token: 'facebook_access_token',
                token_type: 'bearer',
                expires_in: 5183974
            });


        nock('https://graph.facebook.com')
            .get('/v2.5/me')
            .query({
                fields: 'id,name,picture,email',
                access_token: 'facebook_access_token'
            })
            .reply(200, {
                id: '10216001184997572',
                name: 'John Doe',
                picture: {
                    data: {
                        height: 50,
                        is_silhouette: false,
                        url: 'https://images.pexels.com/photos/20787/pexels-photo.jpg?auto=compress&cs=tinysrgb&h=750&w=1260',
                        width: 50
                    }
                },
                email: 'john.doe@vizzuality.com'
            });


        await requester
            .get(`/auth`)
            .send();

        const response = await requester
            .get(`/auth/facebook/callback?code=TEST_FACEBOOK_OAUTH2_CALLBACK_CODE`)
            .send();

        response.status.should.equal(200);
        response.header['content-type'].should.equal('text/html; charset=utf-8');
        response.redirects.should.be.an('array').and.length(1);
        response.redirects[0].should.match(new RegExp(`\/auth\/success$`));

        const confirmedUser = await UserModel.findOne({ email: 'john.doe@vizzuality.com' }).exec();
        should.exist(confirmedUser);
        confirmedUser.should.have.property('email').and.equal('john.doe@vizzuality.com');
        confirmedUser.should.have.property('name').and.equal('John Doe');
        confirmedUser.should.have.property('photo').and.equal('https://images.pexels.com/photos/20787/pexels-photo.jpg?auto=compress&cs=tinysrgb&h=750&w=1260');
        confirmedUser.should.have.property('role').and.equal('USER');
        confirmedUser.should.have.property('provider').and.equal('facebook');
        confirmedUser.should.have.property('providerId').and.equal('10216001184997572');
    });

    it('Visiting /auth/facebook/token with a valid Facebook OAuth token should generate a new token', async () => {
        await new UserModel({
            name: 'John Doe',
            email: 'john.doe@vizzuality.com',
            role: 'USER',
            provider: 'facebook',
            providerId: '10216001184997572',
            photo: 'https://images.pexels.com/photos/20787/pexels-photo.jpg?auto=compress&cs=tinysrgb&h=750&w=1260'
        }).save();

        const existingUser = await UserModel.findOne({ email: 'john.doe@vizzuality.com' }).exec();
        should.exist(existingUser);
        existingUser.should.have.property('email').and.equal('john.doe@vizzuality.com');
        existingUser.should.have.property('name').and.equal('John Doe');
        existingUser.should.have.property('photo').and.equal('https://images.pexels.com/photos/20787/pexels-photo.jpg?auto=compress&cs=tinysrgb&h=750&w=1260');
        existingUser.should.have.property('role').and.equal('USER');
        existingUser.should.have.property('provider').and.equal('facebook');
        existingUser.should.have.property('providerId').and.equal('10216001184997572');
        existingUser.should.have.property('userToken').and.equal(undefined);

        const proof = crypto.createHmac('sha256', process.env.TEST_FACEBOOK_OAUTH2_APP_SECRET || 'TEST_FACEBOOK_OAUTH2_APP_SECRET').update('TEST_FACEBOOK_OAUTH2_ACCESS_TOKEN').digest('hex');

        nock('https://graph.facebook.com')
            .get('/v2.6/me')
            .query({
                appsecret_proof: proof,
                fields: 'id,name,last_name,first_name,middle_name,email',
                access_token: 'TEST_FACEBOOK_OAUTH2_ACCESS_TOKEN'
            })
            .reply(200, {
                id: '10216001184997572',
                name: 'John Doe',
                last_name: 'Doe',
                first_name: 'Tiago',
                email: 'john.doe@vizzuality.com'
            });


        const response = await requester
            .get(`/auth/facebook/token?access_token=TEST_FACEBOOK_OAUTH2_ACCESS_TOKEN`)
            .send();

        response.status.should.equal(200);
        response.header['content-type'].should.equal('application/json; charset=utf-8');
        response.body.should.be.an('object');
        response.body.should.have.property('token').and.be.a('string');

        jwt.verify(response.body.token, process.env.JWT_SECRET);

        const userWithToken = await UserModel.findOne({ email: 'john.doe@vizzuality.com' }).exec();
        should.exist(userWithToken);
        userWithToken.should.have.property('email').and.equal('john.doe@vizzuality.com');
        userWithToken.should.have.property('name').and.equal('John Doe');
        userWithToken.should.have.property('photo').and.equal('https://images.pexels.com/photos/20787/pexels-photo.jpg?auto=compress&cs=tinysrgb&h=750&w=1260');
        userWithToken.should.have.property('role').and.equal('USER');
        userWithToken.should.have.property('provider').and.equal('facebook');
        userWithToken.should.have.property('providerId').and.equal('10216001184997572');
        userWithToken.should.have.property('userToken').and.equal(response.body.token);
    });

    afterEach(() => {
        if (!nock.isDone()) {
            throw new Error(`Not all nock interceptors were used: ${nock.pendingMocks()}`);
        }

        UserModel.deleteMany({}).exec();

        closeTestAgent();
    });
});
