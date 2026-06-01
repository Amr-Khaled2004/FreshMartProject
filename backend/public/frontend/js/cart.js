document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  displayCart();
  updateCheckoutTotal();
});

function addToCart(product) {
  if (!isAuthenticated()) {
    showUserToast("Please login before adding items to your cart.", "error");
    window.location.href = "login.html";
    return;
  }

  if (isAdmin()) {
    showUserToast("Admin accounts manage products instead of shopping carts.", "error");
    return;
  }

  const cart = getCart();

  const productId = product._id || product.id || product.productId;
  const existingProduct = cart.find(item => String(item.productId) === String(productId));

  if (Number(product.stock) <= 0) {
    showUserToast(`${product.name} is out of stock.`, "error");
    return;
  }

  if (existingProduct) {
    if (Number(existingProduct.quantity) >= Number(product.stock)) {
      showUserToast(`Maximum stock reached: only ${product.stock} ${product.name} item(s) available.`, "error");
      return;
    }

    existingProduct.quantity += 1;
  } else {
    cart.push({
      productId,
      name: product.name,
      price: product.price,
      image: product.image,
      stock: product.stock,
      quantity: 1
    });
  }

  saveCart(cart);
  showUserToast(`${product.name} added to cart.`, "success");
}

function removeFromCart(productId) {
  let cart = getCart();

  cart = cart.filter(item => String(item.productId) !== String(productId));

  saveCart(cart);
  displayCart();
}

function increaseQuantity(productId) {
  const cart = getCart();

  const item = cart.find(product => String(product.productId) === String(productId));

  if (item) {
    if (Number(item.quantity) >= Number(item.stock)) {
      showUserToast(`Maximum stock reached: only ${item.stock} ${item.name} item(s) available.`, "error");
      return;
    }

    item.quantity += 1;
  }

  saveCart(cart);
  displayCart();
}

function decreaseQuantity(productId) {
  const cart = getCart();

  const item = cart.find(product => String(product.productId) === String(productId));

  if (item && item.quantity > 1) {
    item.quantity -= 1;
  }

  saveCart(cart);
  displayCart();
}

function clearCart() {
  deleteCurrentCart();
  updateCartCount();
  displayCart();
}

function calculateCartTotal() {
  const cart = getCart();

  return cart.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);
}

function updateCartCount() {
  const cartCount = document.getElementById("cart-count");

  if (!cartCount) return;

  const cart = getCart();

  const totalItems = cart.reduce((total, item) => {
    return total + item.quantity;
  }, 0);

  cartCount.textContent = totalItems;
}

function displayCart() {
  const container = document.getElementById("cart-container");
  const totalElement = document.getElementById("cart-total");

  if (!container) return;

  if (!isAuthenticated()) {
    container.innerHTML = `
      <p>Please login to view your cart.</p>
      <br>
      <a href="login.html" class="btn">Login</a>
    `;
    if (totalElement) totalElement.textContent = "0";
    return;
  }

  if (isAdmin()) {
    container.innerHTML = "<p>Admin accounts do not have shopping carts.</p>";
    if (totalElement) totalElement.textContent = "0";
    return;
  }

  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = "<p>Your cart is empty.</p>";
    if (totalElement) totalElement.textContent = "0";
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}" />

      <div>
        <h3>${item.name}</h3>
        <p>Price: EGP ${item.price}</p>
        <p>Available: ${item.stock} item(s)</p>
        <p>Subtotal: EGP ${item.price * item.quantity}</p>
      </div>

      <div class="cart-controls">
        <button onclick="decreaseQuantity('${item.productId}')">-</button>
        <span>${item.quantity}</span>
        <button onclick="increaseQuantity('${item.productId}')">+</button>
        <button onclick="removeFromCart('${item.productId}')">Remove</button>
      </div>
    </div>
  `).join("");

  if (totalElement) {
    totalElement.textContent = calculateCartTotal();
  }
}

function updateCheckoutTotal() {
  const checkoutTotal = document.getElementById("checkout-total");

  if (checkoutTotal) {
    checkoutTotal.textContent = calculateCartTotal();
  }
}

function showUserToast(message, type = "success") {
  let toast = document.getElementById("user-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "user-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `toast ${type}`;

  clearTimeout(showUserToast.timeoutId);
  showUserToast.timeoutId = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}
