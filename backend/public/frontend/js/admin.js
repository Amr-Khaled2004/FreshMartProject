document.addEventListener("DOMContentLoaded", () => {
  if (!protectAdminPage()) return;

  const productForm = document.getElementById("productForm");
  const productCategory = document.getElementById("productCategory");

  if (productForm) {
    productForm.addEventListener("submit", addProduct);
  }

  if (productCategory) {
    productCategory.addEventListener("change", updateProductUnitInputs);
    updateProductUnitInputs();
  }

  loadAdminProducts();
  loadAdminOrders();
});

function protectAdminPage() {
  const user = getUser();

  if (!getToken() || !user || user.role !== "admin") {
    alert("Access denied. Admins only.");
    window.location.href = "login.html";
    return false;
  }

  return true;
}

async function addProduct(event) {
  event.preventDefault();

  const token = getToken();
  const category = document.getElementById("productCategory").value;

  const product = {
    name: document.getElementById("productName").value,
    category,
    price: Number(document.getElementById("productPrice").value),
    stock: Number(document.getElementById("productStock").value),
    image: document.getElementById("productImage").value,
    description: document.getElementById("productDescription").value
  };

  try {
    const response = await fetch(`${API_BASE_URL}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(product)
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage("adminMessage", data.message || "Failed to add product", "error");
      return;
    }

    showMessage("adminMessage", "Product added successfully.", "success");

    document.getElementById("productForm").reset();
    updateProductUnitInputs();
    loadAdminProducts();

  } catch (error) {
    showMessage("adminMessage", "Server error. Try again later.", "error");
  }
}

function updateProductUnitInputs() {
  const categoryInput = document.getElementById("productCategory");
  const priceInput = document.getElementById("productPrice");
  const stockInput = document.getElementById("productStock");
  const category = categoryInput ? categoryInput.value : "";
  const isKilo = isKiloCategory(category);

  if (priceInput) {
    priceInput.placeholder = isKilo ? "Price per kg" : "Price";
  }

  if (stockInput) {
    stockInput.placeholder = isKilo ? "Stock in kg" : "Stock Quantity";
    stockInput.step = isKilo ? "0.1" : "1";
  }
}

async function loadAdminProducts() {
  const container = document.getElementById("admin-products");

  if (!container) return;

  container.innerHTML = "<p>Loading products...</p>";

  try {
    const response = await fetch(`${API_BASE_URL}/products`);
    const products = await response.json();

    if (products.length === 0) {
      container.innerHTML = "<p>No products found.</p>";
      return;
    }

    container.innerHTML = products.map(product => `
      <div class="admin-product">
        <img src="${product.image}" alt="${product.name}" />

        <div>
          <h4>${product.name}</h4>
          <p>Category: ${product.category}</p>
          <p>Price: ${formatPrice(product.price, product)}</p>
          <p>Stock: <strong id="product-stock-${product._id}">${formatQuantity(product.stock, product)}</strong></p>
        </div>

        <div class="admin-product-actions">
          <input
            type="number"
            id="stock-change-${product._id}"
            min="${isKiloCategory(product.category) ? "0.1" : "1"}"
            step="${isKiloCategory(product.category) ? "0.1" : "1"}"
            value="1"
            aria-label="Stock amount for ${product.name}"
          />
          <button class="btn compact" onclick="changeProductStock('${product._id}', 1)">Add Stock</button>
          <button class="btn compact secondary-action" onclick="changeProductStock('${product._id}', -1)">Reduce Stock</button>
          <button class="btn danger compact" onclick="deleteProduct('${product._id}')">Delete Product</button>
        </div>
      </div>
    `).join("");

  } catch (error) {
    container.innerHTML = "<p>Failed to load products.</p>";
  }
}

async function deleteProduct(productId) {
  const token = getToken();

  const confirmDelete = confirm("Are you sure you want to delete this product?");

  if (!confirmDelete) return;

  try {
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      alert("Failed to delete product.");
      return;
    }

    loadAdminProducts();

  } catch (error) {
    alert("Server error.");
  }
}

async function changeProductStock(productId, direction) {
  const token = getToken();
  const amountInput = document.getElementById(`stock-change-${productId}`);
  const amount = Number(amountInput ? amountInput.value : 1);

  if (!Number.isFinite(amount) || amount <= 0) {
    showAdminToast("Enter a stock amount greater than zero.", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/products/${productId}/stock`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ change: amount * direction })
    });

    const data = await response.json();

    if (!response.ok) {
      showAdminToast(data.message || "Failed to update stock.", "error");
      return;
    }

    const stockElement = document.getElementById(`product-stock-${productId}`);

    if (stockElement) {
      stockElement.textContent = formatQuantity(data.stock, data);
    }

    showAdminToast(`Stock updated to ${formatQuantity(data.stock, data)}.`, "success");

  } catch (error) {
    showAdminToast("Server error. Try again later.", "error");
  }
}

async function loadAdminOrders() {
  const container = document.getElementById("admin-orders");

  if (!container) return;

  const token = getToken();

  container.innerHTML = "<p>Loading orders...</p>";

  try {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const orders = await response.json();

    if (!response.ok) {
      container.innerHTML = "<p>Failed to load orders.</p>";
      return;
    }

    if (orders.length === 0) {
      container.innerHTML = "<p>No orders found.</p>";
      return;
    }

    container.innerHTML = orders.map(order => `
      <div class="order-card" id="order-card-${order._id}">
        <h3>Order ID: ${order._id}</h3>
        <p>Customer: ${order.user && order.user.name ? order.user.name : "Unknown"}</p>
        <p>Email: ${order.user && order.user.email ? order.user.email : "Unknown"}</p>
        <p>Total: EGP ${order.totalPrice}</p>
        <p>Street: ${order.streetName || order.address}</p>
        <p>Apartment: ${order.apartmentNumber || "N/A"}</p>
        <p>Phone: ${order.contactPhone || "N/A"}</p>
        <p>Status: <strong id="order-status-${order._id}">${order.status}</strong></p>

        <select id="order-select-${order._id}" onchange="updateOrderStatus('${order._id}', this.value)">
          <option value="Confirmed" ${order.status === "Confirmed" ? "selected" : ""}>Confirmed</option>
          <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
          <option value="Processing" ${order.status === "Processing" ? "selected" : ""}>Processing</option>
          <option value="Delivered" ${order.status === "Delivered" ? "selected" : ""}>Delivered</option>
          <option value="Cancelled" ${order.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
        </select>

        <button class="btn danger" onclick="deleteOrder('${order._id}')">
          Delete Order
        </button>

        <h4>Items:</h4>
        <ul>
          ${order.items.map(item => `
            <li>
              ${item.product && item.product.name ? item.product.name : "Product"} -
              Quantity: ${formatQuantity(item.quantity, item.product)} -
              Price: ${formatPrice(item.price, item.product)}
            </li>
          `).join("")}
        </ul>
      </div>
    `).join("");

  } catch (error) {
    container.innerHTML = "<p>Server error. Try again later.</p>";
  }
}

async function updateOrderStatus(orderId, status) {
  const token = getToken();
  keepAdminOrdersView();

  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    const data = await response.json();

    if (!response.ok) {
      showAdminToast(data.message || "Failed to update order status.", "error");
      loadAdminOrders();
      return;
    }

    const statusElement = document.getElementById(`order-status-${orderId}`);

    if (statusElement) {
      statusElement.textContent = status;
    }

    showAdminToast(`Order marked as ${status}.`, "success");
    keepAdminOrdersView();

  } catch (error) {
    showAdminToast("Server error. Try again later.", "error");
    loadAdminOrders();
  }
}

function keepAdminOrdersView() {
  const ordersSection = document.getElementById("admin-orders-section");

  if (window.location.pathname.endsWith("admin.html")) {
    history.replaceState(null, "", "admin.html#admin-orders-section");
  }

  if (ordersSection) {
    ordersSection.scrollIntoView({ block: "start" });
  }
}

async function deleteOrder(orderId) {
  const token = getToken();

  const confirmDelete = confirm("Are you sure you want to delete this order?");

  if (!confirmDelete) return;

  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      showAdminToast("Failed to delete order.", "error");
      return;
    }

    showAdminToast("Order deleted successfully.", "success");

    const orderCard = document.getElementById(`order-card-${orderId}`);

    if (orderCard) {
      orderCard.remove();
    }

    loadAdminOrders();

  } catch (error) {
    showAdminToast("Server error. Try again later.", "error");
  }
}

function showAdminToast(message, type = "success") {
  const toast = document.getElementById("admin-toast");

  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type}`;

  clearTimeout(showAdminToast.timeoutId);
  showAdminToast.timeoutId = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2800);
}
