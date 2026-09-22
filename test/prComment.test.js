const assert = require("assert");
const {
  buildPrCommentText,
  buildBlockingGeneralComment,
  resolveInlineComments,
  postInlineComments,
  postReviewComments,
  REVIEWER_COMMENT_MARKER,
  CODE_REVIEW_COMMENT_MARKER,
  EXTENSION_COMMENT_MARKERS,
  hasOurReviewComment,
  formatAlreadyCommentedWarning,
  filterOurReviewComments,
  deleteOurReviewComments,
  sanitizeBitbucketInlineMarkdown,
  formatReviewStamp,
} = require("../out/prComment");

assert.strictEqual(
  sanitizeBitbucketInlineMarkdown("**`log.error(...)`**"),
  "`log.error(...)`"
);
assert.strictEqual(
  sanitizeBitbucketInlineMarkdown("**`log.error(...)` stacktrace eksik**"),
  "`log.error(...)` stacktrace eksik"
);
assert.strictEqual(
  sanitizeBitbucketInlineMarkdown("**Geniş catch Exception maskeliyor**"),
  "**Geniş catch Exception maskeliyor**"
);
assert.strictEqual(typeof deleteOurReviewComments, "function");
assert.strictEqual(
  typeof require("../out/prComment").REPLACE_PREVIOUS_COMMENTS_ACTION,
  "undefined",
  "REPLACE_PREVIOUS_COMMENTS_ACTION kalkmali"
);

const stampFixed = formatReviewStamp({
  now: new Date(2026, 8, 16, 10, 31, 0),
  reviewNumber: 3,
});
assert.strictEqual(stampFixed, "16.09.2026 10:31 · Çarşamba · 3. review");

const text = buildPrCommentText("Bulgu: null check eksik.", "qwen3", {
  now: new Date(2026, 8, 16, 10, 31, 0),
  reviewNumber: 2,
});
assert.ok(text.includes("## 🤖 Copilot Otomatik Code Review"));
assert.ok(text.includes("Bulgu: null check eksik."));
assert.ok(
  text.includes("*Bu review **qwen3** modeli tarafından otomatik oluşturulmuştur.*") ||
    text.includes("qwen3")
);
assert.ok(text.includes("16.09.2026 10:31"));
assert.ok(text.includes("Çarşamba"));
assert.ok(text.includes("2. review"));
assert.ok(
  text.includes(REVIEWER_COMMENT_MARKER),
  "genel comment footer marker tasimali (auto-review skip)"
);

const blockingWithCritical = buildBlockingGeneralComment(
  [
    "## Özet",
    "küçük değişiklik",
    "",
    "## Critical",
    "1. **NPE riski**",
    "   - **File:** `src/Foo.java:11`",
    "   - **Sorun:** null check yok.",
    "",
    "## Minor",
    "- `src/Bar.java:40` naming kötü.",
    "",
    "## Sonuç",
    "Needs work",
  ].join("\n"),
  "qwen3"
);
assert.ok(blockingWithCritical.includes("## 🤖 Copilot Otomatik Code Review"));
assert.ok(blockingWithCritical.includes("## Critical"));
assert.ok(blockingWithCritical.includes("NPE riski"));
assert.ok(blockingWithCritical.includes("null check yok"));
assert.ok(
  !blockingWithCritical.includes("naming kötü"),
  "genel comment Important/Minor almamali"
);
assert.ok(
  !blockingWithCritical.includes("Needs work"),
  "genel comment Sonuç/Özet almamali"
);
assert.ok(blockingWithCritical.includes(REVIEWER_COMMENT_MARKER));

const noCriticalSection = buildBlockingGeneralComment(
  "## Important\n- `src/Foo.java:11` style\n",
  "qwen3"
);
assert.ok(
  noCriticalSection.includes("bloklayan Critical bulgu yok") ||
    noCriticalSection.toLowerCase().includes("critical bulgu yok"),
  "Critical yoksa aciklama yazilmali"
);
assert.ok(!noCriticalSection.includes("style"));
assert.ok(noCriticalSection.includes(REVIEWER_COMMENT_MARKER));

const emptyCritical = buildBlockingGeneralComment(
  "## Critical\n\n## Important\n1. naming\n",
  "qwen3"
);
assert.ok(
  emptyCritical.includes("bloklayan Critical bulgu yok") ||
    emptyCritical.toLowerCase().includes("critical bulgu yok")
);
assert.ok(!emptyCritical.includes("naming"));

const placeholderCritical = buildBlockingGeneralComment(
  "## Critical\nSorun yok.\n",
  "qwen3"
);
assert.ok(
  placeholderCritical.includes("bloklayan Critical bulgu yok") ||
    placeholderCritical.toLowerCase().includes("critical bulgu yok"),
  "placeholder Critical body bloklayan sayilmamali"
);

const diffData = {
  // EFFECTIVE diff: fromHash = target HEAD, toHash = Bitbucket merge hash
  fromHash: "target-head-bbb",
  toHash: "effective-merge-ccc",
  diffs: [
    {
      source: { toString: "src/Foo.java" },
      destination: { toString: "src/Foo.java" },
      hunks: [
        {
          sourceLine: 10,
          destinationLine: 10,
          segments: [
            { type: "CONTEXT", lines: [{ line: "void x() {" }] },
            { type: "ADDED", lines: [{ line: "return null;" }] },
          ],
        },
      ],
    },
    {
      source: { toString: "src/Bar.java" },
      destination: { toString: "src/Bar.java" },
      hunks: [
        {
          sourceLine: 39,
          destinationLine: 39,
          segments: [
            { type: "CONTEXT", lines: [{ line: "int a;" }] },
            { type: "ADDED", lines: [{ line: "int badName;" }] },
          ],
        },
      ],
    },
  ],
};

const review = `
## Critical
- \`src/Foo.java:11\` null check yok. NPE riski.

## Minor
src/Bar.java:40 naming kötü.

Zaman damgasi 2026-09-11T09:15:30 ve URL https://example.com:443 eslesmemeli.
`;

const comments = resolveInlineComments(review, diffData, "qwen3", {
  now: new Date(2026, 8, 16, 10, 31, 0),
  reviewNumber: 4,
});
assert.strictEqual(comments.length, 2, "iki satır comment üretilmeli");
assert.ok(comments.every((c) => c.anchor && c.anchor.line), "her comment inline anchor taşımalı");
assert.strictEqual(comments[0].anchor.path, "src/Foo.java");
assert.strictEqual(comments[0].anchor.line, 11);
assert.strictEqual(comments[0].anchor.lineType, "ADDED");
assert.strictEqual(comments[0].anchor.fileType, "TO");
assert.ok(comments[0].text.includes("null check"));
assert.ok(comments[0].text.includes("**Critical**"), "severity stamp Critical");
assert.ok(comments[0].text.includes("16.09.2026 10:31"));
assert.ok(comments[0].text.includes("Çarşamba"));
assert.ok(comments[0].text.includes("4. review"));
assert.ok(
  comments[0].text.includes(REVIEWER_COMMENT_MARKER),
  "inline comment bizim marker'i tasimali"
);
assert.strictEqual(comments[1].anchor.path, "src/Bar.java");
assert.strictEqual(comments[1].anchor.line, 40);
assert.ok(comments[1].text.includes("**Minor**"), "severity stamp Minor");

const unknownOnly = resolveInlineComments(
  "- `src/Missing.java:3` yok",
  diffData,
  "qwen3"
);
assert.strictEqual(unknownOnly.length, 0, "diff'te olmayan dosyaya comment yok");

// Model sikca File / Sorun / Neden bloklari yazar; sadece File satiri comment olmamali
const structuredDiff = {
  fromHash: "aaa",
  toHash: "bbb",
  diffs: [
    {
      source: { toString: "src/Pacs.java" },
      destination: { toString: "src/Pacs.java" },
      hunks: [
        {
          sourceLine: 28,
          destinationLine: 28,
          segments: [
            { type: "CONTEXT", lines: [{ line: "import a;" }, { line: "import b;" }] },
            { type: "ADDED", lines: [{ line: "import CollectionUtils;" }] },
          ],
        },
        {
          sourceLine: 168,
          destinationLine: 168,
          segments: [
            {
              type: "ADDED",
              lines: [
                { line: "try {" },
                { line: "  find();" },
                { line: "} catch (Exception e) {" },
                { line: "  return null;" },
                { line: "}" },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const structuredReview = `
## Important
1. **Geniş catch Exception maskeliyor**
   - **File:** \`src/Pacs.java:168-178\`
   - **Issue:** tum exception'lar yutulup null donuluyor.
   - **Why it matters:** compliance riski.
   - **Suggested code:**
\`\`\`java
} catch (NotFoundException e) {
  return Optional.empty();
}
\`\`\`

## Minor
1. **Unused import**
   - **File:** \`src/Pacs.java:29\`
   - **Issue:** CollectionUtils import edilmis ama kullanilmiyor.
   - **Why it matters:** Dead code.
`;

const structured = resolveInlineComments(
  structuredReview,
  structuredDiff,
  "GPT-5.4 mini"
);
assert.ok(structured.length >= 1, "structured bulgulardan comment uremeli");
const catchComment = structured.find((c) => c.text.includes("exception"));
assert.ok(catchComment, "Sorun satiri comment body'de olmali (sadece File satiri degil)");
assert.ok(
  catchComment.text.includes("Geniş catch") ||
    catchComment.text.includes("maskeliyor"),
  "baslik comment'te olmali"
);
assert.ok(
  !/^\*\*File:\*\*/m.test(catchComment.text.split("\n---\n")[0].trim()) ||
    catchComment.text.includes("Sorun"),
  "body yalnizca File satiri olmamali"
);
assert.ok(
  catchComment.text.includes("`GPT-5.4 mini`"),
  "model adi backtick icinde olmali (Bitbucket Jira autolink engeli)"
);
assert.ok(
  catchComment.text.includes("```java") &&
    catchComment.text.includes("NotFoundException"),
  "kisa duzeltilmis kod fenced block comment'te olmali"
);
const unused = structured.find((c) => c.text.includes("CollectionUtils"));
assert.ok(unused, "unused import bulgusu da gelmeli");
assert.ok(unused.text.includes("Dead code") || unused.text.includes("silin"));
assert.ok(
  !unused.text.includes("**File:**"),
  "inline body'de bos File label kalmamali (Bitbucket zaten path gosterir)"
);

const backtickTitleDiff = {
  fromHash: "aaa",
  toHash: "bbb",
  diffs: [
    {
      source: { toString: "src/Log.java" },
      destination: { toString: "src/Log.java" },
      hunks: [
        {
          sourceLine: 58,
          destinationLine: 58,
          segments: [
            { type: "CONTEXT", lines: [{ line: "try {" }] },
            { type: "ADDED", lines: [{ line: "log.error(...);" }] },
          ],
        },
      ],
    },
  ],
};
const backtickComments = resolveInlineComments(
  `
## Important
1. **\`log.error(...)\` stacktrace eksik**
   - **File:** \`src/Log.java:59\`
   - **Sorun:** exception stacktrace eklenmiyor.
`,
  backtickTitleDiff,
  "qwen3"
);
assert.strictEqual(backtickComments.length, 1);
const logBody = backtickComments[0].text.split("\n---\n")[0];
assert.ok(logBody.includes("`log.error(...)`"));
assert.ok(
  !/\*\*`/.test(logBody),
  "Bitbucket <strong>`</strong> ureten **` kalmamali"
);

assert.strictEqual(
  hasOurReviewComment(["baska yorum", `ok\n${REVIEWER_COMMENT_MARKER}`]),
  true
);
assert.strictEqual(hasOurReviewComment(["sadece insan yorumu"]), false);
assert.strictEqual(hasOurReviewComment([]), false);

const warn = formatAlreadyCommentedWarning([
  { id: 12, title: "fix npe" },
  { id: 15, title: "refactor" },
]);
assert.ok(warn.includes("#12"));
assert.ok(warn.includes("#15"));
assert.ok(warn.includes("Daha önce comment"));
assert.strictEqual(formatAlreadyCommentedWarning([]), "");

const metas = [
  { id: 1, version: 0, text: "insan yorumu" },
  { id: 2, version: 1, text: `npe\n---\n*qwen3* · ${REVIEWER_COMMENT_MARKER}` },
  // Bosluklu / bozuk marker — eslesmemeli
  { id: 3, version: 2, text: `YK B-PR-REVIEWER-EXTENDED buyuk harf` },
];
const ours = filterOurReviewComments(metas);
assert.deepStrictEqual(
  ours.map((c) => ({ id: c.id, version: c.version })),
  [{ id: 2, version: 1 }],
  "sadece tam marker tasiyan comment"
);
assert.deepStrictEqual(filterOurReviewComments([]), []);
assert.deepStrictEqual(filterOurReviewComments(null), []);

function addedFileDiff(filePath, destLine) {
  return {
    source: { toString: filePath },
    destination: { toString: filePath },
    hunks: [
      {
        sourceLine: destLine - 1,
        destinationLine: destLine - 1,
        segments: [
          { type: "CONTEXT", lines: [{ line: "void x() {" }] },
          { type: "ADDED", lines: [{ line: "return null;" }] },
        ],
      },
    ],
  };
}

const capDiffs = [addedFileDiff("src/Crit.java", 10), addedFileDiff("src/Imp.java", 10)];
const capReviewLines = [
  "## Minor",
];
for (let i = 0; i < 20; i++) {
  const p = `src/Min${i}.java`;
  capDiffs.push(addedFileDiff(p, 10));
  capReviewLines.push(`**File:** \`${p}:11\``);
  capReviewLines.push("**Issue:** naming");
  capReviewLines.push("");
}
capReviewLines.push("## Important");
capReviewLines.push("**File:** `src/Imp.java:11`");
capReviewLines.push("**Issue:** pageSize");
capReviewLines.push("");
capReviewLines.push("## Critical");
capReviewLines.push("**File:** `src/Crit.java:11`");
capReviewLines.push("**Issue:** orphanRemoval clear");
capReviewLines.push("");

const capped = resolveInlineComments(
  capReviewLines.join("\n"),
  { fromHash: "a", toHash: "b", diffs: capDiffs },
  "qwen3"
);
assert.strictEqual(capped.length, 20, "MAX_INLINE_COMMENTS=20");
assert.strictEqual(capped[0].anchor.path, "src/Crit.java", "Critical cap'te önce");
assert.strictEqual(capped[1].anchor.path, "src/Imp.java", "Important Critical'dan sonra");
assert.ok(
  capped.every((c) => c.anchor.path !== "src/Min19.java") ||
    capped.some((c) => c.anchor.path === "src/Crit.java"),
  "Minor kotayı doldurup Critical kaçırmasın"
);

(async () => {
  // prDetails bilerek yanlis branch tip hash'leri tasir; gonderilmemeli
  const sharedArgs = {
    client: {},
    projectKey: "PAY",
    repoSlug: "payment-service",
    prId: "42",
    reviewText: review,
    modelLabel: "qwen3",
    prDetails: {
      fromRef: { latestCommit: "aaa" },
      toRef: { latestCommit: "bbb" },
    },
  };

  const posted = [];
  const n = await postInlineComments({
    ...sharedArgs,
    addCommentFn: async (_client, _pk, _rs, _id, text, anchor) => {
      posted.push({ text, anchor });
    },
    diffData,
  });
  assert.strictEqual(n, 2);
  assert.ok(posted.every((p) => p.anchor && p.anchor.line && p.anchor.path));
  // Branch tip'leri degil; ayni EFFECTIVE diff response'taki hash'ler kullanilmali
  assert.strictEqual(posted[0].anchor.fromHash, "target-head-bbb");
  assert.strictEqual(posted[0].anchor.toHash, "effective-merge-ccc");

  const postedWithoutDiffHashes = [];
  await postInlineComments({
    ...sharedArgs,
    addCommentFn: async (_c, _pk, _rs, _id, text, anchor) => {
      postedWithoutDiffHashes.push({ text, anchor });
    },
    diffData: { diffs: diffData.diffs },
  });
  assert.strictEqual(
    postedWithoutDiffHashes[0].anchor.fromHash,
    undefined,
    "yanlis branch tip hash gondermemeli"
  );
  assert.strictEqual(postedWithoutDiffHashes[0].anchor.toHash, undefined);

  const mixedPosted = [];
  const mixed = await postReviewComments({
    ...sharedArgs,
    addCommentFn: async (_c, _pk, _rs, _id, text, anchor) => {
      mixedPosted.push({ text, anchor });
    },
    diffData,
  });
  assert.strictEqual(mixed.inlineCount, 2, "inline comment sayisi ayni kalmali");
  assert.strictEqual(mixed.generalCount, 1, "bir genel comment atilmali");
  const general = mixedPosted.filter((p) => !p.anchor);
  const inlineOnly = mixedPosted.filter((p) => p.anchor);
  assert.strictEqual(inlineOnly.length, 2);
  assert.strictEqual(general.length, 1);
  assert.ok(general[0].text.includes("## Critical"));
  assert.ok(general[0].text.includes("null check"));
  assert.ok(!general[0].text.includes("naming kötü"));
  assert.ok(general[0].text.includes(REVIEWER_COMMENT_MARKER));

  const nonePosted = [];
  const noneResult = await postReviewComments({
    ...sharedArgs,
    reviewText: "## Important\n- `src/Bar.java:40` naming\n",
    addCommentFn: async (_c, _pk, _rs, _id, text, anchor) => {
      nonePosted.push({ text, anchor });
    },
    diffData,
  });
  assert.strictEqual(noneResult.generalCount, 1);
  const noneGeneral = nonePosted.find((p) => !p.anchor);
  assert.ok(noneGeneral);
  assert.ok(
    noneGeneral.text.includes("bloklayan Critical bulgu yok") ||
      noneGeneral.text.toLowerCase().includes("critical bulgu yok")
  );

  const mine = `npe\n---\n*qwen3* · ${REVIEWER_COMMENT_MARKER}`;
  const otherBot = `npe\n---\n*qwen3* · ${REVIEWER_COMMENT_MARKER}`;
  const deleteArgs = {
    client: {},
    projectKey: "PAY",
    repoSlug: "payment-service",
    prId: "42",
    currentUserSlug: "me",
    getCommentMetasFn: async () => [
      { id: 1, version: 0, text: "insan yorumu", authorSlug: "me" },
      { id: 2, version: 1, text: mine, authorSlug: "me" },
      { id: 3, version: 2, text: otherBot, authorSlug: "other.user" },
      { id: 4, version: 0, text: mine, authorSlug: "me" },
      { id: 5, version: 0, text: mine },
    ],
  };

  const deletedOwn = [];
  const ownResult = await deleteOurReviewComments({
    ...deleteArgs,
    deleteCommentFn: async (_c, _pk, _rs, _id, commentId, version) => {
      deletedOwn.push({ commentId, version });
    },
  });
  assert.deepStrictEqual(
    deletedOwn,
    [
      { commentId: 4, version: 0 },
      { commentId: 2, version: 1 },
    ],
    "sadece kendi marker'li comment'ler, reply once (ters sira)"
  );
  assert.deepStrictEqual(ownResult, {
    attempted: 2,
    deleted: 2,
    markerCount: 4,
    errors: [],
  });

  const nestedMine = `npe\n---\n*qwen3* · ${REVIEWER_COMMENT_MARKER}`;
  const deletedNested = [];
  const nestedResult = await deleteOurReviewComments({
    client: {},
    projectKey: "PAY",
    repoSlug: "payment-service",
    prId: "42",
    currentUserSlug: "me",
    getCommentMetasFn: async () => [
      { id: 20, version: 0, text: nestedMine, authorSlug: "me" },
      { id: 21, version: 1, text: nestedMine, authorSlug: "me" },
      { id: 22, version: 0, text: nestedMine, authorSlug: "me" },
    ],
    deleteCommentFn: async (_c, _pk, _rs, _id, commentId, version) => {
      deletedNested.push({ commentId, version });
    },
  });
  assert.deepStrictEqual(
    deletedNested,
    [
      { commentId: 22, version: 0 },
      { commentId: 21, version: 1 },
      { commentId: 20, version: 0 },
    ],
    "nested reply dahil kendi marker comment'lerin hepsi, child once"
  );
  assert.deepStrictEqual(nestedResult, {
    attempted: 3,
    deleted: 3,
    markerCount: 3,
    errors: [],
  });

  const deletedNoSlug = [];
  const noSlugResult = await deleteOurReviewComments({
    ...deleteArgs,
    currentUserSlug: "",
    deleteCommentFn: async (_c, _pk, _rs, _id, commentId) => {
      deletedNoSlug.push(commentId);
    },
  });
  assert.deepStrictEqual(deletedNoSlug, [], "slug yoksa ve tek author yoksa silinmez");
  assert.deepStrictEqual(noSlugResult, {
    attempted: 0,
    deleted: 0,
    markerCount: 4,
    errors: [],
  });

  const postedNoSlugWithMarker = [];
  let noSlugWithMarkerErr = null;
  try {
    await postReviewComments({
      ...sharedArgs,
      currentUserSlug: "",
      getCommentMetasFn: deleteArgs.getCommentMetasFn,
      deleteCommentFn: async () => {},
      addCommentFn: async (_c, _pk, _rs, _id, text, anchor) => {
        postedNoSlugWithMarker.push({ text, anchor });
      },
      diffData,
    });
  } catch (err) {
    noSlugWithMarkerErr = err;
  }
  assert.ok(noSlugWithMarkerErr, "slug yok + marker varsa throw");
  assert.ok(
    String(noSlugWithMarkerErr.message).includes("currentUserSlug") ||
      String(noSlugWithMarkerErr.message).toLowerCase().includes("duplicate"),
    "hata duplicate önlemini anlatmalı"
  );
  assert.strictEqual(
    postedNoSlugWithMarker.length,
    0,
    "slug yok + önceki bot comment varken yeni post yok"
  );

  // API slug vermezse ama PR'da tek author'lı bot comment varsa onu "ben" say.
  const postedInferred = [];
  const deletedInferred = [];
  const inferredResult = await postReviewComments({
    ...sharedArgs,
    currentUserSlug: "",
    getCommentMetasFn: async () => [
      { id: 10, version: 0, text: mine, authorSlug: "u0102292" },
      { id: 11, version: 1, text: mine, authorSlug: "u0102292" },
      { id: 12, version: 0, text: "insan", authorSlug: "other" },
    ],
    deleteCommentFn: async (_c, _pk, _rs, _id, commentId, version) => {
      deletedInferred.push({ commentId, version });
    },
    addCommentFn: async (_c, _pk, _rs, _id, text, anchor) => {
      postedInferred.push({ text, anchor });
    },
    diffData,
  });
  assert.deepStrictEqual(
    deletedInferred,
    [
      { commentId: 11, version: 1 },
      { commentId: 10, version: 0 },
    ],
    "tek author'lı bot comment'ler silinmeli"
  );
  assert.ok(inferredResult.inlineCount >= 1 || inferredResult.generalCount >= 1);
  assert.ok(postedInferred.length > 0, "infer edilen slug ile post devam etmeli");

  const postedNoSlugFirstReview = [];
  await postReviewComments({
    ...sharedArgs,
    currentUserSlug: "",
    getCommentMetasFn: async () => [
      { id: 1, version: 0, text: "insan yorumu", authorSlug: "other" },
    ],
    deleteCommentFn: async () => {},
    addCommentFn: async (_c, _pk, _rs, _id, text, anchor) => {
      postedNoSlugFirstReview.push({ text, anchor });
    },
    diffData,
  });
  assert.ok(
    postedNoSlugFirstReview.length > 0,
    "slug yok ama marker yoksa ilk review post edilir"
  );

  const deletedPartial = [];
  const partial = await deleteOurReviewComments({
    ...deleteArgs,
    deleteCommentFn: async (_c, _pk, _rs, _id, commentId) => {
      deletedPartial.push(commentId);
      if (commentId === 4) throw new Error("409 conflict");
    },
  });
  assert.deepStrictEqual(deletedPartial, [4, 2], "hata olsa da sonrakiler denenir");
  assert.strictEqual(partial.attempted, 2);
  assert.strictEqual(partial.deleted, 1);
  assert.strictEqual(partial.markerCount, 4);
  assert.strictEqual(partial.errors.length, 1);
  assert.strictEqual(partial.errors[0].id, 4);
  assert.strictEqual(partial.errors[0].phase, "delete");
  assert.ok(
    String(partial.errors[0].error.message).includes("409"),
    "hata mesajı log detayında olmalı"
  );

  const deletedAfterListFail = [];
  const listFail = await deleteOurReviewComments({
    ...deleteArgs,
    getCommentMetasFn: async () => {
      throw new Error("activities 500");
    },
    deleteCommentFn: async (_c, _pk, _rs, _id, commentId) => {
      deletedAfterListFail.push(commentId);
    },
  });
  assert.deepStrictEqual(deletedAfterListFail, []);
  assert.strictEqual(listFail.attempted, 0);
  assert.strictEqual(listFail.deleted, 0);
  assert.strictEqual(listFail.markerCount, 0);
  assert.strictEqual(listFail.errors.length, 1);
  assert.strictEqual(listFail.errors[0].phase, "list");
  assert.ok(String(listFail.errors[0].error.message).includes("activities 500"));

  // API slug yanlış ama tek bot author → infer ile sil (Silindi: 0 fix)
  const deletedWrongSlug = [];
  const wrongSlugResult = await deleteOurReviewComments({
    client: {},
    projectKey: "PAY",
    repoSlug: "payment-service",
    prId: "99",
    currentUserSlug: "wrong-from-api",
    getCommentMetasFn: async () => [
      { id: 70, version: 0, text: mine, authorSlug: "u0102292" },
      { id: 71, version: 1, text: mine, authorSlug: "u0102292" },
      { id: 72, version: 0, text: "insan", authorSlug: "other" },
    ],
    deleteCommentFn: async (_c, _pk, _rs, _id, commentId, version) => {
      deletedWrongSlug.push({ commentId, version });
    },
  });
  assert.deepStrictEqual(
    deletedWrongSlug,
    [
      { commentId: 71, version: 1 },
      { commentId: 70, version: 0 },
    ],
    "yanlış API slug + tek bot author → silinmeli"
  );
  assert.deepStrictEqual(wrongSlugResult, {
    attempted: 2,
    deleted: 2,
    markerCount: 2,
    errors: [],
  });

  // DELETE HTTP hatası: status + responseData log detayında
  const httpFail = await deleteOurReviewComments({
    client: {},
    projectKey: "PAY",
    repoSlug: "payment-service",
    prId: "7",
    currentUserSlug: "me",
    getCommentMetasFn: async () => [
      { id: 80, version: 3, text: mine, authorSlug: "me" },
    ],
    deleteCommentFn: async () => {
      const err = new Error("Request failed with status code 409");
      err.response = {
        status: 409,
        statusText: "Conflict",
        data: { errors: [{ message: "version mismatch" }] },
      };
      throw err;
    },
  });
  assert.strictEqual(httpFail.deleted, 0);
  assert.strictEqual(httpFail.errors.length, 1);
  assert.strictEqual(httpFail.errors[0].error.status, 409);
  assert.deepStrictEqual(httpFail.errors[0].error.responseData, {
    errors: [{ message: "version mismatch" }],
  });

  const postedAfterDelete = [];
  const deletedDuringPost = [];
  const nAfterDelete = await postInlineComments({
    ...sharedArgs,
    currentUserSlug: "me",
    getCommentMetasFn: deleteArgs.getCommentMetasFn,
    deleteCommentFn: async (_c, _pk, _rs, _id, commentId) => {
      deletedDuringPost.push(commentId);
    },
    addCommentFn: async (_c, _pk, _rs, _id, text, anchor) => {
      postedAfterDelete.push({ text, anchor });
    },
    diffData,
  });
  assert.deepStrictEqual(deletedDuringPost, [4, 2]);
  assert.strictEqual(nAfterDelete, 2);
  assert.strictEqual(postedAfterDelete.length, 2);

  const postedAfterDeleteFail = [];
  await postInlineComments({
    ...sharedArgs,
    currentUserSlug: "me",
    getCommentMetasFn: deleteArgs.getCommentMetasFn,
    deleteCommentFn: async () => {
      throw new Error("delete 403");
    },
    addCommentFn: async (_c, _pk, _rs, _id, text, anchor) => {
      postedAfterDeleteFail.push({ text, anchor });
    },
    diffData,
  });
  assert.strictEqual(
    postedAfterDeleteFail.length,
    2,
    "silme hata verse de yeni comment atilir"
  );

  const postedWhenListFails = [];
  const deletedWhenListFails = [];
  await postInlineComments({
    ...sharedArgs,
    currentUserSlug: "me",
    getCommentMetasFn: async () => {
      throw new Error("activities down");
    },
    deleteCommentFn: async (_c, _pk, _rs, _id, commentId) => {
      deletedWhenListFails.push(commentId);
    },
    addCommentFn: async (_c, _pk, _rs, _id, text, anchor) => {
      postedWhenListFails.push({ text, anchor });
    },
    diffData,
  });
  assert.deepStrictEqual(deletedWhenListFails, []);
  assert.strictEqual(postedWhenListFails.length, 2);

  const postedWithoutFns = [];
  await postInlineComments({
    ...sharedArgs,
    addCommentFn: async (_c, _pk, _rs, _id, text, anchor) => {
      postedWithoutFns.push({ text, anchor });
    },
    diffData,
  });
  assert.strictEqual(
    postedWithoutFns.length,
    2,
    "fn yoksa silme atlanir, post devam eder"
  );

  const bulkText = `npe\n---\n*qwen3* · ${REVIEWER_COMMENT_MARKER}`;
  const codeText = `npe\n---\n*qwen3* · ${CODE_REVIEW_COMMENT_MARKER}`;
  const markerMix = [
    { id: 1, version: 0, text: bulkText, authorSlug: "me" },
    { id: 2, version: 0, text: codeText, authorSlug: "me" },
    { id: 3, version: 0, text: "insan", authorSlug: "me" },
  ];
  assert.strictEqual(
    filterOurReviewComments(markerMix).length,
    1,
    "default marker code-review soneğini tutmaz"
  );
  assert.strictEqual(filterOurReviewComments(markerMix)[0].id, 1);
  assert.deepStrictEqual(
    filterOurReviewComments(markerMix, EXTENSION_COMMENT_MARKERS).map((m) => m.id),
    [1, 2],
    "Code Review silme Dev Bulk + code-review marker"
  );
  assert.strictEqual(
    filterOurReviewComments(markerMix, CODE_REVIEW_COMMENT_MARKER).length,
    1
  );
  assert.strictEqual(
    filterOurReviewComments(markerMix, CODE_REVIEW_COMMENT_MARKER)[0].id,
    2
  );

  const deletedBoth = [];
  await deleteOurReviewComments({
    client: {},
    projectKey: "PAY",
    repoSlug: "payment-service",
    prId: "7",
    currentUserSlug: "me",
    marker: EXTENSION_COMMENT_MARKERS,
    getCommentMetasFn: async () => markerMix,
    deleteCommentFn: async (_c, _pk, _rs, _id, commentId) => {
      deletedBoth.push(commentId);
    },
  });
  assert.deepStrictEqual(deletedBoth.sort(), [1, 2]);

  console.log("prComment tests OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
