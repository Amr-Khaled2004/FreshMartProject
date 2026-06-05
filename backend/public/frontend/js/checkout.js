document.addEventListener("DOMContentLoaded", () => {
  const checkoutForm = document.getElementById("checkoutForm");
  const paymentMethod = document.getElementById("paymentMethod");
  const cardNumber = document.getElementById("cardNumber");
  const cardExpiry = document.getElementById("cardExpiry");

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", placeOrder);
  }

  if (paymentMethod) {
    paymentMethod.addEventListener("change", toggleCardFields);
    toggleCardFields();
  }

  if (cardNumber) {
    cardNumber.addEventListener("input", formatCardNumber);
  }

  if (cardExpiry) {
    cardExpiry.addEventListener("input", formatCardExpiry);
  }
});

function toggleCardFields() {
  const paymentMethod = document.getElementById("paymentMethod").value;
  const cardFields = document.getElementById("cardPaymentFields");
  const cardInputs = cardFields ? cardFields.querySelectorAll("input") : [];
  const isCreditCard = paymentMethod === "Credit Card";

  if (!cardFields) return;

  cardFields.classList.toggle("hidden", !isCreditCard);

  cardInputs.forEach(input => {
    input.required = isCreditCard;
  });
}

function formatCardNumber(event) {
  event.target.value = event.target.value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatCardExpiry(event) {
  const value = event.target.value.replace(/\D/g, "").slice(0, 4);

  event.target.value = value.length > 2
    ? `${value.slice(0, 2)}/${value.slice(2)}`
    : value;
}

function validateCardPayment() {
  const paymentMethod = document.getElementById("paymentMethod").value;

  if (paymentMethod !== "Credit Card") {
    return true;
  }

  const cardName = document.getElementById("cardName").value.trim();
  const cardNumber = document.getElementById("cardNumber").value.replace(/\s/g, "");
  const cardExpiry = document.getElementById("cardExpiry").value.trim();
  const cardCvv = document.getElementById("cardCvv").value.trim();

  if (!cardName || !/^\d{16}$/.test(cardNumber) || !/^\d{2}\/\d{2}$/.test(cardExpiry) || !/^\d{3,4}$/.test(cardCvv)) {
    showMessage("checkoutMessage", "Please enter valid credit card details.", "error");
    return false;
  }

  const [month, year] = cardExpiry.split("/").map(Number);

  if (month < 1 || month > 12) {
    showMessage("checkoutMessage", "Please enter a valid card expiry month.", "error");
    return false;
  }

  const now = new Date();
  const currentYear = Number(String(now.getFullYear()).slice(2));
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    showMessage("checkoutMessage", "This credit card is expired.", "error");
    return false;
  }

  return true;
}

async function placeOrder(event) {
  event.preventDefault();

  const token = getToken();

  if (!token) {
    alert("Please login first.");
    window.location.href = "login.html";
    return;
  }

  if (isAdmin()) {
    showMessage("checkoutMessage", "Admin accounts cannot place customer orders.", "error");
    return;
  }

  const cart = getCart();

  if (cart.length === 0) {
    showMessage("checkoutMessage", "Your cart is empty.", "error");
    return;
  }

  const streetName = document.getElementById("streetName").value.trim();
  const apartmentNumber = document.getElementById("apartmentNumber").value.trim();
  const contactPhone = document.getElementById("contactPhone").value.trim();
  const paymentMethod = document.getElementById("paymentMethod").value;
  const phonePattern = /^[+\d][\d\s()-]{6,19}$/;

  if (!streetName || !apartmentNumber || !phonePattern.test(contactPhone)) {
    showMessage("checkoutMessage", "Please enter a street name, apartment number, and valid contact phone.", "error");
    return;
  }

  if (!validateCardPayment()) {
    return;
  }

  const orderData = {
    items: cart.map(item => ({
      product: item.productId,
      quantity: item.quantity,
      price: item.price
    })),
    totalPrice: calculateCartTotal(),
    streetName,
    apartmentNumber,
    contactPhone,
    paymentMethod
  };

  try {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage("checkoutMessage", data.message || "Order failed", "error");
      showUserToast(data.message || "Order failed", "error");
      return;
    }

    deleteCurrentCart();
    updateCartCount();

    const currentUser = getUser();
    const emailAddress = data.emailTo || (currentUser && currentUser.email) || "your account email";
    const emailMessage = data.emailSent
      ? `Confirmation email sent to ${emailAddress}.`
      : `Order email was not sent because SMTP is not configured. Recipient would be ${emailAddress}.`;
    const successMessage = `Order placed successfully. ${emailMessage}`;

    showMessage("checkoutMessage", successMessage, "success");
    showUserToast(successMessage, "success");

    setTimeout(() => {
      window.location.href = "orders.html";
    }, 1200);

  } catch (error) {
    showMessage("checkoutMessage", "Server error. Try again later.", "error");
    showUserToast("Server error. Try again later.", "error");
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
