const API_BASE_URL = "/api";

function getToken() {
  return localStorage.getItem("token");
}

function getUser() {
  const user = localStorage.getItem("user");

  if (!user) return null;

  try {
    return JSON.parse(user);
  } catch (error) {
    localStorage.removeItem("user");
    return null;
  }
}

function getUserId(user = getUser()) {
  return user && (user.id || user._id) ? String(user.id || user._id) : null;
}

function isAuthenticated() {
  return Boolean(getToken() && getUserId());
}

function isAdmin(user = getUser()) {
  return Boolean(user && user.role === "admin");
}

function getCartStorageKey(user = getUser()) {
  const userId = getUserId(user);
  return userId ? `cart:${userId}` : null;
}

function readStoredArray(key) {
  if (!key) return [];

  const value = localStorage.getItem(key);

  if (!value) return [];

  try {
    const parsedValue = JSON.parse(value);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (error) {
    localStorage.removeItem(key);
    return [];
  }
}

function getCart() {
  if (!isAuthenticated() || isAdmin()) {
    return [];
  }

  return readStoredArray(getCartStorageKey());
}

function saveCart(cart) {
  const cartKey = getCartStorageKey();

  if (!cartKey || isAdmin()) return;

  localStorage.setItem(cartKey, JSON.stringify(cart));
  localStorage.removeItem("cart");

  if (typeof updateCartCount === "function") {
    updateCartCount();
  }
}

function clearLegacyCartState() {
  localStorage.removeItem("cart");
}

function deleteCurrentCart() {
  const cartKey = getCartStorageKey();

  if (cartKey) {
    localStorage.removeItem(cartKey);
  }

  clearLegacyCartState();
}

function showMessage(elementId, message, type = "success") {
  const element = document.getElementById(elementId);

  if (!element) return;

  element.textContent = message;
  element.style.color = type === "success" ? "green" : "red";
}
