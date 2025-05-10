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
    const reportViewProvider = new ReportViewProvider(context.extensionUri);
    
    // Register the tree data provider for commits
    const commitExplorer = vscode.window.createTreeView('commitExplorer', {
        treeDataProvider: gitCommitProvider,
        showCollapseAll: true
    });
    
    // Register the webview provider for reports
    const reportViewProviderRegistration = vscode.window.registerWebviewViewProvider(
        'reportView',
        reportViewProvider,
        { webviewOptions: { retainContextWhenHidden: true } }
    );
    
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
            
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating AI Work Report",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Analyzing commits..." });
                
                // Use the AI-powered report generator
                await reportViewProvider.generateAIReport(commits);
                vscode.window.showInformationMessage('AI-powered work report generated!');
            });
        },
        'report-pilot.copyReport': async () => {
            await vscode.env.clipboard.writeText(reportViewProvider.getReportText());
            vscode.window.showInformationMessage('Work report copied to clipboard!');
        },
        'report-pilot.viewReportInEditor': async () => {
            const reportText = reportViewProvider.getReportText();
            if (!reportText) {
                vscode.window.showInformationMessage('No report has been generated yet.');
                return;
            }
            
            // Create a temporary document and show it
            const doc = await vscode.workspace.openTextDocument({
                content: reportText,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(doc, { preview: true });
        },
        'report-pilot.clearReport': async () => {
            reportViewProvider.clearReport();
            vscode.window.showInformationMessage('Report cleared. Ready to generate a new report.');
        }
    };
    
    // Register each command
    for (const [commandId, handler] of Object.entries(commands)) {
        const disposable = vscode.commands.registerCommand(commandId, handler);
        context.subscriptions.push(disposable);
    }
    
    // Register the webview view provider
    context.subscriptions.push(commitExplorer, reportViewProviderRegistration);
}