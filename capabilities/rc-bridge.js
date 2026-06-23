/*
 * Shared helper for the RevenueCat WebView capability sample pages.
 *
 * Implements the Paywalls V2 web<->native bridge (protocol version 1):
 *   - pages call `window.RevenueCatWebView.postMessage({ type, component_id, ... })`
 *   - native replies arrive via `window.__revenueCatReceiveMessage(message)`
 *
 * The `component_id` MUST match the id of the `web_view` component that loaded this page,
 * otherwise the SDK drops the message. Each sample paywall passes it on the URL as `?cid=<id>`.
 */
(function () {
  "use strict";

  function queryParam(name) {
    var match = new RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : null;
  }

  var messageHandlers = [];

  var RC = {
    // Component id (== the web_view component's id), read from the `?cid=` query param.
    cid: queryParam("cid") || "",

    // True when running inside the SDK's WKWebView (the native bridge is injected).
    get bridgeAvailable() {
      return !!(window.RevenueCatWebView && typeof window.RevenueCatWebView.postMessage === "function");
    },

    // Post a message to native. Silently no-ops when not running inside the SDK.
    post: function (type, extra) {
      if (!RC.bridgeAvailable) {
        return false;
      }
      var message = { type: type, component_id: RC.cid };
      if (extra) {
        Object.keys(extra).forEach(function (key) {
          message[key] = extra[key];
        });
      }
      try {
        window.RevenueCatWebView.postMessage(message);
        return true;
      } catch (e) {
        return false;
      }
    },

    // Register a handler for native->web messages.
    onMessage: function (fn) {
      messageHandlers.push(fn);
    },

    // Append a status row to the page's `.rows` list and return a handle to update it.
    addRow: function (label, status, detail) {
      var list = document.querySelector(".rows");
      if (!list) {
        list = document.createElement("ul");
        list.className = "rows";
        document.body.appendChild(list);
      }
      var li = document.createElement("li");
      li.className = "row";
      var badge = document.createElement("span");
      var body = document.createElement("div");
      body.className = "body";
      var labelEl = document.createElement("div");
      labelEl.className = "label";
      var detailEl = document.createElement("div");
      detailEl.className = "detail";
      body.appendChild(labelEl);
      body.appendChild(detailEl);
      li.appendChild(badge);
      li.appendChild(body);
      list.appendChild(li);

      function apply(st, dt) {
        var s = st || "pending";
        badge.className = "badge " + s;
        badge.textContent = s === "pass" ? "PASS" : s === "fail" ? "FAIL" : s === "info" ? "INFO" : "…";
        if (dt !== undefined && dt !== null) {
          detailEl.textContent = dt;
        }
      }
      labelEl.textContent = label;
      apply(status, detail);

      return {
        set: function (st, dt) {
          apply(st, dt);
        }
      };
    }
  };

  // Native -> web entry point. Fan out to any registered handlers.
  window.__revenueCatReceiveMessage = function (message) {
    messageHandlers.forEach(function (fn) {
      try {
        fn(message);
      } catch (e) {
        /* ignore handler errors */
      }
    });
  };

  // Report unexpected JS errors back to native (and surface them on the page).
  window.addEventListener("error", function (event) {
    RC.post("rc:error", { error: String(event.message || "Unknown error") });
  });
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event && event.reason ? String(event.reason) : "Unhandled promise rejection";
    RC.post("rc:error", { error: reason });
  });

  // Let native know the step finished loading.
  document.addEventListener("DOMContentLoaded", function () {
    RC.post("rc:step-loaded");
    var banner = document.querySelector("[data-bridge-status]");
    if (banner) {
      banner.textContent = RC.bridgeAvailable
        ? "Native bridge: connected (cid: " + RC.cid + ")"
        : "Native bridge: not detected (open inside the app)";
    }
  });

  window.RC = RC;
})();
