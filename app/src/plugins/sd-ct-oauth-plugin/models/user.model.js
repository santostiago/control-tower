const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const User = new Schema({
    name: { type: String, required: false, trim: true },
    photo: { type: String, required: false, trim: true },
    provider: { type: String, required: true, trim: true, default: 'local' },
    providerId: { type: String, required: false, trim: true },
    email: { type: String, required: false, trim: true },
    password: { type: String, required: false, trim: true },
    salt: { type: String, required: false, trim: true },
    role: { type: String, required: true, default: 'USER', trim: true },
    createdAt: { type: Date, required: true, default: Date.now },
    extraUserData: { type: Schema.Types.Mixed },
    userToken: { type: String, required: false, trim: true }
});

module.exports = mongoose.model('User', User);
