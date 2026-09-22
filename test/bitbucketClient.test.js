const assert = require("assert");
const http = require("http");
const {
  createClient,
  addComment,
  getPRCommentTexts,
  getPRCommentMetas,
  deleteComment,
  collectCommentMetas,
  approvePullRequest,
  unapprovePullRequest,
  getFileAtCommit,
  getCurrentUser,
} = require("../out/api/bitbucketClient");

async function requestError(baseUrl) {
  const client = createClient("tok", baseUrl);
  try {
    await client.get("/users/~");
    return null;
  } catch (err) {
    return err;
  }
}

(async () => {
  const httpsErr = await requestError("https://127.0.0.1:59999");
  assert.ok(httpsErr, "kapali https porta baglanti basarisiz olmali");
  assert.notStrictEqual(
    httpsErr.message,
    "https is not defined",
    "https protocol icin Node https moduli require edilmeli"
  );

  const captured = { method: "", path: "", body: null };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      captured.method = req.method;
      captured.path = req.url;
      const raw = Buffer.concat(chunks).toString("utf8");
      captured.body = raw ? JSON.parse(raw) : null;
      res.writeHead(200, { "Content-Type": "application/json" });
      if (String(req.url).includes("/pull-requests/42") && req.method === "GET" && !String(req.url).includes("/activities") && !String(req.url).includes("/comments")) {
        res.end(JSON.stringify({ id: 42, version: 3, title: "Fix" }));
        return;
      }
      if (req.method === "POST") {
        res.end(JSON.stringify({ id: 1 }));
        return;
      }
      if (req.method === "DELETE") {
        res.end(JSON.stringify({ approved: false }));
        return;
      }
      if (String(req.url).includes("/activities")) {
        res.end(
          JSON.stringify({
            isLastPage: true,
            values: [
              {
                action: "COMMENTED",
                comment: {
                  id: 100,
                  version: 1,
                  text: "ykb-pr-reviewer-extended npe",
                  author: { slug: "me" },
                  comments: [
                    { id: 101, version: 0, text: "insan reply", author: { slug: "other.user" } },
                  ],
                },
              },
            ],
          })
        );
        return;
      }
      res.end(JSON.stringify({ slug: "tester" }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const client = createClient("tok", `http://127.0.0.1:${port}`);
    const { data } = await client.get("/users/~");
    assert.strictEqual(data.slug, "tester");

    await addComment(client, "PAY", "payment-service", "42", "review body");
    assert.strictEqual(captured.method, "POST");
    assert.strictEqual(
      captured.path,
      "/rest/api/1.0/projects/PAY/repos/payment-service/pull-requests/42/comments"
    );
    assert.deepStrictEqual(captured.body, { text: "review body" });

    await addComment(client, "PAY", "payment-service", "42", "inline body", {
      path: "src/Foo.java",
      line: 11,
      lineType: "ADDED",
      fileType: "TO",
      diffType: "EFFECTIVE",
    });
    assert.strictEqual(captured.body.text, "inline body");
    assert.strictEqual(captured.body.anchor.path, "src/Foo.java");
    assert.strictEqual(captured.body.anchor.line, 11);
    assert.strictEqual(captured.body.anchor.lineType, "ADDED");

    const texts = await getPRCommentTexts(
      client,
      "PAY",
      "payment-service",
      "42"
    );
    assert.deepStrictEqual(texts, [
      "ykb-pr-reviewer-extended npe",
      "insan reply",
    ]);

    const metas = await getPRCommentMetas(
      client,
      "PAY",
      "payment-service",
      "42"
    );
    assert.deepStrictEqual(metas, [
      { id: 100, version: 1, text: "ykb-pr-reviewer-extended npe", authorSlug: "me" },
      { id: 101, version: 0, text: "insan reply", authorSlug: "other.user" },
    ]);

    assert.deepStrictEqual(
      collectCommentMetas([
        { action: "OPENED" },
        {
          action: "COMMENTED",
          comment: { id: 7, version: 2, text: "x", comments: null },
        },
        {
          action: "COMMENTED",
          comment: {
            id: 8,
            text: "version yok → 0",
            author: { name: "by-name" },
            comments: [{ text: "id yok, atlanir" }],
          },
        },
      ]),
      [
        { id: 7, version: 2, text: "x", authorSlug: "" },
        { id: 8, version: 0, text: "version yok → 0", authorSlug: "by-name" },
      ]
    );

    assert.deepStrictEqual(
      collectCommentMetas([
        {
          action: "COMMENTED",
          comment: {
            id: 9,
            version: 0,
            text: "slug oncelikli",
            author: { slug: "real-slug", name: "ignored" },
          },
        },
      ]),
      [
        {
          id: 9,
          version: 0,
          text: "slug oncelikli",
          authorSlug: "real-slug",
        },
      ]
    );

    assert.deepStrictEqual(
      collectCommentMetas([
        {
          action: "COMMENTED",
          comment: {
            id: 20,
            version: 0,
            text: "parent",
            author: { slug: "me" },
            comments: [
              {
                id: 21,
                version: 1,
                text: "reply",
                author: { slug: "me" },
                comments: [
                  {
                    id: 22,
                    version: 0,
                    text: "nested reply",
                    author: { slug: "other" },
                  },
                ],
              },
            ],
          },
        },
      ]),
      [
        { id: 20, version: 0, text: "parent", authorSlug: "me" },
        { id: 21, version: 1, text: "reply", authorSlug: "me" },
        { id: 22, version: 0, text: "nested reply", authorSlug: "other" },
      ],
      "nested reply'lar recursive toplanmalı"
    );

    await deleteComment(client, "PAY", "payment-service", "42", 100, 1);
    assert.strictEqual(captured.method, "DELETE");
    assert.strictEqual(
      captured.path,
      "/rest/api/1.0/projects/PAY/repos/payment-service/pull-requests/42/comments/100?version=1"
    );

    await approvePullRequest(client, "PAY", "payment-service", "42");
    assert.strictEqual(captured.method, "POST");
    assert.ok(
      String(captured.path).startsWith(
        "/rest/api/1.0/projects/PAY/repos/payment-service/pull-requests/42/approve"
      )
    );
    assert.ok(String(captured.path).includes("version=3"));

    await unapprovePullRequest(client, "PAY", "payment-service", "42");
    assert.strictEqual(captured.method, "DELETE");
    assert.ok(
      String(captured.path).startsWith(
        "/rest/api/1.0/projects/PAY/repos/payment-service/pull-requests/42/approve"
      )
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  const browseHits = [];
  const browseServer = http.createServer((req, res) => {
    browseHits.push(req.url);
    const url = String(req.url);
    if (url.includes("/browse/missing/NoFile.java")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ errors: [{ message: "not found" }] }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    if (url.includes("start=2")) {
      res.end(
        JSON.stringify({
          isLastPage: true,
          lines: [{ text: "  return x;" }, { text: "}" }],
        })
      );
      return;
    }
    res.end(
      JSON.stringify({
        isLastPage: false,
        nextPageStart: 2,
        lines: [{ text: "class Foo {" }, { text: "  int x;" }],
      })
    );
  });
  await new Promise((resolve) => browseServer.listen(0, "127.0.0.1", resolve));
  const browsePort = browseServer.address().port;
  try {
    const browseClient = createClient("tok", `http://127.0.0.1:${browsePort}`);
    const content = await getFileAtCommit(
      browseClient,
      "PAY",
      "payment-service",
      "src/Foo.java",
      "abc123"
    );
    assert.strictEqual(content, "class Foo {\n  int x;\n  return x;\n}");
    assert.ok(
      browseHits[0].includes(
        "/rest/api/1.0/projects/PAY/repos/payment-service/browse/src/Foo.java"
      )
    );
    assert.ok(browseHits[0].includes("at=abc123"));
    assert.strictEqual(browseHits.length, 2);

    const missing = await getFileAtCommit(
      browseClient,
      "PAY",
      "payment-service",
      "missing/NoFile.java",
      "abc123"
    );
    assert.strictEqual(missing, null);
  } finally {
    await new Promise((resolve) => browseServer.close(resolve));
  }

  const userHits = [];
  const userServer = http.createServer((req, res) => {
    userHits.push(req.url);
    res.writeHead(200, { "Content-Type": "application/json" });
    if (String(req.url).includes("/profile/recent/repos")) {
      res.end(JSON.stringify({ values: [{ slug: "payment-service" }] }));
      return;
    }
    res.end(JSON.stringify({ slug: "me" }));
  });
  await new Promise((resolve) => userServer.listen(0, "127.0.0.1", resolve));
  try {
    const userClient = createClient(
      "tok",
      `http://127.0.0.1:${userServer.address().port}`
    );
    const slug = await getCurrentUser(userClient);
    assert.strictEqual(
      slug,
      "me",
      "recent/repos values varsa da /users/~ slug kullanilmali"
    );
    assert.ok(userHits.some((url) => String(url).includes("/users/~")));
  } finally {
    await new Promise((resolve) => userServer.close(resolve));
  }

  // Bitbucket bazen /users/~ cevabında slug yerine yalnız name döner (comment author ile aynı).
  const nameOnlyServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    if (String(req.url).includes("/profile/recent/repos")) {
      res.end(JSON.stringify({ values: [] }));
      return;
    }
    res.end(JSON.stringify({ name: "u0102292", displayName: "Test User" }));
  });
  await new Promise((resolve) => nameOnlyServer.listen(0, "127.0.0.1", resolve));
  try {
    const nameClient = createClient(
      "tok",
      `http://127.0.0.1:${nameOnlyServer.address().port}`
    );
    const fromName = await getCurrentUser(nameClient);
    assert.strictEqual(
      fromName,
      "u0102292",
      "slug yokken name currentUser olarak kullanilmali"
    );
  } finally {
    await new Promise((resolve) => nameOnlyServer.close(resolve));
  }

  console.log("bitbucketClient tests OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
