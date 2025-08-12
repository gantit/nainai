// navigation.js - manejo de navegación y estado admin
import { fetchOrders } from "./orders.js";

export function setupNavigation(adminMode) {
  const shopPage = document.getElementById("shop-page");
  const adminPage = document.getElementById("admin-page");
  const ordersPage = document.getElementById("orders-page");
  const showShopBtn = document.getElementById("show-shop-btn");
  const showAdminBtn = document.getElementById("show-admin-btn");
  const showOrdersBtn = document.getElementById("show-orders-btn");

  if (adminMode) {
    showAdminBtn.classList.remove("hidden");
    showOrdersBtn.classList.remove("hidden");
  }

  showShopBtn.addEventListener("click", () => {
    shopPage.classList.remove("hidden");
    adminPage.classList.add("hidden");
    ordersPage.classList.add("hidden");
    showShopBtn.className = baseBtnClass("cyan", true);
    showAdminBtn.className = baseBtnClass();
    showOrdersBtn.className = ordersBtnClass();
    if (!adminMode) {
      showAdminBtn.classList.add("hidden");
      showOrdersBtn.classList.add("hidden");
    }
  });

  showAdminBtn.addEventListener("click", () => {
    shopPage.classList.add("hidden");
    adminPage.classList.remove("hidden");
    ordersPage.classList.add("hidden");
    showAdminBtn.className = baseBtnClass("cyan", true);
    showShopBtn.className = baseBtnClass();
    showOrdersBtn.className = ordersBtnClass();
  });

  showOrdersBtn.addEventListener("click", () => {
    shopPage.classList.add("hidden");
    adminPage.classList.add("hidden");
    ordersPage.classList.remove("hidden");
    showOrdersBtn.className = ordersBtnClass(true);
    showShopBtn.className = baseBtnClass();
    showAdminBtn.className = baseBtnClass();
    fetchOrders(adminMode);
  });
}

function baseBtnClass(color = "white", active = false) {
  if (color === "cyan" && active)
    return "px-5 py-2.5 text-sm font-semibold bg-cyan-600 text-white rounded-full shadow-md hover:bg-cyan-700 transition-all";
  return "px-5 py-2.5 text-sm font-semibold bg-white text-gray-700 rounded-full shadow-md hover:bg-gray-100 transition-all";
}
function ordersBtnClass(active = false) {
  return active
    ? "px-5 py-2.5 text-sm font-semibold bg-purple-800 text-white rounded-full shadow-md hover:bg-purple-900 transition-all"
    : "px-5 py-2.5 text-sm font-semibold bg-purple-600 text-white rounded-full shadow-md hover:bg-purple-700 transition-all";
}
