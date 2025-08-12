// orders.js - sistema de pedidos
import { db, appId } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
} from "./firebase.js";
import { showNotification } from "./utils.js";

export function setupOrderModal(productsCache) {
  let currentOrderProductId = null;
  window.orderProduct = function (productId, productName) {
    currentOrderProductId = productId;
    document.getElementById("order-product-name").textContent = productName;
    document.getElementById("order-modal").classList.remove("hidden");
  };
  window.closeOrderModal = function () {
    document.getElementById("order-modal").classList.add("hidden");
    document.getElementById("order-form").reset();
    currentOrderProductId = null;
  };
  document
    .getElementById("order-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const customerName = document.getElementById("customer-name").value;
      const customerAddress = document.getElementById("customer-address").value;
      const customerPhone = document.getElementById("customer-phone").value;
      const product = productsCache[currentOrderProductId];
      if (!product) {
        alert("Error: producto no encontrado");
        return;
      }
      try {
        const dynamicAppId = window.__app_id || appId;
        const ordersCollection = collection(
          db,
          "artifacts",
          dynamicAppId,
          "public",
          "data",
          "orders"
        );
        await addDoc(ordersCollection, {
          productId: currentOrderProductId,
          productName: product.name,
          productPrice: product.price,
          customerName,
          customerAddress,
          customerPhone: customerPhone || null,
          status: "pendiente",
          createdAt: new Date(),
          orderDate: new Date().toLocaleDateString("es-ES"),
        });
        showNotification("¡Pedido enviado! Te contactaremos pronto.");
        window.closeOrderModal();
      } catch (error) {
        console.error("Error al enviar pedido:", error);
        alert("Error al enviar el pedido.");
      }
    });
}

export function fetchOrders(adminMode) {
  if (!adminMode) return;
  const dynamicAppId = window.__app_id || appId;
  const ordersCollection = collection(
    db,
    "artifacts",
    dynamicAppId,
    "public",
    "data",
    "orders"
  );
  const q = query(ordersCollection, orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const ordersLoading = document.getElementById("orders-loading");
    const ordersContainer = document.getElementById("orders-container");
    if (ordersLoading) ordersLoading.classList.add("hidden");
    if (!ordersContainer) return;
    ordersContainer.innerHTML = "";
    if (snapshot.empty) {
      ordersContainer.innerHTML =
        '<p class="text-center text-gray-500 py-8">No hay pedidos todavía.</p>';
      return;
    }
    snapshot.docs.forEach((docSnap) => {
      const order = docSnap.data();
      ordersContainer.innerHTML += `
        <div class="bg-white rounded-lg shadow-md p-6 border-l-4 ${
          order.status === "pendiente"
            ? "border-yellow-400"
            : order.status === "entregado"
            ? "border-green-400"
            : "border-gray-400"
        }">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="font-bold text-lg text-gray-800">${
                order.productName
              }</h3>
              <p class="text-gray-600">Cliente: ${order.customerName}</p>
              <p class="text-gray-600">Precio: ${order.productPrice} €</p>
            </div>
            <div class="text-right">
              <span class="inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                order.status === "pendiente"
                  ? "bg-yellow-100 text-yellow-800"
                  : order.status === "entregado"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }">${
        order.status.charAt(0).toUpperCase() + order.status.slice(1)
      }</span>
              <p class="text-xs text-gray-500 mt-1">${order.orderDate}</p>
            </div>
          </div>
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700">Dirección:</p>
            <p class="text-sm text-gray-600">${order.customerAddress}</p>
            ${
              order.customerPhone
                ? `<p class='text-sm text-gray-600'>Tel: ${order.customerPhone}</p>`
                : ""
            }
          </div>
          ${
            order.status === "pendiente"
              ? `<button onclick="markAsDelivered('${docSnap.id}')" class="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded hover:bg-green-700">Marcar como Entregado</button>`
              : ""
          }
        </div>`;
    });
  });
}

export function setupMarkDelivered() {
  window.markAsDelivered = async function (orderId) {
    try {
      const dynamicAppId = window.__app_id || appId;
      const orderRef = doc(
        db,
        "artifacts",
        dynamicAppId,
        "public",
        "data",
        "orders",
        orderId
      );
      await updateDoc(orderRef, {
        status: "entregado",
        deliveredAt: new Date(),
      });
      showNotification("Pedido marcado como entregado");
    } catch (error) {
      console.error("Error al actualizar pedido:", error);
      alert("Error al actualizar el pedido");
    }
  };
}
