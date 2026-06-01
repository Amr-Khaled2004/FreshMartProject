const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: String,
      default: null
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    _id: false
  }
);

const orderSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },
    id: {
      type: String,
      required: true
    },
    user: {
      type: String,
      required: true
    },
    items: {
      type: [orderItemSchema],
      default: []
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    address: {
      type: String,
      required: true
    },
    paymentMethod: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["Confirmed", "Pending", "Processing", "Delivered", "Cancelled"],
      default: "Confirmed"
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

module.exports = mongoose.model("Order", orderSchema);
