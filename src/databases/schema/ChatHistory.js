const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
    userId: { type: String, required: true },
    role: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ChatHistory", Schema);
