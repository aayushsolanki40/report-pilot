// This file is the main entry point for the extension. It activates the extension and registers commands and event listeners.

import * as vscode from 'vscode';
import { registerCommands } from './commands/index';

/**
 * This method is called when the extension is activated
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
    // Register commands, views, and providers
    registerCommands(context);

    // Show status bar message when activated
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(git-commit) Report Pilot';
    statusBarItem.tooltip = 'Click to generate a work report from your commits';
    statusBarItem.command = 'report-pilot.generateReport';
    statusBarItem.show();
    
    // Add the status bar item to the disposables
    context.subscriptions.push(statusBarItem);
    
    console.log('Report Pilot extension is now active.');
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {
    console.log('Report Pilot extension is now deactivated.');
}