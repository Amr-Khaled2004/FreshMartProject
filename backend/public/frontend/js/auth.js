document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();

  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const logoutLink = document.getElementById("logout-link");

  if (registerForm) {
    registerForm.addEventListener("submit", registerUser);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", loginUser);
  }

  if (logoutLink) {
    logoutLink.addEventListener("click", logoutUser);
  }
});

async function registerUser(event) {
  event.preventDefault();

  const firstName = document.getElementById("registerFirstName").value.trim();
  const lastName = document.getElementById("registerLastName").value.trim();
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;
  const namePattern = /^[A-Za-z][A-Za-z\s'-]*$/;

  if (!namePattern.test(firstName) || !namePattern.test(lastName)) {
    showMessage("registerMessage", "First and last name can only contain letters, spaces, apostrophes, or hyphens.", "error");
    return;
  }

  if (password.length < 6 || !/\d/.test(password)) {
    showMessage("registerMessage", "Password must be at least 6 characters and include a number.", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ firstName, lastName, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage("registerMessage", data.message || "Registration failed", "error");
      return;
    }

    showMessage("registerMessage", "Registration successful. Redirecting...", "success");

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1000);

  } catch (error) {
    showMessage("registerMessage", "Server error. Try again later.", "error");
  }
}

async function loginUser(event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage("loginMessage", data.message || "Login failed", "error");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    clearLegacyCartState();
    sessionStorage.clear();

    showMessage("loginMessage", "Login successful. Redirecting...", "success");

    setTimeout(() => {
      if (data.user.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "products.html";
      }
    }, 1000);

  } catch (error) {
    showMessage("loginMessage", "Server error. Try again later.", "error");
  }
}

function logoutUser(event) {
  if (event) event.preventDefault();

  clearLegacyCartState();
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.clear();

  window.location.href = "login.html";
}

function updateAuthLinks() {
  renderNavbar();
}

function renderNavbar() {
  const token = getToken();
  const user = getUser();
  const nav = document.querySelector(".navbar nav");

  if (!nav) return;

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const currentHash = window.location.hash;
  const links = buildNavbarLinks(token, user);

  nav.innerHTML = links.map((link) => {
    const isActive = isActiveNavLink(link.href, currentPage, currentHash);
    const activeClass = isActive ? " class=\"active\"" : "";

    if (link.cart) {
      return `<a href="${link.href}"${activeClass}>${link.label} <span id="cart-count">0</span></a>`;
    }

    if (link.logout) {
      return `<a href="#" id="logout-link"${activeClass}>${link.label}</a>`;
    }

    return `<a href="${link.href}"${activeClass}>${link.label}</a>`;
  }).join("");

  const logoutLink = document.getElementById("logout-link");

  if (logoutLink) {
    logoutLink.addEventListener("click", logoutUser);
  }

  if (typeof updateCartCount === "function") {
    updateCartCount();
  }
}

function isActiveNavLink(href, currentPage, currentHash) {
  if (href === "admin.html#admin-orders-section") {
    return currentPage === "admin.html" && currentHash === "#admin-orders-section";
  }

  if (href === "admin.html") {
    return currentPage === "admin.html" && currentHash !== "#admin-orders-section";
  }

  return href === currentPage;
}

function buildNavbarLinks(token, user) {
  if (!token || !user) {
    return [
      { href: "index.html", label: "Home" },
      { href: "products.html", label: "Products" },
      { href: "login.html", label: "Login" },
      { href: "register.html", label: "Register" }
    ];
  }

  if (user.role === "admin") {
    return [
      { href: "index.html", label: "Home" },
      { href: "admin.html", label: "Manage Products" },
      { href: "admin.html#admin-orders-section", label: "Orders" },
      { href: "#", label: "Logout", logout: true }
    ];
  }

  return [
    { href: "index.html", label: "Home" },
    { href: "products.html", label: "Products" },
    { href: "cart.html", label: "Cart", cart: true },
    { href: "orders.html", label: "Orders" },
    { href: "#", label: "Logout", logout: true }
  ];
}
