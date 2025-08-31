import * as vscode from 'vscode';

/**
 * Service for handling markdown text formatting operations.
 * Provides methods for applying bold, italic, and header formatting.
 */
export class FormattingService {
    
  /**
     * Formats selected text as bold or removes bold formatting if already bold.
     * @param editor The active text editor
     */
  public static formatBold(editor: vscode.TextEditor): void {
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
        
    if (selectedText.length === 0) {
      // No selection - insert bold markers and place cursor between them
      const position = selection.active;
      editor.edit(editBuilder => {
        editBuilder.insert(position, '****');
      }).then(() => {
        // Move cursor to between the asterisks
        const newPosition = position.translate(0, 2);
        editor.selection = new vscode.Selection(newPosition, newPosition);
      });
    } else {
      // Text is selected - toggle bold formatting
      if (this.isBold(selectedText)) {
        // Remove bold formatting
        const unboldText = selectedText.replace(/^\*\*(.*)\*\*$/, '$1');
        editor.edit(editBuilder => {
          editBuilder.replace(selection, unboldText);
        });
      } else {
        // Add bold formatting
        const boldText = `**${selectedText}**`;
        editor.edit(editBuilder => {
          editBuilder.replace(selection, boldText);
        });
      }
    }
  }
    
  /**
     * Formats selected text as italic or removes italic formatting if already italic.
     * @param editor The active text editor
     */
  public static formatItalic(editor: vscode.TextEditor): void {
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
        
    if (selectedText.length === 0) {
      // No selection - insert italic markers and place cursor between them
      const position = selection.active;
      editor.edit(editBuilder => {
        editBuilder.insert(position, '**');
      }).then(() => {
        // Move cursor to between the asterisks
        const newPosition = position.translate(0, 1);
        editor.selection = new vscode.Selection(newPosition, newPosition);
      });
    } else {
      // Text is selected - toggle italic formatting
      if (this.isItalic(selectedText)) {
        // Remove italic formatting
        const unitalicText = selectedText.replace(/^\*(.*)\*$/, '$1');
        editor.edit(editBuilder => {
          editBuilder.replace(selection, unitalicText);
        });
      } else {
        // Add italic formatting
        const italicText = `*${selectedText}*`;
        editor.edit(editBuilder => {
          editBuilder.replace(selection, italicText);
        });
      }
    }
  }
    
  /**
     * Cycles through header levels for the current line: No header -> H1 -> H2 -> H3 -> No header.
     * @param editor The active text editor
     */
  public static formatHeader(editor: vscode.TextEditor): void {
    const selection = editor.selection;
    const line = editor.document.lineAt(selection.active.line);
    const lineText = line.text;
        
    let newText: string;
    const headerMatch = lineText.match(/^(#{1,3})\s+(.*)$/);
        
    if (!headerMatch) {
      // No header - make it H1
      newText = `# ${lineText.trim()}`;
    } else {
      const headerLevel = headerMatch[1].length;
      const content = headerMatch[2];
            
      if (headerLevel === 1) {
        // H1 -> H2
        newText = `## ${content}`;
      } else if (headerLevel === 2) {
        // H2 -> H3
        newText = `### ${content}`;
      } else {
        // H3 -> No header
        newText = content;
      }
    }
        
    editor.edit(editBuilder => {
      editBuilder.replace(line.range, newText);
    });
  }
    
  /**
     * Checks if the given text is formatted as bold.
     * @param text Text to check
     * @returns True if text is wrapped in ** markers
     */
  private static isBold(text: string): boolean {
    return /^\*\*.*\*\*$/.test(text);
  }
    
  /**
     * Checks if the given text is formatted as italic.
     * @param text Text to check
     * @returns True if text is wrapped in * markers
     */
  private static isItalic(text: string): boolean {
    return /^\*.*\*$/.test(text) && !this.isBold(text);
  }
}