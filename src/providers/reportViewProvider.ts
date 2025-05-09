import * as vscode from 'vscode';
import dayjs from 'dayjs';
import { CommitInfo, summarizeCommits } from '../utils/gitUtils';

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
     * Parse the report text into sections based on markdown headings
     */
    private parseReportSections(): void {
        this.reportSections = [];
        
        if (!this.report) {
            return;
        }
        
        // Split the report by heading lines (##)
        const lines = this.report.split('\n');
        let currentSection = '';
        let currentContent = '';
        
        for (const line of lines) {
            if (line.startsWith('## ')) {
                // If we were already processing a section, save it
                if (currentSection) {
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
                currentContent = line + '\n';
            } else {
                // Add line to current section content
                currentContent += line + '\n';
            }
        }
        
        // Add the last section if there is one
        if (currentSection) {
            this.reportSections.push(
                new ReportSectionTreeItem(
                    currentSection,
                    currentContent.trim(),
                    vscode.TreeItemCollapsibleState.Collapsed
                )
            );
        }
        
        // Add overall summary item
        if (this.reportSections.length > 0) {
            this.reportSections.unshift(
                new ReportSectionTreeItem(
                    'Full Report',
                    this.report,
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