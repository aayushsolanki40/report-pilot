// This file exports functions that define the commands available in the extension.

import * as vscode from 'vscode';
import { GitCommitProvider } from '../providers/gitCommitProvider';
import { ReportViewProvider } from '../providers/reportViewProvider';

/**
 * Register all commands for the extension
 * @param context The extension context
 */
export function registerCommands(context: vscode.ExtensionContext): void {
    // Create providers
    const gitCommitProvider = new GitCommitProvider();
    const reportViewProvider = new ReportViewProvider();
    
    // Register the tree data providers
    const commitExplorer = vscode.window.createTreeView('commitExplorer', {
        treeDataProvider: gitCommitProvider,
        showCollapseAll: true
    });
    
    const reportView = vscode.window.createTreeView('reportView', {
        treeDataProvider: reportViewProvider
    });
    
    // Register commands
    const commands: { [key: string]: (...args: any[]) => any } = {
        'report-pilot.showCommits': async () => {
            await gitCommitProvider.changeTimeSpan();
        },
        'report-pilot.refreshCommits': async () => {
            await gitCommitProvider.refreshCommits();
            vscode.window.showInformationMessage('Commits refreshed');
        },
        'report-pilot.generateReport': async () => {
            const commits = gitCommitProvider.getCommits();
            if (commits.length === 0) {
                vscode.window.showWarningMessage('No commits found for the selected time period.');
                return;
            }
            
            reportViewProvider.generateReport(commits);
            vscode.window.showInformationMessage('Work report generated!');
        },
        'report-pilot.copyReport': async () => {
            await reportViewProvider.copyReportToClipboard();
        },
        'report-pilot.viewReportInEditor': async () => {
            await reportViewProvider.showReportPreview();
        }
    };
    
    // Register each command
    for (const [commandId, handler] of Object.entries(commands)) {
        const disposable = vscode.commands.registerCommand(commandId, handler);
        context.subscriptions.push(disposable);
    }
    
    // Register the views
    context.subscriptions.push(commitExplorer, reportView);
}