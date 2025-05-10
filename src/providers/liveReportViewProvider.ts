import * as vscode from 'vscode';
import dayjs from 'dayjs';
import { CommitInfo, generateAIWorkReport } from '../utils/gitUtils';
import { generateOpenAIReport } from '../utils/aiUtils';

/**
 * Provider for the Live Report View
 * This provider embeds a webview directly in the view container
 * to show a live-updating report
 */
export class LiveReportViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'liveReportView';

    private _view?: vscode.WebviewView;
    private _report: string = '';
    private _isGenerating: boolean = false;
    private _pendingReportGeneration: boolean = false;
    private _pendingCommits?: CommitInfo[];

    constructor(private readonly _extensionUri: vscode.Uri) {}

    /**
     * Set a pending report generation request that will be processed
     * when the view becomes visible
     */
    public setPendingReportGeneration(commits: CommitInfo[]): void {
        console.log('[Report Pilot] Setting pending report generation');
        this._pendingReportGeneration = true;
        this._pendingCommits = commits;
    }
    
    /**
     * Check if the view is currently available
     */
    public isViewReady(): boolean {
        return !!this._view;
    }

    /**
     * Called when the view is first created or becomes visible again
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        console.log('[Report Pilot] Resolving webview view');
        this._view = webviewView;

        // Set options for the webview
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // Set the initial HTML content
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            console.log(`[Report Pilot] Received message from webview: ${message.command}`);
            switch (message.command) {
                case 'generateReport':
                    // User clicked the generate report button in the webview
                    vscode.commands.executeCommand('report-pilot.generateReport');
                    break;
                
                case 'copyReport':
                    this.copyReportToClipboard();
                    break;
                
                case 'debug':
                    console.log(`[Report Pilot] Webview debug: ${message.text}`);
                    break;
                    
                case 'webviewReady':
                    console.log('[Report Pilot] Webview reported it is ready');
                    this._processWebviewReady();
                    break;
            }
        });
        
        console.log('[Report Pilot] Sending ready message to webview');
        webviewView.webview.postMessage({ command: 'ready' });

        // Check if there's a pending report generation request
        // This is the critical part - we process pending reports as soon as the view is created
        if (this._pendingReportGeneration && this._pendingCommits) {
            console.log('[Report Pilot] Found pending report generation request during webview initialization');
            
            // Store commits locally so we don't lose them
            const commits = [...this._pendingCommits];
            
            // Clear pending flags to avoid duplicate generation
            this._pendingReportGeneration = false;
            this._pendingCommits = undefined;
            
            // Use setTimeout to ensure the webview is fully initialized
            setTimeout(() => {
                console.log('[Report Pilot] Executing pending report generation after view initialization');
                this.generateReport(commits).catch(error => {
                    console.error('[Report Pilot] Error generating pending report:', error);
                });
            }, 500);
        }

        // Handle disposal
        webviewView.onDidDispose(() => {
            console.log('[Report Pilot] Webview disposed');
            this._view = undefined;
        });
    }
    
    /**
     * Process any pending report generation when the webview is ready
     */
    private _processWebviewReady(): void {
        // Check if there's a pending report generation request
        if (this._pendingReportGeneration && this._pendingCommits) {
            console.log('[Report Pilot] Processing pending report request after webview is ready');
            
            // Store the commits locally before clearing the pending flags
            const commits = [...this._pendingCommits];
            
            // Clear pending flags
            this._pendingReportGeneration = false;
            this._pendingCommits = undefined;
            
            // Use setTimeout to ensure the webview is fully initialized
            setTimeout(() => {
                if (this._view) {
                    console.log('[Report Pilot] Starting pending report generation');
                    this.generateReport(commits);
                } else {
                    console.log('[Report Pilot] View no longer available for pending report');
                }
            }, 300);
        }
    }

    /**
     * Generate an AI-powered report from commits with live updates
     */
    public async generateReport(commits: CommitInfo[]): Promise<void> {
        console.log(`[Report Pilot] Generate report called with ${commits.length} commits`);
        
        // Prevent multiple report generations at the same time
        if (this._isGenerating) {
            console.log('[Report Pilot] Report generation already in progress');
            vscode.window.showInformationMessage('A report is already being generated, please wait.');
            return;
        }
        
        // If view is not available, we need to create it and initialize it
        if (!this._view) {
            console.log('[Report Pilot] View not available, attempting to initialize it');
            
            // Store the commits for later generation
            this._pendingCommits = commits;
            this._pendingReportGeneration = true;
            
            // Show the Report Pilot view container
            await vscode.commands.executeCommand('workbench.view.extension.report-pilot');
            
            // Show a notification with a direct action to open the Live Report view
            const selection = await vscode.window.showInformationMessage(
                'Click the Live Report tab to generate your report',
                'Generate Now'
            );
            
            if (selection === 'Generate Now') {
                // Try to force the view to be visible
                try {
                    console.log('[Report Pilot] Generate Now clicked, forcing view creation');
                    
                    // First focus on the Report Pilot view container
                    await vscode.commands.executeCommand('workbench.view.extension.report-pilot');
                    
                    // The correct command format is simply 'workbench.view.extension.report-pilot'
                    // We don't need to try to focus the specific view, just make the container visible
                    
                    // Show a progress notification to indicate we're working on it
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Initializing Live Report view",
                        cancellable: false
                    }, async (progress) => {
                        // Try multiple times to wait for the view to become available
                        for (let attempt = 0; attempt < 10; attempt++) {
                            progress.report({ message: `Please wait (${attempt + 1}/10)...` });
                            
                            // Wait a bit for the view to initialize
                            await new Promise(resolve => setTimeout(resolve, 300));
                            
                            // Check if the view is now available
                            if (this._view) {
                                console.log('[Report Pilot] View has been initialized, can proceed with report generation');
                                break;
                            }
                        }
                        
                        // Final wait to ensure everything is ready
                        return new Promise(resolve => setTimeout(resolve, 200));
                    });
                    
                    // If view is now available, we can proceed with report generation
                    if (this._view) {
                        console.log('[Report Pilot] View is now available, continuing with direct report generation');
                        // We'll fall through to the report generation code below
                    } else {
                        // Create a notification with instructions to manually click the tab
                        vscode.window.showInformationMessage(
                            'Please click on the "Live Report" tab in the Report Pilot view panel to see your report.'
                        );
                        
                        console.log('[Report Pilot] View still not available after attempts, relying on pending generation');
                        return; // The pending report will be generated when the view is actually created
                    }
                } catch (error) {
                    console.error('[Report Pilot] Error focusing view:', error);
                    vscode.window.showErrorMessage('Error opening report view. Please click on the Live Report tab manually.');
                    return;
                }
            } else {
                // User didn't click "Generate Now", so we'll wait for them to click the tab
                console.log('[Report Pilot] Waiting for user to click the Live Report tab');
                return;
            }
        }
        
        // If we reach here, the view should be available
        if (!this._view) {
            console.error('[Report Pilot] View still not available even after initialization attempts');
            vscode.window.showErrorMessage('Could not initialize report view. Please try again.');
            return;
        }
        
        // View is now available, proceed with generation
        this._isGenerating = true;
        
        try {
            // Show the "generating" state in the webview immediately
            console.log('[Report Pilot] Sending startGenerating message to webview');
            this._view.webview.postMessage({ command: 'startGenerating' });
            
            // Clear previous report
            this._report = '';
            
            // Start with report header including generation date
            const currentDate = dayjs().format('YYYY-MM-DD HH:mm:ss');
            const reportHeader = `# Work Report\nGenerated on: ${currentDate}\n\n`;
            
            // Update the webview with the header right away
            await this._updateReport(reportHeader);
            this._report = reportHeader;
            
            // Generate the report using the built-in AI report generator
            console.log('[Report Pilot] Starting report generation');
            const sections = this._generateLocalAIReportSections(commits);
            console.log(`[Report Pilot] Generated ${sections.length} report sections`);
            
            for (const section of sections) {
                this._report += section;
                await this._updateReport(this._report);
                
                // Simulate streaming with a short delay
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Complete the report generation in the UI
            if (this._view) {
                console.log('[Report Pilot] Finishing report generation');
                this._view.webview.postMessage({ command: 'finishGenerating' });
            } else {
                console.log('[Report Pilot] View no longer available at completion');
            }
            
        } catch (error) {
            vscode.window.showErrorMessage(`Error generating AI report: ${error}`);
            console.error('[Report Pilot] Error in generateReport:', error);
            if (this._view) {
                this._view.webview.postMessage({ 
                    command: 'error', 
                    message: `Error generating report: ${error}` 
                });
            }
        } finally {
            this._isGenerating = false;
        }
    }
    
    /**
     * Update the report content in the webview
     */
    private async _updateReport(content: string): Promise<void> {
        if (!this._view) {
            console.log('[Report Pilot] Cannot update report: View not available');
            return;
        }
        
        try {
            this._view.webview.postMessage({
                command: 'updateReport',
                content: content
            });
        } catch (error) {
            console.error('[Report Pilot] Error updating report in webview:', error);
        }
    }
    
    /**
     * Generate local AI report in sections for streaming
     */
    private _generateLocalAIReportSections(commits: CommitInfo[]): string[] {
        // Get full report
        console.log('[Report Pilot] Calling generateAIWorkReport');
        const report = generateAIWorkReport(commits);
        
        // Split the report into logical sections for streaming
        const sections: string[] = [];
        const lines = report.split('\n');
        let currentSection = '';
        
        for (const line of lines) {
            // Start a new section when we hit a heading
            if (line.startsWith('## ') && currentSection) {
                sections.push(currentSection);
                currentSection = line + '\n';
            } else {
                currentSection += line + '\n';
            }
            
            // Also split on paragraph breaks to get more granular streaming
            if (line === '' && currentSection.length > 100) {
                sections.push(currentSection);
                currentSection = '';
            }
        }
        
        if (currentSection) {
            sections.push(currentSection);
        }
        
        return sections;
    }
    
    /**
     * Copy the report text to clipboard
     */
    public async copyReportToClipboard(): Promise<void> {
        if (!this._report) {
            vscode.window.showInformationMessage('No report has been generated yet.');
            return;
        }
        
        await vscode.env.clipboard.writeText(this._report);
        vscode.window.showInformationMessage('Work report copied to clipboard!');
        
        // Update UI to show the report was copied
        if (this._view) {
            this._view.webview.postMessage({ command: 'reportCopied' });
        }
    }
    
    /**
     * Get the HTML content for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Report Pilot</title>
            <style>
                body {
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    padding: 0 12px;
                    line-height: 1.5;
                    color: var(--vscode-editor-foreground);
                }
                h1 { 
                    font-size: 1.3em; 
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 5px;
                    margin-top: 10px;
                }
                h2 { font-size: 1.1em; margin-top: 15px; }
                h3 { font-size: 1em; margin-top: 10px; }
                .loading {
                    display: flex;
                    align-items: center;
                    margin: 15px 0;
                }
                .loading-spinner {
                    border: 3px solid rgba(0, 0, 0, 0.1);
                    border-left-color: var(--vscode-button-background);
                    border-radius: 50%;
                    width: 16px;
                    height: 16px;
                    animation: spin 1s linear infinite;
                    margin-right: 10px;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                #report-content {
                    margin-top: 15px;
                    overflow-wrap: break-word;
                }
                .date-generated {
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    margin-bottom: 15px;
                    font-size: 0.9em;
                }
                pre {
                    background: var(--vscode-textCodeBlock-background);
                    padding: 8px;
                    border-radius: 3px;
                    overflow: auto;
                    font-size: 0.9em;
                }
                code {
                    font-family: var(--vscode-editor-font-family);
                    font-size: 0.9em;
                }
                ul {
                    padding-left: 20px;
                }
                .message {
                    margin: 15px 0;
                    padding: 8px;
                    border-radius: 3px;
                }
                .welcome {
                    text-align: center;
                    margin: 20px 0;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 2px;
                    cursor: pointer;
                    margin-top: 10px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .copy-btn {
                    opacity: 0.7;
                    background: var(--vscode-button-secondaryBackground);
                }
                .copy-btn:hover {
                    opacity: 1;
                }
                .actions-bar {
                    display: flex;
                    justify-content: space-between;
                    margin: 15px 0;
                    padding-top: 10px;
                    border-top: 1px solid var(--vscode-panel-border);
                }
                .hidden {
                    display: none;
                }
                .debug-info {
                    margin-top: 20px;
                    font-size: 0.8em;
                    color: #888;
                }
                .button-icon {
                    margin-right: 6px;
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    vertical-align: text-bottom;
                }
                
                .refresh-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .refresh-icon {
                    display: inline-block;
                    width: 14px;
                    height: 14px;
                    margin-right: 6px;
                    animation: none;
                }
                
                .refresh-icon svg {
                    fill: currentColor;
                }
                
                .refresh-icon.spinning {
                    animation: spin 1s linear infinite;
                }

                .report-container {
                    position: relative;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 16px;
                    margin-top: 20px;
                }

                .report-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }

                .report-title {
                    font-size: 1.2em;
                    font-weight: bold;
                    margin: 0;
                }

                .report-actions {
                    display: flex;
                    gap: 8px;
                }

                .report-button {
                    padding: 4px 8px;
                    font-size: 12px;
                }
                
                .report-content-wrapper {
                    max-height: calc(100vh - 200px);
                    overflow-y: auto;
                    padding-right: 5px;
                }
            </style>
        </head>
        <body>
            <div id="welcome-view">
                <div class="welcome">
                    <h2>Work Report Generator</h2>
                    <p>Generate a detailed work report based on your Git commits.</p>
                    <button id="generate-btn" class="refresh-btn">
                        <span class="refresh-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                            </svg>
                        </span>
                        Generate Report
                    </button>
                </div>
            </div>
            
            <div id="report-view" class="hidden">
                <div class="loading hidden" id="loading">
                    <div class="loading-spinner"></div>
                    <div>Generating report...</div>
                </div>
                
                <div id="report-container" class="report-container hidden">
                    <div class="report-header">
                        <h3 class="report-title">Work Report</h3>
                        <div class="report-actions">
                            <button id="refresh-report-btn" class="report-button refresh-btn" title="Refresh Report">
                                <span class="refresh-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24">
                                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                                    </svg>
                                </span>
                                Refresh
                            </button>
                            <button id="copy-report-btn" class="report-button" title="Copy to Clipboard">Copy</button>
                        </div>
                    </div>
                    <div class="report-content-wrapper">
                        <div id="report-content" class="markdown-body"></div>
                    </div>
                </div>
            </div>

            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    const welcomeView = document.getElementById('welcome-view');
                    const reportView = document.getElementById('report-view');
                    const reportContainer = document.getElementById('report-container');
                    const reportContent = document.getElementById('report-content');
                    const loading = document.getElementById('loading');
                    const generateBtn = document.getElementById('generate-btn');
                    const refreshReportBtn = document.getElementById('refresh-report-btn');
                    const copyReportBtn = document.getElementById('copy-report-btn');
                    
                    // Debug info
                    function debugLog(message) {
                        console.log("[Report Pilot WebView] " + message);
                        vscode.postMessage({
                            command: 'debug',
                            text: message
                        });
                    }
                    
                    // Add event listeners
                    debugLog("Setting up event listeners");
                    
                    generateBtn.addEventListener('click', () => {
                        debugLog("Generate button clicked");
                        vscode.postMessage({
                            command: 'generateReport'
                        });
                    });
                    
                    refreshReportBtn.addEventListener('click', () => {
                        debugLog("Refresh report button clicked");
                        // Show spinning animation on refresh icon
                        const refreshIcon = refreshReportBtn.querySelector('.refresh-icon');
                        refreshIcon.classList.add('spinning');
                        
                        // Hide report container and show loading indicator
                        reportContainer.classList.add('hidden');
                        loading.classList.remove('hidden');
                        
                        vscode.postMessage({
                            command: 'generateReport'
                        });
                    });
                    
                    copyReportBtn.addEventListener('click', () => {
                        debugLog("Copy button clicked");
                        vscode.postMessage({
                            command: 'copyReport'
                        });
                    });
                    
                    // Send ready signal
                    debugLog("Webview initialized, sending ready signal");
                    vscode.postMessage({ command: 'webviewReady' });
                    
                    // Listen for messages from the extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        debugLog("Received message: " + message.command);
                        
                        switch (message.command) {
                            case 'ready':
                                debugLog("Extension sent ready signal");
                                break;
                                
                            case 'startGenerating':
                                // Show generating UI
                                debugLog("Starting report generation");
                                welcomeView.classList.add('hidden');
                                reportView.classList.remove('hidden');
                                reportContainer.classList.add('hidden');
                                loading.classList.remove('hidden');
                                reportContent.innerHTML = '';
                                break;
                                
                            case 'updateReport':
                                // Update report content with markdown
                                debugLog("Updating report content");
                                reportContent.innerHTML = markdownToHtml(message.content);
                                break;
                                
                            case 'finishGenerating':
                                // Hide loading UI and show report
                                debugLog("Finishing report generation");
                                loading.classList.add('hidden');
                                reportContainer.classList.remove('hidden');
                                
                                // Reset the refresh icon if it was spinning
                                const refreshIcon = refreshReportBtn.querySelector('.refresh-icon');
                                refreshIcon.classList.remove('spinning');
                                break;
                                
                            case 'reportCopied':
                                debugLog("Report copied to clipboard");
                                copyReportBtn.textContent = 'Copied!';
                                setTimeout(() => {
                                    copyReportBtn.textContent = 'Copy';
                                }, 2000);
                                break;
                                
                            case 'error':
                                // Show error UI
                                debugLog("Error: " + message.message);
                                loading.classList.add('hidden');
                                reportContainer.classList.remove('hidden');
                                reportContent.innerHTML = '<div class="message error">Error generating report. Please try again.</div>';
                                reportContent.innerHTML += '<div class="error-details">' + message.message + '</div>';
                                
                                // Reset the refresh icon if it was spinning
                                const errorRefreshIcon = refreshReportBtn.querySelector('.refresh-icon');
                                errorRefreshIcon.classList.remove('spinning');
                                break;
                        }
                    });
                    
                    // Basic markdown to HTML converter
                    function markdownToHtml(markdown) {
                        let html = '';
                        const lines = markdown.split('\\n');
                        let inList = false;
                        
                        for (const line of lines) {
                            // Handle headings
                            if (line.startsWith('# ')) {
                                html += '<h1>' + line.substring(2) + '</h1>\\n';
                            }
                            else if (line.startsWith('## ')) {
                                html += '<h2>' + line.substring(3) + '</h2>\\n';
                            }
                            else if (line.startsWith('### ')) {
                                html += '<h3>' + line.substring(4) + '</h3>\\n';
                            }
                            // Handle list items
                            else if (line.startsWith('- ')) {
                                if (!inList) {
                                    html += '<ul>\\n';
                                    inList = true;
                                }
                                html += '<li>' + line.substring(2) + '</li>\\n';
                            }
                            else if (line.trim() === '' && inList) {
                                html += '</ul>\\n';
                                inList = false;
                                html += '<p></p>\\n';
                            }
                            // Handle bold text
                            else if (line.includes('**')) {
                                let processedLine = line.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
                                html += '<p>' + processedLine + '</p>\\n';
                            }
                            // Regular paragraphs
                            else if (line.trim() !== '') {
                                html += '<p>' + line + '</p>\\n';
                            }
                            else {
                                html += '<p></p>\\n';
                            }
                        }
                        
                        // Close any open lists
                        if (inList) {
                            html += '</ul>\\n';
                        }
                        
                        return html;
                    }
                })();
            </script>
        </body>
        </html>`;
    }
}