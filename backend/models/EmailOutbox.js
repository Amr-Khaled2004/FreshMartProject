const mongoose = require("mongoose");

const emailOutboxSchema = new mongoose.Schema(
  {
    from: {
      type: String,
      required: true
    },
    to: {
      type: String,
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    html: {
      type: String,
      required: true
    },
    savedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

module.exports = mongoose.model("EmailOutbox", emailOutboxSchema);
