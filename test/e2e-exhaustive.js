const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 8789; // Unique port for testing
const WORKER_URL = `http://localhost:${PORT}`;
const CLI_BIN = path.resolve(__dirname, '../cli/dist/index.js');
const WORKER_DIR = path.resolve(__dirname, '../worker');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/`);
      if (res.status === 200) return true;
    } catch {
      // Server not ready yet
    }
    await sleep(250);
  }
  throw new Error(`Worker did not become ready at ${url} within ${timeoutMs}ms`);
}

function runCli(args, opts = {}) {
  const cmd = `node "${CLI_BIN}" ${args}`;
  try {
    const stdout = execSync(cmd, { encoding: 'utf-8', ...opts });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      status: err.status || 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : (err.message || ''),
    };
  }
}

async function main() {
  console.log('====================================================');
  console.log(' STARTING EXHAUSTIVE END-TO-END TEST SUITE');
  console.log('====================================================\n');

  console.log(`Starting wrangler dev on port ${PORT}...`);
  const wrangler = spawn('npx', ['wrangler', 'dev', '--port', String(PORT)], {
    cwd: WORKER_DIR,
    stdio: 'pipe',
  });

  wrangler.stderr.on('data', (d) => {
    // console.error('[wrangler:err]', d.toString());
  });

  try {
    await waitForServer(WORKER_URL);
    console.log(`✓ Worker is listening at ${WORKER_URL}\n`);

    // Setup CLI login
    console.log('[Test 1] CLI Login Setup');
    const loginRes = runCli(`login --url ${WORKER_URL}`);
    if (loginRes.status !== 0) throw new Error('CLI login failed: ' + loginRes.stderr);
    console.log('✓ CLI login succeeded.\n');

    // Test 2: Standard lifecycle
    console.log('[Test 2] Standard Document Lifecycle (Publish -> Outline -> Patch -> Read)');
    const testDoc1 = 'test-doc1.md';
    fs.writeFileSync(
      testDoc1,
      `# System Overview

Intro section.

## Architecture
Edge nodes on Cloudflare.

## Roadmap
* Q1 Launch
`
    );

    const pub1 = JSON.parse(runCli(`publish ${testDoc1} --json`).stdout);
    if (!pub1.id || !pub1.url) throw new Error('Publish returned invalid payload: ' + JSON.stringify(pub1));
    console.log(`✓ Published document ID: ${pub1.id}`);

    const outline1 = JSON.parse(runCli(`outline ${pub1.id} --json`).stdout);
    if (outline1.outline.length !== 3) throw new Error('Outline count mismatch: expected 3');
    console.log(`✓ Outline extracted ${outline1.outline.length} sections accurately.`);

    const patch1 = JSON.parse(
      runCli(`patch ${pub1.id} --section "Architecture" --content "Distributed worldwide edge compute." --json`).stdout
    );
    if (patch1.version !== 2) throw new Error('Patch version mismatch: expected v2');
    console.log(`✓ Section patched to version v${patch1.version}.`);

    const get1 = JSON.parse(runCli(`get ${pub1.id} --json`).stdout);
    if (!get1.markdown.includes('Distributed worldwide edge compute.')) {
      throw new Error('Patched content missing from document.');
    }
    console.log('✓ Document verified after patch.');

    const htmlRes1 = await fetch(pub1.url);
    const html1 = await htmlRes1.text();
    if (!html1.includes('Distributed worldwide edge compute.') || !html1.includes('System Overview')) {
      throw new Error('Public rendered HTML missing patched content.');
    }
    console.log(`✓ Public rendered HTML verified (HTTP ${htmlRes1.status}, ${html1.length} bytes).\n`);
    fs.unlinkSync(testDoc1);

    // Test 3: Code blocks with '#' comments
    console.log('[Test 3] Code Blocks with # Comments');
    const testDocCode = 'test-code.md';
    fs.writeFileSync(
      testDocCode,
      `# Script Reference

## Python Guide
Here is sample code:
\`\`\`python
# Configuration parameter
TIMEOUT = 30
# Database connection
def connect():
    pass
\`\`\`

## Next Steps
Deploy to cluster.
`
    );
    const pubCode = JSON.parse(runCli(`publish ${testDocCode} --json`).stdout);
    const outlineCode = JSON.parse(runCli(`outline ${pubCode.id} --json`).stdout);
    const codeHeadings = outlineCode.outline.map((o) => o.heading);
    if (codeHeadings.includes('Configuration parameter') || codeHeadings.includes('Database connection')) {
      throw new Error('Code fence failure: code comments mistakenly parsed as headings!');
    }
    console.log('✓ Outline correctly ignored # comments inside code blocks.');

    // Patch Python Guide section across the code block
    const patchCode = JSON.parse(
      runCli(`patch ${pubCode.id} --section "Python Guide" --content "Updated python guide without snippets." --json`).stdout
    );
    const getCode = JSON.parse(runCli(`get ${pubCode.id} --json`).stdout);
    if (!getCode.markdown.includes('## Next Steps') || getCode.markdown.includes('TIMEOUT = 30')) {
      throw new Error('Section replacement failed across code block boundary.');
    }
    console.log('✓ Section replacement correctly handled code block boundaries.\n');
    fs.unlinkSync(testDocCode);

    // Test 4: Regex and special characters in heading titles
    console.log('[Test 4] Regex & Special Characters in Heading Titles');
    const testDocSpecial = 'test-special.md';
    fs.writeFileSync(
      testDocSpecial,
      `# Special Specs

## What's Next? (2026 Roadmap & [Beta] v1.0)
Special characters testing.

## Final Note
End of doc.
`
    );
    const pubSpecial = JSON.parse(runCli(`publish ${testDocSpecial} --json`).stdout);
    const patchSpecial = JSON.parse(
      runCli(
        `patch ${pubSpecial.id} --section "What's Next? (2026 Roadmap & [Beta] v1.0)" --content "Replaced special title section." --json`
      ).stdout
    );
    const getSpecial = JSON.parse(runCli(`get ${pubSpecial.id} --json`).stdout);
    if (!getSpecial.markdown.includes('Replaced special title section.') || !getSpecial.markdown.includes('## Final Note')) {
      throw new Error('Surgical patch failed on heading with regex special characters.');
    }
    console.log('✓ Successfully patched heading with special characters (parentheses, brackets, question marks).\n');
    fs.unlinkSync(testDocSpecial);

    // Test 5: Hierarchical duplicate heading targeting
    console.log('[Test 5] Hierarchical Duplicate Heading Targeting (Frontend > Storage vs Backend > Storage)');
    const testDocDup = 'test-dup.md';
    fs.writeFileSync(
      testDocDup,
      `# Application Arch

## Backend
### Storage
Postgres database

## Frontend
### Storage
Local browser storage
`
    );
    const pubDup = JSON.parse(runCli(`publish ${testDocDup} --json`).stdout);
    runCli(`patch ${pubDup.id} --section "Frontend > Storage" --content "IndexedDB cache store" --json`);
    const getDup = JSON.parse(runCli(`get ${pubDup.id} --json`).stdout);
    if (!getDup.markdown.includes('Postgres database') || !getDup.markdown.includes('IndexedDB cache store')) {
      throw new Error('Hierarchical patch failed: modified wrong storage section.');
    }
    console.log('✓ Successfully targeted "Frontend > Storage" while preserving "Backend > Storage".\n');
    fs.unlinkSync(testDocDup);

    // Test 6: Exact substring replace and error on non-existent text
    console.log('[Test 6] Exact Substring Replacement & Error Boundaries');
    const testDocReplace = 'test-replace.md';
    fs.writeFileSync(testDocReplace, '# Document\n\nstatus: **draft**\n\nNotes here.');
    const pubReplace = JSON.parse(runCli(`publish ${testDocReplace} --json`).stdout);

    const patchReplace = JSON.parse(
      runCli(`patch ${pubReplace.id} --find "status: **draft**" --replace "status: **production**" --json`).stdout
    );
    const getReplace = JSON.parse(runCli(`get ${pubReplace.id} --json`).stdout);
    if (!getReplace.markdown.includes('status: **production**')) {
      throw new Error('Exact text replacement failed.');
    }
    console.log('✓ Exact text replacement with markdown bold succeeded.');

    // Failure case: non-existent text
    const failReplace = runCli(`patch ${pubReplace.id} --find "non-existent-string" --replace "foo" --json`);
    if (failReplace.status === 0) {
      throw new Error('Expected failure when finding non-existent text, but succeeded.');
    }
    console.log('✓ Correctly returned error code when text snippet was not found.\n');
    fs.unlinkSync(testDocReplace);

    // Test 7: Append to section (middle vs last section at EOF)
    console.log('[Test 7] Append to Section (Middle & Last Section at EOF)');
    const testDocAppend = 'test-append.md';
    fs.writeFileSync(
      testDocAppend,
      `# Changelog

## v1.0.0
* Initial release

## Future
* Idea 1
`
    );
    const pubAppend = JSON.parse(runCli(`publish ${testDocAppend} --json`).stdout);

    // Append to middle section (v1.0.0)
    runCli(`patch ${pubAppend.id} --section "v1.0.0" --append "* Patch 1 added" --json`);

    // Append to last section (Future)
    runCli(`patch ${pubAppend.id} --section "Future" --append "* Idea 2 added" --json`);

    const getAppend = JSON.parse(runCli(`get ${pubAppend.id} --json`).stdout);
    if (!getAppend.markdown.includes('* Patch 1 added\n\n## Future') || !getAppend.markdown.includes('* Idea 2 added')) {
      throw new Error('Append to section failed: content formatting or position incorrect.');
    }
    console.log('✓ Successfully appended to both middle section and end-of-file section.\n');
    fs.unlinkSync(testDocAppend);

    // Test 8: Unicode, Emojis, and Multilingual Content
    console.log('[Test 8] Unicode, Emojis, and Multilingual Headings');
    const testDocUni = 'test-unicode.md';
    fs.writeFileSync(
      testDocUni,
      `# 🚀 项目计划 (Project Plan)

## 📌 架构设计
分布式边缘网络。

## 🎯 目標 (Goals)
100% 可用性。
`
    );
    const pubUni = JSON.parse(runCli(`publish ${testDocUni} --json`).stdout);
    runCli(`patch ${pubUni.id} --section "📌 架构设计" --content "更新后的分布式架构。" --json`);
    const getUni = JSON.parse(runCli(`get ${pubUni.id} --json`).stdout);
    if (!getUni.markdown.includes('更新后的分布式架构。') || !getUni.markdown.includes('## 🎯 目標 (Goals)')) {
      throw new Error('Unicode section patch failed.');
    }
    console.log('✓ Unicode, Chinese/Japanese characters, and emojis handled flawlessly.\n');
    fs.unlinkSync(testDocUni);

    // Test 9: Stdin Pipe Publishing
    console.log('[Test 9] Stdin Pipe Publishing');
    const pipeRes = execSync(`echo "# Piped Document\\n\\nContent streamed via stdin." | node "${CLI_BIN}" publish - --json`, {
      encoding: 'utf-8',
    });
    const pubPipe = JSON.parse(pipeRes);
    if (!pubPipe.id) throw new Error('Stdin pipe publish failed.');
    const getPipe = JSON.parse(runCli(`get ${pubPipe.id} --json`).stdout);
    if (!getPipe.markdown.includes('Content streamed via stdin.')) {
      throw new Error('Piped content mismatch.');
    }
    console.log(`✓ Stdin pipe publishing succeeded for document ID ${pubPipe.id}.\n`);

    // Test 10: Custom Slugs & Duplicate Conflict Detection
    console.log('[Test 10] Custom Slugs & 409 Conflict Handling');
    const testDocSlug = 'test-slug.md';
    fs.writeFileSync(testDocSlug, '# Custom Slug Test\n\nDocument with specific slug.');
    const customSlug = 'my-custom-doc-' + Date.now();

    const pubSlug = JSON.parse(runCli(`publish ${testDocSlug} --slug ${customSlug} --json`).stdout);
    if (pubSlug.id !== customSlug) throw new Error(`Expected slug ${customSlug}, got ${pubSlug.id}`);
    console.log(`✓ Successfully published with custom slug: ${pubSlug.id}`);

    // Try publishing again with the same custom slug (must return 409 conflict)
    const pubConflict = runCli(`publish ${testDocSlug} --slug ${customSlug} --json`);
    if (pubConflict.status === 0 || !pubConflict.stderr.includes('already exists')) {
      throw new Error('Expected 409 conflict error on duplicate custom slug, but succeeded.');
    }
    console.log('✓ Duplicate custom slug correctly rejected with conflict error.\n');
    fs.unlinkSync(testDocSlug);

    // Test 11: TTL & Expiration Handling
    console.log('[Test 11] TTL Parsing and Parameter Handling');
    const testDocTtl = 'test-ttl.md';
    fs.writeFileSync(testDocTtl, '# Ephemeral Doc\n\nExpires in 24 hours.');
    const pubTtl = JSON.parse(runCli(`publish ${testDocTtl} --ttl 24h --json`).stdout);
    if (!pubTtl.id) throw new Error('TTL publish failed.');
    console.log('✓ Successfully published with --ttl 24h parameter.\n');
    fs.unlinkSync(testDocTtl);

    // Test 12: In-Browser Editor View & Live Preview
    console.log('[Test 12] In-Browser Editor View (/p/:id/edit)');
    const editorRes = await fetch(`${WORKER_URL}/p/${pub1.id}/edit`);
    const editorHtml = await editorRes.text();
    if (!editorHtml.includes('<textarea id="editor"') || !editorHtml.includes('Save Changes')) {
      throw new Error('In-browser editor HTML missing essential UI components.');
    }
    console.log(`✓ In-browser editor view verified (HTTP ${editorRes.status}, ${editorHtml.length} bytes).\n`);

    // Test 13: XSS Neutralization in Rendered Reader
    console.log('[Test 13] XSS Neutralization in Rendered Reader');
    const testDocXss = 'test-xss.md';
    fs.writeFileSync(
      testDocXss,
      `# Security Test

<script>alert("pwned")</script>
<img src=x onerror="alert('xss')">
<iframe src="javascript:alert(1)"></iframe>

[Valid Safe Link](https://agentpages.dev)
`
    );
    const pubXss = JSON.parse(runCli(`publish ${testDocXss} --json`).stdout);
    const htmlResXss = await fetch(pubXss.url);
    const htmlXss = await htmlResXss.text();
    const articleStart = htmlXss.indexOf('<article class="markdown-body">');
    const articleEnd = htmlXss.indexOf('</article>');
    const articleContent = htmlXss.slice(articleStart, articleEnd);

    if (
      articleContent.includes('<script') ||
      articleContent.includes('onerror=') ||
      articleContent.includes('<iframe') ||
      htmlXss.includes('alert("pwned")')
    ) {
      throw new Error('XSS payload was not sanitized in reader output!');
    }
    if (!htmlXss.includes('href="https://agentpages.dev"')) {
      throw new Error('Legitimate markdown links were erroneously stripped.');
    }
    console.log('✓ XSS scripts, error triggers, and iframes completely neutralized in public view.\n');
    fs.unlinkSync(testDocXss);

    // Test 14: Document Deletion and 404 Confirmation
    console.log('[Test 14] Document Deletion & Immediate 404 Confirmation');
    const delRes = JSON.parse(runCli(`delete ${pub1.id} --json`).stdout);
    if (delRes.status !== 'success') throw new Error('Delete returned unexpected response: ' + JSON.stringify(delRes));

    const postDelRes = await fetch(pub1.url);
    if (postDelRes.status !== 404) {
      throw new Error(`Expected HTTP 404 after deletion, received ${postDelRes.status}`);
    }
    console.log('✓ Document successfully deleted and immediately returned 404.\n');

    console.log('====================================================');
    console.log(' ALL 14 EXHAUSTIVE END-TO-END TESTS PASSED (100%)');
    console.log('====================================================\n');
  } finally {
    wrangler.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
