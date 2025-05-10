import * as vscode from 'vscode';
import dayjs from 'dayjs';
import { CommitInfo, generateAIWorkReport } from '../utils/gitUtils';
import { generateOpenAIReport } from '../utils/aiUtils';

/**
 * WebView provider for rendering Work Reports directly in HTML
 */
export class ReportViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _report: string = '';
    private _isGenerating: boolean = false;
    
    constructor(private readonly _extensionUri: vscode.Uri) {}
    
    /**
     * Called when the view becomes visible
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        
        // Set options for the webview
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        
        // Initialize the webview with the generate button
        this._updateWebviewContent();
        
        // Set up message handling for the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'generateReport':
                    // Delegate to the command handler
                    vscode.commands.executeCommand('report-pilot.generateReport');
                    break;
                
                case 'copyReport':
                    await vscode.env.clipboard.writeText(this._report);
                    vscode.window.showInformationMessage('Work report copied to clipboard!');
                    break;
                
                case 'openInEditor':
                    // Create a temporary document and show it
                    const doc = await vscode.workspace.openTextDocument({
                        content: this._report,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(doc, { preview: true });
                    break;
                
                case 'newReport':
                    this.clearReport();
                    break;
            }
        });
    }
    
    /**
     * Update the webview content - either showing the generate button or the report
     */
    private _updateWebviewContent() {
        if (!this._view) {
            return;
        }
        
        // Generate the HTML content
        const webview = this._view.webview;
        webview.html = this._getHtmlForWebview(webview);
    }
    
    /**
     * Generate the HTML for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // If we have a report, show it, otherwise show the generate button
        if (this._report) {
            return this._getReportHtml();
        } else {
            return this._getGenerateButtonHtml();
        }
    }
    
    /**
     * Generate HTML for the generate button
     */
    private _getGenerateButtonHtml(): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Work Report</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-editor-foreground);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .generate-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    font-size: 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 20px;
                }
                .generate-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .icon {
                    font-size: 16px;
                }
                .description {
                    margin-bottom: 20px;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="description">
                <p>Generate a comprehensive work report based on your Git commits.</p>
                <p>The report will include all work completed with dates.</p>
            </div>
            <button class="generate-button" id="generateBtn">
                <span class="icon">▶</span>
                Generate Report
            </button>
            
            <script>
                const vscode = acquireVsCodeApi();
                document.getElementById('generateBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'generateReport'
                    });
                });
            </script>
        </body>
        </html>`;
    }
    
    /**
     * Generate HTML for showing "generating" state
     */
    private _getGeneratingHtml(): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Work Report</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-editor-foreground);
                }
                .loader {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 40px 0;
                }
                .loader-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: var(--vscode-editor-foreground);
                    margin: 0 4px;
                    animation: pulse 1.5s infinite ease-in-out;
                }
                .loader-dot:nth-child(2) {
                    animation-delay: 0.2s;
                }
                .loader-dot:nth-child(3) {
                    animation-delay: 0.4s;
                }
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(0.7);
                        opacity: 0.5;
                    }
                    50% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                .generating-text {
                    text-align: center;
                    font-size: 16px;
                }
            </style>
        </head>
        <body>
            <div class="generating-text">Generating report...</div>
            <div class="loader">
                <div class="loader-dot"></div>
                <div class="loader-dot"></div>
                <div class="loader-dot"></div>
            </div>
        </body>
        </html>`;
    }
    
    /**
     * Generate HTML for the report content
     */
    private _getReportHtml(): string {
        const currentDate = dayjs().format('YYYY-MM-DD');
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Work Report</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-editor-foreground);
                    max-width: 100%;
                }
                .report-title {
                    font-size: 22px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                .report-date {
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 20px;
                }
                .report-content {
                    font-size: 14px;
                    line-height: 1.6;
                    white-space: pre-wrap;
                }
                h2 {
                    margin-top: 20px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 4px;
                }
                ul {
                    padding-left: 20px;
                }
                .actions {
                    margin-top: 30px;
                    display: flex;
                    gap: 10px;
                }
                .action-button {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                }
                .action-button:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .new-report-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .new-report-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="report-title">Work Report</div>
            <div class="report-date">Generated on: ${currentDate}</div>
            <div class="report-content">${this._formatReportContent(this._report)}</div>
            
            <div class="actions">
                <button class="action-button new-report-button" id="newReportBtn">New Report</button>
                <button class="action-button" id="copyReportBtn">Copy to Clipboard</button>
                <button class="action-button" id="openEditorBtn">Open in Editor</button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                // New report button
                document.getElementById('newReportBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'newReport'
                    });
                });
                
                // Copy report button
                document.getElementById('copyReportBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'copyReport'
                    });
                });
                
                // Open in editor button
                document.getElementById('openEditorBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'openInEditor'
                    });
                });
            </script>
        </body>
        </html>`;
    }
    
    /**
     * Format the report content with proper HTML formatting
     */
    private _formatReportContent(content: string): string {
        // Convert markdown-style content to HTML
        let formatted = content
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/- (.*$)/gm, '<li>$1</li>')
            .replace(/<li>(.*)<\/li>/gm, function(match) {
                return '<ul>' + match + '</ul>';
            })
            .replace(/<\/ul>\s*<ul>/g, '')
            .replace(/\n\n/g, '<br><br>');
            
        return formatted;
    }
    
    /**
     * Show the generating UI
     */
    public showGeneratingUI() {
        if (!this._view) {
            return;
        }
        
        this._view.webview.html = this._getGeneratingHtml();
        this._isGenerating = true;
    }
    
    /**
     * Generate a report from commits
     */
    public generateReport(commits: CommitInfo[]): void {
        // Call the AI report generator
        this.generateAIReport(commits);
    }

    /**
     * Generate an AI-powered report from commits with streaming updates
     */
    public async generateAIReport(commits: CommitInfo[]): Promise<void> {
        // Generate a consistent date format for both methods
        const currentDate = dayjs().format('YYYY-MM-DD HH:mm:ss');
        const reportHeader = `# Work Report\nGenerated on: ${currentDate}\n\n`;

        try {
            // Prevent multiple report generations at the same time
            if (this._isGenerating && !this._view) {
                vscode.window.showInformationMessage('A report is already being generated, please wait.');
                return;
            }

            this._isGenerating = true;
            this.showGeneratingUI();
            
            // Ask user which AI model to use
            const aiOption = await vscode.window.showQuickPick(
                [
                    { label: 'OpenAI (GPT)', description: 'Generate report using OpenAI API (requires API key)', detail: 'More detailed and insightful reports' },
                    { label: 'Local AI', description: 'Generate report using local code analysis', detail: 'Works offline, no API key needed' }
                ],
                { 
                    placeHolder: 'Choose AI model for report generation'
                }
            );
            
            if (!aiOption) {
                // User canceled - restore the button
                this._isGenerating = false;
                this._updateWebviewContent();
                return;
            }
            
            // Start with header in both cases
            this._report = '';
            this._updateWebviewContent(); // Show the report header immediately
            
            // Generate the report based on user selection
            if (aiOption.label === 'OpenAI (GPT)') {
                try {
                    // Generate with OpenAI
                    const fullReport = await generateOpenAIReport(commits);
                    
                    // Stream the report content in chunks
                    const chunks = this._chunkReportForStreaming(fullReport);
                    for (const chunk of chunks) {
                        this._report += chunk;
                        this._updateWebviewContent();
                        
                        // Small delay to simulate streaming
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                } catch (openaiError) {
                    vscode.window.showErrorMessage(`Error with OpenAI: ${openaiError}`);
                    this._report += `\n\nError generating OpenAI report: ${openaiError}`;
                    this._updateWebviewContent();
                }
            } else {
                // Generate with local AI and stream it
                const fullReport = generateAIWorkReport(commits);
                
                // Stream the report content in chunks
                const chunks = this._chunkReportForStreaming(fullReport);
                for (const chunk of chunks) {
                    this._report += chunk;
                    this._updateWebviewContent();
                    
                    // Small delay to simulate streaming
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // Add a final completion message
            this._report += `\n\n_Report generation completed at ${dayjs().format('HH:mm:ss')}_`;
            this._updateWebviewContent();
            
        } catch (error) {
            vscode.window.showErrorMessage(`Error generating AI report: ${error}`);
            console.error('[Report Pilot] Error in generateAIReport:', error);
            this._report = `Error generating report: ${error}`;
            this._updateWebviewContent();
        } finally {
            this._isGenerating = false;
        }
    }
    
    /**
     * Break a report into chunks for streaming display
     */
    private _chunkReportForStreaming(report: string): string[] {
        // Split by sections (## headers) or by lines
        const sections: string[] = [];
        const lines = report.split('\n');
        let currentSection = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // If we hit a header, start a new section
            if (line.startsWith('## ') && currentSection) {
                sections.push(currentSection);
                currentSection = line + '\n';
            } else {
                currentSection += line + '\n';
            }
            
            // Also break on paragraphs to get more fine-grained streaming
            if (line === '' && currentSection.length > 50) {
                sections.push(currentSection);
                currentSection = '';
            }
            
            // Break very long sections
            if (currentSection.length > 200) {
                sections.push(currentSection);
                currentSection = '';
            }
        }
        
        // Add any remaining content
        if (currentSection) {
            sections.push(currentSection);
        }
        
        return sections;
    }

    /**
     * Get the full report text
     */
    public getReportText(): string {
        return this._report;
    }
    
    /**
     * Clear the current report and show the Generate button again
     */
    public clearReport(): void {
        this._report = '';
        this._updateWebviewContent();
    }
}