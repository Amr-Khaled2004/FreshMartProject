document.addEventListener("DOMContentLoaded", () => {
  loadMyOrders();
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    loadMyOrders();
  }
});

async function loadMyOrders() {
  const container = document.getElementById("orders-container");

  if (!container) return;

  const token = getToken();

  if (!token) {
    container.innerHTML = `
      <p>Please login to view your orders.</p>
      <br>
      <a href="login.html" class="btn">Login</a>
    `;
    return;
  }

  container.innerHTML = "<p>Loading orders...</p>";

  try {
    const response = await fetch(`${API_BASE_URL}/orders/my-orders`, {
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
      container.innerHTML = "<p>You have no orders yet.</p>";
      return;
    }

    container.innerHTML = orders.map(order => `
      <div class="order-card">
        <h3>Order ID: ${order._id}</h3>
        <p>Status: <strong>${order.status}</strong></p>
        <p>Total: EGP ${order.totalPrice}</p>
        <p>Address: ${order.address}</p>

        <h4>Items:</h4>
        <ul>
          ${order.items.map(item => `
            <li>
              ${item.product && item.product.name ? item.product.name : "Product"} -
              Quantity: ${item.quantity} -
              Price: EGP ${item.price}
            </li>
          `).join("")}
        </ul>
      </div>
    `).join("");

  } catch (error) {
    container.innerHTML = "<p>Server error. Try again later.</p>";
  }
}
