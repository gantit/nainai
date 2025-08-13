// navigation.js - manejo de navegación y estado admin
import { fetchOrders } from "./orders.js";

// Unifica la navegación usando el sistema de clases brand-* (tema dinámico)
export function setupNavigation(adminMode) {
  const shopPage = document.getElementById("shop-page");
  const adminPage = document.getElementById("admin-page");
  const ordersPage = document.getElementById("orders-page");
  const showShopBtn = document.getElementById("show-shop-btn");
  const showAdminBtn = document.getElementById("show-admin-btn");
  const showOrdersBtn = document.getElementById("show-orders-btn");

  // Guardar clases base originales (para restaurar variante visual)
  [showShopBtn, showAdminBtn, showOrdersBtn].forEach((btn) => {
    if (btn) {
      btn.dataset.originalClasses = btn.className
        .split(" ")
        .filter((c) => c !== "hidden" && c !== "active-nav")
        .join(" ");
    }
  });

  if (adminMode) {
    showAdminBtn.classList.remove("hidden");
    showOrdersBtn.classList.remove("hidden");
  }

  function activate(btn) {
    const buttons = [showShopBtn, showAdminBtn, showOrdersBtn];
    buttons.forEach((b) => {
      if (!b) return;
      // Restaurar base original
      const base = b.dataset.originalClasses || b.className;
      const wasHidden = b.classList.contains("hidden") && !adminMode;
      b.className = base;
      if (wasHidden) b.classList.add("hidden");
      b.classList.remove("active-nav", "brand-btn-primary");
      // Botón tienda: degradar a secundaria para contraste, no dejarlo blanco puro
      if (b.id === "show-shop-btn") {
        b.classList.remove("brand-btn-primary");
        if (!b.classList.contains("brand-btn-secondary")) {
          b.classList.add("brand-btn-secondary");
        }
      }
    });
    if (btn) {
      btn.classList.add("active-nav");
      // Forzar variante primaria para el activo (garantiza contraste)
      btn.classList.remove(
        "brand-btn-secondary",
        "brand-btn-outline",
        "brand-btn-accent"
      );
      btn.classList.add("brand-btn-primary");
    }
  }

  showShopBtn.addEventListener("click", () => {
    if (showShopBtn.classList.contains("hidden")) return;
    shopPage.classList.remove("hidden");
    adminPage.classList.add("hidden");
    ordersPage.classList.add("hidden");
    activate(showShopBtn);
  });

  showAdminBtn.addEventListener("click", () => {
    shopPage.classList.add("hidden");
    adminPage.classList.remove("hidden");
    ordersPage.classList.add("hidden");
    activate(showAdminBtn);
  });

  showOrdersBtn.addEventListener("click", () => {
    shopPage.classList.add("hidden");
    adminPage.classList.add("hidden");
    ordersPage.classList.remove("hidden");
    activate(showOrdersBtn);
    fetchOrders(adminMode);
  });

  // Estado inicial: si no es admin y el botón tienda está oculto, dejar vista por defecto (shop ya visible en HTML) sin activar nav.
  if (!showShopBtn.classList.contains("hidden")) {
    activate(showShopBtn);
  }
}
