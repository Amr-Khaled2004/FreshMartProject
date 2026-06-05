const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const connectDB = require("./config/db");
const User = require("./models/User");
const Product = require("./models/Product");
const Order = require("./models/Order");
const EmailOutbox = require("./models/EmailOutbox");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public", "frontend")));
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "simple_supermarket_secret";
const PRODUCT_CATEGORIES = ["Fruits", "Vegetables", "Dairy", "Bakery", "Drinks", "Snacks", "Meat", "Cleaning"];
const KILO_CATEGORIES = ["Fruits", "Vegetables"];

function generateId() {
  return Date.now().toString();
}

function toPlainRecord(record) {
  if (!record) return null;
  return typeof record.toObject === "function" ? record.toObject() : record;
}

function normalizeRecordId(record) {
  const plainRecord = toPlainRecord(record);
  if (!plainRecord) return null;
  const id = plainRecord.id || plainRecord._id || generateId();

  return {
    ...plainRecord,
    id,
    _id: id
  };
}

function preventResponseCaching(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
}

function createToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: "7d"
  });
}

function isValidNamePart(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z\s'-]*$/.test(value.trim());
}

function isValidPassword(value) {
  return typeof value === "string" && value.length >= 6 && /\d/.test(value);
}

function isValidContactPhone(value) {
  return typeof value === "string" && /^[+\d][\d\s()-]{6,19}$/.test(value.trim());
}

function formatAddress(streetName, apartmentNumber) {
  return `${streetName}, Apt ${apartmentNumber}`;
}

function isValidProductCategory(category) {
  return PRODUCT_CATEGORIES.includes(category);
}

function isKiloCategory(category) {
  return KILO_CATEGORIES.includes(category);
}

function getProductUnit(product) {
  return product && isKiloCategory(product.category) ? "kg" : "item(s)";
}

function formatQuantity(value, product) {
  return `${Number(value)} ${getProductUnit(product)}`;
}

function formatPrice(value, product) {
  const unit = product && isKiloCategory(product.category) ? " / kg" : "";
  return `EGP ${Number(value)}${unit}`;
}

function isValidStockAmount(value, category) {
  return Number.isFinite(value) && value >= 0 && (isKiloCategory(category) || Number.isInteger(value));
}

function isValidOrderQuantity(value, product) {
  return Number.isFinite(value) && value > 0 && (isKiloCategory(product.category) || Number.isInteger(value));
}

function createMailTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false"
    },
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function getMissingEmailSettings() {
  return ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((key) => !process.env[key]);
}

function formatOrderItemsForEmail(checkedItems) {
  return checkedItems.map((item) => {
    const product = item.product;
    const orderItem = item.orderItem;

    return {
      name: product.name,
      quantity: formatQuantity(orderItem.quantity, product),
      price: formatPrice(orderItem.price, product),
      subtotal: orderItem.quantity * orderItem.price
    };
  });
}

function buildOrderEmail(user, order, checkedItems) {
  const orderItems = formatOrderItemsForEmail(checkedItems);
  const streetName = order.streetName || order.address;
  const apartmentNumber = order.apartmentNumber || "N/A";
  const contactPhone = order.contactPhone || "N/A";
  const itemLines = orderItems.map((item) => {
    return `- ${item.name} x ${item.quantity} = EGP ${item.subtotal}`;
  }).join("\n");

  const itemRows = orderItems.map((item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #dfe8e2;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #dfe8e2; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #dfe8e2; text-align: right;">${item.price}</td>
      <td style="padding: 10px; border-bottom: 1px solid #dfe8e2; text-align: right;">EGP ${item.subtotal}</td>
    </tr>
  `).join("");

  return {
    subject: `FreshMart order placed - #${order.id}`,
    text: [
      `Hi ${user.name},`,
      "",
      "Your FreshMart order has been placed successfully.",
      "",
      `Order ID: ${order.id}`,
      `Status: ${order.status}`,
      `Payment: ${order.paymentMethod}`,
      `Street: ${streetName}`,
      `Apartment: ${apartmentNumber}`,
      `Phone: ${contactPhone}`,
      "",
      "Items:",
      itemLines,
      "",
      `Total: EGP ${order.totalPrice}`,
      "",
      "Thank you for shopping with FreshMart."
    ].join("\n"),
    html: `
      <div style="font-family: Segoe UI, Arial, sans-serif; color: #17211b; line-height: 1.5;">
        <h2 style="color: #086232;">Your FreshMart order has been placed</h2>
        <p>Hi ${user.name}, your order is confirmed.</p>
        <p><strong>Order ID:</strong> ${order.id}</p>
        <p><strong>Status:</strong> ${order.status}</p>
        <p><strong>Payment:</strong> ${order.paymentMethod}</p>
        <p><strong>Street:</strong> ${streetName}</p>
        <p><strong>Apartment:</strong> ${apartmentNumber}</p>
        <p><strong>Phone:</strong> ${contactPhone}</p>
        <table style="width: 100%; max-width: 680px; border-collapse: collapse; margin-top: 18px;">
          <thead>
            <tr style="background: #e8f7ef;">
              <th style="padding: 10px; text-align: left;">Product</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
              <th style="padding: 10px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <h3 style="color: #086232;">Total: EGP ${order.totalPrice}</h3>
        <p>Thank you for shopping with FreshMart.</p>
      </div>
    `
  };
}

async function saveEmailToOutbox(email) {
  await EmailOutbox.create({
    ...email,
    savedAt: new Date()
  });
}

async function sendOrderConfirmationEmail(user, order, checkedItems) {
  const emailContent = buildOrderEmail(user, order, checkedItems);
  const email = {
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || "FreshMart <no-reply@freshmart.local>",
    to: user.email,
    ...emailContent
  };

  const transporter = createMailTransporter();

  if (!transporter) {
    await saveEmailToOutbox(email);
    return {
      sent: false,
      savedToOutbox: true,
      to: user.email,
      reason: `Missing email settings: ${getMissingEmailSettings().join(", ")}`
    };
  }

  await transporter.sendMail(email);
  return { sent: true, savedToOutbox: false, to: user.email, reason: "" };
}

async function buildOrderResponse(order, options = {}) {
  const normalizedOrder = normalizeRecordId(order);
  const responseOrder = {
    ...normalizedOrder,
    items: []
  };

  if (options.includeUser) {
    const user = await User.findById(String(normalizedOrder.user)).lean();

    responseOrder.user = user
      ? {
          id: user.id,
          _id: user.id,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        }
      : null;
  }

  for (const item of normalizedOrder.items || []) {
    const productId = item.product || item.productId;
    const product = productId ? await Product.findById(String(productId)).lean() : null;

    responseOrder.items.push({
      ...item,
      product: product ? normalizeRecordId(product) : null
    });
  }

  return responseOrder;
}

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(String(decoded.id)).lean();

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = {
      id: user.id,
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Admin only" });
  }
}

app.get("/", (req, res) => {
  res.send("Simple supermarket backend is running");
});

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const firstName = typeof req.body.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName = typeof req.body.lastName === "string" ? req.body.lastName.trim() : "";
    const { email, password } = req.body;

    if (!isValidNamePart(firstName) || !isValidNamePart(lastName)) {
      return res.status(400).json({
        message: "First and last name can only contain letters, spaces, apostrophes, or hyphens"
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ message: "Password must be at least 6 characters and include a number" });
    }

    const existingUser = await User.findOne({ email: String(email).toLowerCase() });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const name = `${firstName} ${lastName}`;

    const userId = generateId();
    const newUser = await User.create({
      id: userId,
      _id: userId,
      name,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: "customer"
    });

    res.status(201).json({
      message: "Registered successfully",
      user: {
        id: newUser.id,
        _id: newUser.id,
        name: newUser.name,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: String(email).toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      token: createToken(user.id),
      user: {
        id: user.id,
        _id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

// Get all products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().lean();

    res.json(products.map(normalizeRecordId));
  } catch (error) {
    res.status(500).json({ message: "Failed to load products" });
  }
});

// Add product - admin only
app.post("/api/products", protect, adminOnly, async (req, res) => {
  try {
    const category = typeof req.body.category === "string" ? req.body.category.trim() : "";
    const price = Number(req.body.price);
    const stock = Number(req.body.stock);

    if (!isValidProductCategory(category)) {
      return res.status(400).json({ message: "Choose a valid product category" });
    }

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: "Price must be zero or greater" });
    }

    if (!isValidStockAmount(stock, category)) {
      return res.status(400).json({
        message: isKiloCategory(category)
          ? "Stock in kg must be zero or greater"
          : "Stock quantity must be a whole number zero or greater"
      });
    }

    const productId = generateId();
    const newProduct = await Product.create({
      id: productId,
      _id: productId,
      name: req.body.name,
      category,
      price,
      stock,
      image: req.body.image,
      description: req.body.description || ""
    });

    res.status(201).json(normalizeRecordId(newProduct));
  } catch (error) {
    res.status(500).json({ message: "Failed to add product" });
  }
});

// Delete product - admin only
app.delete("/api/products/:id", protect, adminOnly, async (req, res) => {
  try {
    await Product.deleteOne({ _id: String(req.params.id) });

    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete product" });
  }
});

// Update product stock - admin only
app.patch("/api/products/:id/stock", protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findById(String(req.params.id));

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const change = Number(req.body.change || 0);
    const nextStock = Number(product.stock) + change;

    if (!Number.isFinite(change) || change === 0 || (!isKiloCategory(product.category) && !Number.isInteger(change))) {
      return res.status(400).json({
        message: isKiloCategory(product.category)
          ? "Stock change must be a non-zero kg amount"
          : "Stock change must be a non-zero whole number"
      });
    }

    if (nextStock < 0) {
      return res.status(400).json({ message: "Stock cannot be less than zero" });
    }

    product.stock = nextStock;

    await product.save();

    res.json(normalizeRecordId(product));
  } catch (error) {
    res.status(500).json({ message: "Failed to update stock" });
  }
});

// Place order
app.post("/api/orders", protect, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(403).json({ message: "Admin accounts cannot place customer orders" });
    }

    const { items, paymentMethod } = req.body;
    const streetName = typeof req.body.streetName === "string" ? req.body.streetName.trim() : "";
    const apartmentNumber = typeof req.body.apartmentNumber === "string" ? req.body.apartmentNumber.trim() : "";
    const contactPhone = typeof req.body.contactPhone === "string" ? req.body.contactPhone.trim() : "";

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No order items" });
    }

    if (!streetName || !apartmentNumber || !isValidContactPhone(contactPhone)) {
      return res.status(400).json({
        message: "Street name, apartment number, and a valid contact phone are required"
      });
    }

    const checkedItems = [];

    for (const item of items) {
      const productId = item.product || item.productId;
      const quantity = Number(item.quantity);
      const product = await Product.findById(String(productId));

      if (!product) {
        return res.status(404).json({ message: "One of the products was not found" });
      }

      if (!isValidOrderQuantity(quantity, product)) {
        return res.status(400).json({
          message: isKiloCategory(product.category)
            ? `Invalid kg quantity for ${product.name}`
            : "Invalid product quantity"
        });
      }

      if (Number(product.stock) < quantity) {
        return res.status(400).json({
          message: `Only ${formatQuantity(product.stock, product)} left for ${product.name}`
        });
      }

      checkedItems.push({
        product,
        orderItem: {
          product: product.id,
          quantity,
          price: Number(product.price)
        }
      });
    }

    const orderId = generateId();

    const newOrder = {
      id: orderId,
      _id: orderId,
      user: req.user.id,
      items: checkedItems.map((item) => item.orderItem),
      totalPrice: checkedItems.reduce((total, item) => {
        return total + item.orderItem.price * item.orderItem.quantity;
      }, 0),
      address: formatAddress(streetName, apartmentNumber),
      streetName,
      apartmentNumber,
      contactPhone,
      paymentMethod,
      status: "Confirmed",
      createdAt: new Date()
    };

    for (const item of checkedItems) {
      item.product.stock = Number(item.product.stock) - item.orderItem.quantity;
      await item.product.save();
    }

    const createdOrder = await Order.create(newOrder);
    const responseOrder = normalizeRecordId(createdOrder);

    let emailStatus = { sent: false, savedToOutbox: false, to: req.user.email, reason: "" };

    try {
      emailStatus = await sendOrderConfirmationEmail(req.user, responseOrder, checkedItems);
    } catch (emailError) {
      emailStatus = {
        sent: false,
        savedToOutbox: false,
        to: req.user.email,
        reason: emailError.message
      };
      console.error("Order confirmation email failed:", emailError.message);
    }

    res.status(201).json({
      ...responseOrder,
      emailSent: emailStatus.sent,
      emailSavedToOutbox: emailStatus.savedToOutbox,
      emailTo: emailStatus.to,
      emailError: emailStatus.reason
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to place order" });
  }
});

// Customer orders
app.get("/api/orders/my-orders", protect, async (req, res) => {
  try {
    preventResponseCaching(res);

    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();

    const myOrders = [];

    for (const order of orders) {
      myOrders.push(await buildOrderResponse(order));
    }

    res.json(myOrders);
  } catch (error) {
    res.status(500).json({ message: "Failed to load orders" });
  }
});

// Admin: all orders
app.get("/api/orders", protect, adminOnly, async (req, res) => {
  try {
    preventResponseCaching(res);

    const savedOrders = await Order.find().sort({ createdAt: -1 }).lean();
    const orders = [];

    for (const order of savedOrders) {
      orders.push(await buildOrderResponse(order, { includeUser: true }));
    }

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to load admin orders" });
  }
});

// Admin: update order status
app.put("/api/orders/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const order = await Order.findById(String(req.params.id));

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const nextStatus = req.body.status;
    const previousStatus = order.status;

    if (!["Confirmed", "Pending", "Processing", "Delivered", "Cancelled"].includes(nextStatus)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    if (nextStatus === "Cancelled" && previousStatus !== "Cancelled") {
      for (const item of order.items) {
        const productId = item.product || item.productId;
        const product = productId ? await Product.findById(String(productId)) : null;

        if (product) {
          product.stock = Number(product.stock) + Number(item.quantity);
          await product.save();
        }
      }
    }

    order.status = nextStatus;

    await order.save();

    res.json(normalizeRecordId(order));
  } catch (error) {
    res.status(500).json({ message: "Failed to update order status" });
  }
});

// Admin: delete order
app.delete("/api/orders/:id", protect, adminOnly, async (req, res) => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(String(req.params.id));

    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ message: "Order deleted", deletedOrderId: String(req.params.id) });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete order" });
  }
});

connectDB()
  .then(() => {
    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "frontend", "index.html"));
    });

    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start backend:", error.message);
    process.exit(1);
  });
