import assert from "node:assert/strict";
import test from "node:test";

import worker from "./index.js";

test("serves an existing static asset directly", async () => {
  const calls = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  };

  const response = await worker.fetch(
    new Request("https://example.com/assets/app.js"),
    env,
  );

  assert.equal(await response.text(), "asset");
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown page route", async () => {
  const calls = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        const path = new URL(request.url).pathname;
        calls.push(path);
        return path === "/index.html"
          ? new Response("app", { status: 200 })
          : new Response("missing", { status: 404 });
      },
    },
  };

  const response = await worker.fetch(
    new Request("https://example.com/settings", {
      headers: { accept: "text/html" },
    }),
    env,
  );

  assert.equal(await response.text(), "app");
  assert.deepEqual(calls, ["/settings", "/index.html"]);
});
