/*!
 * AutoUPI embedded QR widget (no redirect, no popup)
 *
 * Usage on the merchant page:
 *   <div id="panme-pay"></div>
 *   <script src="https://www.autoupi.shop/embed/panme-pay.js"></script>
 *   <script>
 *     PanMePay.mount("#panme-pay", {
 *       apiKey: "lk_live_xxx",
 *       createOrderUrl: "/api/create-topup",   // optional: your own server proxy (recommended)
 *       onSuccess: function (order) { console.log("paid", order); }
 *     });
 *   </script>
 */
(function () {
  "use strict";

  var GATEWAY = "https://www.autoupi.shop";
  var POLL_MS = 2000;

  function el(tag, style, text) {
    var n = document.createElement(tag);
    if (style) n.setAttribute("style", style);
    if (text != null) n.textContent = text;
    return n;
  }

  function fmtTime(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60);
    return m + ":" + String(s % 60).padStart(2, "0");
  }

  function mount(target, opts) {
    opts = opts || {};
    var root = typeof target === "string" ? document.querySelector(target) : target;
    if (!root) throw new Error("PanMePay: mount target not found");
    var gateway = (opts.gateway || GATEWAY).replace(/\/+$/, "");

    var box =
      "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:360px;border:1px solid #e5e7eb;border-radius:16px;padding:20px;background:#fff;color:#0d1b2a";
    var wrap = el("div", box);
    root.innerHTML = "";
    root.appendChild(wrap);

    function renderForm(msg) {
      wrap.innerHTML = "";
      wrap.appendChild(el("div", "font-weight:700;font-size:18px;margin-bottom:12px", "Add Wallet Balance"));
      if (msg) wrap.appendChild(el("div", "color:#b91c1c;font-size:13px;margin-bottom:8px", msg));
      var input = el(
        "input",
        "width:100%;box-sizing:border-box;padding:12px;font-size:16px;border:1px solid #d1d5db;border-radius:10px;margin-bottom:12px",
      );
      input.type = "number";
      input.min = "1";
      input.step = "0.01";
      input.placeholder = "Amount (₹)";
      var btn = el(
        "button",
        "width:100%;padding:12px;border:0;border-radius:10px;background:#0d4a3a;color:#fff;font-weight:700;cursor:pointer",
        "PAY",
      );
      btn.onclick = function () {
        var amt = parseFloat(input.value);
        if (!amt || amt <= 0) return renderForm("Enter a valid amount");
        btn.disabled = true;
        btn.textContent = "Generating…";
        createOrder(amt).then(renderQr, function (e) {
          renderForm(e.message || "Could not start payment");
        });
      };
      wrap.appendChild(input);
      wrap.appendChild(btn);
    }

    function createOrder(amount) {
      if (opts.createOrderUrl) {
        // Recommended: your server creates the order (API key stays private).
        return fetch(opts.createOrderUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amount }),
        }).then(readJson);
      }
      return fetch(gateway + "/api/public/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + opts.apiKey },
        body: JSON.stringify({
          amount: amount,
          merchant_order_id: opts.merchantOrderId || "wallet_" + Date.now(),
          success_url: opts.successUrl || location.href,
          failure_url: opts.failureUrl || location.href,
          webhook_url: opts.webhookUrl || (location.origin + "/api/webhooks/autoupi"),
          customer: opts.customer,
        }),
      }).then(readJson);
    }

    function readJson(r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.message || d.error || "request_failed");
        return d;
      });
    }

    function renderQr(order) {
      wrap.innerHTML = "";
      wrap.appendChild(el("div", "font-weight:700;font-size:18px", "Scan & Pay"));
      wrap.appendChild(
        el(
          "div",
          "font-size:24px;font-weight:800;margin:6px 0 12px",
          "₹" + Number(order.payable_amount).toFixed(2),
        ),
      );
      if (order.qr_base64) {
        var img = el("img", "width:100%;border-radius:12px;background:#fff");
        img.src = order.qr_base64;
        img.alt = "UPI QR";
        wrap.appendChild(img);
      }
      var link = el(
        "a",
        "display:block;text-align:center;margin-top:12px;padding:10px;border-radius:10px;background:#0d4a3a;color:#fff;text-decoration:none;font-weight:700",
        "Pay with UPI app",
      );
      link.href = order.upi_uri;
      wrap.appendChild(link);

      var timer = el("div", "text-align:center;font-size:13px;color:#6b7280;margin-top:10px", "");
      wrap.appendChild(timer);
      var status = el("div", "text-align:center;font-size:13px;color:#6b7280;margin-top:4px", "Waiting for payment…");
      wrap.appendChild(status);

      var expiry = new Date(order.expires_at).getTime();
      var tick = setInterval(function () {
        timer.textContent = "Expires in " + fmtTime(expiry - Date.now());
      }, 1000);
      timer.textContent = "Expires in " + fmtTime(expiry - Date.now());

      var stopped = false;
      var pollTimer = null;
      function pollStatus() {
        var url =
          (opts.statusUrl
            ? opts.statusUrl + encodeURIComponent(order.order_id)
            : gateway + "/api/public/v1/orders/" + encodeURIComponent(order.order_id));
        fetch(url, {
          headers: opts.statusUrl ? {} : { Authorization: "Bearer " + opts.apiKey },
        })
          .then(readJson)
          .then(function (d) {
            if (d.status === "paid") {
              stopped = true;
              clearTimeout(pollTimer);
              clearInterval(tick);
              renderDone(d);
            } else if (d.status === "expired" || d.status === "failed") {
              stopped = true;
              clearTimeout(pollTimer);
              clearInterval(tick);
              renderForm("Payment " + d.status + ". Please try again.");
            }
          })
          .catch(function () {})
          .finally(function () {
            if (!stopped) pollTimer = setTimeout(pollStatus, POLL_MS);
          });
      }
      pollTimer = setTimeout(pollStatus, POLL_MS);
    }

    function renderDone(order) {
      wrap.innerHTML = "";
      wrap.appendChild(el("div", "font-size:40px;text-align:center", "✅"));
      wrap.appendChild(
        el("div", "text-align:center;font-weight:700;font-size:18px;margin-top:6px", "Payment Successful"),
      );
      wrap.appendChild(
        el(
          "div",
          "text-align:center;color:#6b7280;font-size:13px;margin-top:4px",
          "₹" + Number(order.payable_amount).toFixed(2) + " • Order " + order.order_id,
        ),
      );
      if (typeof opts.onSuccess === "function") opts.onSuccess(order);
    }

    renderForm();
  }

  window.PanMePay = { mount: mount };
})();
