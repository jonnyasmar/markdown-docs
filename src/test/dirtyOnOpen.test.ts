/* eslint-disable no-console */
import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

// Helper: delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

suite('Dirty-on-open regression', () => {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.resolve(__dirname, '../../..');

  const openWithCustomEditor = async (relativePath: string): Promise<vscode.TextDocument> => {
    const full = path.join(workspaceRoot, relativePath);
    const uri = vscode.Uri.file(full);

    // Ensure document is closed/clean start
    const existing = vscode.workspace.textDocuments.find(d => d.uri.fsPath === full);
    if (existing) {
      await vscode.window.showTextDocument(existing);
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }

    // Open the document to ensure VS Code has a TextDocument
    const doc = await vscode.workspace.openTextDocument(uri);

    // Open with our custom editor view
    await vscode.commands.executeCommand('vscode.openWith', uri, 'markdown-docs.editor');

    return doc;
  };

  test('example.md does not become dirty on open', async () => {
    const doc = await openWithCustomEditor('example.md');

    // Give the webview/editor time to initialize and possibly send spurious edits
    await sleep(1500);

    assert.strictEqual(doc.isDirty, false, 'Document became dirty on open (example.md)');
  });

  test('README.md does not become dirty on open', async () => {
    const doc = await openWithCustomEditor('README.md');

    await sleep(1500);

    assert.strictEqual(doc.isDirty, false, 'Document became dirty on open (README.md)');
  });
});

