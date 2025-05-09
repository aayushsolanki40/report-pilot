import * as vscode from 'vscode';
import dayjs from 'dayjs';
import { CommitInfo, summarizeCommits, generateAIWorkReport } from '../utils/gitUtils';
import { generateOpenAIReport } from '../utils/aiUtils';

/**
 * Tree item representing a report section in the report view
 */
export class ReportSectionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly content: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        
        // Set tooltip to show content preview
        this.tooltip = content.substring(0, 100) + (content.length > 100 ? '...' : '');
        
        // Add document icon
        this.iconPath = new vscode.ThemeIcon('notebook');
        
        // Add a command to view the content when clicked
        this.command = {
            command: 'report-pilot.viewReportSection',
            title: 'View Report Section',
            arguments: [this.content]
        };
        
        // Add a description to show a preview
        this.description = content.split('\n')[0].substring(0, 30) + 
            (content.split('\n')[0].length > 30 ? '...' : '');
        
        // Enable context menu actions
        this.contextValue = 'reportSection';
    }
}

/**
 * Provider for the Report View TreeView
 */
export class ReportViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> = this._onDidChangeTreeData.event;
    
    private report: string = '';
    private reportSections: ReportSectionTreeItem[] = [];

    constructor() {}
    
    /**
     * Generate a report from commits
     */
    public generateReport(commits: CommitInfo[]): void {
        // Generate the report text
        this.report = summarizeCommits(commits);
        
        // Parse the report into sections based on markdown headings
        this.parseReportSections();
        
        // Notify the tree view to refresh
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Generate an AI-powered report from commits
     * This uses advanced analysis to categorize and summarize work
     */
    public async generateAIReport(commits: CommitInfo[]): Promise<void> {
        try {
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
                return; // User canceled
            }
            
            // Generate the report based on user selection
            if (aiOption.label === 'OpenAI (GPT)') {
                vscode.window.showInformationMessage('Generating report using OpenAI...');
                this.report = await generateOpenAIReport(commits);
            } else {
                // Use the built-in AI report generator
                this.report = generateAIWorkReport(commits);
            }
            
            // Parse the report into sections based on markdown headings
            this.parseReportSections();
            
            // Notify the tree view to refresh
            this._onDidChangeTreeData.fire(undefined);
        } catch (error) {
            vscode.window.showErrorMessage(`Error generating AI report: ${error}`);
            console.error('[Report Pilot] Error in generateAIReport:', error);
        }
    }
    
    /**
     * Parse the report text into sections based on markdown headings
     */
    private parseReportSections(): void {
        this.reportSections = [];
        
        if (!this.report || this.report.trim() === '') {
            console.log("[Report Pilot] No report content to parse");
            return;
        }
        
        console.log("[Report Pilot] Parsing report content");
        
        // Add overall summary item first
        this.reportSections.push(
            new ReportSectionTreeItem(
                'Full Report',
                this.report,
                vscode.TreeItemCollapsibleState.Collapsed
            )
        );
        
        // Split the report by heading lines (##)
        const lines = this.report.split('\n');
        let currentSection = '';
        let currentContent = '';
        let sectionStartIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith('## ')) {
                // If we were already processing a section, save it
                if (currentSection && currentContent) {
                    this.reportSections.push(
                        new ReportSectionTreeItem(
                            currentSection,
                            currentContent.trim(),
                            vscode.TreeItemCollapsibleState.Collapsed
                        )
                    );
                }
                
                // Start a new section
                currentSection = line.substring(3).trim();
                sectionStartIndex = i;
                currentContent = line + '\n';
            } else if (currentSection) {
                // Add line to current section content
                currentContent += line + '\n';
            }
        }
        
        // Add the last section if there is one
        if (currentSection && currentContent) {
            this.reportSections.push(
                new ReportSectionTreeItem(
                    currentSection,
                    currentContent.trim(),
                    vscode.TreeItemCollapsibleState.Collapsed
                )
            );
        }
        
        // Extract individual dates as sections (for daily reports)
        this.extractDateSections();
        
        console.log(`[Report Pilot] Parsed ${this.reportSections.length} report sections`);
    }
    
    /**
     * Extract date sections from the report content
     * This helps better organize the report by creating individual sections for each date
     */
    private extractDateSections(): void {
        // Look for ### level headings which typically represent dates in our reports
        const datePattern = /^### (\d{4}-\d{2}-\d{2})$/;
        const lines = this.report.split('\n');
        let currentDate = '';
        let currentContent = '';
        let inDateSection = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const dateMatch = line.match(datePattern);
            
            if (dateMatch) {
                // If we were already processing a date section, save it
                if (inDateSection && currentDate && currentContent) {
                    this.reportSections.push(
                        new ReportSectionTreeItem(
                            currentDate,
                            currentContent.trim(),
                            vscode.TreeItemCollapsibleState.Collapsed
                        )
                    );
                }
                
                // Start a new date section
                currentDate = dateMatch[1];
                currentContent = line + '\n';
                inDateSection = true;
            } else if (inDateSection) {
                if (line.startsWith('## ')) {
                    // End of date section if we hit a new major section
                    if (currentDate && currentContent) {
                        this.reportSections.push(
                            new ReportSectionTreeItem(
                                currentDate,
                                currentContent.trim(),
                                vscode.TreeItemCollapsibleState.Collapsed
                            )
                        );
                    }
                    inDateSection = false;
                    currentDate = '';
                    currentContent = '';
                } else {
                    // Continue current date section
                    currentContent += line + '\n';
                }
            }
        }
        
        // Add final date section if there is one
        if (inDateSection && currentDate && currentContent) {
            this.reportSections.push(
                new ReportSectionTreeItem(
                    currentDate,
                    currentContent.trim(),
                    vscode.TreeItemCollapsibleState.Collapsed
                )
            );
        }
    }
    
    /**
     * Get TreeItem representation of the element
     */
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }
    
    /**
     * Get the children of the element
     */
    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        // If no element is provided, return all report sections
        if (!element) {
            return this.reportSections;
        }
        
        // No children for report sections
        return [];
    }
    
    /**
     * Get the full report text
     */
    public getReportText(): string {
        return this.report;
    }
    
    /**
     * Show a preview of the report in a markdown editor
     */
    public async showReportPreview(): Promise<void> {
        if (!this.report) {
            vscode.window.showInformationMessage('No report has been generated yet.');
            return;
        }
        
        // Create a temporary document and show it
        const doc = await vscode.workspace.openTextDocument({
            content: this.report,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc, { preview: true });
    }
    
    /**
     * Copy the report text to clipboard
     */
    public async copyReportToClipboard(): Promise<void> {
        if (!this.report) {
            vscode.window.showInformationMessage('No report has been generated yet.');
            return;
        }
        
        // Copy to clipboard
        await vscode.env.clipboard.writeText(this.report);
        vscode.window.showInformationMessage('Work report copied to clipboard!');
    }
    
    /**
     * Clear the current report
     */
    public clearReport(): void {
        this.report = '';
        this.reportSections = [];
        this._onDidChangeTreeData.fire(undefined);
    }
}