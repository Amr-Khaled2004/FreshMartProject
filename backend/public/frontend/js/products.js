let products = [];

const productsContainer = document.getElementById("products-container");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const sortFilter = document.getElementById("sortFilter");
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  updateCartCount();
});

async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE_URL}/products`);
    if (!response.ok) {
      throw new Error(`Products request failed with status ${response.status}`);
    }

    products = await response.json();
    if (!Array.isArray(products)) {
      throw new Error("Products response was not a list");
    }

    const selectedCategory = getCategoryFromURL();

    if (selectedCategory && categoryFilter) {
      categoryFilter.value = selectedCategory;
      filterProducts();
    } else {
      displayProducts(products);
    }

  } catch (error) {
    console.error("Error loading products:", error);

    if (productsContainer) {
      productsContainer.innerHTML = "<p>Failed to load products.</p>";
    }
  }
}

function getCategoryFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("category");
}

function displayProducts(productList) {
  productsContainer.innerHTML = "";

  if (productList.length === 0) {
    productsContainer.innerHTML = "<p>No products found.</p>";
    return;
  }

  productList.forEach(product => {
    const productId = product._id || product.id;
    const isOutOfStock = Number(product.stock) <= 0;

    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h3>${product.name}</h3>
      <p>${product.description || ""}</p>
      <p><strong>Category:</strong> ${product.category}</p>
      <p><strong>Price:</strong> ${formatPrice(product.price, product)}</p>
      <p><strong>Stock:</strong> ${formatQuantity(product.stock, product)}</p>
      <button onclick="addToCart('${productId}', this)" class="btn" ${isOutOfStock ? "disabled" : ""}>
        ${isOutOfStock ? "Out of Stock" : "Add to Cart"}
      </button>
    `;

    productsContainer.appendChild(card);
  });
}

function filterProducts() {
  const searchValue = searchInput ? searchInput.value.toLowerCase() : "";
  const categoryValue = categoryFilter ? categoryFilter.value : "";
  const sortValue = sortFilter ? sortFilter.value : "";

  let filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchValue);
    const matchesCategory = categoryValue === "" || product.category === categoryValue;

    return matchesSearch && matchesCategory;
  });

  if (sortValue === "low-high") {
    filteredProducts.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sortValue === "high-low") {
    filteredProducts.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (sortValue === "name-az") {
    filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortValue === "name-za") {
    filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
  }

  displayProducts(filteredProducts);
}

function addToCart(productId, button) {
  if (!isAuthenticated()) {
    showUserToast("Please login before adding items to your cart.", "error");
    window.location.href = "login.html";
    return;
  }

  if (isAdmin()) {
    showUserToast("Admin accounts manage products instead of shopping carts.", "error");
    return;
  }

  const product = products.find(item => String(item._id || item.id) === String(productId));

  if (!product) {
    showUserToast("Product not found.", "error");
    return;
  }

  if (Number(product.stock) <= 0) {
    showUserToast(`${product.name} is out of stock.`, "error");
    return;
  }

  let cart = getCart();

  const existingItem = cart.find(item =>
    String(item._id || item.id || item.productId) === String(productId)
  );

  if (existingItem) {
    if (Number(existingItem.quantity) >= Number(product.stock)) {
      showUserToast(`Maximum stock reached: only ${formatQuantity(product.stock, product)} of ${product.name} available.`, "error");
      return;
    }

    existingItem.quantity += 1;
  } else {
    cart.push({
      ...product,
      productId: product._id || product.id,
      quantity: 1
    });
  }

  saveCart(cart);
  showUserToast(`${product.name} added to cart.`, "success");

  if (button) {
    button.textContent = "Added!";
    button.style.background = "#086b2d";

    setTimeout(() => {
      button.textContent = "Add to Cart";
      button.style.background = "#0b8f3a";
    }, 1000);
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

function updateCartCount() {
  const cartCount = document.getElementById("cart-count");
  const cart = getCart();

  const totalItems = cart.reduce((sum, item) => {
    return sum + Number(item.quantity || 0);
  }, 0);

  if (cartCount) {
    cartCount.textContent = totalItems;
  }
}

if (searchInput) {
  searchInput.addEventListener("input", filterProducts);
}

if (categoryFilter) {
  categoryFilter.addEventListener("change", filterProducts);
}

if (sortFilter) {
  sortFilter.addEventListener("change", filterProducts);
}
